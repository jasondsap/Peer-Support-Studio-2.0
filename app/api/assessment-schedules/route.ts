import { NextRequest, NextResponse } from "next/server";
import { getSessionWithUserId, requireOrgAccess } from "@/lib/auth";
import { sql, logAuditEvent } from "@/lib/db";

// ============================================================================
// Reassessment cadence schedules.
//
// Table: assessment_schedules(
//   id, organization_id, participant_id, assessment_type,
//   interval_days default 90, next_due_date, last_completed_at,
//   is_active default true, created_by, created_at, updated_at
// )  UNIQUE(participant_id, assessment_type)
//
// All endpoints are org-scoped, guarded by requireOrgAccess, and audited.
// ============================================================================

const VALID_TYPES = ["barc10", "mirc28"];

function normalizeInterval(value: unknown): number | null {
    if (value === undefined || value === null || value === "") return null;
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return null;
    return Math.round(n);
}

// GET — schedules for a participant, or all active schedules for an org.
//   ?organization_id=&participant_id=  -> that participant's schedules
//   ?organization_id=                  -> all active schedules for the org
export async function GET(req: NextRequest) {
    try {
        const session = await getSessionWithUserId();
        const { searchParams } = new URL(req.url);
        const organizationId = searchParams.get("organization_id");
        const participantId = searchParams.get("participant_id");

        if (!organizationId) {
            return NextResponse.json(
                { error: "organization_id is required" },
                { status: 400 }
            );
        }

        await requireOrgAccess(organizationId);

        let schedules: any[] = [];
        if (participantId) {
            schedules = await sql`
                SELECT *,
                    (is_active AND next_due_date IS NOT NULL AND next_due_date < CURRENT_DATE) AS is_overdue
                FROM assessment_schedules
                WHERE organization_id = ${organizationId}
                  AND participant_id = ${participantId}
                ORDER BY assessment_type ASC
            `;
        } else {
            // Org-wide view: active schedules, soonest-due first, with participant name.
            schedules = await sql`
                SELECT s.*,
                    (s.is_active AND s.next_due_date IS NOT NULL AND s.next_due_date < CURRENT_DATE) AS is_overdue,
                    p.first_name AS participant_first_name,
                    p.last_name AS participant_last_name,
                    p.preferred_name AS participant_preferred_name
                FROM assessment_schedules s
                LEFT JOIN participants p ON p.id = s.participant_id
                WHERE s.organization_id = ${organizationId}
                  AND s.is_active = true
                ORDER BY s.next_due_date ASC NULLS LAST
            `;
        }

        return NextResponse.json({ schedules });
    } catch (error) {
        console.error("Error fetching assessment schedules:", error);
        const message = error instanceof Error ? error.message : "Failed to fetch schedules";
        const status = message.includes("access denied") ? 403 : 500;
        return NextResponse.json({ error: message }, { status });
    }
}

// Accept a 'YYYY-MM-DD' date string (or 'now'/'today' for today). Returns the
// normalized date string, or null if not provided/invalid.
function normalizeDueDate(value: unknown): string | null {
    if (value === undefined || value === null || value === "") return null;
    if (typeof value !== "string") return null;
    const v = value.trim().toLowerCase();
    if (v === "now" || v === "today") {
        return new Date().toISOString().slice(0, 10);
    }
    // Strict YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) return value.trim();
    return null;
}

// POST — upsert a cadence for a participant + instrument.
//   { organization_id, participant_id, assessment_type, interval_days?, next_due_date? }
//   - interval_days: any positive number (preset 30/60/90 or custom). Default 90.
//   - next_due_date: optional explicit date ('YYYY-MM-DD', or 'now'/'today' for
//     "due now"); overrides the computed (CURRENT_DATE + interval) value.
export async function POST(req: NextRequest) {
    try {
        const session = await getSessionWithUserId();
        const body = await req.json();
        const { organization_id, participant_id, assessment_type } = body;
        const intervalDays = normalizeInterval(body.interval_days);
        const explicitDue = normalizeDueDate(body.next_due_date);

        if (!organization_id || !participant_id || !assessment_type) {
            return NextResponse.json(
                { error: "organization_id, participant_id and assessment_type are required" },
                { status: 400 }
            );
        }

        if (!VALID_TYPES.includes(assessment_type)) {
            return NextResponse.json(
                { error: `assessment_type must be one of: ${VALID_TYPES.join(", ")}` },
                { status: 400 }
            );
        }

        await requireOrgAccess(organization_id);

        // Confirm the participant belongs to this org (no cross-tenant writes).
        const participant = await sql`
            SELECT id FROM participants
            WHERE id = ${participant_id} AND organization_id = ${organization_id}
        `;
        if (participant.length === 0) {
            return NextResponse.json({ error: "Participant not found" }, { status: 404 });
        }

        const insertInterval = intervalDays ?? 90;
        const result = await sql`
            INSERT INTO assessment_schedules (
                organization_id, participant_id, assessment_type,
                interval_days, next_due_date, is_active, created_by
            ) VALUES (
                ${organization_id}, ${participant_id}, ${assessment_type},
                ${insertInterval},
                COALESCE(${explicitDue}::date, (CURRENT_DATE + ${insertInterval}::int)),
                true, ${session.internalUserId}
            )
            ON CONFLICT (participant_id, assessment_type) DO UPDATE SET
                interval_days = COALESCE(${intervalDays}::int, assessment_schedules.interval_days),
                next_due_date = COALESCE(
                    ${explicitDue}::date,
                    COALESCE(assessment_schedules.last_completed_at::date, CURRENT_DATE)
                        + COALESCE(${intervalDays}::int, assessment_schedules.interval_days)
                ),
                is_active = true,
                updated_at = now()
            RETURNING *
        `;

        await logAuditEvent(
            session.internalUserId,
            organization_id,
            "update",
            "assessment_schedule",
            result[0].id,
            { action: "upsert", assessment_type, interval_days: intervalDays, next_due_date: explicitDue, participant_id }
        );

        return NextResponse.json({ schedule: result[0] });
    } catch (error) {
        console.error("Error upserting assessment schedule:", error);
        const message = error instanceof Error ? error.message : "Failed to save schedule";
        const status = message.includes("access denied") ? 403 : 500;
        return NextResponse.json({ error: message }, { status });
    }
}

// PATCH — adjust interval / active state, or mark the assessment completed today.
//   { id, organization_id, interval_days?, is_active?, action? }
//   action: 'complete' -> last_completed_at = now(), next_due_date = CURRENT_DATE + interval_days
export async function PATCH(req: NextRequest) {
    try {
        const session = await getSessionWithUserId();
        const body = await req.json();
        const { id, organization_id, action } = body;
        const intervalDays = normalizeInterval(body.interval_days);
        const isActive = typeof body.is_active === "boolean" ? body.is_active : null;

        if (!id || !organization_id) {
            return NextResponse.json(
                { error: "id and organization_id are required" },
                { status: 400 }
            );
        }

        await requireOrgAccess(organization_id);

        const existing = await sql`
            SELECT id FROM assessment_schedules
            WHERE id = ${id} AND organization_id = ${organization_id}
        `;
        if (existing.length === 0) {
            return NextResponse.json({ error: "Schedule not found" }, { status: 404 });
        }

        let result: any[];
        if (action === "complete") {
            // Manual "mark reassessed today": stamp completion, push next due out.
            result = await sql`
                UPDATE assessment_schedules
                SET last_completed_at = now(),
                    interval_days = COALESCE(${intervalDays}::int, interval_days),
                    next_due_date = (CURRENT_DATE + COALESCE(${intervalDays}::int, interval_days)),
                    is_active = true,
                    updated_at = now()
                WHERE id = ${id} AND organization_id = ${organization_id}
                RETURNING *
            `;
        } else {
            result = await sql`
                UPDATE assessment_schedules
                SET interval_days = COALESCE(${intervalDays}::int, interval_days),
                    is_active = COALESCE(${isActive}::boolean, is_active),
                    next_due_date = (
                        COALESCE(last_completed_at::date, CURRENT_DATE)
                        + COALESCE(${intervalDays}::int, interval_days)
                    ),
                    updated_at = now()
                WHERE id = ${id} AND organization_id = ${organization_id}
                RETURNING *
            `;
        }

        await logAuditEvent(
            session.internalUserId,
            organization_id,
            "update",
            "assessment_schedule",
            id,
            { action: action === "complete" ? "mark_completed" : "update", interval_days: intervalDays, is_active: isActive }
        );

        return NextResponse.json({ schedule: result[0] });
    } catch (error) {
        console.error("Error updating assessment schedule:", error);
        const message = error instanceof Error ? error.message : "Failed to update schedule";
        const status = message.includes("access denied") ? 403 : 500;
        return NextResponse.json({ error: message }, { status });
    }
}

// DELETE — deactivate (soft) a schedule.  ?id=&organization_id=
export async function DELETE(req: NextRequest) {
    try {
        const session = await getSessionWithUserId();
        const { searchParams } = new URL(req.url);
        const id = searchParams.get("id");
        const organizationId = searchParams.get("organization_id");

        if (!id || !organizationId) {
            return NextResponse.json(
                { error: "id and organization_id are required" },
                { status: 400 }
            );
        }

        await requireOrgAccess(organizationId);

        const result = await sql`
            UPDATE assessment_schedules
            SET is_active = false, updated_at = now()
            WHERE id = ${id} AND organization_id = ${organizationId}
            RETURNING id
        `;

        if (result.length === 0) {
            return NextResponse.json({ error: "Schedule not found" }, { status: 404 });
        }

        await logAuditEvent(
            session.internalUserId,
            organizationId,
            "delete",
            "assessment_schedule",
            id,
            { action: "deactivate" }
        );

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error deleting assessment schedule:", error);
        const message = error instanceof Error ? error.message : "Failed to delete schedule";
        const status = message.includes("access denied") ? 403 : 500;
        return NextResponse.json({ error: message }, { status });
    }
}
