// app/api/advisor-sessions/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getSession, getInternalUserId } from '@/lib/auth';
import { sql } from '@/lib/db';

// POST - Save a new advisor session
export async function POST(request: NextRequest) {
    try {
        const session = await getSession();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const userId = await getInternalUserId(session.user.id, session.user.email);
        if (!userId) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        // Get organization from session
        const organizationId = session.currentOrganization?.id;
        if (!organizationId) {
            return NextResponse.json({ error: 'No organization selected' }, { status: 400 });
        }

        const body = await request.json();
        const { title, transcript, summary, messages } = body;

        if (!title) {
            return NextResponse.json(
                { error: 'Title is required' },
                { status: 400 }
            );
        }

        // Build messages array - if transcript provided, convert to message format
        let messagesData = messages;
        if (!messagesData && transcript) {
            // Store transcript as a single message for compatibility
            messagesData = [{ role: 'transcript', content: transcript }];
        }

        // Summary should be stored as text (stringify if object)
        const summaryText = typeof summary === 'object' ? JSON.stringify(summary) : summary;

        const result = await sql`
            INSERT INTO advisor_sessions (
                user_id,
                organization_id,
                title,
                session_type,
                messages,
                summary
            ) VALUES (
                ${userId},
                ${organizationId},
                ${title},
                'voice',
                ${messagesData ? JSON.stringify(messagesData) : null},
                ${summaryText || null}
            )
            RETURNING *
        `;

        return NextResponse.json({
            success: true,
            session: result[0]
        });

    } catch (error: any) {
        console.error('Save advisor session error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to save session' },
            { status: 500 }
        );
    }
}

// GET - List advisor sessions for the current user
export async function GET(request: NextRequest) {
    try {
        const session = await getSession();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const userId = await getInternalUserId(session.user.id, session.user.email);
        if (!userId) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const { searchParams } = new URL(request.url);
        const limit = parseInt(searchParams.get('limit') || '20');
        const offset = parseInt(searchParams.get('offset') || '0');

        const sessions = await sql`
            SELECT 
                id,
                title,
                session_type,
                messages,
                summary,
                created_at,
                updated_at
            FROM advisor_sessions
            WHERE user_id = ${userId}
            ORDER BY created_at DESC
            LIMIT ${limit}
            OFFSET ${offset}
        `;

        // Parse summary back to object if it's JSON string
        // Also extract transcript from messages for backward compatibility
        const parsedSessions = sessions.map((s: any) => {
            let parsedSummary = s.summary;
            if (s.summary && typeof s.summary === 'string') {
                try {
                    parsedSummary = JSON.parse(s.summary);
                } catch {
                    // Keep as string if not valid JSON
                }
            }
            
            // Extract transcript from messages if stored there
            let transcript = '';
            if (s.messages && Array.isArray(s.messages)) {
                const transcriptMsg = s.messages.find((m: any) => m.role === 'transcript');
                if (transcriptMsg) {
                    transcript = transcriptMsg.content;
                } else {
                    // Build transcript from conversation messages
                    transcript = s.messages
                        .filter((m: any) => m.content)
                        .map((m: any) => `${m.role || 'Unknown'}: ${m.content}`)
                        .join('\n\n');
                }
            }
            
            return { ...s, summary: parsedSummary, transcript };
        });

        return NextResponse.json({
            success: true,
            sessions: parsedSessions
        });

    } catch (error: any) {
        console.error('Get advisor sessions error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to fetch sessions' },
            { status: 500 }
        );
    }
}

// DELETE - Delete an advisor session
export async function DELETE(request: NextRequest) {
    try {
        const session = await getSession();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const userId = await getInternalUserId(session.user.id, session.user.email);
        if (!userId) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const { searchParams } = new URL(request.url);
        const sessionId = searchParams.get('id');

        if (!sessionId) {
            return NextResponse.json({ error: 'Session ID required' }, { status: 400 });
        }

        const result = await sql`
            DELETE FROM advisor_sessions
            WHERE id = ${sessionId}
            AND user_id = ${userId}
            RETURNING id
        `;

        if (result.length === 0) {
            return NextResponse.json({ error: 'Session not found' }, { status: 404 });
        }

        return NextResponse.json({
            success: true,
            deleted_id: sessionId
        });

    } catch (error: any) {
        console.error('Delete advisor session error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to delete session' },
            { status: 500 }
        );
    }
}
