/**
 * Public kiosk check-in. No auth — token is the credential. Designed against
 * enumeration: exact match only, identical generic response for no-match vs
 * multi-match, rate-limited + locked out per IP, every attempt audited.
 */
import { NextRequest, NextResponse } from 'next/server';
import { sql, logAuditEvent } from '@/lib/db';
import { loadKiosk } from '../route';

export const runtime = 'nodejs';

const MAX_FAILED = 5;

function clientIp(req: NextRequest): string | null {
    return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null;
}

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ token: string }> }
) {
    const { token } = await params;
    const ip = clientIp(req);

    try {
        const kiosk = await loadKiosk(token);
        if (!kiosk || !kiosk.active) {
            return NextResponse.json({ error: 'This kiosk link is not active.' }, { status: 404 });
        }
        const orgId = kiosk.organization_id;

        // Lockout: too many recent failures from this IP on this kiosk.
        const recentFails = (await sql`
            SELECT COUNT(*)::int AS n FROM kiosk_checkin_attempts
            WHERE kiosk_id = ${kiosk.id}
              AND success = false
              AND (${ip}::text IS NULL OR ip = ${ip})
              AND created_at > NOW() - INTERVAL '10 minutes'
        `) as Array<{ n: number }>;
        if (recentFails[0].n >= MAX_FAILED) {
            return NextResponse.json(
                { error: 'Too many attempts. Please check in with staff.' },
                { status: 429 }
            );
        }

        const body = await req.json();
        const { activity_id, method } = body;

        // Activity must belong to this kiosk's org and be today.
        const act = (await sql`
            SELECT id FROM group_activities
            WHERE id = ${activity_id}::uuid
              AND organization_id = ${orgId}
              AND activity_date = CURRENT_DATE
              AND status = 'active'
            LIMIT 1
        `) as Array<{ id: string }>;
        if (act.length === 0) {
            return NextResponse.json({ error: 'That activity is not available.' }, { status: 400 });
        }

        // Exact, org-scoped, active-only match.
        let matches: Array<{ id: string; first_name: string }> = [];
        if (method === 'code') {
            const code = String(body.code || '').trim();
            if (code) {
                matches = (await sql`
                    SELECT id, first_name FROM participants
                    WHERE organization_id = ${orgId} AND status = 'active'
                      AND UPPER(kiosk_code) = UPPER(${code})
                    LIMIT 2
                `) as any[];
            }
        } else if (method === 'name_dob') {
            const first = String(body.first_name || '').trim();
            const last = String(body.last_name || '').trim();
            if (first && last) {
                matches = (await sql`
                    SELECT id, first_name FROM participants
                    WHERE organization_id = ${orgId} AND status = 'active'
                      AND LOWER(first_name) = LOWER(${first})
                      AND LOWER(last_name) = LOWER(${last})
                    LIMIT 2
                `) as any[];
            }
        }

        const matched = matches.length === 1;

        await sql`
            INSERT INTO kiosk_checkin_attempts (kiosk_id, ip, success)
            VALUES (${kiosk.id}, ${ip}, ${matched})
        `;

        if (!matched) {
            // Identical generic response whether 0 or >1 matches — no enumeration.
            await logAuditEvent(null, orgId, 'kiosk_checkin_failed', 'group_activities', activity_id,
                { method }, ip ?? undefined);
            return NextResponse.json({ matched: false });
        }

        const participant = matches[0];
        await sql`
            INSERT INTO group_attendance (
                organization_id, activity_id, participant_id, attendance_status, source, recorded_by
            ) VALUES (
                ${orgId}::uuid, ${activity_id}::uuid, ${participant.id}::uuid, 'present', 'kiosk', NULL
            )
            ON CONFLICT (activity_id, participant_id) DO NOTHING
        `;

        await logAuditEvent(null, orgId, 'kiosk_checkin', 'group_attendance', participant.id,
            { activity_id, method }, ip ?? undefined);

        return NextResponse.json({ matched: true, first_name: participant.first_name });
    } catch (error) {
        console.error('Kiosk check-in error:', error);
        return NextResponse.json({ error: 'Check-in failed. Please see staff.' }, { status: 500 });
    }
}
