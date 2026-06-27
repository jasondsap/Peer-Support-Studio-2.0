import { NextRequest, NextResponse } from 'next/server';
import { getSession, getInternalUserId } from '@/lib/auth';
import { sql, logAuditEvent } from '@/lib/db';

const SUPERVISOR_ROLES = ['supervisor', 'admin', 'owner'];

// POST - Drive a session note through its review lifecycle.
// Body: { action: 'submit' | 'approve' | 'request_changes', review_notes?: string }
export async function POST(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getSession();

        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const userId = await getInternalUserId(session.user.id, session.user.email);
        if (!userId) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const noteId = params.id;
        const body = await request.json().catch(() => ({}));
        const action = body?.action as string;
        const reviewNotes = body?.review_notes ?? null;

        if (!['submit', 'approve', 'request_changes'].includes(action)) {
            return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
        }

        // Load the note (org-scoped fields needed for role checks)
        const rows = await sql`
            SELECT id, user_id, organization_id, review_status, is_locked
            FROM session_notes
            WHERE id = ${noteId}::uuid
            AND is_archived = false
        `;

        if (rows.length === 0) {
            return NextResponse.json({ error: 'Note not found' }, { status: 404 });
        }

        const note = rows[0];
        const isAuthor = note.user_id === userId;

        // Resolve the caller's role in the note's organization (from the session)
        const orgRole = note.organization_id
            ? session.organizations?.find((o) => o.id === note.organization_id)?.role
            : undefined;
        const isSupervisor = !!orgRole && SUPERVISOR_ROLES.includes(orgRole);

        // ── SUBMIT (author: draft|changes_requested -> submitted) ──────────────
        if (action === 'submit') {
            if (!isAuthor) {
                return NextResponse.json(
                    { error: 'Only the note author can submit it for review' },
                    { status: 403 }
                );
            }
            if (!['draft', 'changes_requested'].includes(note.review_status)) {
                return NextResponse.json(
                    { error: `Cannot submit a note that is ${note.review_status}` },
                    { status: 400 }
                );
            }

            const updated = await sql`
                UPDATE session_notes
                SET review_status = 'submitted',
                    submitted_at = NOW(),
                    submitted_by = ${userId}::uuid,
                    updated_at = NOW()
                WHERE id = ${noteId}::uuid
                RETURNING *
            `;

            await logAuditEvent(userId, note.organization_id || null, 'submit', 'session_note', noteId, {
                review_status: 'submitted',
            });

            return NextResponse.json({ success: true, note: updated[0] });
        }

        // approve / request_changes require supervisor+ in the note's org
        if (!note.organization_id) {
            return NextResponse.json(
                { error: 'Note is not associated with an organization' },
                { status: 403 }
            );
        }
        if (!isSupervisor) {
            return NextResponse.json(
                { error: 'Insufficient permissions to review this note' },
                { status: 403 }
            );
        }
        if (note.review_status !== 'submitted') {
            return NextResponse.json(
                { error: `Only submitted notes can be reviewed (current: ${note.review_status})` },
                { status: 400 }
            );
        }

        // ── APPROVE (supervisor+: submitted -> approved + lock) ────────────────
        if (action === 'approve') {
            const updated = await sql`
                UPDATE session_notes
                SET review_status = 'approved',
                    reviewed_at = NOW(),
                    reviewed_by = ${userId}::uuid,
                    is_locked = true,
                    locked_at = NOW(),
                    updated_at = NOW()
                WHERE id = ${noteId}::uuid
                RETURNING *
            `;

            await logAuditEvent(userId, note.organization_id, 'approve', 'session_note', noteId, {
                review_status: 'approved',
                locked: true,
            });

            return NextResponse.json({ success: true, note: updated[0] });
        }

        // ── REQUEST CHANGES (supervisor+: submitted -> changes_requested) ──────
        const updated = await sql`
            UPDATE session_notes
            SET review_status = 'changes_requested',
                reviewed_at = NOW(),
                reviewed_by = ${userId}::uuid,
                review_notes = ${reviewNotes},
                is_locked = false,
                locked_at = NULL,
                updated_at = NOW()
            WHERE id = ${noteId}::uuid
            RETURNING *
        `;

        await logAuditEvent(userId, note.organization_id, 'request_changes', 'session_note', noteId, {
            review_status: 'changes_requested',
        });

        return NextResponse.json({ success: true, note: updated[0] });
    } catch (error) {
        console.error('Error processing note review action:', error);
        return NextResponse.json({ error: 'Failed to process review action' }, { status: 500 });
    }
}
