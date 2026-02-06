import { NextRequest, NextResponse } from "next/server";
import { getSessionWithUserId, requireOrgAccess } from "@/lib/auth";
import { sql, logAuditEvent } from "@/lib/db";

// ============================================================================
// GET - Fetch messages in a conversation
// ============================================================================

export async function GET(
    req: NextRequest,
    { params }: { params: { conversationId: string } }
) {
    try {
        const session = await getSessionWithUserId();
        const { searchParams } = new URL(req.url);
        const organizationId = searchParams.get("organization_id");
        const limit = parseInt(searchParams.get("limit") || "50");
        const before = searchParams.get("before"); // cursor for pagination
        const conversationId = params.conversationId;

        if (!organizationId) {
            return NextResponse.json(
                { error: "organization_id is required" },
                { status: 400 }
            );
        }

        await requireOrgAccess(organizationId);

        // Verify user is a member of this conversation
        const membership = await sql`
            SELECT cm.id, cm.last_read_at, cm.unread_count
            FROM conversation_members cm
            JOIN conversations c ON cm.conversation_id = c.id
            WHERE cm.conversation_id = ${conversationId}
            AND cm.user_id = ${session.internalUserId}
            AND cm.is_active = true
            AND c.organization_id = ${organizationId}
        `;

        if (membership.length === 0) {
            return NextResponse.json(
                { error: "Not a member of this conversation" },
                { status: 403 }
            );
        }

        // Fetch messages with sender info
        let messages;
        if (before) {
            messages = await sql`
                SELECT 
                    m.id,
                    m.conversation_id,
                    m.sender_type,
                    m.sender_user_id,
                    m.sender_participant_id,
                    m.content,
                    m.content_type,
                    m.related_type,
                    m.related_id,
                    m.status,
                    m.is_edited,
                    m.edited_at,
                    m.created_at,
                    -- Sender info
                    CASE 
                        WHEN m.sender_type = 'user' THEN json_build_object(
                            'id', u.id,
                            'name', u.first_name || ' ' || u.last_name,
                            'avatar_url', u.avatar_url
                        )
                        WHEN m.sender_type = 'participant' THEN json_build_object(
                            'id', p.id,
                            'name', COALESCE(p.preferred_name, p.first_name) || ' ' || p.last_name,
                            'avatar_url', null
                        )
                        ELSE json_build_object('name', 'System')
                    END as sender,
                    -- Attachments
                    (
                        SELECT json_agg(json_build_object(
                            'id', ma.id,
                            'file_name', ma.file_name,
                            'file_type', ma.file_type,
                            'file_size', ma.file_size,
                            'file_url', ma.file_url,
                            'thumbnail_url', ma.thumbnail_url
                        ))
                        FROM message_attachments ma
                        WHERE ma.message_id = m.id AND ma.status = 'active'
                    ) as attachments
                FROM messages m
                LEFT JOIN users u ON m.sender_user_id = u.id
                LEFT JOIN participants p ON m.sender_participant_id = p.id
                WHERE m.conversation_id = ${conversationId}
                AND m.status != 'deleted'
                AND m.created_at < ${before}::timestamptz
                ORDER BY m.created_at DESC
                LIMIT ${limit}
            `;
        } else {
            messages = await sql`
                SELECT 
                    m.id,
                    m.conversation_id,
                    m.sender_type,
                    m.sender_user_id,
                    m.sender_participant_id,
                    m.content,
                    m.content_type,
                    m.related_type,
                    m.related_id,
                    m.status,
                    m.is_edited,
                    m.edited_at,
                    m.created_at,
                    CASE 
                        WHEN m.sender_type = 'user' THEN json_build_object(
                            'id', u.id,
                            'name', u.first_name || ' ' || u.last_name,
                            'avatar_url', u.avatar_url
                        )
                        WHEN m.sender_type = 'participant' THEN json_build_object(
                            'id', p.id,
                            'name', COALESCE(p.preferred_name, p.first_name) || ' ' || p.last_name,
                            'avatar_url', null
                        )
                        ELSE json_build_object('name', 'System')
                    END as sender,
                    (
                        SELECT json_agg(json_build_object(
                            'id', ma.id,
                            'file_name', ma.file_name,
                            'file_type', ma.file_type,
                            'file_size', ma.file_size,
                            'file_url', ma.file_url,
                            'thumbnail_url', ma.thumbnail_url
                        ))
                        FROM message_attachments ma
                        WHERE ma.message_id = m.id AND ma.status = 'active'
                    ) as attachments
                FROM messages m
                LEFT JOIN users u ON m.sender_user_id = u.id
                LEFT JOIN participants p ON m.sender_participant_id = p.id
                WHERE m.conversation_id = ${conversationId}
                AND m.status != 'deleted'
                ORDER BY m.created_at DESC
                LIMIT ${limit}
            `;
        }

        // Get conversation details
        const conversation = await sql`
            SELECT 
                c.*,
                p.first_name as participant_first_name,
                p.last_name as participant_last_name,
                p.preferred_name as participant_preferred_name
            FROM conversations c
            LEFT JOIN participants p ON c.participant_id = p.id
            WHERE c.id = ${conversationId}
        `;

        // Reverse to get chronological order (we fetched DESC for pagination)
        messages.reverse();

        return NextResponse.json({
            messages,
            conversation: conversation[0],
            membership: membership[0],
            pagination: { limit, hasMore: messages.length === limit }
        });

    } catch (error) {
        console.error("Error fetching messages:", error);
        const message = error instanceof Error ? error.message : "Failed to fetch messages";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

// ============================================================================
// POST - Send a new message
// ============================================================================

export async function POST(
    req: NextRequest,
    { params }: { params: { conversationId: string } }
) {
    try {
        const session = await getSessionWithUserId();
        const body = await req.json();
        const { organization_id, content, content_type, related_type, related_id } = body;
        const conversationId = params.conversationId;

        if (!organization_id || !content) {
            return NextResponse.json(
                { error: "organization_id and content are required" },
                { status: 400 }
            );
        }

        await requireOrgAccess(organization_id);

        // Verify user is a member of this conversation
        const membership = await sql`
            SELECT cm.id
            FROM conversation_members cm
            JOIN conversations c ON cm.conversation_id = c.id
            WHERE cm.conversation_id = ${conversationId}
            AND cm.user_id = ${session.internalUserId}
            AND cm.is_active = true
            AND c.organization_id = ${organization_id}
            AND c.status = 'active'
        `;

        if (membership.length === 0) {
            return NextResponse.json(
                { error: "Not a member of this conversation or conversation is closed" },
                { status: 403 }
            );
        }

        // Insert message
        const newMessage = await sql`
            INSERT INTO messages (
                conversation_id,
                sender_type,
                sender_user_id,
                content,
                content_type,
                related_type,
                related_id
            )
            VALUES (
                ${conversationId},
                'user',
                ${session.internalUserId},
                ${content},
                ${content_type || 'text'},
                ${related_type || null},
                ${related_id || null}
            )
            RETURNING *
        `;

        // Mark as read for sender (reset their unread count)
        await sql`
            UPDATE conversation_members
            SET unread_count = 0, last_read_at = NOW()
            WHERE conversation_id = ${conversationId}
            AND user_id = ${session.internalUserId}
        `;

        // Fetch message with sender info
        const message = await sql`
            SELECT 
                m.*,
                json_build_object(
                    'id', u.id,
                    'name', u.first_name || ' ' || u.last_name,
                    'avatar_url', u.avatar_url
                ) as sender
            FROM messages m
            JOIN users u ON m.sender_user_id = u.id
            WHERE m.id = ${newMessage[0].id}
        `;

        return NextResponse.json({
            success: true,
            message: message[0]
        });

    } catch (error) {
        console.error("Error sending message:", error);
        const message = error instanceof Error ? error.message : "Failed to send message";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

// ============================================================================
// PATCH - Update conversation (archive, change subject, etc.)
// ============================================================================

export async function PATCH(
    req: NextRequest,
    { params }: { params: { conversationId: string } }
) {
    try {
        const session = await getSessionWithUserId();
        const body = await req.json();
        const { organization_id, status, subject, muted } = body;
        const conversationId = params.conversationId;

        if (!organization_id) {
            return NextResponse.json(
                { error: "organization_id is required" },
                { status: 400 }
            );
        }

        await requireOrgAccess(organization_id);

        // Verify user is a member
        const membership = await sql`
            SELECT cm.id, cm.role
            FROM conversation_members cm
            JOIN conversations c ON cm.conversation_id = c.id
            WHERE cm.conversation_id = ${conversationId}
            AND cm.user_id = ${session.internalUserId}
            AND c.organization_id = ${organization_id}
        `;

        if (membership.length === 0) {
            return NextResponse.json(
                { error: "Not a member of this conversation" },
                { status: 403 }
            );
        }

        // Update conversation properties (if owner or admin)
        if (status !== undefined || subject !== undefined) {
            await sql`
                UPDATE conversations
                SET 
                    status = COALESCE(${status}, status),
                    subject = COALESCE(${subject}, subject),
                    updated_at = NOW()
                WHERE id = ${conversationId}
            `;
        }

        // Update member preferences (muted)
        if (muted !== undefined) {
            await sql`
                UPDATE conversation_members
                SET muted = ${muted}
                WHERE conversation_id = ${conversationId}
                AND user_id = ${session.internalUserId}
            `;
        }

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error("Error updating conversation:", error);
        const message = error instanceof Error ? error.message : "Failed to update conversation";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
