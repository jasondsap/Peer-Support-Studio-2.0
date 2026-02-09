// ============================================================================
// Peer Support Studio - Organization Members API
// File: /app/api/organizations/members/route.ts
// Returns list of members (with user details) for an organization
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getSessionWithUserId, requireOrgAccess } from '@/lib/auth';
import { sql } from '@/lib/db';

export async function GET(request: NextRequest) {
    try {
        const session = await getSessionWithUserId();

        const { searchParams } = new URL(request.url);
        const organizationId = searchParams.get('organization_id');

        if (!organizationId) {
            return NextResponse.json({ error: 'organization_id is required' }, { status: 400 });
        }

        // Verify org access
        await requireOrgAccess(organizationId);

        // Fetch org members with user details
        const members = await sql`
            SELECT 
                u.id,
                u.first_name,
                u.last_name,
                u.display_name,
                u.email,
                om.role,
                om.status,
                om.joined_at
            FROM organization_members om
            JOIN users u ON u.id = om.user_id
            WHERE om.organization_id = ${organizationId}
              AND om.status = 'active'
            ORDER BY u.first_name, u.last_name
        `;

        // Format response with computed display name
        const formatted = members.map((m: any) => ({
            id: m.id,
            name: m.display_name || [m.first_name, m.last_name].filter(Boolean).join(' ').trim() || m.email,
            first_name: m.first_name,
            last_name: m.last_name,
            email: m.email,
            role: m.role,
            joined_at: m.joined_at,
        }));

        return NextResponse.json({ members: formatted });
    } catch (error) {
        console.error('Error fetching org members:', error);
        return NextResponse.json({ error: 'Failed to fetch members' }, { status: 500 });
    }
}
