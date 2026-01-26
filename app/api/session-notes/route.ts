import { NextRequest, NextResponse } from 'next/server';
import { getSession, getInternalUserId } from '@/lib/auth';
import { sql } from '@/lib/db';

// GET - Fetch all session notes for the current user
export async function GET(request: NextRequest) {
    try {
        const session = await getSession();
        
        if (!session?.user?.id) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        // Get internal user ID from Cognito sub
        const userId = await getInternalUserId(session.user.id, session.user.email);
        
        if (!userId) {
            return NextResponse.json(
                { error: 'User not found in database' },
                { status: 404 }
            );
        }

        // Get query params for filtering
        const searchParams = request.nextUrl.searchParams;
        const status = searchParams.get('status');
        const source = searchParams.get('source'); // Filter by source (manual, recording, dictation, upload)
        const participantId = searchParams.get('participantId');
        const limit = parseInt(searchParams.get('limit') || '50');
        const offset = parseInt(searchParams.get('offset') || '0');

        // Build base query - Neon doesn't support conditional fragments well,
        // so we'll build separate queries based on filters
        let notes;
        
        if (status && participantId) {
            notes = await sql`
                SELECT 
                    sn.id,
                    sn.metadata,
                    sn.pss_note,
                    sn.pss_summary,
                    sn.participant_summary,
                    sn.source,
                    sn.status,
                    sn.created_at,
                    sn.updated_at,
                    p.first_name || ' ' || p.last_name as participant_name
                FROM session_notes sn
                LEFT JOIN participants p ON sn.participant_id = p.id
                WHERE sn.user_id = ${userId}::uuid
                AND sn.is_archived = false
                AND sn.status = ${status}
                AND sn.participant_id = ${participantId}::uuid
                ORDER BY sn.created_at DESC
                LIMIT ${limit}
                OFFSET ${offset}
            `;
        } else if (status) {
            notes = await sql`
                SELECT 
                    sn.id,
                    sn.metadata,
                    sn.pss_note,
                    sn.pss_summary,
                    sn.participant_summary,
                    sn.source,
                    sn.status,
                    sn.created_at,
                    sn.updated_at,
                    p.first_name || ' ' || p.last_name as participant_name
                FROM session_notes sn
                LEFT JOIN participants p ON sn.participant_id = p.id
                WHERE sn.user_id = ${userId}::uuid
                AND sn.is_archived = false
                AND sn.status = ${status}
                ORDER BY sn.created_at DESC
                LIMIT ${limit}
                OFFSET ${offset}
            `;
        } else if (participantId) {
            notes = await sql`
                SELECT 
                    sn.id,
                    sn.metadata,
                    sn.pss_note,
                    sn.pss_summary,
                    sn.participant_summary,
                    sn.source,
                    sn.status,
                    sn.created_at,
                    sn.updated_at,
                    p.first_name || ' ' || p.last_name as participant_name
                FROM session_notes sn
                LEFT JOIN participants p ON sn.participant_id = p.id
                WHERE sn.user_id = ${userId}::uuid
                AND sn.is_archived = false
                AND sn.participant_id = ${participantId}::uuid
                ORDER BY sn.created_at DESC
                LIMIT ${limit}
                OFFSET ${offset}
            `;
        } else if (source) {
            notes = await sql`
                SELECT 
                    sn.id,
                    sn.metadata,
                    sn.pss_note,
                    sn.pss_summary,
                    sn.participant_summary,
                    sn.source,
                    sn.status,
                    sn.created_at,
                    sn.updated_at,
                    p.first_name || ' ' || p.last_name as participant_name
                FROM session_notes sn
                LEFT JOIN participants p ON sn.participant_id = p.id
                WHERE sn.user_id = ${userId}::uuid
                AND sn.is_archived = false
                AND sn.source = ${source}
                ORDER BY sn.created_at DESC
                LIMIT ${limit}
                OFFSET ${offset}
            `;
        } else {
            notes = await sql`
                SELECT 
                    sn.id,
                    sn.metadata,
                    sn.pss_note,
                    sn.pss_summary,
                    sn.participant_summary,
                    sn.source,
                    sn.status,
                    sn.created_at,
                    sn.updated_at,
                    p.first_name || ' ' || p.last_name as participant_name
                FROM session_notes sn
                LEFT JOIN participants p ON sn.participant_id = p.id
                WHERE sn.user_id = ${userId}::uuid
                AND sn.is_archived = false
                ORDER BY sn.created_at DESC
                LIMIT ${limit}
                OFFSET ${offset}
            `;
        }

        // Get total count for pagination
        const countResult = await sql`
            SELECT COUNT(*) as total
            FROM session_notes
            WHERE user_id = ${userId}::uuid
            AND is_archived = false
        `;

        return NextResponse.json({ 
            notes,
            pagination: {
                total: parseInt(countResult[0]?.total || '0'),
                limit,
                offset
            }
        });
    } catch (error) {
        console.error('Error fetching session notes:', error);
        return NextResponse.json(
            { error: 'Failed to fetch session notes' },
            { status: 500 }
        );
    }
}

// POST - Create a new session note
export async function POST(request: NextRequest) {
    try {
        const session = await getSession();
        
        if (!session?.user?.id) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        // Get internal user ID
        const userId = await getInternalUserId(session.user.id, session.user.email);
        
        if (!userId) {
            return NextResponse.json(
                { error: 'User not found in database' },
                { status: 404 }
            );
        }

        const body = await request.json();
        const {
            metadata,
            pss_note,
            pss_summary,
            participant_summary,
            transcript,
            source = 'manual',
            organization_id,
            participant_id,
            pss_coaching,
            conversation_analysis,
            clinical_data, // For manual notes - stores full clinical template data
        } = body;

        // Validate required fields
        if (!metadata) {
            return NextResponse.json(
                { error: 'metadata is required' },
                { status: 400 }
            );
        }

        // For manual notes, pss_note might be constructed from clinical_data
        // Allow either pss_note or clinical_data
        if (!pss_note && !clinical_data) {
            return NextResponse.json(
                { error: 'pss_note or clinical_data is required' },
                { status: 400 }
            );
        }

        // If clinical_data is provided but no pss_note, build a basic pss_note
        let finalPssNote = pss_note;
        if (!pss_note && clinical_data) {
            finalPssNote = {
                sessionOverview: metadata.groupTopic || clinical_data.intervention || 'Manual session note',
                topicsDiscussed: [metadata.groupTopic].filter(Boolean),
                strengthsObserved: [],
                recoverySupportProvided: [clinical_data.intervention].filter(Boolean),
                actionItems: [],
                followUpNeeded: clinical_data.justification ? [clinical_data.justification] : [],
            };
        }

        // Merge clinical_data into metadata for manual notes
        const finalMetadata = clinical_data 
            ? { ...metadata, clinical_data }
            : metadata;

        // Insert new note
        const newNotes = await sql`
            INSERT INTO session_notes (
                user_id,
                organization_id,
                participant_id,
                metadata,
                pss_note,
                pss_summary,
                participant_summary,
                transcript,
                source,
                status,
                pss_coaching,
                conversation_analysis,
                is_archived
            ) VALUES (
                ${userId}::uuid,
                ${organization_id || null}::uuid,
                ${participant_id || null}::uuid,
                ${JSON.stringify(finalMetadata)}::jsonb,
                ${JSON.stringify(finalPssNote)}::jsonb,
                ${pss_summary || null},
                ${participant_summary || null},
                ${transcript || null},
                ${source},
                'draft',
                ${pss_coaching ? JSON.stringify(pss_coaching) : null}::jsonb,
                ${conversation_analysis ? JSON.stringify(conversation_analysis) : null}::jsonb,
                false
            )
            RETURNING *
        `;

        return NextResponse.json({ 
            success: true,
            note: newNotes[0]
        }, { status: 201 });
    } catch (error) {
        console.error('Error creating session note:', error);
        return NextResponse.json(
            { error: 'Failed to create session note' },
            { status: 500 }
        );
    }
}
