import { NextRequest, NextResponse } from "next/server";
import { requireOrgRole } from "@/lib/auth";
import { sql } from "@/lib/db";

export const runtime = "nodejs";
export const maxDuration = 60;

// Leadership-only agency analytics. Read-only org-wide rollups.
// Each sub-query is isolated in its own try/catch so a missing table
// (modules ship incrementally) degrades that metric to null/empty rather
// than failing the whole page.
const LEADERSHIP_ROLES = ["supervisor", "admin", "owner"];

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const organizationId = searchParams.get("organization_id");

    if (!organizationId) {
        return NextResponse.json(
            { error: "organization_id is required" },
            { status: 400 }
        );
    }

    // Role guard — supervisors and above only.
    try {
        await requireOrgRole(organizationId, LEADERSHIP_ROLES);
    } catch (err) {
        const message = err instanceof Error ? err.message : "Forbidden";
        if (message === "Unauthorized") {
            return NextResponse.json({ error: message }, { status: 401 });
        }
        // "Organization access denied" or "Insufficient permissions"
        return NextResponse.json({ error: message }, { status: 403 });
    }

    const failed: string[] = [];

    // ── notesPerPss — session notes by author, last 30 days ─────────────────
    let notesPerPss: Array<{ userId: string | null; name: string; count: number }> = [];
    try {
        const rows = await sql`
            SELECT sn.user_id AS user_id,
                   COALESCE(NULLIF(TRIM(u.first_name || ' ' || u.last_name), ''), 'Unknown') AS name,
                   COUNT(*)::int AS count
            FROM session_notes sn
            LEFT JOIN users u ON sn.user_id = u.id
            WHERE sn.organization_id = ${organizationId}
              AND sn.is_archived = false
              AND sn.created_at >= NOW() - INTERVAL '30 days'
            GROUP BY sn.user_id, u.first_name, u.last_name
            ORDER BY count DESC
        `;
        notesPerPss = rows.map((r: any) => ({
            userId: r.user_id,
            name: r.name,
            count: Number(r.count),
        }));
    } catch (e) {
        console.error("[analytics] notesPerPss failed:", e);
        failed.push("notesPerPss");
    }

    // ── noteReviewStatus — counts by review_status across the org ───────────
    let noteReviewStatus: Record<string, number> = {
        draft: 0,
        submitted: 0,
        approved: 0,
        changes_requested: 0,
    };
    try {
        const rows = await sql`
            SELECT COALESCE(review_status, 'draft') AS review_status,
                   COUNT(*)::int AS count
            FROM session_notes
            WHERE organization_id = ${organizationId}
              AND is_archived = false
            GROUP BY review_status
        `;
        for (const r of rows as any[]) {
            noteReviewStatus[r.review_status] = Number(r.count);
        }
    } catch (e) {
        console.error("[analytics] noteReviewStatus failed:", e);
        failed.push("noteReviewStatus");
    }

    // ── billingReadiness — completed intakes with zero holds vs >0 ──────────
    let billingReadiness: { ready: number; notReady: number; total: number } | null = null;
    try {
        const rows = await sql`
            SELECT
                COUNT(*) FILTER (
                    WHERE jsonb_array_length(COALESCE(billing_readiness_holds, '[]'::jsonb)) = 0
                )::int AS ready,
                COUNT(*) FILTER (
                    WHERE jsonb_array_length(COALESCE(billing_readiness_holds, '[]'::jsonb)) > 0
                )::int AS not_ready,
                COUNT(*)::int AS total
            FROM participant_intakes
            WHERE organization_id = ${organizationId}
              AND status = 'completed'
        `;
        const r: any = rows[0] || {};
        billingReadiness = {
            ready: Number(r.ready) || 0,
            notReady: Number(r.not_ready) || 0,
            total: Number(r.total) || 0,
        };
    } catch (e) {
        console.error("[analytics] billingReadiness failed:", e);
        failed.push("billingReadiness");
    }

    // ── assessmentCompletion — administered by type (90d) + overdue count ───
    let assessmentCompletion: {
        byType: Array<{ type: string; count: number }>;
        overdueSchedules: number | null;
    } = { byType: [], overdueSchedules: null };
    try {
        const rows = await sql`
            SELECT COALESCE(assessment_type, 'unknown') AS type,
                   COUNT(*)::int AS count
            FROM recovery_assessments
            WHERE organization_id = ${organizationId}
              AND assessment_date >= (CURRENT_DATE - INTERVAL '90 days')
            GROUP BY assessment_type
            ORDER BY count DESC
        `;
        assessmentCompletion.byType = (rows as any[]).map((r) => ({
            type: r.type,
            count: Number(r.count),
        }));
    } catch (e) {
        console.error("[analytics] assessmentCompletion.byType failed:", e);
        failed.push("assessmentCompletion.byType");
    }
    try {
        const rows = await sql`
            SELECT COUNT(*)::int AS overdue
            FROM assessment_schedules
            WHERE organization_id = ${organizationId}
              AND is_active = true
              AND next_due_date IS NOT NULL
              AND next_due_date < CURRENT_DATE
        `;
        assessmentCompletion.overdueSchedules = Number((rows[0] as any)?.overdue) || 0;
    } catch (e) {
        console.error("[analytics] assessmentCompletion.overdue failed:", e);
        failed.push("assessmentCompletion.overdue");
    }

    // ── caseloadDistribution — active participants by primary PSS + unassigned ─
    let caseloadDistribution: {
        byPss: Array<{ pssId: string; name: string; count: number }>;
        unassigned: number;
    } = { byPss: [], unassigned: 0 };
    try {
        const rows = await sql`
            SELECT p.primary_pss_id AS pss_id,
                   COALESCE(NULLIF(TRIM(u.first_name || ' ' || u.last_name), ''), 'Unknown') AS name,
                   COUNT(*)::int AS count
            FROM participants p
            LEFT JOIN users u ON p.primary_pss_id = u.id
            WHERE p.organization_id = ${organizationId}
              AND p.status = 'active'
            GROUP BY p.primary_pss_id, u.first_name, u.last_name
            ORDER BY count DESC
        `;
        for (const r of rows as any[]) {
            if (!r.pss_id) {
                caseloadDistribution.unassigned += Number(r.count);
            } else {
                caseloadDistribution.byPss.push({
                    pssId: r.pss_id,
                    name: r.name,
                    count: Number(r.count),
                });
            }
        }
    } catch (e) {
        console.error("[analytics] caseloadDistribution failed:", e);
        failed.push("caseloadDistribution");
    }

    // ── activeSupport — active participants touched in last 14 days vs total ─
    let activeSupport: { active14d: number; totalActive: number } | null = null;
    try {
        const rows = await sql`
            SELECT
                COUNT(*)::int AS total_active,
                COUNT(*) FILTER (WHERE
                    EXISTS (
                        SELECT 1 FROM session_notes sn
                        WHERE sn.participant_id = p.id
                          AND sn.created_at >= NOW() - INTERVAL '14 days'
                    )
                    OR EXISTS (
                        SELECT 1 FROM group_attendance ga
                        WHERE ga.participant_id = p.id
                          AND ga.check_in_time >= NOW() - INTERVAL '14 days'
                    )
                    OR EXISTS (
                        SELECT 1 FROM service_plans sp
                        WHERE sp.participant_id = p.id
                          AND sp.created_at >= NOW() - INTERVAL '14 days'
                    )
                )::int AS active_14d
            FROM participants p
            WHERE p.organization_id = ${organizationId}
              AND p.status = 'active'
        `;
        const r: any = rows[0] || {};
        activeSupport = {
            active14d: Number(r.active_14d) || 0,
            totalActive: Number(r.total_active) || 0,
        };
    } catch (e) {
        console.error("[analytics] activeSupport failed:", e);
        failed.push("activeSupport");
    }

    // ── serviceActivity — service_plans by status over last 30 days ─────────
    let serviceActivity: { byStatus: Array<{ status: string; count: number }> } | null = null;
    try {
        const rows = await sql`
            SELECT COALESCE(status, 'unknown') AS status,
                   COUNT(*)::int AS count
            FROM service_plans
            WHERE organization_id = ${organizationId}
              AND created_at >= NOW() - INTERVAL '30 days'
            GROUP BY status
            ORDER BY count DESC
        `;
        serviceActivity = {
            byStatus: (rows as any[]).map((r) => ({
                status: r.status,
                count: Number(r.count),
            })),
        };
    } catch (e) {
        console.error("[analytics] serviceActivity failed:", e);
        failed.push("serviceActivity");
    }

    return NextResponse.json({
        organizationId,
        generatedAt: new Date().toISOString(),
        ranges: {
            notesPerPssDays: 30,
            assessmentsDays: 90,
            activeSupportDays: 14,
            serviceActivityDays: 30,
        },
        notesPerPss,
        noteReviewStatus,
        billingReadiness,
        assessmentCompletion,
        caseloadDistribution,
        activeSupport,
        serviceActivity,
        failedMetrics: failed,
    });
}
