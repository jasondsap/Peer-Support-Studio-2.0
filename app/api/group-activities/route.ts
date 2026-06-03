import { NextRequest, NextResponse } from 'next/server';
import { getSession, getInternalUserId } from '@/lib/auth';
import { sql, logAuditEvent } from '@/lib/db';

const LOG_ROLES = ['pss', 'supervisor', 'admin', 'owner'];

// Resolve internal user id + current org + role from the session (same shape as service-log).
async function getUserContext(session: any) {
    const userId = await getInternalUserId(session.user.id, session.user.email);
    if (!userId) return null;
    const organizationId = session.currentOrganization?.id;
    if (!organizationId) return null;
    const role = session.currentOrganization?.role || '';
    return { userId, organizationId, role };
}

// GET - list group activities for the org (with computed attendee counts)
export async function GET(request: NextRequest) {
    try {
        const session = await getSession();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const ctx = await getUserContext(session);
        if (!ctx) return NextResponse.json({ error: 'User not found' }, { status: 404 });

        const { searchParams } = new URL(request.url);
        const from = searchParams.get('from');
        const to = searchParams.get('to');
        const type = searchParams.get('type');
        const locationId = searchParams.get('location_id');
        const limit = Math.min(parseInt(searchParams.get('limit') || '200'), 500);

        const activities = await sql`
            SELECT
                a.*,
                l.name AS location_name,
                TRIM(COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '')) AS facilitator_name,
                (SELECT COUNT(*)::int FROM group_attendance ga
                   WHERE ga.activity_id = a.id AND ga.attendance_status <> 'no_show') AS attendee_count
            FROM group_activities a
            LEFT JOIN locations l ON l.id = a.location_id
            LEFT JOIN users u ON u.id = a.facilitator_id
            WHERE a.organization_id = ${ctx.organizationId}
              AND a.status = 'active'
              AND (${from}::date IS NULL OR a.activity_date >= ${from}::date)
              AND (${to}::date IS NULL OR a.activity_date <= ${to}::date)
              AND (${type}::text IS NULL OR a.activity_type = ${type})
              AND (${locationId}::uuid IS NULL OR a.location_id = ${locationId}::uuid)
            ORDER BY a.activity_date DESC, a.start_time DESC NULLS LAST
            LIMIT ${limit}
        `;

        return NextResponse.json({ success: true, activities });
    } catch (error: any) {
        console.error('Group activities GET error:', error);
        return NextResponse.json({ error: 'Failed to fetch activities' }, { status: 500 });
    }
}

// POST - create a group activity
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
            name, activity_type, primary_audience, activity_date, start_time,
            duration_minutes, location_id, facilitator_id, headcount_total, notes,
        } = body;

        if (!name || !activity_date) {
            return NextResponse.json({ error: 'name and activity_date are required' }, { status: 400 });
        }

        const result = await sql`
            INSERT INTO group_activities (
                organization_id, location_id, name, activity_type, primary_audience,
                activity_date, start_time, duration_minutes, facilitator_id,
                headcount_total, notes, created_by
            ) VALUES (
                ${ctx.organizationId}::uuid,
                ${location_id || null},
                ${name},
                ${activity_type || 'recovery_group'},
                ${primary_audience || null},
                ${activity_date},
                ${start_time || null},
                ${duration_minutes || null},
                ${facilitator_id || null},
                ${headcount_total ?? null},
                ${notes || null},
                ${ctx.userId}::uuid
            )
            RETURNING *
        `;

        await logAuditEvent(ctx.userId, ctx.organizationId, 'create', 'group_activity', result[0].id);

        return NextResponse.json({ success: true, activity: result[0] });
    } catch (error: any) {
        console.error('Group activities POST error:', error);
        return NextResponse.json({ error: 'Failed to create activity' }, { status: 500 });
    }
}
