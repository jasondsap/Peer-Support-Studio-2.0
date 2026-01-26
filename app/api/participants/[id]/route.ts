import { NextRequest, NextResponse } from "next/server";
import { getSessionWithUserId, requireOrgAccess } from "@/lib/auth";
import { sql, logAuditEvent } from "@/lib/db";

// GET - Get a single participant by ID
export async function GET(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getSessionWithUserId();
        const { searchParams } = new URL(req.url);
        const organizationId = searchParams.get("organization_id");
        const participantId = params.id;

        if (!organizationId) {
            return NextResponse.json(
                { error: "organization_id is required" },
                { status: 400 }
            );
        }

        // Verify org access
        await requireOrgAccess(organizationId);

        // Fetch participant with related data
        const participants = await sql`
            SELECT 
                p.*,
                u.first_name || ' ' || u.last_name as primary_pss_name,
                u.email as primary_pss_email,
                (SELECT COUNT(*) FROM saved_goals g WHERE g.participant_id = p.id AND g.status != 'abandoned') as goals_count,
                (SELECT COUNT(*) FROM saved_goals g WHERE g.participant_id = p.id AND g.status = 'completed') as goals_completed,
                (SELECT COUNT(*) FROM session_notes sn WHERE sn.participant_id = p.id AND NOT sn.is_archived) as notes_count,
                (SELECT MAX(assessment_date) FROM recovery_assessments ra WHERE ra.participant_id = p.id) as last_assessment,
                (SELECT MAX(created_at) FROM session_notes sn WHERE sn.participant_id = p.id) as last_session
            FROM participants p
            LEFT JOIN users u ON p.primary_pss_id = u.id
            WHERE p.id = ${participantId}
            AND p.organization_id = ${organizationId}
        `;

        if (participants.length === 0) {
            return NextResponse.json(
                { error: "Participant not found" },
                { status: 404 }
            );
        }

        const participant = participants[0];

        // Fetch care team - using correct columns
        let careTeam: any[] = [];
        try {
            careTeam = await sql`
                SELECT 
                    pct.id,
                    pct.participant_id,
                    pct.user_id,
                    pct.role,
                    pct.is_primary,
                    pct.assigned_at,
                    pct.assigned_by,
                    u.first_name,
                    u.last_name,
                    u.email
                FROM participant_care_team pct
                JOIN users u ON pct.user_id = u.id
                WHERE pct.participant_id = ${participantId}
                ORDER BY pct.is_primary DESC, pct.assigned_at ASC
            `;
        } catch (e) {
            // Care team table might not exist or have different structure
            console.log("Care team query failed, skipping:", e);
        }

        // Fetch recent goals - using correct columns
        const recentGoals = await sql`
            SELECT id, smart_goal, goal_area, desired_outcome, status, timeframe, created_at
            FROM saved_goals
            WHERE participant_id = ${participantId}
            ORDER BY created_at DESC
            LIMIT 5
        `;

        // Fetch recent session notes - using correct columns
        const recentNotes = await sql`
            SELECT id, created_at, source, status, is_archived
            FROM session_notes
            WHERE participant_id = ${participantId}
            AND NOT is_archived
            ORDER BY created_at DESC
            LIMIT 5
        `;

        // Fetch recent assessments - using correct columns
        const recentAssessments = await sql`
            SELECT id, assessment_type, assessment_date, total_score, ai_analysis, participant_name
            FROM recovery_assessments
            WHERE participant_id = ${participantId}
            ORDER BY assessment_date DESC
            LIMIT 5
        `;

        // Log audit event
        await logAuditEvent(
            session.internalUserId,
            organizationId,
            "read",
            "participant",
            participantId,
            { action: "view_detail" }
        );

        return NextResponse.json({
            participant,
            careTeam,
            recentGoals,
            recentNotes,
            recentAssessments,
        });
    } catch (error) {
        console.error("Error fetching participant:", error);
        const message = error instanceof Error ? error.message : "Failed to fetch participant";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

// PUT - Update a participant
export async function PUT(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getSessionWithUserId();
        const body = await req.json();
        const { organization_id, ...updateData } = body;
        const participantId = params.id;

        if (!organization_id) {
            return NextResponse.json(
                { error: "organization_id is required" },
                { status: 400 }
            );
        }

        // Verify org access
        await requireOrgAccess(organization_id);

        // Verify participant belongs to org
        const existing = await sql`
            SELECT id FROM participants 
            WHERE id = ${participantId} AND organization_id = ${organization_id}
        `;

        if (existing.length === 0) {
            return NextResponse.json(
                { error: "Participant not found" },
                { status: 404 }
            );
        }

        // Build dynamic update
        const allowedFields = [
            'first_name', 'last_name', 'preferred_name', 'date_of_birth',
            'gender', 'email', 'phone', 'address_line1', 'address_line2',
            'city', 'state', 'zip', 'emergency_contact_name',
            'emergency_contact_phone', 'emergency_contact_relationship',
            'status', 'referral_source', 'discharge_date', 'discharge_reason',
            'primary_pss_id', 'internal_notes'
        ];

        const setClauses: string[] = [];
        const values: unknown[] = [];

        for (const field of allowedFields) {
            if (field in updateData) {
                setClauses.push(`${field} = $${values.length + 1}`);
                values.push(updateData[field] === '' ? null : updateData[field]);
            }
        }

        if (setClauses.length === 0) {
            return NextResponse.json(
                { error: "No valid fields to update" },
                { status: 400 }
            );
        }

        // Add participant ID as last parameter
        values.push(participantId);

        const updateQuery = `
            UPDATE participants 
            SET ${setClauses.join(', ')}, updated_at = NOW()
            WHERE id = $${values.length}
            RETURNING *
        `;

        const result = await sql(updateQuery, values);

        // Log audit event
        await logAuditEvent(
            session.internalUserId,
            organization_id,
            "update",
            "participant",
            participantId,
            { updated_fields: Object.keys(updateData) }
        );

        return NextResponse.json({ participant: result[0] });
    } catch (error) {
        console.error("Error updating participant:", error);
        const message = error instanceof Error ? error.message : "Failed to update participant";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

// DELETE - Archive a participant
export async function DELETE(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getSessionWithUserId();
        const { searchParams } = new URL(req.url);
        const organizationId = searchParams.get("organization_id");
        const participantId = params.id;

        if (!organizationId) {
            return NextResponse.json(
                { error: "organization_id is required" },
                { status: 400 }
            );
        }

        // Verify org access
        await requireOrgAccess(organizationId);

        // Soft delete
        await sql`
            UPDATE participants 
            SET status = 'discharged', 
                discharge_date = CURRENT_DATE,
                updated_at = NOW()
            WHERE id = ${participantId} AND organization_id = ${organizationId}
        `;

        // Log audit event
        await logAuditEvent(
            session.internalUserId,
            organizationId,
            "delete",
            "participant",
            participantId,
            { action: "soft_delete" }
        );

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error archiving participant:", error);
        const message = error instanceof Error ? error.message : "Failed to archive participant";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
