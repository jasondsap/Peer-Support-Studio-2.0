import { NextRequest, NextResponse } from 'next/server';
import { getSession, getInternalUserId } from '@/lib/auth';
import { sql, logAuditEvent } from '@/lib/db';

const EDIT_ROLES = ['supervisor', 'admin', 'owner'];

async function getUserContext(session: any) {
    const userId = await getInternalUserId(session.user.id, session.user.email);
    if (!userId) return null;
    const organizationId = session.currentOrganization?.id;
    if (!organizationId) return null;
    const role = session.currentOrganization?.role || '';
    return { userId, organizationId, role };
}

// GET - single activity with full roster
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getSession();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const ctx = await getUserContext(session);
        if (!ctx) return NextResponse.json({ error: 'User not found' }, { status: 404 });

        const { id } = await params;

        const rows = await sql`
            SELECT
                a.*,
                l.name AS location_name,
                TRIM(COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '')) AS facilitator_name
            FROM group_activities a
            LEFT JOIN locations l ON l.id = a.location_id
            LEFT JOIN users u ON u.id = a.facilitator_id
            WHERE a.id = ${id}::uuid AND a.organization_id = ${ctx.organizationId}
        `;
        if (rows.length === 0) {
            return NextResponse.json({ error: 'Activity not found' }, { status: 404 });
        }

        const roster = await sql`
            SELECT
                ga.id, ga.participant_id, ga.attendance_status, ga.source,
                ga.check_in_time, ga.notes,
                p.first_name, p.last_name, p.preferred_name
            FROM group_attendance ga
            JOIN participants p ON p.id = ga.participant_id
            WHERE ga.activity_id = ${id}::uuid AND ga.organization_id = ${ctx.organizationId}
            ORDER BY p.last_name, p.first_name
        `;

        return NextResponse.json({ success: true, activity: rows[0], roster });
    } catch (error: any) {
        console.error('Group activity GET error:', error);
        return NextResponse.json({ error: 'Failed to fetch activity' }, { status: 500 });
    }
}

// PATCH - edit fields / set headcount / archive
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getSession();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const ctx = await getUserContext(session);
        if (!ctx) return NextResponse.json({ error: 'User not found' }, { status: 404 });

        const { id } = await params;
        const body = await request.json();

        // Editing/archiving requires supervisor+ (creators can still edit their own via the create flow).
        if (!EDIT_ROLES.includes(ctx.role)) {
            const owned = await sql`
                SELECT 1 FROM group_activities
                WHERE id = ${id}::uuid AND organization_id = ${ctx.organizationId} AND created_by = ${ctx.userId}::uuid
            `;
            if (owned.length === 0) {
                return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
            }
        }

        const result = await sql`
            UPDATE group_activities SET
                name = COALESCE(${body.name ?? null}, name),
                activity_type = COALESCE(${body.activity_type ?? null}, activity_type),
                primary_audience = COALESCE(${body.primary_audience ?? null}, primary_audience),
                activity_date = COALESCE(${body.activity_date ?? null}, activity_date),
                start_time = COALESCE(${body.start_time ?? null}, start_time),
                duration_minutes = COALESCE(${body.duration_minutes ?? null}, duration_minutes),
                location_id = COALESCE(${body.location_id ?? null}, location_id),
                facilitator_id = COALESCE(${body.facilitator_id ?? null}, facilitator_id),
                headcount_total = COALESCE(${body.headcount_total ?? null}, headcount_total),
                notes = COALESCE(${body.notes ?? null}, notes),
                status = COALESCE(${body.status ?? null}, status),
                updated_at = NOW()
            WHERE id = ${id}::uuid AND organization_id = ${ctx.organizationId}
            RETURNING *
        `;
        if (result.length === 0) {
            return NextResponse.json({ error: 'Activity not found' }, { status: 404 });
        }

        await logAuditEvent(ctx.userId, ctx.organizationId, 'update', 'group_activity', id);
        return NextResponse.json({ success: true, activity: result[0] });
    } catch (error: any) {
        console.error('Group activity PATCH error:', error);
        return NextResponse.json({ error: 'Failed to update activity' }, { status: 500 });
    }
}

// DELETE - soft archive
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getSession();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const ctx = await getUserContext(session);
        if (!ctx) return NextResponse.json({ error: 'User not found' }, { status: 404 });
        if (!EDIT_ROLES.includes(ctx.role)) {
            return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
        }

        const { id } = await params;
        const result = await sql`
            UPDATE group_activities SET status = 'archived', updated_at = NOW()
            WHERE id = ${id}::uuid AND organization_id = ${ctx.organizationId}
            RETURNING id
        `;
        if (result.length === 0) {
            return NextResponse.json({ error: 'Activity not found' }, { status: 404 });
        }

        await logAuditEvent(ctx.userId, ctx.organizationId, 'archive', 'group_activity', id);
        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Group activity DELETE error:', error);
        return NextResponse.json({ error: 'Failed to archive activity' }, { status: 500 });
    }
}
