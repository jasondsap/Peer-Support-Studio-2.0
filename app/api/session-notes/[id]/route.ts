import { NextRequest, NextResponse } from 'next/server';
import { getSession, getInternalUserId } from '@/lib/auth';
import { sql, softDelete } from '@/lib/db';

// GET - Fetch a single session note by ID
export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getSession();
        
        if (!session?.user?.id) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const noteId = params.id;

        // Get internal user ID
        const userId = await getInternalUserId(session.user.id, session.user.email);
        
        if (!userId) {
            return NextResponse.json(
                { error: 'User not found' },
                { status: 404 }
            );
        }

        // Fetch the note - user must own it or be in the same org
        const notes = await sql`
            SELECT 
                sn.*,
                p.first_name || ' ' || p.last_name as participant_name
            FROM session_notes sn
            LEFT JOIN participants p ON sn.participant_id = p.id
            WHERE sn.id = ${noteId}::uuid
            AND sn.user_id = ${userId}::uuid
            AND sn.is_archived = false
        `;

        if (notes.length === 0) {
            return NextResponse.json(
                { error: 'Note not found' },
                { status: 404 }
            );
        }

        const note = notes[0];
        
        // If participant name exists, add it to metadata
        if (note.participant_name && note.metadata) {
            note.metadata.participantName = note.participant_name;
        }

        return NextResponse.json({ note });
    } catch (error) {
        console.error('Error fetching session note:', error);
        return NextResponse.json(
            { error: 'Failed to fetch session note' },
            { status: 500 }
        );
    }
}

// DELETE - Soft delete a session note
export async function DELETE(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getSession();
        
        if (!session?.user?.id) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const noteId = params.id;

        // Get internal user ID
        const userId = await getInternalUserId(session.user.id, session.user.email);
        
        if (!userId) {
            return NextResponse.json(
                { error: 'User not found' },
                { status: 404 }
            );
        }

        // Verify ownership before deleting
        const existingNote = await sql`
            SELECT id FROM session_notes 
            WHERE id = ${noteId}::uuid 
            AND user_id = ${userId}::uuid
        `;

        if (existingNote.length === 0) {
            return NextResponse.json(
                { error: 'Note not found or access denied' },
                { status: 404 }
            );
        }

        // Soft delete
        await sql`
            UPDATE session_notes 
            SET is_archived = true, updated_at = NOW()
            WHERE id = ${noteId}::uuid
        `;

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting session note:', error);
        return NextResponse.json(
            { error: 'Failed to delete session note' },
            { status: 500 }
        );
    }
}

// PATCH - Update a session note
export async function PATCH(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getSession();
        
        if (!session?.user?.id) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const noteId = params.id;
        const updates = await request.json();

        // Get internal user ID
        const userId = await getInternalUserId(session.user.id, session.user.email);
        
        if (!userId) {
            return NextResponse.json(
                { error: 'User not found' },
                { status: 404 }
            );
        }

        // Verify ownership
        const existingNote = await sql`
            SELECT id FROM session_notes 
            WHERE id = ${noteId}::uuid 
            AND user_id = ${userId}::uuid
        `;

        if (existingNote.length === 0) {
            return NextResponse.json(
                { error: 'Note not found or access denied' },
                { status: 404 }
            );
        }

        // Build update query based on provided fields
        const allowedFields = ['metadata', 'pss_note', 'pss_summary', 'participant_summary', 'transcript', 'status', 'review_notes'];
        const updateData: Record<string, any> = {};
        
        for (const field of allowedFields) {
            if (updates[field] !== undefined) {
                updateData[field] = updates[field];
            }
        }

        if (Object.keys(updateData).length === 0) {
            return NextResponse.json(
                { error: 'No valid fields to update' },
                { status: 400 }
            );
        }

        // Update the note
        const updatedNotes = await sql`
            UPDATE session_notes 
            SET 
                metadata = COALESCE(${updateData.metadata ? JSON.stringify(updateData.metadata) : null}::jsonb, metadata),
                pss_note = COALESCE(${updateData.pss_note ? JSON.stringify(updateData.pss_note) : null}::jsonb, pss_note),
                pss_summary = COALESCE(${updateData.pss_summary || null}, pss_summary),
                participant_summary = COALESCE(${updateData.participant_summary || null}, participant_summary),
                transcript = COALESCE(${updateData.transcript || null}, transcript),
                status = COALESCE(${updateData.status || null}, status),
                review_notes = COALESCE(${updateData.review_notes || null}, review_notes),
                updated_at = NOW()
            WHERE id = ${noteId}::uuid
            RETURNING *
        `;

        return NextResponse.json({ 
            success: true, 
            note: updatedNotes[0] 
        });
    } catch (error) {
        console.error('Error updating session note:', error);
        return NextResponse.json(
            { error: 'Failed to update session note' },
            { status: 500 }
        );
    }
}
