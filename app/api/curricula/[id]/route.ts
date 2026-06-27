import { NextRequest, NextResponse } from 'next/server';
import { getSession, getInternalUserId } from '@/lib/auth';
import { sql, logAuditEvent, validateUUID } from '@/lib/db';

const MANAGE_ROLES = ['owner', 'admin', 'supervisor'];

async function getCtx() {
    const session = await getSession();
    if (!session?.user?.id) return { error: 'Unauthorized', status: 401 as const };
    const userId = await getInternalUserId(session.user.id, session.user.email);
    if (!userId) return { error: 'User not found', status: 404 as const };
    const organizationId = session.currentOrganization?.id;
    if (!organizationId) return { error: 'No organization selected', status: 400 as const };
    const role = session.currentOrganization?.role || '';
    return { userId, organizationId, role };
}

// GET - single curriculum with modules and progress stats
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
    try {
        const ctx = await getCtx();
        if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
        if (!validateUUID(params.id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

        const rows = await sql`
            SELECT * FROM curricula WHERE id = ${params.id}::uuid AND organization_id = ${ctx.organizationId}
        `;
        if (rows.length === 0) return NextResponse.json({ error: 'Curriculum not found' }, { status: 404 });
        const curriculum = rows[0];

        // Resolve the attached-lesson title from whichever source the module points at.
        const modules = await sql`
            SELECT m.*,
                COALESCE(sl.title, lt.title) AS lesson_title
            FROM curriculum_modules m
            LEFT JOIN saved_lessons sl ON m.lesson_source = 'saved' AND sl.id = m.lesson_id
            LEFT JOIN lesson_templates lt ON m.lesson_source = 'template' AND lt.id = m.lesson_id
            WHERE m.curriculum_id = ${params.id}::uuid
            ORDER BY m.sort_order, m.module_number
        `;

        const stats = await sql`
            SELECT
                COUNT(*) FILTER (WHERE status = 'active')::int AS active_enrollments,
                COUNT(*) FILTER (WHERE status = 'completed')::int AS completed_enrollments,
                COUNT(*)::int AS total_enrollments
            FROM curriculum_enrollments
            WHERE curriculum_id = ${params.id}::uuid
        `;

        return NextResponse.json({
            success: true,
            curriculum: { ...curriculum, modules },
            stats: stats[0],
        });
    } catch (error) {
        console.error('Curriculum GET error:', error);
        return NextResponse.json({ error: 'Failed to load curriculum' }, { status: 500 });
    }
}

// PUT - update curriculum metadata
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
    try {
        const ctx = await getCtx();
        if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
        if (!MANAGE_ROLES.includes(ctx.role)) {
            return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
        }
        if (!validateUUID(params.id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

        const body = await request.json();
        const { name, description, source, total_hours, status } = body;

        const result = await sql`
            UPDATE curricula SET
                name = COALESCE(${name ?? null}, name),
                description = ${description ?? null},
                source = ${source ?? null},
                total_hours = ${total_hours ?? null},
                status = COALESCE(${status && ['active', 'draft', 'archived'].includes(status) ? status : null}, status),
                updated_at = NOW()
            WHERE id = ${params.id}::uuid AND organization_id = ${ctx.organizationId}
            RETURNING *
        `;
        if (result.length === 0) return NextResponse.json({ error: 'Curriculum not found' }, { status: 404 });

        await logAuditEvent(ctx.userId, ctx.organizationId, 'update', 'curriculum', params.id);
        return NextResponse.json({ success: true, curriculum: result[0] });
    } catch (error) {
        console.error('Curriculum PUT error:', error);
        return NextResponse.json({ error: 'Failed to update curriculum' }, { status: 500 });
    }
}

// DELETE - soft delete (archive)
export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
    try {
        const ctx = await getCtx();
        if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
        if (!MANAGE_ROLES.includes(ctx.role)) {
            return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
        }
        if (!validateUUID(params.id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

        const result = await sql`
            UPDATE curricula SET status = 'archived', updated_at = NOW()
            WHERE id = ${params.id}::uuid AND organization_id = ${ctx.organizationId}
            RETURNING id
        `;
        if (result.length === 0) return NextResponse.json({ error: 'Curriculum not found' }, { status: 404 });

        await logAuditEvent(ctx.userId, ctx.organizationId, 'archive', 'curriculum', params.id);
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Curriculum DELETE error:', error);
        return NextResponse.json({ error: 'Failed to archive curriculum' }, { status: 500 });
    }
}
