// app/api/user/organizations/route.ts
// Returns organizations the current user belongs to

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql } from '@/lib/db';

export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const userEmail = session.user.email;

        if (!userEmail) {
            return NextResponse.json({ error: 'No email in session' }, { status: 400 });
        }

        const organizations = await sql`
            SELECT 
                o.id,
                o.name,
                o.slug,
                o.type,
                o.invite_code,
                om.role
            FROM organizations o
            JOIN organization_members om ON o.id = om.organization_id
            JOIN users u ON om.user_id = u.id
            WHERE u.email = ${userEmail}
              AND om.status = 'active'
            ORDER BY o.name
        `;

        // If user has no organizations, return empty array
        if (organizations.length === 0) {
            return NextResponse.json({
                organizations: [],
                message: 'User is not a member of any organization',
            });
        }

        return NextResponse.json({
            organizations,
            defaultOrganization: organizations[0],
        });

    } catch (error) {
        console.error('Error fetching user organizations:', error);
        return NextResponse.json(
            { error: 'Failed to fetch organizations' },
            { status: 500 }
        );
    }
}
