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

// GET - list curricula for the org with module + enrollment counts
export async function GET() {
    try {
        const ctx = await getCtx();
        if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

        const curricula = await sql`
            SELECT c.*,
                (SELECT COUNT(*) FROM curriculum_modules m WHERE m.curriculum_id = c.id)::int AS module_count,
                (SELECT COUNT(*) FROM curriculum_enrollments e WHERE e.curriculum_id = c.id AND e.status = 'active')::int AS active_enrollment_count,
                (SELECT COUNT(*) FROM curriculum_enrollments e WHERE e.curriculum_id = c.id)::int AS total_enrollment_count,
                (SELECT COUNT(*) FROM curriculum_enrollments e WHERE e.curriculum_id = c.id AND e.status = 'completed')::int AS completed_enrollment_count
            FROM curricula c
            WHERE c.organization_id = ${ctx.organizationId}
            ORDER BY c.created_at DESC
        `;

        return NextResponse.json({ success: true, curricula });
    } catch (error) {
        console.error('Curricula GET error:', error);
        return NextResponse.json({ error: 'Failed to load curricula' }, { status: 500 });
    }
}

// POST - create a curriculum (optionally with modules in one call)
export async function POST(request: NextRequest) {
    try {
        const ctx = await getCtx();
        if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
        if (!MANAGE_ROLES.includes(ctx.role)) {
            return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
        }

        const body = await request.json();
        const { name, description, source, total_hours, status, modules } = body;
        if (!name || !name.trim()) {
            return NextResponse.json({ error: 'Curriculum name is required' }, { status: 400 });
        }

        const created = await sql`
            INSERT INTO curricula (organization_id, name, description, source, total_hours, status, created_by)
            VALUES (
                ${ctx.organizationId}::uuid,
                ${name.trim()},
                ${description || null},
                ${source || null},
                ${total_hours ?? null},
                ${status && ['active', 'draft', 'archived'].includes(status) ? status : 'active'},
                ${ctx.userId}::uuid
            )
            RETURNING *
        `;
        const curriculum = created[0];

        const insertedModules = [];
        if (Array.isArray(modules)) {
            for (let i = 0; i < modules.length; i++) {
                const m = modules[i];
                if (!m?.title || !m.title.trim()) continue;
                const objectives = Array.isArray(m.learning_objectives) && m.learning_objectives.length
                    ? m.learning_objectives : null;
                // Optionally carry an attached lesson through bulk create.
                const lessonId = m.lesson_id && validateUUID(m.lesson_id) && ['saved', 'template'].includes(m.lesson_source)
                    ? m.lesson_id : null;
                const lessonSource = lessonId ? m.lesson_source : null;
                const row = await sql`
                    INSERT INTO curriculum_modules
                        (curriculum_id, module_number, title, description, minimum_hours, minimum_minutes, learning_objectives, sort_order, lesson_id, lesson_source)
                    VALUES (
                        ${curriculum.id}::uuid,
                        ${m.module_number ?? i + 1},
                        ${m.title.trim()},
                        ${m.description || null},
                        ${m.minimum_hours ?? null},
                        ${m.minimum_minutes ?? null},
                        ${objectives},
                        ${m.sort_order ?? i},
                        ${lessonId}::uuid,
                        ${lessonSource}
                    )
                    RETURNING *
                `;
                insertedModules.push(row[0]);
            }
        }

        await logAuditEvent(ctx.userId, ctx.organizationId, 'create', 'curriculum', curriculum.id);

        return NextResponse.json({ success: true, curriculum, modules: insertedModules });
    } catch (error) {
        console.error('Curricula POST error:', error);
        return NextResponse.json({ error: 'Failed to create curriculum' }, { status: 500 });
    }
}
