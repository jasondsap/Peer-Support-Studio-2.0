import { NextRequest, NextResponse } from 'next/server';
import { getSession, getInternalUserId } from '@/lib/auth';
import { sql, validateUUID } from '@/lib/db';

const VIEW_ROLES = ['owner', 'admin', 'supervisor', 'pss'];

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

async function ownsCurriculum(curriculumId: string, organizationId: string) {
    const rows = await sql`
        SELECT id, name FROM curricula WHERE id = ${curriculumId}::uuid AND organization_id = ${organizationId}
    `;
    return rows.length ? rows[0] : null;
}

// GET - completion + attendance summary for a curriculum (org-scoped).
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
    try {
        const ctx = await getCtx();
        if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
        if (!VIEW_ROLES.includes(ctx.role)) {
            return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
        }
        if (!validateUUID(params.id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

        const curriculum = await ownsCurriculum(params.id, ctx.organizationId);
        if (!curriculum) return NextResponse.json({ error: 'Curriculum not found' }, { status: 404 });

        // Enrollment totals.
        const totalsRows = await sql`
            SELECT
                COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE status = 'active')::int AS active,
                COUNT(*) FILTER (WHERE status = 'completed')::int AS completed,
                COUNT(*) FILTER (WHERE status = 'withdrawn')::int AS withdrawn
            FROM curriculum_enrollments
            WHERE curriculum_id = ${params.id}::uuid AND organization_id = ${ctx.organizationId}
        `;
        const totals = totalsRows[0];

        // Per-module completion: how many enrollments have completed each module.
        const perModule = await sql`
            SELECT m.id AS module_id, m.module_number, m.title,
                (
                    SELECT COUNT(*)::int FROM module_completions mc
                    JOIN curriculum_enrollments e ON e.id = mc.enrollment_id
                    WHERE mc.module_id = m.id
                      AND e.curriculum_id = ${params.id}::uuid
                      AND e.organization_id = ${ctx.organizationId}
                ) AS completed_count
            FROM curriculum_modules m
            WHERE m.curriculum_id = ${params.id}::uuid
            ORDER BY m.sort_order, m.module_number
        `;

        // Attendance summary across logged sessions.
        const attRows = await sql`
            SELECT
                COUNT(DISTINCT s.id)::int AS session_count,
                COUNT(sa.id)::int AS total_attendance,
                COUNT(sa.id) FILTER (WHERE sa.status = 'present')::int AS present_count
            FROM curriculum_sessions s
            LEFT JOIN session_attendance sa ON sa.session_id = s.id
            WHERE s.curriculum_id = ${params.id}::uuid AND s.organization_id = ${ctx.organizationId}
        `;
        const att = attRows[0];

        return NextResponse.json({
            success: true,
            curriculum_name: curriculum.name,
            enrollment_totals: totals,
            per_module: perModule,
            attendance: {
                session_count: att.session_count,
                total_attendance: att.total_attendance,
                present_count: att.present_count,
                avg_present_per_session:
                    att.session_count > 0 ? Math.round((att.present_count / att.session_count) * 10) / 10 : 0,
            },
        });
    } catch (error) {
        console.error('Curriculum reports error:', error);
        return NextResponse.json({ error: 'Failed to build reports' }, { status: 500 });
    }
}
