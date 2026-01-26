import { NextRequest, NextResponse } from 'next/server';
import { getSession, getInternalUserId } from '@/lib/auth';
import { sql } from '@/lib/db';

// GET - Fetch participants for the current user's organization
export async function GET(request: NextRequest) {
    try {
        const session = await getSession();
        
        if (!session?.user?.id) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        // Get internal user ID
        const userId = await getInternalUserId(session.user.id, session.user.email);
        
        if (!userId) {
            return NextResponse.json(
                { error: 'User not found' },
                { status: 404 }
            );
        }

        // Get organization ID from query or user's default
        const searchParams = request.nextUrl.searchParams;
        const organizationId = searchParams.get('organizationId');

        let participants;

        if (organizationId) {
            // Fetch participants for specific organization
            participants = await sql`
                SELECT id, first_name, last_name, status
                FROM participants
                WHERE organization_id = ${organizationId}::uuid
                AND status = 'active'
                ORDER BY last_name, first_name
            `;
        } else {
            // Fetch participants the user has access to (their orgs or assigned to them)
            participants = await sql`
                SELECT DISTINCT p.id, p.first_name, p.last_name, p.status
                FROM participants p
                LEFT JOIN organization_members om ON p.organization_id = om.organization_id
                WHERE (om.user_id = ${userId}::uuid OR p.primary_pss_id = ${userId}::uuid)
                AND p.status = 'active'
                ORDER BY p.last_name, p.first_name
                LIMIT 100
            `;
        }

        return NextResponse.json({ participants });
    } catch (error) {
        console.error('Error fetching participants:', error);
        return NextResponse.json(
            { error: 'Failed to fetch participants' },
            { status: 500 }
        );
    }
}
