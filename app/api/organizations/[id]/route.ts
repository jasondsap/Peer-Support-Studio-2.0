// app/api/organizations/[id]/members/route.ts
// Get members of an organization

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getServerSession(authOptions);
        
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const orgId = params.id;

        // Verify user is a member of this organization
        const userEmail = session.user.email;
        const memberCheck = await sql`
            SELECT om.role FROM organization_members om
            JOIN users u ON om.user_id = u.id
            WHERE om.organization_id = ${orgId}
              AND u.email = ${userEmail}
              AND om.status = 'active'
        `;

        if (memberCheck.length === 0) {
            return NextResponse.json({ error: 'Not a member of this organization' }, { status: 403 });
        }

        // Get all members
        const members = await sql`
            SELECT 
                om.id,
                om.user_id,
                om.role,
                om.status,
                om.joined_at,
                json_build_object(
                    'id', u.id,
                    'email', u.email,
                    'first_name', u.first_name,
                    'last_name', u.last_name
                ) as user
            FROM organization_members om
            JOIN users u ON om.user_id = u.id
            WHERE om.organization_id = ${orgId}
              AND om.status = 'active'
            ORDER BY 
                CASE om.role 
                    WHEN 'owner' THEN 1 
                    WHEN 'admin' THEN 2 
                    WHEN 'supervisor' THEN 3 
                    ELSE 4 
                END,
                om.joined_at ASC
        `;

        return NextResponse.json({ members });

    } catch (error) {
        console.error('Error fetching organization members:', error);
        return NextResponse.json(
            { error: 'Failed to fetch members' },
            { status: 500 }
        );
    }
}
