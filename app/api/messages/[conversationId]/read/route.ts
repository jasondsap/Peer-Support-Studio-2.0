import { NextRequest, NextResponse } from "next/server";
import { getSessionWithUserId, requireOrgAccess } from "@/lib/auth";
import { sql, logAuditEvent } from "@/lib/db";

// ============================================================================
// POST - Mark conversation as read
// ============================================================================

export async function POST(
    req: NextRequest,
    { params }: { params: { conversationId: string } }
) {
    try {
        const session = await getSessionWithUserId();
        const body = await req.json();
        const { organization_id } = body;
        const conversationId = params.conversationId;

        if (!organization_id) {
            return NextResponse.json(
                { error: "organization_id is required" },
                { status: 400 }
            );
        }

        await requireOrgAccess(organization_id);

        // Update the member's read status
        const result = await sql`
            UPDATE conversation_members
            SET 
                last_read_at = NOW(),
                unread_count = 0
            WHERE conversation_id = ${conversationId}
            AND user_id = ${session.internalUserId}
            AND is_active = true
            RETURNING id
        `;

        if (result.length === 0) {
            return NextResponse.json(
                { error: "Not a member of this conversation" },
                { status: 403 }
            );
        }

        // Advance real delivery/read state on the underlying messages so the
        // check / double-check UI tells the truth. A reader implicitly receives
        // (delivered) and reads every message in the thread they did NOT send.
        // Best-effort: a failure here must not fail marking the thread read.
        let readReceiptCount = 0;
        try {
            const advanced = await sql`
                UPDATE messages
                SET
                    delivered_at = COALESCE(delivered_at, NOW()),
                    read_at      = COALESCE(read_at, NOW()),
                    status       = CASE WHEN status <> 'read' THEN 'read' ELSE status END
                WHERE conversation_id = ${conversationId}
                  AND status <> 'deleted'
                  AND (sender_user_id IS DISTINCT FROM ${session.internalUserId})
                  AND read_at IS NULL
                RETURNING id
            `;
            readReceiptCount = advanced.length;
        } catch (err) {
            console.error("Error advancing read receipts:", err);
        }

        // Audit thread READ (Phase 0 only audited conversation creation).
        await logAuditEvent(
            session.internalUserId,
            organization_id,
            "read",
            "conversation",
            conversationId,
            { messages_marked_read: readReceiptCount }
        );

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error("Error marking as read:", error);
        const message = error instanceof Error ? error.message : "Failed to mark as read";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
