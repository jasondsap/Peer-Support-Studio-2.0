// app/api/peer-advisor-chat/route.ts
// Peer Advisor Chat — RAG-powered conversational endpoint with Neon persistence

import { NextRequest, NextResponse } from 'next/server';
import { getSessionWithUserId } from '@/lib/auth';
import { sql } from '@/lib/db';

// Map RAG doc_id prefixes to display labels
const DOC_LABELS: Record<string, string> = {
    'samhsa_tip64': 'TIP 64',
    'samhsa_tip57': 'TIP 57',
    'samhsa_tip35': 'TIP 35',
    'samhsa_tip42': 'TIP 42',
    'samhsa_tip63': 'TIP 63',
    'samhsa_tip65': 'TIP 65',
    'samhsa_10_guiding_principles': '10 Principles',
    'samhsa_core_competencies': 'Peer Competencies',
    'naadac_code_of_ethics': 'NAADAC Ethics',
};

function getDocLabel(docId: string): string {
    for (const [key, label] of Object.entries(DOC_LABELS)) {
        if (docId.startsWith(key)) return label;
    }
    return docId;
}

export async function POST(req: NextRequest) {
    try {
        // Auth
        const session = await getSessionWithUserId();
        const userId = session.internalUserId;
        const orgId = session.currentOrganization?.id;

        if (!orgId) {
            return NextResponse.json({ error: 'No organization context' }, { status: 400 });
        }

        const { query, conversationId } = await req.json();

        if (!query || typeof query !== 'string') {
            return NextResponse.json({ error: 'Query is required' }, { status: 400 });
        }

        // Resolve or create conversation
        let convId = conversationId;

        if (convId) {
            // Verify ownership
            const existing = await sql`
                SELECT id FROM advisor_conversations 
                WHERE id = ${convId}::uuid AND user_id = ${userId}::uuid AND organization_id = ${orgId}::uuid
            `;
            if (!existing[0]) {
                return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
            }
        } else {
            // Create new conversation
            const newConv = await sql`
                INSERT INTO advisor_conversations (user_id, organization_id)
                VALUES (${userId}::uuid, ${orgId}::uuid)
                RETURNING id
            `;
            convId = newConv[0].id;
        }

        // Save user message
        await sql`
            INSERT INTO advisor_messages (conversation_id, role, content)
            VALUES (${convId}::uuid, 'user', ${query})
        `;

        // Determine user role for audience filtering
        const orgRole = session.currentOrganization?.role || 'peer_specialist';
        const audienceRole = orgRole === 'admin' || orgRole === 'owner' 
            ? 'administrator' 
            : orgRole === 'supervisor' 
                ? 'supervisor' 
                : 'peer_specialist';

        // Call RAG service
        const ragApiUrl = process.env.RAG_API_URL;
        const ragApiKey = process.env.RAG_API_KEY;

        if (!ragApiUrl || !ragApiKey) {
            console.error('RAG_API_URL or RAG_API_KEY not set');
            return NextResponse.json({ error: 'RAG service not configured' }, { status: 500 });
        }

        // Load recent conversation history for context (last 6 messages)
        const recentMessages = await sql`
            SELECT role, content FROM advisor_messages
            WHERE conversation_id = ${convId}::uuid
            ORDER BY created_at DESC
            LIMIT 6
        `;
        const conversationHistory = recentMessages.reverse().map((m: any) => ({
            role: m.role,
            content: m.content,
        }));

        const ragResponse = await fetch(ragApiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': ragApiKey,
            },
            body: JSON.stringify({
                module: 'peer_advisor',
                query,
                context: {
                    audience_role: audienceRole,
                    conversation_history: conversationHistory,
                },
            }),
        });

        if (!ragResponse.ok) {
            const errorData = await ragResponse.json().catch(() => ({}));
            console.error('RAG service error:', ragResponse.status, errorData);
            throw new Error(errorData.error || `RAG service returned ${ragResponse.status}`);
        }

        const ragData = await ragResponse.json();

        const answerText = ragData.answer || "I wasn't able to generate a response. Please try rephrasing your question.";

        const citations = (ragData.sources || [])
            .map((s: any) => ({
                doc: getDocLabel(s.doc_id || ''),
                section: s.section_path || '',
                pages: s.page_start && s.page_end && s.page_start !== s.page_end
                    ? `${s.page_start}-${s.page_end}`
                    : s.page_start || '',
                usage: s.usage || '',
            }))
            .filter((c: any) => c.section || c.pages);

        // Save assistant message with citations
        await sql`
            INSERT INTO advisor_messages (conversation_id, role, content, citations)
            VALUES (${convId}::uuid, 'assistant', ${answerText}, ${JSON.stringify(citations)}::jsonb)
        `;

        return NextResponse.json({
            answer: answerText,
            citations,
            conversationId: convId,
        });

    } catch (error: any) {
        console.error('Peer advisor chat error:', error);

        if (error.message === 'Unauthorized' || error.message === 'User not found in database') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        return NextResponse.json(
            { error: `Failed to get response: ${error.message}` },
            { status: 500 }
        );
    }
}
