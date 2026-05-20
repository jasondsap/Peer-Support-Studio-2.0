/**
 * Twilio wrapper for SMS sending.
 *
 * HIPAA NOTES:
 * - Twilio HIPAA Eligible Service mode + signed BAA required before production
 *   use. Do not ship without both.
 * - Tokenized assessment URLs intentionally contain no PHI (no participant id,
 *   no email, no phone in the path).
 * - Use a Twilio Messaging Service SID (pooled numbers, sticky sender, 10DLC).
 */

import twilio, { Twilio } from 'twilio';

let _client: Twilio | null = null;

function getClient(): Twilio {
    if (_client) return _client;
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    if (!sid || !token) {
        throw new Error('TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN must be set');
    }
    _client = twilio(sid, token);
    return _client;
}

/**
 * Normalize a US phone number to E.164. Accepts:
 *   "(606) 356-6779", "606-356-6779", "6063566779", "+16063566779"
 *
 * Returns null if it can't be confidently coerced — caller treats that as a
 * validation failure, never as "send to fallback number."
 */
export function normalizeUsPhoneE164(input: string | null | undefined): string | null {
    if (!input) return null;
    const digits = input.replace(/\D/g, '');
    if (digits.length === 10) return `+1${digits}`;
    if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
    if (input.trim().startsWith('+') && digits.length >= 11) return `+${digits}`;
    return null;
}

export interface SendSmsParams {
    to: string;
    body: string;
    /** Defaults to TWILIO_MESSAGING_SERVICE_SID; can fall back to TWILIO_FROM_NUMBER. */
    messagingServiceSid?: string;
    from?: string;
    statusCallback?: string;
}

export interface SendSmsResult {
    sid: string;
    status: string;
}

export async function sendSms(params: SendSmsParams): Promise<SendSmsResult> {
    const messagingServiceSid =
        params.messagingServiceSid ?? process.env.TWILIO_MESSAGING_SERVICE_SID;
    const from = params.from ?? process.env.TWILIO_FROM_NUMBER;

    if (!messagingServiceSid && !from) {
        throw new Error('TWILIO_MESSAGING_SERVICE_SID or TWILIO_FROM_NUMBER must be set');
    }

    const client = getClient();
    const message = await client.messages.create({
        to: params.to,
        body: params.body,
        ...(messagingServiceSid ? { messagingServiceSid } : { from: from! }),
        ...(params.statusCallback ? { statusCallback: params.statusCallback } : {}),
    });

    return { sid: message.sid, status: message.status };
}
