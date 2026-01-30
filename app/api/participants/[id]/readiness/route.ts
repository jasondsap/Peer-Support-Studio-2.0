import { NextRequest, NextResponse } from "next/server";
import { getSessionWithUserId, requireOrgAccess } from "@/lib/auth";
import { sql, logAuditEvent } from "@/lib/db";

// GET - Fetch all readiness items for a participant
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

        // Verify participant exists and belongs to organization
        const participant = await sql`
            SELECT id, is_reentry_participant 
            FROM participants 
            WHERE id = ${participantId} AND organization_id = ${organizationId}
        `;

        if (participant.length === 0) {
            return NextResponse.json(
                { error: "Participant not found" },
                { status: 404 }
            );
        }

        // Get readiness items with definitions
        const items = await sql`
            SELECT 
                pri.id,
                pri.participant_id,
                pri.organization_id,
                pri.item_key,
                pri.status,
                pri.obtained_date,
                pri.expiration_date,
                pri.notes,
                pri.created_at,
                pri.updated_at,
                rid.category,
                rid.item_label,
                rid.description,
                rid.display_order
            FROM participant_readiness_items pri
            JOIN readiness_item_definitions rid ON pri.item_key = rid.item_key
            WHERE pri.participant_id = ${participantId}
            AND pri.organization_id = ${organizationId}
            ORDER BY rid.display_order ASC
        `;

        // Calculate summary statistics
        const summary = {
            obtained_count: items.filter((i: any) => i.status === 'obtained').length,
            in_progress_count: items.filter((i: any) => i.status === 'in_progress').length,
            missing_count: items.filter((i: any) => i.status === 'missing').length,
            expired_count: items.filter((i: any) => i.status === 'expired').length,
            not_needed_count: items.filter((i: any) => i.status === 'not_needed').length,
            total_items: items.length,
            completion_percentage: 0
        };

        const applicableItems = summary.total_items - summary.not_needed_count;
        if (applicableItems > 0) {
            summary.completion_percentage = Math.round(
                (summary.obtained_count / applicableItems) * 100
            );
        }

        return NextResponse.json({
            success: true,
            items,
            summary,
            is_reentry_participant: participant[0].is_reentry_participant
        });

    } catch (error) {
        console.error("Error fetching readiness items:", error);
        const message = error instanceof Error ? error.message : "Failed to fetch readiness items";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

// POST - Initialize readiness items for a participant
export async function POST(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getSessionWithUserId();
        const body = await req.json();
        const { organization_id } = body;
        const participantId = params.id;

        if (!organization_id) {
            return NextResponse.json(
                { error: "organization_id is required" },
                { status: 400 }
            );
        }

        // Verify org access
        await requireOrgAccess(organization_id);

        // Verify participant exists
        const participant = await sql`
            SELECT id FROM participants 
            WHERE id = ${participantId} AND organization_id = ${organization_id}
        `;

        if (participant.length === 0) {
            return NextResponse.json(
                { error: "Participant not found" },
                { status: 404 }
            );
        }

        // Get all active readiness item definitions
        const definitions = await sql`
            SELECT item_key FROM readiness_item_definitions WHERE is_active = true
        `;

        // Insert readiness items for this participant
        for (const def of definitions) {
            await sql`
                INSERT INTO participant_readiness_items 
                    (participant_id, organization_id, item_key, status, updated_by)
                VALUES 
                    (${participantId}, ${organization_id}, ${def.item_key}, 'missing', ${session.internalUserId})
                ON CONFLICT (participant_id, item_key) DO NOTHING
            `;
        }

        // Also mark participant as reentry participant
        await sql`
            UPDATE participants 
            SET is_reentry_participant = true, updated_at = NOW()
            WHERE id = ${participantId}
        `;

        // Fetch the created items
        const items = await sql`
            SELECT 
                pri.*,
                rid.category,
                rid.item_label,
                rid.description,
                rid.display_order
            FROM participant_readiness_items pri
            JOIN readiness_item_definitions rid ON pri.item_key = rid.item_key
            WHERE pri.participant_id = ${participantId}
            ORDER BY rid.display_order ASC
        `;

        // Log audit event
        await logAuditEvent(
            session.internalUserId,
            organization_id,
            "create",
            "readiness_checklist",
            participantId,
            { action: "initialize_checklist", items_count: items.length }
        );

        return NextResponse.json({
            success: true,
            items,
            message: 'Readiness checklist initialized'
        });

    } catch (error) {
        console.error("Error initializing readiness items:", error);
        const message = error instanceof Error ? error.message : "Failed to initialize readiness items";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

// PATCH - Update a specific readiness item
export async function PATCH(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getSessionWithUserId();
        const body = await req.json();
        const { 
            organization_id, 
            item_key, 
            status, 
            obtained_date, 
            expiration_date, 
            notes 
        } = body;
        const participantId = params.id;

        if (!organization_id || !item_key) {
            return NextResponse.json(
                { error: "organization_id and item_key are required" },
                { status: 400 }
            );
        }

        // Verify org access
        await requireOrgAccess(organization_id);

        // Validate status
        const validStatuses = ['not_needed', 'missing', 'in_progress', 'obtained', 'expired'];
        if (status && !validStatuses.includes(status)) {
            return NextResponse.json(
                { error: "Invalid status" },
                { status: 400 }
            );
        }

        // Update the readiness item
        const result = await sql`
            UPDATE participant_readiness_items
            SET 
                status = COALESCE(${status}, status),
                obtained_date = ${obtained_date || null},
                expiration_date = ${expiration_date || null},
                notes = COALESCE(${notes}, notes),
                updated_at = NOW(),
                updated_by = ${session.internalUserId}
            WHERE participant_id = ${participantId}
            AND organization_id = ${organization_id}
            AND item_key = ${item_key}
            RETURNING *
        `;

        if (result.length === 0) {
            return NextResponse.json(
                { error: "Readiness item not found" },
                { status: 404 }
            );
        }

        // Fetch updated item with definition data
        const updated = await sql`
            SELECT 
                pri.*,
                rid.category,
                rid.item_label,
                rid.description,
                rid.display_order
            FROM participant_readiness_items pri
            JOIN readiness_item_definitions rid ON pri.item_key = rid.item_key
            WHERE pri.id = ${result[0].id}
        `;

        // Log audit event
        await logAuditEvent(
            session.internalUserId,
            organization_id,
            "update",
            "readiness_item",
            result[0].id,
            { item_key, status, participant_id: participantId }
        );

        return NextResponse.json({
            success: true,
            item: updated[0]
        });

    } catch (error) {
        console.error("Error updating readiness item:", error);
        const message = error instanceof Error ? error.message : "Failed to update readiness item";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

// DELETE - Remove all readiness items for a participant (reset)
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

        // Delete all readiness items for this participant
        await sql`
            DELETE FROM participant_readiness_items
            WHERE participant_id = ${participantId}
            AND organization_id = ${organizationId}
        `;

        // Optionally unmark as reentry participant
        await sql`
            UPDATE participants 
            SET is_reentry_participant = false, updated_at = NOW()
            WHERE id = ${participantId}
        `;

        // Log audit event
        await logAuditEvent(
            session.internalUserId,
            organizationId,
            "delete",
            "readiness_checklist",
            participantId,
            { action: "remove_checklist" }
        );

        return NextResponse.json({
            success: true,
            message: 'Readiness checklist removed'
        });

    } catch (error) {
        console.error("Error removing readiness items:", error);
        const message = error instanceof Error ? error.message : "Failed to remove readiness items";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
