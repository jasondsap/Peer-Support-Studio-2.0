import { NextRequest, NextResponse } from 'next/server';
import { getSession, getInternalUserId } from '@/lib/auth';
import { sql, logAuditEvent } from '@/lib/db';
import { generateUniqueKioskCode } from '@/lib/kiosk';

// POST - (re)generate the participant's kiosk check-in code.
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getSession();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const userId = await getInternalUserId(session.user.id, session.user.email);
        if (!userId) return NextResponse.json({ error: 'User not found' }, { status: 404 });
        const organizationId = session.currentOrganization?.id;
        if (!organizationId) return NextResponse.json({ error: 'No organization' }, { status: 404 });

        const { id } = await params;

        // Confirm the participant belongs to the caller's org.
        const owned = await sql`
            SELECT id FROM participants WHERE id = ${id}::uuid AND organization_id = ${organizationId}
        `;
        if (owned.length === 0) {
            return NextResponse.json({ error: 'Participant not found' }, { status: 404 });
        }

        const code = await generateUniqueKioskCode(organizationId);
        await sql`
            UPDATE participants SET kiosk_code = ${code}, updated_at = NOW()
            WHERE id = ${id}::uuid AND organization_id = ${organizationId}
        `;

        await logAuditEvent(userId, organizationId, 'kiosk_code_regenerated', 'participants', id);
        return NextResponse.json({ success: true, kiosk_code: code });
    } catch (error: any) {
        console.error('Kiosk code regenerate error:', error);
        return NextResponse.json({ error: 'Failed to regenerate code' }, { status: 500 });
    }
}
