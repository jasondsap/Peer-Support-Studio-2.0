// app/api/user/context/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getSession, getInternalUserId } from '@/lib/auth';
import { sql } from '@/lib/db';

export async function GET(request: NextRequest) {
    try {
        const session = await getSession();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get internal user ID
        const userId = await getInternalUserId(session.user.id, session.user.email);
        
        if (!userId) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        // Get user details from database
        const result = await sql`
            SELECT 
                id,
                email,
                first_name,
                last_name
            FROM users
            WHERE id = ${userId}
        `;

        if (result.length === 0) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        // Get organization from session (already loaded by NextAuth)
        const currentOrg = session.currentOrganization;

        return NextResponse.json({
            user_id: result[0].id,
            email: result[0].email,
            first_name: result[0].first_name,
            last_name: result[0].last_name,
            organization_id: currentOrg?.id || null,
            organization_name: currentOrg?.name || null
        });

    } catch (error: any) {
        console.error('User context error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
