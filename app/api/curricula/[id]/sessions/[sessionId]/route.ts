import { NextRequest, NextResponse } from 'next/server';
import { getSession, getInternalUserId, requireOrgAccess } from '@/lib/auth';
import { sql, logAuditEvent, validateUUID } from '@/lib/db';

const ATTENDANCE_STATUSES = ['present', 'absent', 'excused', 'late'];

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

async function getSessionRow(curriculumId: string, sessionId: string, organizationId: string) {
    const rows = await sql`
        SELECT s.* FROM curriculum_sessions s
        WHERE s.id = ${sessionId}::uuid AND s.curriculum_id = ${curriculumId}::uuid
            AND s.organization_id = ${organizationId}
    `;
    return rows.length ? rows[0] : null;
}

// GET - session detail with full attendance list
export async function GET(_request: NextRequest, { params }: { params: { id: string; sessionId: string } }) {
    try {
        const ctx = await getCtx();
        if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
        if (!validateUUID(params.id) || !validateUUID(params.sessionId)) {
            return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
        }

        const session = await getSessionRow(params.id, params.sessionId, ctx.organizationId);
        if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

        const attendance = await sql`
            SELECT sa.*, p.first_name, p.last_name, p.preferred_name
            FROM session_attendance sa
            JOIN participants p ON p.id = sa.participant_id
            WHERE sa.session_id = ${params.sessionId}::uuid
            ORDER BY p.last_name, p.first_name
        `;

        return NextResponse.json({ success: true, session: { ...session, attendance } });
    } catch (error) {
        console.error('Session GET error:', error);
        return NextResponse.json({ error: 'Failed to load session' }, { status: 500 });
    }
}

// PUT - update session metadata and/or individual attendance statuses
export async function PUT(request: NextRequest, { params }: { params: { id: string; sessionId: string } }) {
    try {
        const ctx = await getCtx();
        if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
        try {
            await requireOrgAccess(ctx.organizationId);
        } catch {
            return NextResponse.json({ error: 'Organization access denied' }, { status: 403 });
        }
        if (!validateUUID(params.id) || !validateUUID(params.sessionId)) {
            return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
        }

        const session = await getSessionRow(params.id, params.sessionId, ctx.organizationId);
        if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

        const body = await request.json();
        const { session_date, start_time, duration_minutes, location_id, notes, attendance } = body;

        // Every attendee in the update must belong to this org.
        if (Array.isArray(attendance)) {
            const candidateIds = attendance
                .map((a: any) => a?.participant_id)
                .filter((pid: any) => validateUUID(pid));
            if (candidateIds.length > 0) {
                const validRows = await sql`
                    SELECT id FROM participants
                    WHERE id = ANY(${candidateIds}::uuid[]) AND organization_id = ${ctx.organizationId}
                `;
                const validSet = new Set(validRows.map((r: any) => r.id));
                const missing = candidateIds.filter((pid: string) => !validSet.has(pid));
                if (missing.length > 0) {
                    return NextResponse.json(
                        { error: 'One or more participants do not belong to this organization' },
                        { status: 403 }
                    );
                }
            }
        }

        let validLocationId: string | null | undefined = undefined;
        if (location_id !== undefined) {
            validLocationId = null;
            if (location_id && validateUUID(location_id)) {
                const locRows = await sql`
                    SELECT id FROM locations WHERE id = ${location_id}::uuid AND organization_id = ${ctx.organizationId}
                `;
                if (locRows.length) validLocationId = location_id;
            }
        }

        const updated = await sql`
            UPDATE curriculum_sessions SET
                session_date = COALESCE(${session_date ?? null}::date, session_date),
                start_time = ${start_time !== undefined ? (start_time || null) : session.start_time},
                duration_minutes = ${duration_minutes !== undefined ? (duration_minutes != null ? Number(duration_minutes) : null) : session.duration_minutes},
                location_id = ${validLocationId !== undefined ? validLocationId : session.location_id}::uuid,
                notes = ${notes !== undefined ? (notes || null) : session.notes}
            WHERE id = ${params.sessionId}::uuid AND organization_id = ${ctx.organizationId}
            RETURNING *
        `;

        // Optional per-attendee status updates. Flipping someone to 'present'
        // back-fills their module completion (additive, like the original log);
        // flipping away from 'present' leaves the completion intact, matching
        // the sticky-completion design used on session delete.
        if (Array.isArray(attendance)) {
            for (const a of attendance) {
                if (!validateUUID(a.participant_id)) continue;
                const status = ATTENDANCE_STATUSES.includes(a.status || '') ? a.status : 'present';
                await sql`
                    UPDATE session_attendance SET status = ${status}
                    WHERE session_id = ${params.sessionId}::uuid AND participant_id = ${a.participant_id}::uuid
                `;

                if (status === 'present') {
                    const enrollRows = await sql`
                        SELECT id FROM curriculum_enrollments
                        WHERE curriculum_id = ${params.id}::uuid AND participant_id = ${a.participant_id}::uuid
                            AND organization_id = ${ctx.organizationId} AND status = 'active'
                    `;
                    if (enrollRows.length) {
                        const enrollmentId = enrollRows[0].id;
                        await sql`
                            INSERT INTO module_completions
                                (enrollment_id, module_id, organization_id, facilitator_id, duration_minutes)
                            VALUES (${enrollmentId}::uuid, ${session.module_id}::uuid, ${ctx.organizationId}::uuid,
                                ${ctx.userId}::uuid, ${session.duration_minutes})
                            ON CONFLICT (enrollment_id, module_id) DO NOTHING
                        `;
                        await sql`
                            UPDATE curriculum_enrollments e SET status = 'completed', completed_at = NOW()
                            WHERE e.id = ${enrollmentId}::uuid AND e.status = 'active'
                                AND (SELECT COUNT(*) FROM module_completions mc WHERE mc.enrollment_id = e.id)
                                    >= (SELECT COUNT(*) FROM curriculum_modules cm WHERE cm.curriculum_id = ${params.id}::uuid)
                        `;
                    }
                }
            }
        }

        await logAuditEvent(ctx.userId, ctx.organizationId, 'update', 'curriculum_session', params.sessionId);
        return NextResponse.json({ success: true, session: updated[0] });
    } catch (error) {
        console.error('Session PUT error:', error);
        return NextResponse.json({ error: 'Failed to update session' }, { status: 500 });
    }
}

// DELETE - remove a session (attendance cascades). Module completions are
// left intact: they represent a participant having done the work, not the
// logistics of one delivery, and are keyed to the enrollment rather than the session.
export async function DELETE(_request: NextRequest, { params }: { params: { id: string; sessionId: string } }) {
    try {
        const ctx = await getCtx();
        if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
        if (!validateUUID(params.id) || !validateUUID(params.sessionId)) {
            return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
        }

        const result = await sql`
            DELETE FROM curriculum_sessions
            WHERE id = ${params.sessionId}::uuid AND curriculum_id = ${params.id}::uuid
                AND organization_id = ${ctx.organizationId}
            RETURNING id
        `;
        if (result.length === 0) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

        await logAuditEvent(ctx.userId, ctx.organizationId, 'delete', 'curriculum_session', params.sessionId);
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Session DELETE error:', error);
        return NextResponse.json({ error: 'Failed to delete session' }, { status: 500 });
    }
}
