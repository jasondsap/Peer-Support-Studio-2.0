import { NextRequest, NextResponse } from "next/server";
import { getSessionWithUserId, requireOrgAccess } from "@/lib/auth";
import { sql } from "@/lib/db";

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

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error("Error marking as read:", error);
        const message = error instanceof Error ? error.message : "Failed to mark as read";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
