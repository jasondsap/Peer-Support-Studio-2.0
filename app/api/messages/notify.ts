// ============================================================================
// Messaging — crisis scan + out-of-band delivery notifications
// File: app/api/messages/notify.ts
//
// Shared by app/api/messages/** and app/api/journal/route.ts.
//
// HIPAA / safety notes:
//   - Every function here is BEST-EFFORT. They each swallow their own errors
//     and never throw, so a notify/scan failure can never break the core write.
//   - Outbound participant notifications contain NO PHI: just a generic "you
//     have a new message" line plus the portal URL (same posture as the
//     assessment-invite + portal-welcome emails).
//   - Crisis alerts to staff DO include the participant's name, but only go to
//     authorized care-team members (assigned PSS + org supervisors/admins),
//     consistent with the rest of the app emailing staff about their caseload.
// ============================================================================

import { sql } from '@/lib/db';
import { sendEmail } from '@/lib/email/resend';
import { normalizeUsPhoneE164, sendSms } from '@/lib/sms/twilio';

const PORTAL_URL =
    process.env.PARTICIPANT_PORTAL_URL || 'https://my.peersupportstudio.com';
const SENDER_DISPLAY_NAME =
    process.env.INVITE_SENDER_DISPLAY_NAME || 'Peer Support Studio';
const STUDIO_BASE_URL =
    process.env.NEXTAUTH_URL || process.env.INVITE_BASE_URL || '';
// Opt-in proxy: there is no per-participant SMS-consent column yet, so SMS is
// gated behind an org/deploy-level flag. Email remains the default channel.
const SMS_NOTIFY_ENABLED = process.env.MESSAGE_NOTIFY_SMS_ENABLED === 'true';

// ----------------------------------------------------------------------------
// Crisis keyword / mood scan
// ----------------------------------------------------------------------------

// Curated, intentionally small. Lower-cased; matched as substrings against the
// lower-cased, whitespace-normalized content. Phrase-based to limit false
// positives (e.g. "kill myself" rather than "kill").
export const CRISIS_KEYWORDS: string[] = [
    'suicide',
    'suicidal',
    'kill myself',
    'killing myself',
    'end my life',
    'ending my life',
    'want to die',
    'wanna die',
    'better off dead',
    'self-harm',
    'self harm',
    'hurt myself',
    'hurting myself',
    'cut myself',
    'cutting myself',
    'overdose',
    'od on',
    'no reason to live',
    "don't want to be here anymore",
    'dont want to be here anymore',
    'take my own life',
];

// Moods (from the journal mood picker) that on their own warrant a flag.
const CRISIS_MOODS = new Set(['crisis', 'hopeless', 'suicidal']);

export interface CrisisScanResult {
    flagged: boolean;
    matched: string[];
}

/**
 * Scan participant-authored text (and optional mood) for crisis signals.
 * Pure + synchronous; never throws.
 */
export function scanForCrisis(
    text: string | null | undefined,
    mood?: string | null
): CrisisScanResult {
    const matched: string[] = [];
    try {
        const haystack = (text || '').toLowerCase().replace(/\s+/g, ' ');
        for (const kw of CRISIS_KEYWORDS) {
            if (haystack.includes(kw)) matched.push(kw);
        }
        if (mood && CRISIS_MOODS.has(String(mood).toLowerCase().trim())) {
            matched.push(`mood:${mood}`);
        }
    } catch {
        // never throw
    }
    return { flagged: matched.length > 0, matched };
}

// ----------------------------------------------------------------------------
// Out-of-band participant notification (new message landed)
// ----------------------------------------------------------------------------

interface NotifyParticipantArgs {
    organizationId: string;
    participantId: string;
}

/**
 * Best-effort: let a participant know a new message is waiting in their portal.
 * Prefers email (portal credential email, then participant.email); optionally
 * falls back to SMS when enabled and a phone is on file. Never throws.
 */
export async function notifyParticipantOfMessage(
    args: NotifyParticipantArgs
): Promise<void> {
    const { organizationId, participantId } = args;
    try {
        const rows = (await sql`
            SELECT
                p.first_name,
                p.phone,
                COALESCE(pc.email, p.email) AS email,
                COALESCE(pc.portal_enabled, false) AS portal_enabled
            FROM participants p
            LEFT JOIN participant_credentials pc ON pc.participant_id = p.id
            WHERE p.id = ${participantId}
              AND p.organization_id = ${organizationId}
            LIMIT 1
        `) as Array<{
            first_name: string | null;
            phone: string | null;
            email: string | null;
            portal_enabled: boolean;
        }>;

        const participant = rows[0];
        if (!participant) return;

        const firstName = (participant.first_name || '').trim();
        const greeting = firstName ? `Hi ${firstName},` : 'Hello,';

        // --- Email (preferred) ---
        if (participant.email && participant.email.includes('@')) {
            const subject = `You have a new message — ${SENDER_DISPLAY_NAME}`;
            const text = [
                greeting,
                '',
                'You have a new message from your care team in your Peer Support Studio portal.',
                '',
                `Sign in to read it: ${PORTAL_URL}`,
                '',
                'If you or someone you know is in crisis, call or text 988 (Suicide & Crisis Lifeline), or call 911 for emergencies.',
            ].join('\n');
            const html = `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f5f7fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:24px;">
    <div style="background:#1A73A8;color:#fff;padding:24px;border-radius:10px 10px 0 0;text-align:center;">
      <h1 style="margin:0;font-size:18px;">You have a new message</h1>
    </div>
    <div style="background:#fff;padding:24px;border:1px solid #e6ebf1;border-top:none;border-radius:0 0 10px 10px;">
      <p style="color:#222;">${greeting}</p>
      <p style="color:#444;">You have a new message from your care team in your Peer Support Studio portal.</p>
      <p style="text-align:center;margin:24px 0;">
        <a href="${PORTAL_URL}" style="display:inline-block;background:#1A73A8;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;">Sign in to read your message</a>
      </p>
      <p style="color:#888;font-size:12px;margin-top:24px;">If you or someone you know is in crisis, call or text <strong>988</strong> (Suicide &amp; Crisis Lifeline), or call <strong>911</strong> for emergencies. This is an automated message — please don't reply.</p>
    </div>
  </div>
</body></html>`;

            try {
                await sendEmail({ to: participant.email, subject, html, text });
                return; // delivered via email; don't double-notify by SMS
            } catch (err) {
                console.error('notifyParticipantOfMessage: email failed', err);
                // fall through to SMS attempt
            }
        }

        // --- SMS fallback (opt-in, no PHI) ---
        if (SMS_NOTIFY_ENABLED) {
            const e164 = normalizeUsPhoneE164(participant.phone);
            if (e164) {
                const body =
                    `${SENDER_DISPLAY_NAME}: you have a new message from your care team. ` +
                    `Sign in to read it: ${PORTAL_URL}`;
                try {
                    await sendSms({
                        to: e164,
                        body,
                        statusCallback: process.env.TWILIO_STATUS_CALLBACK_URL,
                    });
                } catch (err) {
                    console.error('notifyParticipantOfMessage: sms failed', err);
                }
            }
        }
    } catch (err) {
        console.error('notifyParticipantOfMessage: failed', err);
    }
}

// ----------------------------------------------------------------------------
// Crisis alert to the care team
// ----------------------------------------------------------------------------

interface NotifyTeamOfCrisisArgs {
    organizationId: string;
    participantId: string;
    source: 'message' | 'journal';
    matched: string[];
    /** Optional short excerpt of the flagged content (truncated by caller). */
    excerpt?: string | null;
}

/**
 * Best-effort: alert the assigned PSS + org supervisors/admins that a
 * participant's inbound content tripped the crisis scan. Never throws.
 */
export async function notifyTeamOfCrisis(
    args: NotifyTeamOfCrisisArgs
): Promise<void> {
    const { organizationId, participantId, source, matched, excerpt } = args;
    try {
        const partRows = (await sql`
            SELECT first_name, last_name, primary_pss_id
            FROM participants
            WHERE id = ${participantId}
              AND organization_id = ${organizationId}
            LIMIT 1
        `) as Array<{
            first_name: string | null;
            last_name: string | null;
            primary_pss_id: string | null;
        }>;
        const participant = partRows[0];
        if (!participant) return;

        // Recipients: assigned PSS + supervisors/admins/owners in the org.
        const recipients = (await sql`
            SELECT DISTINCT u.email, u.first_name
            FROM users u
            JOIN organization_members om
              ON om.user_id = u.id
             AND om.organization_id = ${organizationId}
            WHERE (
                om.role IN ('owner', 'admin', 'supervisor')
                OR u.id = ${participant.primary_pss_id}
            )
            AND u.email IS NOT NULL
        `) as Array<{ email: string | null; first_name: string | null }>;

        if (recipients.length === 0) return;

        const firstName = (participant.first_name || '').trim();
        const lastInitial = (participant.last_name || '').trim().charAt(0);
        const who =
            `${firstName}${lastInitial ? ' ' + lastInitial + '.' : ''}`.trim() ||
            'A participant';
        const sourceLabel = source === 'journal' ? 'journal entry' : 'message';
        const link = STUDIO_BASE_URL
            ? `${STUDIO_BASE_URL.replace(/\/$/, '')}/participants/${participantId}`
            : '';
        const cleanExcerpt = (excerpt || '').replace(/\s+/g, ' ').trim().slice(0, 200);

        const subject = `[Crisis flag] ${who} — review their ${sourceLabel}`;
        const textLines = [
            `A ${sourceLabel} from ${who} was automatically flagged for possible crisis content and needs review.`,
            '',
            matched.length ? `Signals: ${matched.join(', ')}` : '',
            cleanExcerpt ? `Excerpt: "${cleanExcerpt}"` : '',
            '',
            link ? `Open their record: ${link}` : '',
            '',
            'This is an automated safety alert. If you believe the participant is in immediate danger, follow your crisis protocol and call 911.',
        ].filter(Boolean);
        const text = textLines.join('\n');
        const html = `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#fff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:24px;">
    <div style="background:#b91c1c;color:#fff;padding:16px 24px;border-radius:10px 10px 0 0;">
      <h1 style="margin:0;font-size:17px;">Crisis flag — review needed</h1>
    </div>
    <div style="background:#fff;padding:24px;border:1px solid #fee2e2;border-top:none;border-radius:0 0 10px 10px;">
      <p style="color:#222;">A ${sourceLabel} from <strong>${who}</strong> was automatically flagged for possible crisis content and needs review.</p>
      ${matched.length ? `<p style="color:#444;font-size:13px;"><strong>Signals:</strong> ${matched.join(', ')}</p>` : ''}
      ${cleanExcerpt ? `<p style="color:#444;font-size:13px;background:#f9fafb;border-left:3px solid #b91c1c;padding:8px 12px;">${cleanExcerpt}</p>` : ''}
      ${link ? `<p style="text-align:center;margin:20px 0;"><a href="${link}" style="display:inline-block;background:#b91c1c;color:#fff;padding:10px 24px;border-radius:8px;text-decoration:none;font-weight:600;">Open participant record</a></p>` : ''}
      <p style="color:#888;font-size:12px;margin-top:20px;">Automated safety alert. If the participant may be in immediate danger, follow your crisis protocol and call 911.</p>
    </div>
  </div>
</body></html>`;

        await Promise.allSettled(
            recipients
                .filter((r) => r.email && r.email.includes('@'))
                .map((r) =>
                    sendEmail({ to: r.email as string, subject, html, text })
                )
        );
    } catch (err) {
        console.error('notifyTeamOfCrisis: failed', err);
    }
}
