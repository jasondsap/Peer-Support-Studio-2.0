import { NextRequest, NextResponse } from 'next/server';
import { getSession, getInternalUserId, requireOrgAccess } from '@/lib/auth';
import { sql } from '@/lib/db';

export const runtime = 'nodejs';

// ============================================================================
// GET /api/dashboard?organization_id=...
// One aggregation endpoint powering the PSS work-queue dashboard.
// Every sub-query is org-scoped and individually guarded: a missing table or
// column degrades that one section to empty rather than 500-ing the page.
// ============================================================================
export async function GET(req: NextRequest) {
    try {
        const session = await getSession();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const organizationId = searchParams.get('organization_id');
        if (!organizationId) {
            return NextResponse.json({ error: 'organization_id is required' }, { status: 400 });
        }

        // Org membership + role
        let role = '';
        try {
            const { organization } = await requireOrgAccess(organizationId);
            role = organization?.role || '';
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Organization access denied';
            return NextResponse.json({ error: message }, { status: 403 });
        }

        const internalUserId = await getInternalUserId(session.user.id, session.user.email);
        if (!internalUserId) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const isSupervisor = ['supervisor', 'admin', 'owner'].includes(role);

        // Run all sections concurrently; each resolves to its section payload.
        const [
            myCaseload,
            myOpenNotes,
            notesAwaitingReview,
            overduePlanReviews,
            assessmentsDue,
            todaysGroups,
            activeSupportCount,
        ] = await Promise.all([
            // ── My caseload ─────────────────────────────────────────────────
            (async () => {
                try {
                    const rows = await sql`
                        SELECT
                            p.id,
                            TRIM(COALESCE(NULLIF(p.preferred_name, ''), p.first_name) || ' ' || p.last_name) AS name,
                            p.status,
                            (SELECT MAX(sn.created_at) FROM session_notes sn
                               WHERE sn.participant_id = p.id AND NOT sn.is_archived) AS last_session,
                            (SELECT MAX(ra.assessment_date) FROM recovery_assessments ra
                               WHERE ra.participant_id = p.id) AS last_assessment
                        FROM participants p
                        WHERE p.organization_id = ${organizationId}
                          AND p.primary_pss_id = ${internalUserId}
                          AND COALESCE(p.status, 'active') NOT IN ('discharged', 'archived', 'inactive')
                        ORDER BY p.last_name, p.first_name
                        LIMIT 100
                    `;
                    return { count: rows.length, items: rows.slice(0, 12) };
                } catch (e) {
                    console.error('dashboard myCaseload failed:', e);
                    return { count: 0, items: [] };
                }
            })(),

            // ── My open notes (draft / changes_requested) ───────────────────
            (async () => {
                try {
                    const rows = await sql`
                        SELECT
                            sn.id,
                            sn.created_at,
                            sn.review_status,
                            sn.participant_id,
                            TRIM(COALESCE(NULLIF(p.preferred_name, ''), p.first_name) || ' ' || p.last_name) AS participant_name
                        FROM session_notes sn
                        LEFT JOIN participants p ON p.id = sn.participant_id
                        WHERE sn.organization_id = ${organizationId}
                          AND sn.user_id = ${internalUserId}
                          AND sn.review_status IN ('draft', 'changes_requested')
                          AND NOT sn.is_archived
                        ORDER BY sn.created_at DESC
                        LIMIT 50
                    `;
                    return { count: rows.length, items: rows.slice(0, 10) };
                } catch (e) {
                    console.error('dashboard myOpenNotes failed:', e);
                    return { count: 0, items: [] };
                }
            })(),

            // ── Notes awaiting review (supervisors/admins/owners only) ───────
            (async () => {
                if (!isSupervisor) return null;
                try {
                    const rows = await sql`
                        SELECT
                            sn.id,
                            sn.created_at,
                            sn.submitted_at,
                            sn.participant_id,
                            TRIM(COALESCE(NULLIF(p.preferred_name, ''), p.first_name) || ' ' || p.last_name) AS participant_name,
                            TRIM(COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '')) AS author_name
                        FROM session_notes sn
                        LEFT JOIN participants p ON p.id = sn.participant_id
                        LEFT JOIN users u ON u.id = sn.user_id
                        WHERE sn.organization_id = ${organizationId}
                          AND sn.review_status = 'submitted'
                          AND NOT sn.is_archived
                        ORDER BY COALESCE(sn.submitted_at, sn.created_at) ASC
                        LIMIT 50
                    `;
                    return { count: rows.length, items: rows.slice(0, 10) };
                } catch (e) {
                    console.error('dashboard notesAwaitingReview failed:', e);
                    return { count: 0, items: [] };
                }
            })(),

            // ── Overdue plan reviews (my caseload, or whole org if supervisor) ─
            (async () => {
                try {
                    const rows = isSupervisor
                        ? await sql`
                            SELECT
                                rp.id,
                                rp.plan_name,
                                rp.next_review_date,
                                rp.participant_id,
                                TRIM(COALESCE(NULLIF(p.preferred_name, ''), p.first_name) || ' ' || p.last_name) AS participant_name
                            FROM rc_plans rp
                            LEFT JOIN participants p ON p.id = rp.participant_id
                            WHERE rp.organization_id = ${organizationId}
                              AND rp.status = 'active'
                              AND rp.next_review_date IS NOT NULL
                              AND rp.next_review_date < CURRENT_DATE
                            ORDER BY rp.next_review_date ASC
                            LIMIT 50
                        `
                        : await sql`
                            SELECT
                                rp.id,
                                rp.plan_name,
                                rp.next_review_date,
                                rp.participant_id,
                                TRIM(COALESCE(NULLIF(p.preferred_name, ''), p.first_name) || ' ' || p.last_name) AS participant_name
                            FROM rc_plans rp
                            JOIN participants p ON p.id = rp.participant_id
                            WHERE rp.organization_id = ${organizationId}
                              AND rp.status = 'active'
                              AND rp.next_review_date IS NOT NULL
                              AND rp.next_review_date < CURRENT_DATE
                              AND p.primary_pss_id = ${internalUserId}
                            ORDER BY rp.next_review_date ASC
                            LIMIT 50
                        `;
                    return { count: rows.length, items: rows.slice(0, 10) };
                } catch (e) {
                    console.error('dashboard overduePlanReviews failed:', e);
                    return { count: 0, items: [] };
                }
            })(),

            // ── Assessments due (Phase 2 assessment_schedules; may be empty) ──
            (async () => {
                try {
                    const rows = await sql`
                        SELECT
                            a.id,
                            a.participant_id,
                            a.assessment_type,
                            a.next_due_date,
                            TRIM(COALESCE(NULLIF(p.preferred_name, ''), p.first_name) || ' ' || p.last_name) AS participant_name
                        FROM assessment_schedules a
                        LEFT JOIN participants p ON p.id = a.participant_id
                        WHERE a.organization_id = ${organizationId}
                          AND a.is_active
                          AND a.next_due_date IS NOT NULL
                          AND a.next_due_date <= CURRENT_DATE
                        ORDER BY a.next_due_date ASC
                        LIMIT 50
                    `;
                    return { count: rows.length, items: rows.slice(0, 10) };
                } catch (e) {
                    console.error('dashboard assessmentsDue failed:', e);
                    return { count: 0, items: [] };
                }
            })(),

            // ── Today's groups (group_activities + curriculum_sessions) ──────
            (async () => {
                const items: any[] = [];
                try {
                    const groups = await sql`
                        SELECT
                            a.id,
                            a.name,
                            a.activity_type,
                            a.start_time,
                            (SELECT COUNT(*)::int FROM group_attendance ga
                               WHERE ga.activity_id = a.id AND ga.attendance_status <> 'no_show') AS attendee_count
                        FROM group_activities a
                        WHERE a.organization_id = ${organizationId}
                          AND a.activity_date = CURRENT_DATE
                          AND a.status = 'active'
                        ORDER BY a.start_time ASC NULLS LAST
                    `;
                    for (const g of groups) {
                        items.push({
                            id: g.id,
                            source: 'group_activity',
                            name: g.name,
                            activity_type: g.activity_type,
                            start_time: g.start_time,
                            attendee_count: g.attendee_count,
                            href: '/groups',
                        });
                    }
                } catch (e) {
                    console.error('dashboard todaysGroups (group_activities) failed:', e);
                }
                try {
                    const sessions = await sql`
                        SELECT
                            cs.id,
                            cs.start_time,
                            c.name AS curriculum_name,
                            m.title AS module_title
                        FROM curriculum_sessions cs
                        LEFT JOIN curricula c ON c.id = cs.curriculum_id
                        LEFT JOIN curriculum_modules m ON m.id = cs.module_id
                        WHERE cs.organization_id = ${organizationId}
                          AND cs.session_date = CURRENT_DATE
                        ORDER BY cs.start_time ASC NULLS LAST
                    `;
                    for (const s of sessions) {
                        items.push({
                            id: s.id,
                            source: 'curriculum_session',
                            name: [s.curriculum_name, s.module_title].filter(Boolean).join(' — ') || 'Curriculum session',
                            activity_type: 'curriculum',
                            start_time: s.start_time,
                            href: '/curricula',
                        });
                    }
                } catch (e) {
                    console.error('dashboard todaysGroups (curriculum_sessions) failed:', e);
                }
                items.sort((a, b) => String(a.start_time || '~').localeCompare(String(b.start_time || '~')));
                return { count: items.length, items };
            })(),

            // ── Active support count (any interaction in last 14 days) ───────
            // Each source is guarded independently so one missing table/column
            // doesn't zero out the whole metric; distinct participants are
            // unioned in JS.
            (async () => {
                const active = new Set<string>();
                const sources: Promise<void>[] = [
                    (async () => {
                        try {
                            const rows = await sql`
                                SELECT DISTINCT sn.participant_id AS pid
                                FROM session_notes sn
                                WHERE sn.organization_id = ${organizationId}
                                  AND sn.participant_id IS NOT NULL
                                  AND NOT sn.is_archived
                                  AND sn.created_at >= CURRENT_DATE - INTERVAL '14 days'
                            `;
                            for (const r of rows) if (r.pid) active.add(r.pid);
                        } catch (e) {
                            console.error('dashboard activeSupport (session_notes) failed:', e);
                        }
                    })(),
                    (async () => {
                        try {
                            const rows = await sql`
                                SELECT DISTINCT ga.participant_id AS pid
                                FROM group_attendance ga
                                WHERE ga.organization_id = ${organizationId}
                                  AND ga.participant_id IS NOT NULL
                                  AND ga.check_in_time >= CURRENT_DATE - INTERVAL '14 days'
                            `;
                            for (const r of rows) if (r.pid) active.add(r.pid);
                        } catch (e) {
                            console.error('dashboard activeSupport (group_attendance) failed:', e);
                        }
                    })(),
                    (async () => {
                        try {
                            const rows = await sql`
                                SELECT DISTINCT sp.participant_id AS pid
                                FROM service_plans sp
                                WHERE sp.organization_id = ${organizationId}
                                  AND sp.participant_id IS NOT NULL
                                  AND sp.planned_date >= CURRENT_DATE - INTERVAL '14 days'
                            `;
                            for (const r of rows) if (r.pid) active.add(r.pid);
                        } catch (e) {
                            console.error('dashboard activeSupport (service_plans) failed:', e);
                        }
                    })(),
                ];
                await Promise.all(sources);
                return active.size;
            })(),
        ]);

        return NextResponse.json({
            role,
            isSupervisor,
            activeSupportCount,
            myCaseload,
            myOpenNotes,
            notesAwaitingReview, // null when the viewer is not a supervisor
            overduePlanReviews,
            assessmentsDue,
            todaysGroups,
        });
    } catch (error) {
        console.error('Error building dashboard:', error);
        const message = error instanceof Error ? error.message : 'Failed to load dashboard';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
