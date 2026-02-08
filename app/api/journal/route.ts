// app/api/journal/route.ts
// Journal Entries API for Participant Portal
// Uses next-auth session (same auth pattern as sessions, goals, messages APIs)

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { sql } from '@/lib/db';

// GET /api/journal - List journal entries
// Portal: participant views own entries (all)
// Studio: PSS views shared entries for a participant (shared_with_pss only)
export async function GET(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const countOnly = searchParams.get('count_only');

        // Studio access — PSS viewing a participant's shared entries
        const queryParticipantId = searchParams.get('participant_id');
        const queryOrgId = searchParams.get('organization_id');

        if (queryParticipantId && queryOrgId) {
            // Unread count for badge
            if (countOnly === 'true') {
                const unreadOnly = searchParams.get('unread_only');
                if (unreadOnly === 'true') {
                    const result = await sql`
                        SELECT COUNT(*) as count FROM journal_entries
                        WHERE participant_id = ${queryParticipantId}
                        AND organization_id = ${queryOrgId}
                        AND shared_with_pss = true AND pss_viewed = false
                    `;
                    return NextResponse.json({ count: parseInt(result[0].count) });
                }
                const result = await sql`
                    SELECT COUNT(*) as count FROM journal_entries
                    WHERE participant_id = ${queryParticipantId}
                    AND organization_id = ${queryOrgId}
                    AND shared_with_pss = true
                `;
                return NextResponse.json({ count: parseInt(result[0].count) });
            }

            // Full list of shared entries for Studio
            const entries = await sql`
                SELECT id, entry_text, mood, shared_with_pss, pss_viewed, created_at, updated_at
                FROM journal_entries
                WHERE participant_id = ${queryParticipantId}
                AND organization_id = ${queryOrgId}
                AND shared_with_pss = true
                ORDER BY created_at DESC
            `;
            return NextResponse.json({ entries });
        }

        // Portal access — participant viewing own entries
        if (!(session as any).participantId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const participantId = (session as any).participantId;
        const organizationId = (session as any).organizationId;

        if (countOnly === 'true') {
            const result = await sql`
                SELECT COUNT(*) as count
                FROM journal_entries
                WHERE participant_id = ${participantId}
                AND organization_id = ${organizationId}
            `;
            return NextResponse.json({ count: parseInt(result[0].count) });
        }

        const entries = await sql`
            SELECT id, entry_text, mood, shared_with_pss, created_at, updated_at
            FROM journal_entries
            WHERE participant_id = ${participantId}
            AND organization_id = ${organizationId}
            ORDER BY created_at DESC
        `;

        return NextResponse.json({ entries });
    } catch (error) {
        console.error('Error fetching journal entries:', error);
        return NextResponse.json({ error: 'Failed to fetch journal entries' }, { status: 500 });
    }
}

// POST /api/journal - Create a new journal entry
export async function POST(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!(session as any)?.participantId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const participantId = (session as any).participantId;
        const organizationId = (session as any).organizationId;

        const body = await req.json();
        const { entry_text, mood, shared_with_pss } = body;

        if (!entry_text?.trim()) {
            return NextResponse.json({ error: 'Entry text is required' }, { status: 400 });
        }

        const result = await sql`
            INSERT INTO journal_entries (
                participant_id, organization_id, entry_text, mood, shared_with_pss
            ) VALUES (
                ${participantId},
                ${organizationId},
                ${entry_text.trim()},
                ${mood || null},
                ${shared_with_pss || false}
            )
            RETURNING *
        `;

        return NextResponse.json({ entry: result[0] });
    } catch (error) {
        console.error('Error creating journal entry:', error);
        return NextResponse.json({ error: 'Failed to create journal entry' }, { status: 500 });
    }
}

// PUT /api/journal - Update a journal entry
export async function PUT(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!(session as any)?.participantId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const participantId = (session as any).participantId;
        const organizationId = (session as any).organizationId;

        const body = await req.json();
        const { id } = body;

        if (!id) {
            return NextResponse.json({ error: 'Entry id required' }, { status: 400 });
        }

        const result = await sql`
            UPDATE journal_entries
            SET
                entry_text = COALESCE(${body.entry_text || null}, entry_text),
                mood = COALESCE(${body.mood !== undefined ? body.mood : null}, mood),
                shared_with_pss = COALESCE(${body.shared_with_pss !== undefined ? body.shared_with_pss : null}, shared_with_pss),
                pss_viewed = CASE
                    WHEN ${body.shared_with_pss !== undefined ? body.shared_with_pss : null} = false THEN false
                    ELSE pss_viewed
                END,
                updated_at = NOW()
            WHERE id = ${id}
            AND participant_id = ${participantId}
            AND organization_id = ${organizationId}
            RETURNING *
        `;

        if (result.length === 0) {
            return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
        }

        return NextResponse.json({ entry: result[0] });
    } catch (error) {
        console.error('Error updating journal entry:', error);
        return NextResponse.json({ error: 'Failed to update journal entry' }, { status: 500 });
    }
}

// DELETE /api/journal - Delete a journal entry
export async function DELETE(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!(session as any)?.participantId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const participantId = (session as any).participantId;
        const organizationId = (session as any).organizationId;

        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'Entry id required' }, { status: 400 });
        }

        const result = await sql`
            DELETE FROM journal_entries
            WHERE id = ${id}
            AND participant_id = ${participantId}
            AND organization_id = ${organizationId}
            RETURNING id
        `;

        if (result.length === 0) {
            return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true, deleted_id: id });
    } catch (error) {
        console.error('Error deleting journal entry:', error);
        return NextResponse.json({ error: 'Failed to delete journal entry' }, { status: 500 });
    }
}
