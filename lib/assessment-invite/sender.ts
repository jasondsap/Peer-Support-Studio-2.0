/**
 * Send an assessment-completion invitation to a participant via email or SMS.
 *
 * Ported from ddor-platform/lib/assessment-invite/sender.ts. PSS differences:
 *   - Multi-tenant: rows carry organization_id and the supersede match is
 *     four-way (org, participant, assessment_type, delivery_method)
 *   - PSS values: assessment_type ∈ {'barc10','mirc28'}
 *   - PSS audit: logAuditEvent takes (userId, orgId, action, resourceType, …)
 *   - 7-day expiry, kept from ddor
 *   - sql.transaction is not exposed by the PSS Proxy — runs supersede +
 *     insert as two sequential awaits (failure mode: an orphan 'superseded'
 *     row, which is fine)
 */

import { randomBytes } from 'node:crypto';
import { createElement } from 'react';
import { render as renderEmail } from '@react-email/render';
import { sql, logAuditEvent } from '@/lib/db';
import { normalizeUsPhoneE164, sendSms } from '@/lib/sms/twilio';
import { sendEmail } from '@/lib/email/resend';
import { AssessmentInviteEmail } from '@/emails/AssessmentInviteEmail';
import {
    ASSESSMENT_LABELS,
    SendAssessmentInviteInput,
    SendAssessmentInviteResult,
} from '@/lib/assessment-invite/types';

const SENDER_DISPLAY_NAME =
    process.env.INVITE_SENDER_DISPLAY_NAME || 'Peer Support Studio';

function generateToken(): string {
    return randomBytes(32).toString('base64url');
}

function buildInviteUrl(token: string): string {
    const base = process.env.INVITE_BASE_URL || process.env.NEXTAUTH_URL;
    if (!base) throw new Error('INVITE_BASE_URL or NEXTAUTH_URL must be set');
    const root = base.endsWith('/') ? base.slice(0, -1) : base;
    return `${root}/assessment/${token}`;
}

function redactAddress(address: string, channel: 'email' | 'sms'): string {
    if (channel === 'sms') {
        const digits = address.replace(/\D/g, '');
        return `***-***-${digits.slice(-4)}`;
    }
    const at = address.indexOf('@');
    if (at <= 0) return '***';
    return `***@${address.slice(at + 1)}`;
}

function renderSmsBody(p: { inviteUrl: string; senderDisplayName: string; assessmentLabel: string }): string {
    return (
        `${p.senderDisplayName}: please complete your ${p.assessmentLabel} check-in at the link below.\n\n` +
        p.inviteUrl
    );
}

function renderEmailText(p: { inviteUrl: string; senderDisplayName: string; assessmentLabel: string }): string {
    return [
        p.senderDisplayName,
        '',
        `Please complete your ${p.assessmentLabel} check-in`,
        '',
        'Your provider has asked you to complete a brief questionnaire as part of',
        'your care plan. It takes about 5 minutes.',
        '',
        p.inviteUrl,
        '',
        'If you did not expect this message, you can safely ignore it.',
        'The link expires in 7 days.',
    ].join('\n');
}

interface ParticipantRow {
    id: string;
    first_name: string | null;
    email: string | null;
    phone: string | null;
    organization_name: string | null;
}

export async function sendAssessmentInvite(
    input: SendAssessmentInviteInput
): Promise<SendAssessmentInviteResult> {
    const { organizationId, participantId, assessmentType, channel, sentByUserId } = input;
    const assessmentLabel = ASSESSMENT_LABELS[assessmentType];

    // 1. Load participant + org name. Org filter enforces tenant isolation —
    //    a participant fetched against the wrong org returns zero rows.
    const rows = (await sql`
        SELECT p.id, p.first_name, p.email, p.phone, o.name AS organization_name
        FROM participants p
        JOIN organizations o ON o.id = p.organization_id
        WHERE p.id = ${participantId}
          AND p.organization_id = ${organizationId}
        LIMIT 1
    `) as ParticipantRow[];
    const participant = rows[0];
    if (!participant) {
        return {
            invitationId: '', channel, assessmentType,
            success: false, message: 'Participant not found in this organization.',
        };
    }

    // 2. Resolve recipient address
    let recipientAddress: string;
    if (channel === 'email') {
        if (!participant.email || !participant.email.includes('@')) {
            return {
                invitationId: '', channel, assessmentType,
                success: false, message: 'Participant has no valid email address on file.',
            };
        }
        recipientAddress = participant.email;
    } else {
        const e164 = normalizeUsPhoneE164(participant.phone);
        if (!e164) {
            return {
                invitationId: '', channel, assessmentType,
                success: false, message: 'Participant has no valid phone number on file.',
            };
        }
        recipientAddress = e164;
    }

    // 3. Generate token
    const token = generateToken();
    const deliveryMethod = channel === 'sms' ? 'text' : 'email';

    // 4. Supersede any prior pending invite for the same (org, participant,
    //    type, channel). Sequential (no transaction) — see file header.
    //    Legacy rows from the retired participant-app flow used 'pending';
    //    new rows use 'sent'. Match both so resends supersede cleanly.
    await sql`
        UPDATE assessment_invitations
        SET status = 'superseded'
        WHERE organization_id = ${organizationId}
          AND participant_id  = ${participantId}
          AND assessment_type = ${assessmentType}
          AND delivery_method = ${deliveryMethod}
          AND status IN ('pending', 'sent', 'opened')
    `;

    // 5. Insert new row. created_by is the existing column the table already
    //    has — we reuse it rather than introducing sent_by.
    //    The legacy schema has a BEFORE INSERT trigger that auto-generates a
    //    short token; our explicit value overrides it.
    const inserted = (await sql`
        INSERT INTO assessment_invitations (
            organization_id, participant_id, token, assessment_type,
            delivery_method, sent_to, created_by, status,
            sent_at, expires_at,
            participant_first_name, organization_name
        ) VALUES (
            ${organizationId}, ${participantId}, ${token}, ${assessmentType},
            ${deliveryMethod}, ${recipientAddress}, ${sentByUserId}, 'sent',
            NOW(), NOW() + INTERVAL '7 days',
            ${participant.first_name ?? ''}, ${participant.organization_name ?? null}
        )
        RETURNING id
    `) as Array<{ id: string }>;
    const invitationId = inserted[0].id;

    // 6. Send via chosen channel
    const inviteUrl = buildInviteUrl(token);
    let providerMessageId: string;

    try {
        if (channel === 'sms') {
            const body = renderSmsBody({
                inviteUrl,
                senderDisplayName: SENDER_DISPLAY_NAME,
                assessmentLabel,
            });
            const result = await sendSms({
                to: recipientAddress,
                body,
                statusCallback: process.env.TWILIO_STATUS_CALLBACK_URL,
            });
            providerMessageId = result.sid;
            await sql`
                UPDATE assessment_invitations
                SET send_provider_message_id = ${providerMessageId},
                    send_status = ${result.status}
                WHERE id = ${invitationId}
            `;
        } else {
            const html = await renderEmail(
                createElement(AssessmentInviteEmail, {
                    inviteUrl,
                    senderDisplayName: SENDER_DISPLAY_NAME,
                    assessmentLabel,
                    recipientFirstName: participant.first_name ?? undefined,
                })
            );
            const text = renderEmailText({
                inviteUrl,
                senderDisplayName: SENDER_DISPLAY_NAME,
                assessmentLabel,
            });
            const result = await sendEmail({
                to: recipientAddress,
                subject: `Please complete your ${assessmentLabel} check-in — ${SENDER_DISPLAY_NAME}`,
                html,
                text,
            });
            providerMessageId = result.id;
            await sql`
                UPDATE assessment_invitations
                SET send_provider_message_id = ${providerMessageId},
                    send_status = 'sent'
                WHERE id = ${invitationId}
            `;
        }
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown send error';
        await sql`
            UPDATE assessment_invitations
            SET send_status = 'failed', send_error = ${message}
            WHERE id = ${invitationId}
        `;
        await logAuditEvent(
            sentByUserId,
            organizationId,
            `assessment_invite_${channel}_send_failed`,
            'assessment_invitations',
            invitationId,
            {
                channel,
                assessment_type: assessmentType,
                recipient_redacted: redactAddress(recipientAddress, channel),
                error: message,
            }
        );
        return {
            invitationId, channel, assessmentType,
            success: false, message: `Send failed: ${message}`,
        };
    }

    await logAuditEvent(
        sentByUserId,
        organizationId,
        `assessment_invite_${channel}_sent`,
        'assessment_invitations',
        invitationId,
        {
            channel,
            assessment_type: assessmentType,
            recipient_redacted: redactAddress(recipientAddress, channel),
            provider_message_id: providerMessageId,
        }
    );

    return {
        invitationId, channel, assessmentType,
        success: true,
        message:
            channel === 'sms'
                ? `${assessmentLabel} link sent. The participant will receive an SMS shortly.`
                : `${assessmentLabel} email sent. Delivery typically takes under a minute.`,
        providerMessageId,
    };
}
