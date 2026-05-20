/**
 * POST /api/participants/[id]/assessment/send
 *
 * Sends a tokenized assessment link to a participant via email or SMS.
 *
 * Body: { channel: 'email' | 'sms', assessment_type: 'barc10' | 'mirc28', organization_id: string }
 *
 * Returns: { success, message, invitationId, assessmentType, providerMessageId? }
 */

import { NextRequest, NextResponse } from 'next/server';
import { sendAssessmentInvite } from '@/lib/assessment-invite/sender';
import type {
    AssessmentInviteChannel,
    AssessmentType,
} from '@/lib/assessment-invite/types';
import { validateUUID } from '@/lib/db';
import { getSessionWithUserId, requireOrgAccess } from '@/lib/auth';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    const participantId = params.id;
    if (!participantId || !validateUUID(participantId)) {
        return NextResponse.json({ error: 'Invalid participant id' }, { status: 400 });
    }

    let body: { channel?: string; assessment_type?: string; organization_id?: string };
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const channel = body.channel as AssessmentInviteChannel | undefined;
    if (channel !== 'email' && channel !== 'sms') {
        return NextResponse.json(
            { error: "channel must be 'email' or 'sms'" },
            { status: 400 }
        );
    }

    const assessmentType = body.assessment_type as AssessmentType | undefined;
    if (assessmentType !== 'barc10' && assessmentType !== 'mirc28') {
        return NextResponse.json(
            { error: "assessment_type must be 'barc10' or 'mirc28'" },
            { status: 400 }
        );
    }

    const organizationId = body.organization_id;
    if (!organizationId || !validateUUID(organizationId)) {
        return NextResponse.json({ error: 'organization_id is required' }, { status: 400 });
    }

    let session;
    try {
        await requireOrgAccess(organizationId);
        session = await getSessionWithUserId();
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unauthorized';
        const status = message.includes('access denied') ? 403 : 401;
        return NextResponse.json({ error: message }, { status });
    }

    try {
        const result = await sendAssessmentInvite({
            organizationId,
            participantId,
            assessmentType,
            channel,
            sentByUserId: session.internalUserId,
        });
        if (!result.success) {
            return NextResponse.json(result, { status: 422 });
        }
        return NextResponse.json(result, { status: 200 });
    } catch (err) {
        console.error('[assessment/send] unexpected error', {
            participantId,
            organizationId,
            assessmentType,
            channel,
            error: err instanceof Error ? err.message : String(err),
        });
        return NextResponse.json(
            { error: 'Internal error sending assessment invitation' },
            { status: 500 }
        );
    }
}
