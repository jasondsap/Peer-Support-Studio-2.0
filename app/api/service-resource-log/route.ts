import { NextRequest, NextResponse } from 'next/server';
import { getSession, getInternalUserId } from '@/lib/auth';
import { sql, logAuditEvent } from '@/lib/db';

const LOG_ROLES = ['pss', 'supervisor', 'admin', 'owner'];
const LOG_TYPES = ['transportation', 'volunteer', 'supplies'];

async function getUserContext(session: any) {
    const userId = await getInternalUserId(session.user.id, session.user.email);
    if (!userId) return null;
    const organizationId = session.currentOrganization?.id;
    if (!organizationId) return null;
    const role = session.currentOrganization?.role || '';
    return { userId, organizationId, role };
}

// Compute total_cost for a supplies line-item list.
function suppliesTotal(items: any[]): number {
    if (!Array.isArray(items)) return 0;
    return items.reduce((sum, it) => {
        const qty = Number(it.quantity) || 0;
        const cost = Number(it.unit_cost) || 0;
        return sum + qty * cost;
    }, 0);
}

function csvCell(v: any): string {
    if (v === null || v === undefined) return '';
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// GET - list logs (or ?export=csv)
export async function GET(request: NextRequest) {
    try {
        const session = await getSession();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const ctx = await getUserContext(session);
        if (!ctx) return NextResponse.json({ error: 'User not found' }, { status: 404 });

        const { searchParams } = new URL(request.url);
        const logType = searchParams.get('log_type');
        const from = searchParams.get('from');
        const to = searchParams.get('to');
        const participantId = searchParams.get('participant_id');
        const isExport = searchParams.get('export') === 'csv';
        const limit = isExport ? 5000 : Math.min(parseInt(searchParams.get('limit') || '100'), 500);

        const logs = await sql`
            SELECT
                srl.*,
                TRIM(COALESCE(p.first_name, '') || ' ' || COALESCE(p.last_name, '')) AS participant_name,
                NULLIF(TRIM(COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '')), '') AS logged_by_name,
                l.name AS location_name
            FROM service_resource_logs srl
            LEFT JOIN participants p ON p.id = srl.participant_id
            LEFT JOIN users u ON u.id = srl.logged_by
            LEFT JOIN locations l ON l.id = srl.location_id
            WHERE srl.organization_id = ${ctx.organizationId}
              AND srl.status = 'active'
              AND (${logType}::text IS NULL OR srl.log_type = ${logType})
              AND (${from}::date IS NULL OR srl.service_date >= ${from}::date)
              AND (${to}::date IS NULL OR srl.service_date <= ${to}::date)
              AND (${participantId}::uuid IS NULL OR srl.participant_id = ${participantId}::uuid)
            ORDER BY srl.service_date DESC, srl.created_at DESC
            LIMIT ${limit}
        `;

        if (isExport) {
            const header = ['Date', 'Type', 'Participant', 'Location', 'Total Cost', 'Total Hours', 'Details', 'Notes', 'Logged By'];
            const lines = [header.join(',')];
            for (const r of logs as any[]) {
                lines.push([
                    csvCell(r.service_date),
                    csvCell(r.log_type),
                    csvCell(r.participant_name),
                    csvCell(r.location_name),
                    csvCell(r.total_cost),
                    csvCell(r.total_hours),
                    csvCell(JSON.stringify(r.details)),
                    csvCell(r.notes),
                    csvCell(r.logged_by_name),
                ].join(','));
            }
            return new NextResponse(lines.join('\n'), {
                headers: {
                    'Content-Type': 'text/csv',
                    'Content-Disposition': `attachment; filename="service-resource-log.csv"`,
                },
            });
        }

        return NextResponse.json({ success: true, logs });
    } catch (error: any) {
        console.error('Service resource log GET error:', error);
        return NextResponse.json({ error: 'Failed to fetch logs' }, { status: 500 });
    }
}

// POST - create a log entry
export async function POST(request: NextRequest) {
    try {
        const session = await getSession();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const ctx = await getUserContext(session);
        if (!ctx) return NextResponse.json({ error: 'User not found' }, { status: 404 });
        if (!LOG_ROLES.includes(ctx.role)) {
            return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
        }

        const body = await request.json();
        const {
            log_type, service_date, participant_id, location_id,
            details = {}, total_hours, total_cost, notes,
        } = body;

        if (!LOG_TYPES.includes(log_type)) {
            return NextResponse.json({ error: 'Invalid log_type' }, { status: 400 });
        }
        if (!service_date) {
            return NextResponse.json({ error: 'service_date is required' }, { status: 400 });
        }

        // Supplies: compute cost server-side from line items so the total is trustworthy.
        let computedCost = total_cost ?? null;
        if (log_type === 'supplies') {
            computedCost = suppliesTotal(details.items);
        }

        const result = await sql`
            INSERT INTO service_resource_logs (
                organization_id, participant_id, log_type, service_date, location_id,
                details, total_cost, total_hours, notes, logged_by
            ) VALUES (
                ${ctx.organizationId}::uuid,
                ${participant_id || null},
                ${log_type},
                ${service_date},
                ${location_id || null},
                ${JSON.stringify(details)}::jsonb,
                ${computedCost},
                ${total_hours ?? null},
                ${notes || null},
                ${ctx.userId}::uuid
            )
            RETURNING *
        `;

        // PHI-bearing only when a participant is attached.
        await logAuditEvent(ctx.userId, ctx.organizationId, 'create', 'service_resource_log', result[0].id, {
            log_type,
            participant_id: participant_id || null,
        });

        return NextResponse.json({ success: true, log: result[0] });
    } catch (error: any) {
        console.error('Service resource log POST error:', error);
        return NextResponse.json({ error: 'Failed to create log' }, { status: 500 });
    }
}

// PATCH - edit or archive a log
export async function PATCH(request: NextRequest) {
    try {
        const session = await getSession();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const ctx = await getUserContext(session);
        if (!ctx) return NextResponse.json({ error: 'User not found' }, { status: 404 });
        if (!LOG_ROLES.includes(ctx.role)) {
            return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
        }

        const body = await request.json();
        const { id, details, total_hours, total_cost, notes, service_date, participant_id, status } = body;
        if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

        // Recompute supplies cost if items were edited.
        let computedCost = total_cost ?? null;
        if (details && Array.isArray(details.items)) {
            computedCost = suppliesTotal(details.items);
        }

        const result = await sql`
            UPDATE service_resource_logs SET
                details = COALESCE(${details ? JSON.stringify(details) : null}::jsonb, details),
                total_cost = COALESCE(${computedCost}, total_cost),
                total_hours = COALESCE(${total_hours ?? null}, total_hours),
                notes = COALESCE(${notes ?? null}, notes),
                service_date = COALESCE(${service_date ?? null}, service_date),
                participant_id = COALESCE(${participant_id ?? null}, participant_id),
                status = COALESCE(${status ?? null}, status),
                updated_at = NOW()
            WHERE id = ${id}::uuid AND organization_id = ${ctx.organizationId}
            RETURNING *
        `;
        if (result.length === 0) {
            return NextResponse.json({ error: 'Log not found' }, { status: 404 });
        }

        await logAuditEvent(ctx.userId, ctx.organizationId, 'update', 'service_resource_log', id);
        return NextResponse.json({ success: true, log: result[0] });
    } catch (error: any) {
        console.error('Service resource log PATCH error:', error);
        return NextResponse.json({ error: 'Failed to update log' }, { status: 500 });
    }
}
