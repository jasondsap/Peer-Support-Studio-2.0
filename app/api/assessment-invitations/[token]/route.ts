/**
 * Public token-based assessment lookup + submission. No auth — the token IS
 * the credential.
 *
 *   GET  /api/assessment-invitations/[token]
 *        Validates the token (404 / 410 / 409 on bad states), marks the
 *        invitation 'opened' on first valid hit, returns metadata for the form.
 *
 *   POST /api/assessment-invitations/[token]
 *        Accepts the participant's responses + computed total + domain scores.
 *        Writes a recovery_assessments row, marks the invitation 'completed',
 *        captures IP + user agent for audit integrity.
 */

import { NextRequest, NextResponse } from 'next/server';
import { sql, logAuditEvent } from '@/lib/db';
import type { AssessmentType } from '@/lib/assessments/questionnaires';
import { syncScheduleOnAssessment } from '@/lib/assessments/scheduleSync';

export const runtime = 'nodejs';

interface InvitationRow {
    id: string;
    organization_id: string;
    participant_id: string;
    assessment_type: AssessmentType;
    status: 'sent' | 'opened' | 'completed' | 'expired' | 'superseded';
    opened_at: Date | null;
    completed_at: Date | null;
    expires_at: Date;
    total_score: number | null;
    participant_first_name: string | null;
    organization_name: string | null;
}

async function loadInvitation(token: string): Promise<InvitationRow | null> {
    const rows = (await sql`
        SELECT id, organization_id, participant_id, assessment_type, status,
               opened_at, completed_at, expires_at, total_score,
               participant_first_name, organization_name
        FROM assessment_invitations
        WHERE token = ${token}
        LIMIT 1
    `) as InvitationRow[];
    return rows[0] || null;
}

export async function GET(
    _req: NextRequest,
    { params }: { params: { token: string } }
) {
    try {
        const invite = await loadInvitation(params.token);
        if (!invite) {
            return NextResponse.json({ error: 'Invalid or expired link' }, { status: 404 });
        }
        if (invite.status === 'superseded') {
            return NextResponse.json({
                error: 'A newer link has replaced this one. Please use the most recent message.',
            }, { status: 409 });
        }
        if (new Date(invite.expires_at) < new Date()) {
            return NextResponse.json({
                error: 'This assessment link has expired. Please contact your provider for a new link.',
            }, { status: 410 });
        }
        if (invite.status === 'completed') {
            return NextResponse.json({
                error: 'This assessment has already been completed.',
                completed_at: invite.completed_at,
                total_score: invite.total_score,
            }, { status: 409 });
        }

        // Mark as opened on first valid hit
        if (invite.status === 'sent') {
            await sql`UPDATE assessment_invitations SET status = 'opened', opened_at = NOW() WHERE id = ${invite.id}`;
        }

        return NextResponse.json({
            valid: true,
            invitation_id: invite.id,
            assessment_type: invite.assessment_type,
            participant_first_name: invite.participant_first_name,
            organization_name: invite.organization_name,
            expires_at: invite.expires_at,
        });
    } catch (error) {
        console.error('Error looking up invitation:', error);
        return NextResponse.json({ error: 'Failed to validate link' }, { status: 500 });
    }
}

interface SubmitBody {
    /** Per-question answers, key = "q<id>", value = numeric Likert score */
    responses?: Record<string, number>;
    /** Server-trusted total (we re-derive on the server below) */
    total_score?: number;
    /** Per-domain scores object — passed through to recovery_assessments.domain_scores */
    domain_scores?: Record<string, unknown>;
}

export async function POST(
    req: NextRequest,
    { params }: { params: { token: string } }
) {
    try {
        const invite = await loadInvitation(params.token);
        if (!invite) {
            return NextResponse.json({ error: 'Invalid link' }, { status: 404 });
        }
        if (invite.status === 'superseded') {
            return NextResponse.json({ error: 'Superseded' }, { status: 409 });
        }
        if (new Date(invite.expires_at) < new Date()) {
            return NextResponse.json({ error: 'This link has expired' }, { status: 410 });
        }
        if (invite.status === 'completed') {
            return NextResponse.json({ error: 'Already completed' }, { status: 409 });
        }

        const body = (await req.json()) as SubmitBody;
        const { responses, total_score, domain_scores } = body;

        if (!responses || typeof responses !== 'object' || typeof total_score !== 'number') {
            return NextResponse.json(
                { error: 'responses and total_score are required' },
                { status: 400 }
            );
        }

        // Re-derive server-side score from raw responses so a tampered client
        // can't submit an arbitrary total. We use the same scoring functions
        // the staff page uses.
        const { scoreBarc10, scoreMirc28 } = await import('@/lib/assessments/questionnaires');
        const serverScore =
            invite.assessment_type === 'barc10'
                ? scoreBarc10(responses)
                : scoreMirc28(responses);

        // Capture audit provenance — recipient is not a logged-in user
        const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null;
        const userAgent = req.headers.get('user-agent') || null;

        // Insert into recovery_assessments. user_id is NULL because the
        // participant submitted it themselves; sender's UUID is on
        // assessment_invitations.sent_by if you need provenance.
        const inserted = (await sql`
            INSERT INTO recovery_assessments (
                user_id, organization_id, participant_id, participant_name,
                assessment_type, total_score, domain_scores, responses, notes
            ) VALUES (
                NULL,
                ${invite.organization_id},
                ${invite.participant_id},
                ${invite.participant_first_name ?? null},
                ${invite.assessment_type},
                ${serverScore.total},
                ${JSON.stringify(domain_scores ?? serverScore.domains)}::jsonb,
                ${JSON.stringify(responses)}::jsonb,
                ${'Submitted by participant via invitation link'}
            )
            RETURNING id
        `) as Array<{ id: string }>;
        const assessmentId = inserted[0].id;

        // A participant self-completing via the invite link still advances their
        // reassessment cadence (auto-creates a default 90-day one if none).
        await syncScheduleOnAssessment({
            organizationId: invite.organization_id,
            participantId: invite.participant_id,
            assessmentType: invite.assessment_type,
            userId: null,
        });

        // Mark invitation completed + capture IP/UA
        await sql`
            UPDATE assessment_invitations
            SET status = 'completed',
                completed_at = NOW(),
                total_score = ${serverScore.total},
                recovery_assessment_id = ${assessmentId},
                response_ip = ${ip},
                response_user_agent = ${userAgent}
            WHERE id = ${invite.id}
        `;

        await logAuditEvent(
            null,
            invite.organization_id,
            'assessment_invite_completed',
            'assessment_invitations',
            invite.id,
            {
                assessment_type: invite.assessment_type,
                total_score: serverScore.total,
                recovery_assessment_id: assessmentId,
            },
            ip ?? undefined
        );

        return NextResponse.json({
            success: true,
            total_score: serverScore.total,
            assessment_type: invite.assessment_type,
        });
    } catch (error: any) {
        console.error('Error submitting assessment:', error);
        return NextResponse.json(
            { error: error?.message || 'Failed to submit assessment' },
            { status: 500 }
        );
    }
}
