// app/api/peer-advisor-chat/history/route.ts
// List conversations (GET) and load messages for a specific conversation (GET ?id=xxx)

import { NextRequest, NextResponse } from 'next/server';
import { getSessionWithUserId } from '@/lib/auth';
import { sql } from '@/lib/db';

export async function GET(req: NextRequest) {
    try {
        const session = await getSessionWithUserId();
        const userId = session.internalUserId;
        const orgId = session.currentOrganization?.id;

        if (!orgId) {
            return NextResponse.json({ error: 'No organization context' }, { status: 400 });
        }

        const { searchParams } = new URL(req.url);
        const conversationId = searchParams.get('id');

        if (conversationId) {
            // Load messages for a specific conversation
            const conv = await sql`
                SELECT id, title, created_at FROM advisor_conversations
                WHERE id = ${conversationId}::uuid 
                AND user_id = ${userId}::uuid 
                AND organization_id = ${orgId}::uuid
            `;

            if (!conv[0]) {
                return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
            }

            const messages = await sql`
                SELECT id, role, content, citations, created_at
                FROM advisor_messages
                WHERE conversation_id = ${conversationId}::uuid
                ORDER BY created_at ASC
            `;

            return NextResponse.json({
                conversation: conv[0],
                messages: messages.map((m: any) => ({
                    id: m.id,
                    role: m.role,
                    content: m.content,
                    citations: typeof m.citations === 'string' ? JSON.parse(m.citations) : m.citations || [],
                    timestamp: m.created_at,
                })),
            });
        } else {
            // List recent conversations
            const limit = parseInt(searchParams.get('limit') || '20');

            const conversations = await sql`
                SELECT id, title, message_count, last_message_at, created_at
                FROM advisor_conversations
                WHERE user_id = ${userId}::uuid 
                AND organization_id = ${orgId}::uuid
                ORDER BY updated_at DESC
                LIMIT ${limit}
            `;

            return NextResponse.json({ conversations });
        }
    } catch (error: any) {
        console.error('Peer advisor history error:', error);

        if (error.message === 'Unauthorized' || error.message === 'User not found in database') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        return NextResponse.json(
            { error: `Failed to load history: ${error.message}` },
            { status: 500 }
        );
    }
}

// Delete a conversation
export async function DELETE(req: NextRequest) {
    try {
        const session = await getSessionWithUserId();
        const userId = session.internalUserId;
        const orgId = session.currentOrganization?.id;

        if (!orgId) {
            return NextResponse.json({ error: 'No organization context' }, { status: 400 });
        }

        const { conversationId } = await req.json();

        if (!conversationId) {
            return NextResponse.json({ error: 'conversationId required' }, { status: 400 });
        }

        // Verify ownership then delete (cascade deletes messages)
        const result = await sql`
            DELETE FROM advisor_conversations
            WHERE id = ${conversationId}::uuid 
            AND user_id = ${userId}::uuid 
            AND organization_id = ${orgId}::uuid
            RETURNING id
        `;

        if (!result[0]) {
            return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Peer advisor delete error:', error);
        return NextResponse.json(
            { error: `Failed to delete: ${error.message}` },
            { status: 500 }
        );
    }
}
