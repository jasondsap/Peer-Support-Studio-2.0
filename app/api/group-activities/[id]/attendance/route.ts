import { NextRequest, NextResponse } from 'next/server';
import { getSession, getInternalUserId } from '@/lib/auth';
import { sql, logAuditEvent } from '@/lib/db';

const LOG_ROLES = ['pss', 'supervisor', 'admin', 'owner'];

async function getUserContext(session: any) {
    const userId = await getInternalUserId(session.user.id, session.user.email);
    if (!userId) return null;
    const organizationId = session.currentOrganization?.id;
    if (!organizationId) return null;
    const role = session.currentOrganization?.role || '';
    return { userId, organizationId, role };
}

// Verify the activity belongs to the caller's org.
async function activityInOrg(activityId: string, organizationId: string) {
    const rows = await sql`
        SELECT 1 FROM group_activities
        WHERE id = ${activityId}::uuid AND organization_id = ${organizationId}
    `;
    return rows.length > 0;
}

// POST - add one or more attendees by participant id
export async function POST(
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
        if (!LOG_ROLES.includes(ctx.role)) {
            return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
        }

        const { id: activityId } = await params;
        if (!(await activityInOrg(activityId, ctx.organizationId))) {
            return NextResponse.json({ error: 'Activity not found' }, { status: 404 });
        }

        const body = await request.json();
        const participantIds: string[] = body.participantIds || (body.participantId ? [body.participantId] : []);
        const attendanceStatus: string = body.attendance_status || 'present';
        const notes: string | null = body.notes || null;

        if (participantIds.length === 0) {
            return NextResponse.json({ error: 'participantIds is required' }, { status: 400 });
        }

        // Only attach participants that belong to the same org (defense in depth).
        const valid = await sql`
            SELECT id FROM participants
            WHERE id = ANY(${participantIds}::uuid[]) AND organization_id = ${ctx.organizationId}
        `;
        const validIds = valid.map((r: any) => r.id);

        const added: any[] = [];
        for (const pid of validIds) {
            const rows = await sql`
                INSERT INTO group_attendance (
                    organization_id, activity_id, participant_id, attendance_status, source, recorded_by, notes
                ) VALUES (
                    ${ctx.organizationId}::uuid, ${activityId}::uuid, ${pid}::uuid,
                    ${attendanceStatus}, 'staff', ${ctx.userId}::uuid, ${notes}
                )
                ON CONFLICT (activity_id, participant_id) DO NOTHING
                RETURNING *
            `;
            if (rows[0]) {
                added.push(rows[0]);
                await logAuditEvent(ctx.userId, ctx.organizationId, 'create', 'group_attendance', rows[0].id, {
                    activity_id: activityId,
                    participant_id: pid,
                });
            }
        }

        return NextResponse.json({ success: true, added, count: added.length });
    } catch (error: any) {
        console.error('Attendance POST error:', error);
        return NextResponse.json({ error: 'Failed to add attendance' }, { status: 500 });
    }
}

// PATCH - update an attendee's status (present/excused/no_show)
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
        if (!LOG_ROLES.includes(ctx.role)) {
            return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
        }

        const { id: activityId } = await params;
        const body = await request.json();
        const { attendance_id, attendance_status } = body;
        if (!attendance_id || !attendance_status) {
            return NextResponse.json({ error: 'attendance_id and attendance_status are required' }, { status: 400 });
        }

        const result = await sql`
            UPDATE group_attendance SET attendance_status = ${attendance_status}
            WHERE id = ${attendance_id}::uuid
              AND activity_id = ${activityId}::uuid
              AND organization_id = ${ctx.organizationId}
            RETURNING *
        `;
        if (result.length === 0) {
            return NextResponse.json({ error: 'Attendance not found' }, { status: 404 });
        }
        return NextResponse.json({ success: true, attendance: result[0] });
    } catch (error: any) {
        console.error('Attendance PATCH error:', error);
        return NextResponse.json({ error: 'Failed to update attendance' }, { status: 500 });
    }
}

// DELETE - remove an attendee (?attendance_id= or ?participant_id=)
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
        if (!LOG_ROLES.includes(ctx.role)) {
            return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
        }

        const { id: activityId } = await params;
        const { searchParams } = new URL(request.url);
        const attendanceId = searchParams.get('attendance_id');
        const participantId = searchParams.get('participant_id');

        if (!attendanceId && !participantId) {
            return NextResponse.json({ error: 'attendance_id or participant_id is required' }, { status: 400 });
        }

        const result = await sql`
            DELETE FROM group_attendance
            WHERE activity_id = ${activityId}::uuid
              AND organization_id = ${ctx.organizationId}
              AND (${attendanceId}::uuid IS NULL OR id = ${attendanceId}::uuid)
              AND (${participantId}::uuid IS NULL OR participant_id = ${participantId}::uuid)
            RETURNING id
        `;
        if (result.length === 0) {
            return NextResponse.json({ error: 'Attendance not found' }, { status: 404 });
        }

        await logAuditEvent(ctx.userId, ctx.organizationId, 'delete', 'group_attendance', result[0].id);
        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Attendance DELETE error:', error);
        return NextResponse.json({ error: 'Failed to remove attendance' }, { status: 500 });
    }
}
