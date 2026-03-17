// app/api/user/select-org/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { sql } from '@/lib/db';

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { organizationId } = await req.json();
    if (!organizationId) return NextResponse.json({ error: 'organizationId required' }, { status: 400 });

    const cognitoSub = (session.user as any).id;

    // Verify this org belongs to this user
    const membership = await sql`
        SELECT om.organization_id FROM organization_members om
        JOIN users u ON u.id = om.user_id
        WHERE u.cognito_sub = ${cognitoSub}
        AND om.organization_id = ${organizationId}
        AND om.status = 'active'
        LIMIT 1
    `;

    if (membership.length === 0) {
        return NextResponse.json({ error: 'Organization not found' }, { status: 403 });
    }

    // Save to preferences JSONB — merges with any existing preferences
    await sql`
        UPDATE users
        SET preferences = COALESCE(preferences, '{}'::jsonb) || jsonb_build_object('selected_org_id', ${organizationId}::text)
        WHERE cognito_sub = ${cognitoSub}
    `;

    return NextResponse.json({ success: true });
}
