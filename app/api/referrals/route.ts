import { NextRequest, NextResponse } from 'next/server';
import { getSession, getInternalUserId, requireOrgAccess } from '@/lib/auth';
import { query, logAuditEvent } from '@/lib/db';

// ============================================================================
// REFERRALS API — app/api/referrals/route.ts
// The "close the loop" surface: create referrals (e.g. from the treatment
// locator), list open follow-ups, and update status/outcome over time.
// All endpoints are org-scoped (requireOrgAccess) and audited.
// ============================================================================

function accessDenied(err: unknown) {
    const message = err instanceof Error ? err.message : 'Unauthorized';
    const status = (message.includes('access denied') || message.includes('Insufficient')) ? 403 : 401;
    return NextResponse.json({ error: message }, { status });
}

// Statuses that close out a referral (and stamp closed_at).
const CLOSING_STATUSES = ['enrolled', 'declined', 'closed'];

// ============================================================================
// GET /api/referrals?organization_id=&participant_id=
// participant_id optional — without it, returns the org's referrals
// (newest first) so the management page can surface open follow-ups.
// ============================================================================
export async function GET(req: NextRequest) {
    try {
        const session = await getSession();
        if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { searchParams } = new URL(req.url);
        const organizationId = searchParams.get('organization_id');
        const participantId = searchParams.get('participant_id');

        if (!organizationId) {
            return NextResponse.json({ error: 'organization_id required' }, { status: 400 });
        }
        try { await requireOrgAccess(organizationId); } catch (err) { return accessDenied(err); }

        let sql = `
            SELECT r.id, r.participant_id, r.referred_to, r.referral_type, r.contact_info,
                   r.reason, r.status, r.follow_up_date, r.referred_at, r.notes,
                   r.outcome, r.closed_at, r.source,
                   p.first_name AS participant_first_name,
                   p.last_name AS participant_last_name,
                   p.preferred_name AS participant_preferred_name
            FROM referrals r
            LEFT JOIN participants p ON r.participant_id = p.id
            WHERE r.organization_id = $1
        `;
        const params: any[] = [organizationId];

        if (participantId) {
            sql += ` AND r.participant_id = $2`;
            params.push(participantId);
        }

        // Open follow-ups first, then by soonest follow-up date, then newest.
        sql += `
            ORDER BY
                CASE WHEN r.status IN ('enrolled', 'declined', 'closed') THEN 1 ELSE 0 END,
                r.follow_up_date ASC NULLS LAST,
                r.referred_at DESC
        `;

        const referrals = await query(sql, params);
        return NextResponse.json({ referrals });
    } catch (error) {
        console.error('Error fetching referrals:', error);
        return NextResponse.json({ error: 'Failed to fetch referrals' }, { status: 500 });
    }
}

// ============================================================================
// POST /api/referrals
// { organization_id, participant_id, referred_to, referral_type?, contact_info?,
//   reason?, follow_up_date?, source? } -> insert with status 'referred'.
// ============================================================================
export async function POST(req: NextRequest) {
    try {
        const session = await getSession();
        if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await req.json();
        const {
            organization_id, participant_id, referred_to,
            referral_type, contact_info, reason, follow_up_date, source,
        } = body;

        if (!organization_id || !participant_id || !referred_to) {
            return NextResponse.json(
                { error: 'organization_id, participant_id, and referred_to required' },
                { status: 400 }
            );
        }
        try { await requireOrgAccess(organization_id); } catch (err) { return accessDenied(err); }

        const userId = await getInternalUserId(session.user.id, session.user.email);
        if (!userId) return NextResponse.json({ error: 'User not found' }, { status: 404 });

        // Participant must belong to the same org.
        const participantCheck = await query(
            'SELECT id FROM participants WHERE id = $1 AND organization_id = $2',
            [participant_id, organization_id]
        ) as any[];
        if (participantCheck.length === 0) {
            return NextResponse.json({ error: 'Participant not found' }, { status: 404 });
        }

        const inserted = await query(
            `INSERT INTO referrals (
                organization_id, participant_id, referred_to, referral_type,
                contact_info, reason, status, follow_up_date, source, referred_by
            ) VALUES ($1, $2, $3, $4, $5, $6, 'referred', $7, $8, $9)
            RETURNING *`,
            [
                organization_id,
                participant_id,
                referred_to,
                referral_type || 'treatment',
                contact_info ? JSON.stringify(contact_info) : null,
                reason || null,
                follow_up_date || null,
                source ? JSON.stringify(source) : null,
                userId,
            ]
        ) as any[];

        const referral = inserted[0];
        await logAuditEvent(userId, organization_id, 'create', 'referral', referral.id);

        return NextResponse.json({ referral });
    } catch (error) {
        console.error('Error creating referral:', error);
        return NextResponse.json({ error: 'Failed to create referral' }, { status: 500 });
    }
}

// ============================================================================
// PATCH /api/referrals
// { id, organization_id, status?, follow_up_date?, outcome?, notes? } -> update.
// Moving status to enrolled|declined|closed stamps closed_at = now().
// ============================================================================
export async function PATCH(req: NextRequest) {
    try {
        const session = await getSession();
        if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await req.json();
        const { id, organization_id, status, follow_up_date, outcome, notes } = body;

        if (!id || !organization_id) {
            return NextResponse.json({ error: 'id and organization_id required' }, { status: 400 });
        }
        try { await requireOrgAccess(organization_id); } catch (err) { return accessDenied(err); }

        const userId = await getInternalUserId(session.user.id, session.user.email);
        if (!userId) return NextResponse.json({ error: 'User not found' }, { status: 404 });

        // Confirm the referral exists in this org before mutating.
        const existing = await query(
            'SELECT id FROM referrals WHERE id = $1 AND organization_id = $2',
            [id, organization_id]
        ) as any[];
        if (existing.length === 0) {
            return NextResponse.json({ error: 'Referral not found' }, { status: 404 });
        }

        const fields: string[] = [];
        const values: any[] = [];
        let pi = 1;

        if (status !== undefined) {
            fields.push(`status = $${pi++}`); values.push(status);
            // Stamp / clear closed_at based on whether the new status is terminal.
            if (CLOSING_STATUSES.includes(status)) {
                fields.push(`closed_at = NOW()`);
            } else {
                fields.push(`closed_at = NULL`);
            }
        }
        if (follow_up_date !== undefined) { fields.push(`follow_up_date = $${pi++}`); values.push(follow_up_date || null); }
        if (outcome !== undefined) { fields.push(`outcome = $${pi++}`); values.push(outcome || null); }
        if (notes !== undefined) { fields.push(`notes = $${pi++}`); values.push(notes || null); }

        if (fields.length === 0) {
            return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
        }

        fields.push(`updated_at = NOW()`);
        values.push(id);
        values.push(organization_id);

        const updated = await query(
            `UPDATE referrals SET ${fields.join(', ')}
             WHERE id = $${pi++} AND organization_id = $${pi}
             RETURNING *`,
            values
        ) as any[];

        const referral = updated[0];
        await logAuditEvent(userId, organization_id, 'update', 'referral', id);

        return NextResponse.json({ referral });
    } catch (error) {
        console.error('Error updating referral:', error);
        return NextResponse.json({ error: 'Failed to update referral' }, { status: 500 });
    }
}
