import { NextRequest, NextResponse } from "next/server";
import { getSessionWithUserId, requireOrgAccess } from "@/lib/auth";
import { sql, logAuditEvent } from "@/lib/db";

// ============================================================================
// GET - List conversations for current user
// ============================================================================

export async function GET(req: NextRequest) {
    try {
        const session = await getSessionWithUserId();
        const { searchParams } = new URL(req.url);
        const organizationId = searchParams.get("organization_id");
        const status = searchParams.get("status") || "active";
        const type = searchParams.get("type"); // optional filter: 'participant', 'team', 'direct'
        const limit = parseInt(searchParams.get("limit") || "50");
        const offset = parseInt(searchParams.get("offset") || "0");

        if (!organizationId) {
            return NextResponse.json(
                { error: "organization_id is required" },
                { status: 400 }
            );
        }

        await requireOrgAccess(organizationId);

        // Get conversations where user is a member
        let conversations;
        
        if (type) {
            conversations = await sql`
                SELECT 
                    c.id,
                    c.organization_id,
                    c.type,
                    c.participant_id,
                    c.subject,
                    c.category,
                    c.status,
                    c.last_message_at,
                    c.last_message_preview,
                    c.message_count,
                    c.created_at,
                    cm.unread_count,
                    cm.muted,
                    cm.last_read_at,
                    -- Participant info if applicable
                    p.first_name as participant_first_name,
                    p.last_name as participant_last_name,
                    p.preferred_name as participant_preferred_name,
                    -- For direct messages, get the other user's info
                    CASE 
                        WHEN c.type = 'direct' THEN (
                            SELECT json_build_object(
                                'id', u2.id,
                                'name', u2.first_name || ' ' || u2.last_name,
                                'avatar_url', u2.avatar_url
                            )
                            FROM conversation_members cm2
                            JOIN users u2 ON cm2.user_id = u2.id
                            WHERE cm2.conversation_id = c.id
                            AND cm2.user_id != ${session.internalUserId}
                            LIMIT 1
                        )
                        ELSE NULL
                    END as other_user
                FROM conversations c
                JOIN conversation_members cm ON c.id = cm.conversation_id
                LEFT JOIN participants p ON c.participant_id = p.id
                WHERE c.organization_id = ${organizationId}
                AND cm.user_id = ${session.internalUserId}
                AND cm.is_active = true
                AND c.status = ${status}
                AND c.type = ${type}
                ORDER BY c.last_message_at DESC NULLS LAST, c.created_at DESC
                LIMIT ${limit} OFFSET ${offset}
            `;
        } else {
            conversations = await sql`
                SELECT 
                    c.id,
                    c.organization_id,
                    c.type,
                    c.participant_id,
                    c.subject,
                    c.category,
                    c.status,
                    c.last_message_at,
                    c.last_message_preview,
                    c.message_count,
                    c.created_at,
                    cm.unread_count,
                    cm.muted,
                    cm.last_read_at,
                    p.first_name as participant_first_name,
                    p.last_name as participant_last_name,
                    p.preferred_name as participant_preferred_name,
                    CASE 
                        WHEN c.type = 'direct' THEN (
                            SELECT json_build_object(
                                'id', u2.id,
                                'name', u2.first_name || ' ' || u2.last_name,
                                'avatar_url', u2.avatar_url
                            )
                            FROM conversation_members cm2
                            JOIN users u2 ON cm2.user_id = u2.id
                            WHERE cm2.conversation_id = c.id
                            AND cm2.user_id != ${session.internalUserId}
                            LIMIT 1
                        )
                        ELSE NULL
                    END as other_user
                FROM conversations c
                JOIN conversation_members cm ON c.id = cm.conversation_id
                LEFT JOIN participants p ON c.participant_id = p.id
                WHERE c.organization_id = ${organizationId}
                AND cm.user_id = ${session.internalUserId}
                AND cm.is_active = true
                AND c.status = ${status}
                ORDER BY c.last_message_at DESC NULLS LAST, c.created_at DESC
                LIMIT ${limit} OFFSET ${offset}
            `;
        }

        // Get total unread count
        const unreadResult = await sql`
            SELECT COALESCE(SUM(cm.unread_count), 0) as total_unread
            FROM conversation_members cm
            JOIN conversations c ON cm.conversation_id = c.id
            WHERE c.organization_id = ${organizationId}
            AND cm.user_id = ${session.internalUserId}
            AND cm.is_active = true
            AND c.status = 'active'
        `;

        return NextResponse.json({
            conversations,
            totalUnread: parseInt(unreadResult[0]?.total_unread || '0'),
            pagination: { limit, offset }
        });

    } catch (error) {
        console.error("Error fetching conversations:", error);
        const message = error instanceof Error ? error.message : "Failed to fetch conversations";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

// ============================================================================
// POST - Create a new conversation
// ============================================================================

export async function POST(req: NextRequest) {
    try {
        const session = await getSessionWithUserId();
        const body = await req.json();
        const {
            organization_id,
            type,
            participant_id,
            recipient_user_id,
            subject,
            category,
            initial_message
        } = body;

        if (!organization_id || !type) {
            return NextResponse.json(
                { error: "organization_id and type are required" },
                { status: 400 }
            );
        }

        await requireOrgAccess(organization_id);

        let conversationId: string;

        // Handle different conversation types
        if (type === 'participant') {
            if (!participant_id) {
                return NextResponse.json(
                    { error: "participant_id is required for participant conversations" },
                    { status: 400 }
                );
            }

            // Use helper function to get or create participant conversation
            const result = await sql`
                SELECT create_participant_conversation(
                    ${organization_id}::uuid,
                    ${participant_id}::uuid,
                    ${session.internalUserId}::uuid,
                    ${subject || null}
                ) as conversation_id
            `;
            conversationId = result[0].conversation_id;

        } else if (type === 'direct') {
            if (!recipient_user_id) {
                return NextResponse.json(
                    { error: "recipient_user_id is required for direct messages" },
                    { status: 400 }
                );
            }

            // Check if conversation already exists between these two users
            const existing = await sql`
                SELECT c.id
                FROM conversations c
                JOIN conversation_members cm1 ON c.id = cm1.conversation_id AND cm1.user_id = ${session.internalUserId}
                JOIN conversation_members cm2 ON c.id = cm2.conversation_id AND cm2.user_id = ${recipient_user_id}
                WHERE c.organization_id = ${organization_id}
                AND c.type = 'direct'
                AND c.status = 'active'
                LIMIT 1
            `;

            if (existing.length > 0) {
                conversationId = existing[0].id;
            } else {
                // Create new direct conversation
                const newConv = await sql`
                    INSERT INTO conversations (organization_id, type, subject, category, created_by_type, created_by_id)
                    VALUES (${organization_id}, 'direct', ${subject || null}, ${category || null}, 'user', ${session.internalUserId})
                    RETURNING id
                `;
                conversationId = newConv[0].id;

                // Add both members
                await sql`
                    INSERT INTO conversation_members (conversation_id, member_type, user_id, role)
                    VALUES 
                        (${conversationId}, 'user', ${session.internalUserId}, 'owner'),
                        (${conversationId}, 'user', ${recipient_user_id}, 'member')
                `;
            }

        } else if (type === 'team' || type === 'announcement') {
            // Create team/announcement conversation
            const newConv = await sql`
                INSERT INTO conversations (organization_id, type, subject, category, created_by_type, created_by_id)
                VALUES (${organization_id}, ${type}, ${subject || null}, ${category || null}, 'user', ${session.internalUserId})
                RETURNING id
            `;
            conversationId = newConv[0].id;

            // Add creator as owner
            await sql`
                INSERT INTO conversation_members (conversation_id, member_type, user_id, role)
                VALUES (${conversationId}, 'user', ${session.internalUserId}, 'owner')
            `;

        } else {
            return NextResponse.json(
                { error: "Invalid conversation type" },
                { status: 400 }
            );
        }

        // Send initial message if provided
        if (initial_message && conversationId) {
            await sql`
                INSERT INTO messages (conversation_id, sender_type, sender_user_id, content)
                VALUES (${conversationId}, 'user', ${session.internalUserId}, ${initial_message})
            `;
        }

        // Fetch the created conversation
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

        // Log audit event
        await logAuditEvent(
            session.internalUserId,
            organization_id,
            "create",
            "conversation",
            conversationId,
            { type, participant_id, recipient_user_id }
        );

        return NextResponse.json({
            success: true,
            conversation: conversation[0]
        });

    } catch (error) {
        console.error("Error creating conversation:", error);
        const message = error instanceof Error ? error.message : "Failed to create conversation";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
