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

async function ownsCurriculum(curriculumId: string, organizationId: string) {
    const rows = await sql`
        SELECT id FROM curricula WHERE id = ${curriculumId}::uuid AND organization_id = ${organizationId}
    `;
    return rows.length > 0;
}

// GET - list delivered group sessions for this curriculum, most recent first
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
    try {
        const ctx = await getCtx();
        if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
        if (!validateUUID(params.id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
        if (!(await ownsCurriculum(params.id, ctx.organizationId))) {
            return NextResponse.json({ error: 'Curriculum not found' }, { status: 404 });
        }

        const sessions = await sql`
            SELECT s.*,
                m.module_number, m.title AS module_title,
                u.name AS facilitator_name,
                l.name AS location_name,
                (SELECT COUNT(*) FROM session_attendance sa WHERE sa.session_id = s.id)::int AS attendee_count,
                (SELECT COUNT(*) FROM session_attendance sa WHERE sa.session_id = s.id AND sa.status = 'present')::int AS present_count
            FROM curriculum_sessions s
            JOIN curriculum_modules m ON m.id = s.module_id
            LEFT JOIN users u ON u.id = s.facilitator_id
            LEFT JOIN locations l ON l.id = s.location_id
            WHERE s.curriculum_id = ${params.id}::uuid AND s.organization_id = ${ctx.organizationId}
            ORDER BY s.session_date DESC, s.created_at DESC
        `;

        return NextResponse.json({ success: true, sessions });
    } catch (error) {
        console.error('Sessions GET error:', error);
        return NextResponse.json({ error: 'Failed to load sessions' }, { status: 500 });
    }
}

// POST - log a group session: creates the session, attendance, and
// auto-marks module completion for present participants with an active enrollment.
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
    try {
        const ctx = await getCtx();
        if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
        try {
            await requireOrgAccess(ctx.organizationId);
        } catch {
            return NextResponse.json({ error: 'Organization access denied' }, { status: 403 });
        }
        if (!validateUUID(params.id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
        if (!(await ownsCurriculum(params.id, ctx.organizationId))) {
            return NextResponse.json({ error: 'Curriculum not found' }, { status: 404 });
        }

        const body = await request.json();
        const { module_id, session_date, start_time, duration_minutes, location_id, notes } = body;

        if (!validateUUID(module_id)) {
            return NextResponse.json({ error: 'module_id is required' }, { status: 400 });
        }
        if (!session_date) {
            return NextResponse.json({ error: 'session_date is required' }, { status: 400 });
        }

        // Module must belong to this curriculum.
        const moduleRows = await sql`
            SELECT id FROM curriculum_modules WHERE id = ${module_id}::uuid AND curriculum_id = ${params.id}::uuid
        `;
        if (moduleRows.length === 0) {
            return NextResponse.json({ error: 'Module not found in this curriculum' }, { status: 400 });
        }

        // Optional location must belong to the org.
        let validLocationId: string | null = null;
        if (location_id && validateUUID(location_id)) {
            const locRows = await sql`
                SELECT id FROM locations WHERE id = ${location_id}::uuid AND organization_id = ${ctx.organizationId}
            `;
            if (locRows.length) validLocationId = location_id;
        }

        // Every attendee must be a participant in this org before we record
        // attendance against them (prevents cross-org participant injection).
        const attendees: Array<{ participant_id: string; status?: string }> = Array.isArray(body.attendees)
            ? body.attendees
            : [];
        const candidateIds = attendees
            .map((a) => a.participant_id)
            .filter((pid) => validateUUID(pid));
        if (candidateIds.length > 0) {
            const validRows = await sql`
                SELECT id FROM participants
                WHERE id = ANY(${candidateIds}::uuid[]) AND organization_id = ${ctx.organizationId}
            `;
            const validSet = new Set(validRows.map((r: any) => r.id));
            const missing = candidateIds.filter((pid) => !validSet.has(pid));
            if (missing.length > 0) {
                return NextResponse.json(
                    { error: 'One or more participants do not belong to this organization' },
                    { status: 403 }
                );
            }
        }

        const sessionRows = await sql`
            INSERT INTO curriculum_sessions
                (curriculum_id, module_id, organization_id, facilitator_id, location_id, session_date, start_time, duration_minutes, notes)
            VALUES (
                ${params.id}::uuid, ${module_id}::uuid, ${ctx.organizationId}::uuid, ${ctx.userId}::uuid,
                ${validLocationId}::uuid,
                ${session_date}::date,
                ${start_time || null},
                ${duration_minutes != null ? Number(duration_minutes) : null},
                ${notes || null}
            )
            RETURNING *
        `;
        const session = sessionRows[0];

        // Attendance + auto-completion. (attendees validated above)
        let presentCount = 0;
        let completionsCreated = 0;

        for (const a of attendees) {
            if (!validateUUID(a.participant_id)) continue;
            const status = ATTENDANCE_STATUSES.includes(a.status || '') ? a.status : 'present';

            // Resolve this participant's active enrollment in this curriculum (if any).
            const enrollRows = await sql`
                SELECT id, status FROM curriculum_enrollments
                WHERE curriculum_id = ${params.id}::uuid AND participant_id = ${a.participant_id}::uuid
                    AND organization_id = ${ctx.organizationId}
            `;
            const enrollmentId: string | null = enrollRows.length ? enrollRows[0].id : null;

            await sql`
                INSERT INTO session_attendance (session_id, participant_id, enrollment_id, organization_id, status)
                VALUES (${session.id}::uuid, ${a.participant_id}::uuid, ${enrollmentId}::uuid, ${ctx.organizationId}::uuid, ${status})
                ON CONFLICT (session_id, participant_id)
                DO UPDATE SET status = EXCLUDED.status, enrollment_id = EXCLUDED.enrollment_id
            `;

            if (status === 'present') {
                presentCount++;
                // Auto-mark module completion for present + actively enrolled participants.
                if (enrollmentId && enrollRows[0].status === 'active') {
                    const mc = await sql`
                        INSERT INTO module_completions
                            (enrollment_id, module_id, organization_id, facilitator_id, duration_minutes)
                        VALUES (${enrollmentId}::uuid, ${module_id}::uuid, ${ctx.organizationId}::uuid, ${ctx.userId}::uuid,
                            ${duration_minutes != null ? Number(duration_minutes) : null})
                        ON CONFLICT (enrollment_id, module_id) DO NOTHING
                        RETURNING id
                    `;
                    if (mc.length) completionsCreated++;

                    // If this enrollment has now completed every module, mark it completed.
                    await sql`
                        UPDATE curriculum_enrollments e SET status = 'completed', completed_at = NOW()
                        WHERE e.id = ${enrollmentId}::uuid AND e.status = 'active'
                            AND (SELECT COUNT(*) FROM module_completions mc WHERE mc.enrollment_id = e.id)
                                >= (SELECT COUNT(*) FROM curriculum_modules cm WHERE cm.curriculum_id = ${params.id}::uuid)
                    `;
                }
            }
        }

        await logAuditEvent(ctx.userId, ctx.organizationId, 'create', 'curriculum_session', session.id);
        return NextResponse.json({
            success: true,
            session,
            present_count: presentCount,
            completions_created: completionsCreated,
        });
    } catch (error) {
        console.error('Sessions POST error:', error);
        return NextResponse.json({ error: 'Failed to log session' }, { status: 500 });
    }
}
