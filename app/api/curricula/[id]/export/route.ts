import { NextRequest, NextResponse } from 'next/server';
import { getSession, getInternalUserId } from '@/lib/auth';
import { sql, validateUUID, logAuditEvent } from '@/lib/db';

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

// CSV-escape a single cell.
function cell(v: unknown): string {
    if (v === null || v === undefined) return '';
    const s = String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function toCsv(headers: string[], rows: unknown[][]): string {
    const lines = [headers.map(cell).join(',')];
    for (const r of rows) lines.push(r.map(cell).join(','));
    return lines.join('\r\n');
}
const pName = (r: any) => `${r.preferred_name || r.first_name} ${r.last_name}`;
const dateOnly = (d: any) => (d ? String(d).slice(0, 10) : '');

// GET ?type=roster|attendance — download a CSV for grant/compliance reporting.
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
    try {
        const ctx = await getCtx();
        if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
        if (!VIEW_ROLES.includes(ctx.role)) {
            return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
        }
        if (!validateUUID(params.id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

        const currRows = await sql`
            SELECT id, name FROM curricula WHERE id = ${params.id}::uuid AND organization_id = ${ctx.organizationId}
        `;
        if (currRows.length === 0) return NextResponse.json({ error: 'Curriculum not found' }, { status: 404 });
        const curriculum = currRows[0];

        const type = new URL(request.url).searchParams.get('type') || 'roster';
        const safeName = String(curriculum.name || 'curriculum').replace(/[^a-z0-9]+/gi, '_').toLowerCase();

        let csv: string;
        let filename: string;

        if (type === 'attendance') {
            const rows = await sql`
                SELECT s.session_date, m.module_number, m.title AS module_title,
                       p.first_name, p.last_name, p.preferred_name, sa.status
                FROM curriculum_sessions s
                JOIN curriculum_modules m ON m.id = s.module_id
                JOIN session_attendance sa ON sa.session_id = s.id
                JOIN participants p ON p.id = sa.participant_id
                WHERE s.curriculum_id = ${params.id}::uuid AND s.organization_id = ${ctx.organizationId}
                ORDER BY s.session_date DESC, m.module_number, p.last_name
            `;
            csv = toCsv(
                ['Session Date', 'Module #', 'Module', 'Participant', 'Attendance'],
                rows.map((r: any) => [dateOnly(r.session_date), r.module_number, r.module_title, pName(r), r.status])
            );
            filename = `${safeName}_attendance.csv`;
        } else {
            // roster / grant export: one row per enrollment with progress.
            const totalRow = await sql`
                SELECT COUNT(*)::int AS total FROM curriculum_modules WHERE curriculum_id = ${params.id}::uuid
            `;
            const totalModules = totalRow[0].total;
            const rows = await sql`
                SELECT p.first_name, p.last_name, p.preferred_name,
                       e.status, e.enrolled_at, e.completed_at,
                       (SELECT COUNT(*) FROM module_completions mc WHERE mc.enrollment_id = e.id)::int AS modules_completed
                FROM curriculum_enrollments e
                JOIN participants p ON p.id = e.participant_id
                WHERE e.curriculum_id = ${params.id}::uuid AND e.organization_id = ${ctx.organizationId}
                ORDER BY p.last_name, p.first_name
            `;
            csv = toCsv(
                ['Participant', 'Status', 'Enrolled', 'Modules Completed', 'Total Modules', 'Completion %', 'Completed On'],
                rows.map((r: any) => {
                    const pct = totalModules > 0 ? Math.round((r.modules_completed / totalModules) * 100) : 0;
                    return [pName(r), r.status, dateOnly(r.enrolled_at), r.modules_completed, totalModules, `${pct}%`, dateOnly(r.completed_at)];
                })
            );
            filename = `${safeName}_roster.csv`;
        }

        await logAuditEvent(ctx.userId, ctx.organizationId, 'export', 'curriculum', params.id, { type });

        return new NextResponse(csv, {
            status: 200,
            headers: {
                'Content-Type': 'text/csv; charset=utf-8',
                'Content-Disposition': `attachment; filename="${filename}"`,
            },
        });
    } catch (error) {
        console.error('Curriculum export error:', error);
        return NextResponse.json({ error: 'Failed to export' }, { status: 500 });
    }
}
