import { NextRequest, NextResponse } from 'next/server';
import { getSession, getInternalUserId } from '@/lib/auth';
import { sql, logAuditEvent } from '@/lib/db';

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
const dateOnly = (d: any) => (d ? String(d).slice(0, 10) : '');

// GET ?from&to — org-wide group attendance CSV (one row per attendee per activity).
export async function GET(request: NextRequest) {
    try {
        const ctx = await getCtx();
        if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
        if (!VIEW_ROLES.includes(ctx.role)) {
            return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const from = searchParams.get('from');
        const to = searchParams.get('to');

        const rows = await sql`
            SELECT a.activity_date, a.name AS activity_name, a.activity_type,
                   l.name AS location_name,
                   p.first_name, p.last_name, p.preferred_name,
                   ga.attendance_status, ga.source
            FROM group_attendance ga
            JOIN group_activities a ON a.id = ga.activity_id
            JOIN participants p ON p.id = ga.participant_id
            LEFT JOIN locations l ON l.id = a.location_id
            WHERE ga.organization_id = ${ctx.organizationId}
              AND a.status = 'active'
              AND (${from}::date IS NULL OR a.activity_date >= ${from}::date)
              AND (${to}::date IS NULL OR a.activity_date <= ${to}::date)
            ORDER BY a.activity_date DESC, a.name, p.last_name
        `;

        const csv = toCsv(
            ['Date', 'Activity', 'Type', 'Location', 'Participant', 'Attendance', 'Source'],
            rows.map((r: any) => [
                dateOnly(r.activity_date),
                r.activity_name,
                r.activity_type,
                r.location_name || '',
                `${r.preferred_name || r.first_name} ${r.last_name}`,
                r.attendance_status,
                r.source,
            ])
        );

        await logAuditEvent(ctx.userId, ctx.organizationId, 'export', 'group_attendance', undefined, { from, to });

        return new NextResponse(csv, {
            status: 200,
            headers: {
                'Content-Type': 'text/csv; charset=utf-8',
                'Content-Disposition': `attachment; filename="group_attendance.csv"`,
            },
        });
    } catch (error) {
        console.error('Group attendance export error:', error);
        return NextResponse.json({ error: 'Failed to export' }, { status: 500 });
    }
}
