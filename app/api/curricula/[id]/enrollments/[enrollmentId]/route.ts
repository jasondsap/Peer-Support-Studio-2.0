import { NextRequest, NextResponse } from 'next/server';
import { getSession, getInternalUserId } from '@/lib/auth';
import { sql, logAuditEvent, validateUUID } from '@/lib/db';

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

const ENROLLMENT_STATUSES = ['active', 'completed', 'withdrawn', 'paused'];

// PUT - update enrollment status (withdraw / pause / complete / reactivate)
export async function PUT(request: NextRequest, { params }: { params: { id: string; enrollmentId: string } }) {
    try {
        const ctx = await getCtx();
        if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
        if (!validateUUID(params.enrollmentId)) {
            return NextResponse.json({ error: 'Invalid enrollment id' }, { status: 400 });
        }

        const body = await request.json();
        const { status, notes } = body;
        if (status && !ENROLLMENT_STATUSES.includes(status)) {
            return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
        }
        const completedAt = status === 'completed' ? 'NOW()' : null;

        const result = await sql`
            UPDATE curriculum_enrollments SET
                status = COALESCE(${status ?? null}, status),
                notes = ${notes ?? null},
                completed_at = CASE
                    WHEN ${status ?? null} = 'completed' THEN NOW()
                    WHEN ${status ?? null} IS NOT NULL THEN NULL
                    ELSE completed_at
                END
            WHERE id = ${params.enrollmentId}::uuid
                AND curriculum_id = ${params.id}::uuid
                AND organization_id = ${ctx.organizationId}
            RETURNING *
        `;
        if (result.length === 0) return NextResponse.json({ error: 'Enrollment not found' }, { status: 404 });

        await logAuditEvent(ctx.userId, ctx.organizationId, 'update', 'curriculum_enrollment', params.enrollmentId);
        return NextResponse.json({ success: true, enrollment: result[0] });
    } catch (error) {
        console.error('Enrollment PUT error:', error);
        return NextResponse.json({ error: 'Failed to update enrollment' }, { status: 500 });
    }
}

// DELETE - remove an enrollment
export async function DELETE(_request: NextRequest, { params }: { params: { id: string; enrollmentId: string } }) {
    try {
        const ctx = await getCtx();
        if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
        if (!validateUUID(params.enrollmentId)) {
            return NextResponse.json({ error: 'Invalid enrollment id' }, { status: 400 });
        }

        const result = await sql`
            DELETE FROM curriculum_enrollments
            WHERE id = ${params.enrollmentId}::uuid
                AND curriculum_id = ${params.id}::uuid
                AND organization_id = ${ctx.organizationId}
            RETURNING id
        `;
        if (result.length === 0) return NextResponse.json({ error: 'Enrollment not found' }, { status: 404 });

        await logAuditEvent(ctx.userId, ctx.organizationId, 'delete', 'curriculum_enrollment', params.enrollmentId);
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Enrollment DELETE error:', error);
        return NextResponse.json({ error: 'Failed to remove enrollment' }, { status: 500 });
    }
}
