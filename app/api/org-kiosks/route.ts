import { NextRequest, NextResponse } from 'next/server';
import { getSession, getInternalUserId } from '@/lib/auth';
import { sql, logAuditEvent } from '@/lib/db';
import { generateKioskToken } from '@/lib/kiosk';

const MANAGE_ROLES = ['admin', 'owner'];

async function getUserContext(session: any) {
    const userId = await getInternalUserId(session.user.id, session.user.email);
    if (!userId) return null;
    const organizationId = session.currentOrganization?.id;
    if (!organizationId) return null;
    const role = session.currentOrganization?.role || '';
    return { userId, organizationId, role };
}

// GET - the org's kiosk(s); lazily provision one if none exists.
export async function GET(request: NextRequest) {
    try {
        const session = await getSession();
        if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const ctx = await getUserContext(session);
        if (!ctx) return NextResponse.json({ error: 'User not found' }, { status: 404 });
        if (!MANAGE_ROLES.includes(ctx.role)) {
            return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
        }

        let kiosks = await sql`
            SELECT id, token, label, location_id, active, last_used_at, created_at
            FROM org_kiosks WHERE organization_id = ${ctx.organizationId}
            ORDER BY created_at ASC
        `;

        if (kiosks.length === 0) {
            const created = await sql`
                INSERT INTO org_kiosks (organization_id, token)
                VALUES (${ctx.organizationId}::uuid, ${generateKioskToken()})
                RETURNING id, token, label, location_id, active, last_used_at, created_at
            `;
            kiosks = created;
        }

        return NextResponse.json({ success: true, kiosks });
    } catch (error: any) {
        console.error('Org kiosks GET error:', error);
        return NextResponse.json({ error: 'Failed to load kiosks' }, { status: 500 });
    }
}

// POST - actions: rotate (new token), set_active
export async function POST(request: NextRequest) {
    try {
        const session = await getSession();
        if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const ctx = await getUserContext(session);
        if (!ctx) return NextResponse.json({ error: 'User not found' }, { status: 404 });
        if (!MANAGE_ROLES.includes(ctx.role)) {
            return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
        }

        const body = await request.json();
        const { action, kioskId } = body;
        if (!kioskId) return NextResponse.json({ error: 'kioskId is required' }, { status: 400 });

        if (action === 'rotate') {
            const result = await sql`
                UPDATE org_kiosks SET token = ${generateKioskToken()}, updated_at = NOW()
                WHERE id = ${kioskId}::uuid AND organization_id = ${ctx.organizationId}
                RETURNING id, token, label, active, last_used_at
            `;
            if (result.length === 0) return NextResponse.json({ error: 'Kiosk not found' }, { status: 404 });
            await logAuditEvent(ctx.userId, ctx.organizationId, 'kiosk_token_rotated', 'org_kiosks', kioskId);
            return NextResponse.json({ success: true, kiosk: result[0] });
        }

        if (action === 'set_active') {
            const result = await sql`
                UPDATE org_kiosks SET active = ${!!body.active}, updated_at = NOW()
                WHERE id = ${kioskId}::uuid AND organization_id = ${ctx.organizationId}
                RETURNING id, token, label, active, last_used_at
            `;
            if (result.length === 0) return NextResponse.json({ error: 'Kiosk not found' }, { status: 404 });
            return NextResponse.json({ success: true, kiosk: result[0] });
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    } catch (error: any) {
        console.error('Org kiosks POST error:', error);
        return NextResponse.json({ error: 'Failed to update kiosk' }, { status: 500 });
    }
}
