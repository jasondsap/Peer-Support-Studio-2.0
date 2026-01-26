// app/api/organizations/[id]/route.ts
// Get or update a specific organization

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

// GET - Get organization details
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

        // Verify user is a member
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

        const result = await sql`
            SELECT id, name, slug, type, invite_code, created_at
            FROM organizations
            WHERE id = ${orgId}
        `;

        if (result.length === 0) {
            return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
        }

        return NextResponse.json({ organization: result[0] });

    } catch (error) {
        console.error('Error fetching organization:', error);
        return NextResponse.json(
            { error: 'Failed to fetch organization' },
            { status: 500 }
        );
    }
}

// PATCH - Update organization
export async function PATCH(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getServerSession(authOptions);
        
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const orgId = params.id;
        const body = await request.json();

        // Verify user is an admin of this organization
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

        const userRole = memberCheck[0].role;
        if (!['owner', 'admin'].includes(userRole)) {
            return NextResponse.json({ error: 'Only admins can update organization settings' }, { status: 403 });
        }

        // Update allowed fields
        const { name, type } = body;
        const updates: string[] = [];
        const values: any[] = [];

        if (name && name.trim()) {
            await sql`
                UPDATE organizations 
                SET name = ${name.trim()}, updated_at = NOW()
                WHERE id = ${orgId}
            `;
        }

        if (type) {
            await sql`
                UPDATE organizations 
                SET type = ${type}, updated_at = NOW()
                WHERE id = ${orgId}
            `;
        }

        // Fetch updated org
        const result = await sql`
            SELECT id, name, slug, type, invite_code
            FROM organizations
            WHERE id = ${orgId}
        `;

        return NextResponse.json({
            success: true,
            organization: result[0],
        });

    } catch (error) {
        console.error('Error updating organization:', error);
        return NextResponse.json(
            { error: 'Failed to update organization' },
            { status: 500 }
        );
    }
}
