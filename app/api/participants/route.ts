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

        // Get query parameters - support both snake_case and camelCase
        const searchParams = request.nextUrl.searchParams;
        const organizationId = searchParams.get('organization_id') || searchParams.get('organizationId');
        const search = searchParams.get('search');
        const status = searchParams.get('status') || 'active';

        let participants;

        if (organizationId) {
            if (search && search.length >= 2) {
                // Search with filter - case insensitive search on names
                const searchPattern = `%${search.toLowerCase()}%`;
                
                participants = await sql`
                    SELECT 
                        id, first_name, last_name, preferred_name,
                        email, phone, status, date_of_birth, gender,
                        intake_date, referral_source
                    FROM participants
                    WHERE organization_id = ${organizationId}::uuid
                    AND status = ${status}
                    AND (
                        LOWER(first_name) LIKE ${searchPattern}
                        OR LOWER(last_name) LIKE ${searchPattern}
                        OR LOWER(COALESCE(preferred_name, '')) LIKE ${searchPattern}
                        OR LOWER(first_name || ' ' || last_name) LIKE ${searchPattern}
                    )
                    ORDER BY last_name, first_name
                    LIMIT 50
                `;
            } else {
                // No search - return all for organization with status filter
                participants = await sql`
                    SELECT 
                        id, first_name, last_name, preferred_name,
                        email, phone, status, date_of_birth, gender,
                        intake_date, referral_source
                    FROM participants
                    WHERE organization_id = ${organizationId}::uuid
                    AND status = ${status}
                    ORDER BY last_name, first_name
                    LIMIT 100
                `;
            }
        } else {
            // No organization specified - fetch participants user has access to
            if (search && search.length >= 2) {
                const searchPattern = `%${search.toLowerCase()}%`;
                
                participants = await sql`
                    SELECT DISTINCT 
                        p.id, p.first_name, p.last_name, p.preferred_name,
                        p.email, p.phone, p.status
                    FROM participants p
                    LEFT JOIN organization_members om ON p.organization_id = om.organization_id
                    WHERE (om.user_id = ${userId}::uuid OR p.primary_pss_id = ${userId}::uuid)
                    AND p.status = ${status}
                    AND (
                        LOWER(p.first_name) LIKE ${searchPattern}
                        OR LOWER(p.last_name) LIKE ${searchPattern}
                        OR LOWER(COALESCE(p.preferred_name, '')) LIKE ${searchPattern}
                        OR LOWER(p.first_name || ' ' || p.last_name) LIKE ${searchPattern}
                    )
                    ORDER BY p.last_name, p.first_name
                    LIMIT 50
                `;
            } else {
                participants = await sql`
                    SELECT DISTINCT 
                        p.id, p.first_name, p.last_name, p.preferred_name,
                        p.email, p.phone, p.status
                    FROM participants p
                    LEFT JOIN organization_members om ON p.organization_id = om.organization_id
                    WHERE (om.user_id = ${userId}::uuid OR p.primary_pss_id = ${userId}::uuid)
                    AND p.status = ${status}
                    ORDER BY p.last_name, p.first_name
                    LIMIT 100
                `;
            }
        }

        return NextResponse.json({ success: true, participants });
    } catch (error) {
        console.error('Error fetching participants:', error);
        return NextResponse.json(
            { error: 'Failed to fetch participants' },
            { status: 500 }
        );
    }
}
