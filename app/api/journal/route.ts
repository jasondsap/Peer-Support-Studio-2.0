// app/api/journal/route.ts
// Journal Entries API
// Portal: participant CRUD on own entries (requireAuth)
// Studio: PSS reads shared entries (via query params)

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, getSession, getInternalUserId, requireOrgAccess } from "@/lib/auth";
import { sql, logAuditEvent } from "@/lib/db";
import { scanForCrisis, notifyTeamOfCrisis } from "@/app/api/messages/notify";

// GET /api/journal
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const countOnly = searchParams.get('count_only');

        // Studio access — PSS viewing a participant's shared entries
        const queryParticipantId = searchParams.get('participant_id');
        const queryOrgId = searchParams.get('organization_id');

        if (queryParticipantId && queryOrgId) {
            // Studio access requires an authenticated PSS who belongs to the org
            const session = await getSession();
            if (!session?.user?.id) {
                return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
            }
            const userId = await getInternalUserId(session.user.id, session.user.email);
            if (!userId) {
                return NextResponse.json({ error: "User not found" }, { status: 404 });
            }
            try {
                await requireOrgAccess(queryOrgId);
            } catch {
                return NextResponse.json({ error: "Organization access denied" }, { status: 403 });
            }

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

            const entries = await sql`
                SELECT id, entry_text, mood, shared_with_pss, pss_viewed, flagged_crisis, created_at, updated_at
                FROM journal_entries
                WHERE participant_id = ${queryParticipantId}
                AND organization_id = ${queryOrgId}
                AND shared_with_pss = true
                ORDER BY created_at DESC
            `;
            return NextResponse.json({ entries });
        }

        // Portal access — participant viewing own entries
        const session = await requireAuth();
        const participantId = (session as any).participantId;

        if (!participantId) {
            return NextResponse.json({ error: "Participant not found" }, { status: 400 });
        }

        if (countOnly === 'true') {
            const result = await sql`
                SELECT COUNT(*) as count
                FROM journal_entries
                WHERE participant_id = ${participantId}
            `;
            return NextResponse.json({ count: parseInt(result[0].count) });
        }

        const entries = await sql`
            SELECT id, entry_text, mood, shared_with_pss, created_at, updated_at
            FROM journal_entries
            WHERE participant_id = ${participantId}
            ORDER BY created_at DESC
        `;

        return NextResponse.json({ entries });
    } catch (error) {
        console.error("Error fetching journal entries:", error);
        const message = error instanceof Error ? error.message : "Failed to fetch journal entries";
        if (message === "Unauthorized") {
            return NextResponse.json({ error: message }, { status: 401 });
        }
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

// POST /api/journal - Create a new journal entry
export async function POST(req: NextRequest) {
    try {
        const session = await requireAuth();
        const participantId = (session as any).participantId;

        if (!participantId) {
            return NextResponse.json({ error: "Participant not found" }, { status: 400 });
        }

        const body = await req.json();
        const { entry_text, mood, shared_with_pss } = body;

        if (!entry_text?.trim()) {
            return NextResponse.json({ error: 'Entry text is required' }, { status: 400 });
        }

        // Get organization_id from participant record
        const participant = await sql`
            SELECT organization_id FROM participants WHERE id = ${participantId}
        `;

        if (participant.length === 0) {
            return NextResponse.json({ error: "Participant not found" }, { status: 404 });
        }

        const organizationId = participant[0].organization_id;

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

        const entry = result[0];

        // ── Crisis scan on participant-authored entry ──
        // Don't block the write — flag + notify the care team. Best-effort:
        // a scan/notify failure must never fail the journal create.
        try {
            const scan = scanForCrisis(entry_text, mood);
            if (scan.flagged) {
                await sql`
                    UPDATE journal_entries SET flagged_crisis = true WHERE id = ${entry.id}
                `;
                entry.flagged_crisis = true;
                await notifyTeamOfCrisis({
                    organizationId,
                    participantId,
                    source: 'journal',
                    matched: scan.matched,
                    excerpt: entry_text,
                });
            }
        } catch (err) {
            console.error("Crisis scan (journal) failed:", err);
        }

        return NextResponse.json({ entry });
    } catch (error) {
        console.error("Error creating journal entry:", error);
        const message = error instanceof Error ? error.message : "Failed to create journal entry";
        if (message === "Unauthorized") {
            return NextResponse.json({ error: message }, { status: 401 });
        }
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

// PUT /api/journal - Update a journal entry
export async function PUT(req: NextRequest) {
    try {
        const session = await requireAuth();
        const participantId = (session as any).participantId;

        if (!participantId) {
            return NextResponse.json({ error: "Participant not found" }, { status: 400 });
        }

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
            RETURNING *
        `;

        if (result.length === 0) {
            return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
        }

        return NextResponse.json({ entry: result[0] });
    } catch (error) {
        console.error("Error updating journal entry:", error);
        const message = error instanceof Error ? error.message : "Failed to update journal entry";
        if (message === "Unauthorized") {
            return NextResponse.json({ error: message }, { status: 401 });
        }
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

// PATCH /api/journal - PSS-side actions on a participant's shared entries
// Currently: { action: 'mark_viewed', participant_id, organization_id, entry_ids? }
// Marks shared journal entries as viewed by the PSS so the "X new" badge clears.
// This is distinct from the participant/portal-owned PUT above (which resets
// pss_viewed on unshare) — do not conflate the two.
export async function PATCH(req: NextRequest) {
    try {
        const body = await req.json();
        const { action, participant_id, organization_id, entry_ids } = body;

        if (action !== 'mark_viewed') {
            return NextResponse.json({ error: 'Unsupported action' }, { status: 400 });
        }

        if (!participant_id || !organization_id) {
            return NextResponse.json(
                { error: 'participant_id and organization_id are required' },
                { status: 400 }
            );
        }

        // PSS-side: require an authenticated user who belongs to the org
        const session = await getSession();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const userId = await getInternalUserId(session.user.id, session.user.email);
        if (!userId) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }
        try {
            await requireOrgAccess(organization_id);
        } catch {
            return NextResponse.json({ error: 'Organization access denied' }, { status: 403 });
        }

        let result;
        if (Array.isArray(entry_ids) && entry_ids.length > 0) {
            result = await sql`
                UPDATE journal_entries
                SET pss_viewed = true, pss_viewed_by = ${userId}, pss_viewed_at = NOW()
                WHERE participant_id = ${participant_id}
                AND organization_id = ${organization_id}
                AND shared_with_pss = true
                AND pss_viewed = false
                AND id = ANY(${entry_ids}::uuid[])
                RETURNING id
            `;
        } else {
            result = await sql`
                UPDATE journal_entries
                SET pss_viewed = true, pss_viewed_by = ${userId}, pss_viewed_at = NOW()
                WHERE participant_id = ${participant_id}
                AND organization_id = ${organization_id}
                AND shared_with_pss = true
                AND pss_viewed = false
                RETURNING id
            `;
        }

        await logAuditEvent(
            userId, organization_id, 'update', 'journal_entry', participant_id,
            { action: 'mark_viewed', count: result.length, scope: entry_ids?.length ? 'selected' : 'all' }
        );

        return NextResponse.json({
            success: true,
            marked: result.length,
            ids: result.map((r: any) => r.id),
        });
    } catch (error) {
        console.error("Error marking journal entries viewed:", error);
        const message = error instanceof Error ? error.message : "Failed to update journal entries";
        if (message === "Unauthorized") {
            return NextResponse.json({ error: message }, { status: 401 });
        }
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

// DELETE /api/journal - Delete a journal entry
export async function DELETE(req: NextRequest) {
    try {
        const session = await requireAuth();
        const participantId = (session as any).participantId;

        if (!participantId) {
            return NextResponse.json({ error: "Participant not found" }, { status: 400 });
        }

        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'Entry id required' }, { status: 400 });
        }

        const result = await sql`
            DELETE FROM journal_entries
            WHERE id = ${id}
            AND participant_id = ${participantId}
            RETURNING id
        `;

        if (result.length === 0) {
            return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true, deleted_id: id });
    } catch (error) {
        console.error("Error deleting journal entry:", error);
        const message = error instanceof Error ? error.message : "Failed to delete journal entry";
        if (message === "Unauthorized") {
            return NextResponse.json({ error: message }, { status: 401 });
        }
        return NextResponse.json({ error: message }, { status: 500 });
    }
}