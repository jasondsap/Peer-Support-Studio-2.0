/**
 * Public kiosk context. No auth — the token IS the credential (same model as
 * /api/assessment-invitations/[token]). Returns only non-PHI: org name and
 * today's group activities for this kiosk's org/location.
 */
import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export const runtime = 'nodejs';

interface KioskRow {
    id: string;
    organization_id: string;
    location_id: string | null;
    active: boolean;
    org_name: string | null;
    location_name: string | null;
}

export async function loadKiosk(token: string): Promise<KioskRow | null> {
    const rows = (await sql`
        SELECT k.id, k.organization_id, k.location_id, k.active,
               o.name AS org_name, l.name AS location_name
        FROM org_kiosks k
        LEFT JOIN organizations o ON o.id = k.organization_id
        LEFT JOIN locations l ON l.id = k.location_id
        WHERE k.token = ${token}
        LIMIT 1
    `) as KioskRow[];
    return rows[0] || null;
}

export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ token: string }> }
) {
    try {
        const { token } = await params;
        const kiosk = await loadKiosk(token);
        if (!kiosk || !kiosk.active) {
            return NextResponse.json({ error: 'This kiosk link is not active.' }, { status: 404 });
        }

        // Today's activities for this org (and location, if the kiosk is location-bound).
        const activities = await sql`
            SELECT id, name, activity_type, start_time
            FROM group_activities
            WHERE organization_id = ${kiosk.organization_id}
              AND status = 'active'
              AND activity_date = CURRENT_DATE
              AND (${kiosk.location_id}::uuid IS NULL OR location_id = ${kiosk.location_id}::uuid)
            ORDER BY start_time ASC NULLS LAST, name ASC
        `;

        await sql`UPDATE org_kiosks SET last_used_at = NOW() WHERE id = ${kiosk.id}`;

        return NextResponse.json({
            valid: true,
            organization_name: kiosk.org_name,
            location_name: kiosk.location_name,
            activities,
        });
    } catch (error) {
        console.error('Kiosk GET error:', error);
        return NextResponse.json({ error: 'Failed to load kiosk' }, { status: 500 });
    }
}
