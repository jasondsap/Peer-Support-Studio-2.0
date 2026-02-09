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
        const pssFilter = searchParams.get('pss_filter') || 'all'; // 'all', 'mine', or a specific user ID

        let participants;

        if (organizationId) {
            if (search && search.length >= 2) {
                const searchPattern = `%${search.toLowerCase()}%`;

                if (pssFilter === 'mine') {
                    participants = await sql`
                        SELECT 
                            p.id, p.first_name, p.last_name, p.preferred_name,
                            p.email, p.phone, p.status, p.date_of_birth, p.gender,
                            p.intake_date, p.referral_source, p.primary_pss_id,
                            CASE 
                                WHEN u.display_name IS NOT NULL AND u.display_name != '' THEN u.display_name
                                ELSE TRIM(COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, ''))
                            END as primary_pss_name,
                            (SELECT COUNT(*) FROM saved_goals g WHERE g.participant_id = p.id AND g.status != 'abandoned') as goals_count,
                            (SELECT COUNT(*) FROM session_notes sn WHERE sn.participant_id = p.id AND NOT sn.is_archived) as notes_count
                        FROM participants p
                        LEFT JOIN users u ON u.id = p.primary_pss_id
                        WHERE p.organization_id = ${organizationId}::uuid
                        AND p.status = ${status}
                        AND p.primary_pss_id = ${userId}::uuid
                        AND (
                            LOWER(p.first_name) LIKE ${searchPattern}
                            OR LOWER(p.last_name) LIKE ${searchPattern}
                            OR LOWER(COALESCE(p.preferred_name, '')) LIKE ${searchPattern}
                            OR LOWER(p.first_name || ' ' || p.last_name) LIKE ${searchPattern}
                        )
                        ORDER BY p.last_name, p.first_name
                        LIMIT 50
                    `;
                } else if (pssFilter !== 'all' && pssFilter !== 'unassigned') {
                    // Filter by specific PSS user ID
                    participants = await sql`
                        SELECT 
                            p.id, p.first_name, p.last_name, p.preferred_name,
                            p.email, p.phone, p.status, p.date_of_birth, p.gender,
                            p.intake_date, p.referral_source, p.primary_pss_id,
                            CASE 
                                WHEN u.display_name IS NOT NULL AND u.display_name != '' THEN u.display_name
                                ELSE TRIM(COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, ''))
                            END as primary_pss_name,
                            (SELECT COUNT(*) FROM saved_goals g WHERE g.participant_id = p.id AND g.status != 'abandoned') as goals_count,
                            (SELECT COUNT(*) FROM session_notes sn WHERE sn.participant_id = p.id AND NOT sn.is_archived) as notes_count
                        FROM participants p
                        LEFT JOIN users u ON u.id = p.primary_pss_id
                        WHERE p.organization_id = ${organizationId}::uuid
                        AND p.status = ${status}
                        AND p.primary_pss_id = ${pssFilter}::uuid
                        AND (
                            LOWER(p.first_name) LIKE ${searchPattern}
                            OR LOWER(p.last_name) LIKE ${searchPattern}
                            OR LOWER(COALESCE(p.preferred_name, '')) LIKE ${searchPattern}
                            OR LOWER(p.first_name || ' ' || p.last_name) LIKE ${searchPattern}
                        )
                        ORDER BY p.last_name, p.first_name
                        LIMIT 50
                    `;
                } else if (pssFilter === 'unassigned') {
                    participants = await sql`
                        SELECT 
                            p.id, p.first_name, p.last_name, p.preferred_name,
                            p.email, p.phone, p.status, p.date_of_birth, p.gender,
                            p.intake_date, p.referral_source, p.primary_pss_id,
                            NULL as primary_pss_name,
                            (SELECT COUNT(*) FROM saved_goals g WHERE g.participant_id = p.id AND g.status != 'abandoned') as goals_count,
                            (SELECT COUNT(*) FROM session_notes sn WHERE sn.participant_id = p.id AND NOT sn.is_archived) as notes_count
                        FROM participants p
                        WHERE p.organization_id = ${organizationId}::uuid
                        AND p.status = ${status}
                        AND p.primary_pss_id IS NULL
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
                    // All PSS
                    participants = await sql`
                        SELECT 
                            p.id, p.first_name, p.last_name, p.preferred_name,
                            p.email, p.phone, p.status, p.date_of_birth, p.gender,
                            p.intake_date, p.referral_source, p.primary_pss_id,
                            CASE 
                                WHEN u.display_name IS NOT NULL AND u.display_name != '' THEN u.display_name
                                ELSE TRIM(COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, ''))
                            END as primary_pss_name,
                            (SELECT COUNT(*) FROM saved_goals g WHERE g.participant_id = p.id AND g.status != 'abandoned') as goals_count,
                            (SELECT COUNT(*) FROM session_notes sn WHERE sn.participant_id = p.id AND NOT sn.is_archived) as notes_count
                        FROM participants p
                        LEFT JOIN users u ON u.id = p.primary_pss_id
                        WHERE p.organization_id = ${organizationId}::uuid
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
                }
            } else {
                // No search term
                if (pssFilter === 'mine') {
                    participants = await sql`
                        SELECT 
                            p.id, p.first_name, p.last_name, p.preferred_name,
                            p.email, p.phone, p.status, p.date_of_birth, p.gender,
                            p.intake_date, p.referral_source, p.primary_pss_id,
                            CASE 
                                WHEN u.display_name IS NOT NULL AND u.display_name != '' THEN u.display_name
                                ELSE TRIM(COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, ''))
                            END as primary_pss_name,
                            (SELECT COUNT(*) FROM saved_goals g WHERE g.participant_id = p.id AND g.status != 'abandoned') as goals_count,
                            (SELECT COUNT(*) FROM session_notes sn WHERE sn.participant_id = p.id AND NOT sn.is_archived) as notes_count
                        FROM participants p
                        LEFT JOIN users u ON u.id = p.primary_pss_id
                        WHERE p.organization_id = ${organizationId}::uuid
                        AND p.status = ${status}
                        AND p.primary_pss_id = ${userId}::uuid
                        ORDER BY p.last_name, p.first_name
                        LIMIT 100
                    `;
                } else if (pssFilter !== 'all' && pssFilter !== 'unassigned') {
                    participants = await sql`
                        SELECT 
                            p.id, p.first_name, p.last_name, p.preferred_name,
                            p.email, p.phone, p.status, p.date_of_birth, p.gender,
                            p.intake_date, p.referral_source, p.primary_pss_id,
                            CASE 
                                WHEN u.display_name IS NOT NULL AND u.display_name != '' THEN u.display_name
                                ELSE TRIM(COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, ''))
                            END as primary_pss_name,
                            (SELECT COUNT(*) FROM saved_goals g WHERE g.participant_id = p.id AND g.status != 'abandoned') as goals_count,
                            (SELECT COUNT(*) FROM session_notes sn WHERE sn.participant_id = p.id AND NOT sn.is_archived) as notes_count
                        FROM participants p
                        LEFT JOIN users u ON u.id = p.primary_pss_id
                        WHERE p.organization_id = ${organizationId}::uuid
                        AND p.status = ${status}
                        AND p.primary_pss_id = ${pssFilter}::uuid
                        ORDER BY p.last_name, p.first_name
                        LIMIT 100
                    `;
                } else if (pssFilter === 'unassigned') {
                    participants = await sql`
                        SELECT 
                            p.id, p.first_name, p.last_name, p.preferred_name,
                            p.email, p.phone, p.status, p.date_of_birth, p.gender,
                            p.intake_date, p.referral_source, p.primary_pss_id,
                            NULL as primary_pss_name,
                            (SELECT COUNT(*) FROM saved_goals g WHERE g.participant_id = p.id AND g.status != 'abandoned') as goals_count,
                            (SELECT COUNT(*) FROM session_notes sn WHERE sn.participant_id = p.id AND NOT sn.is_archived) as notes_count
                        FROM participants p
                        WHERE p.organization_id = ${organizationId}::uuid
                        AND p.status = ${status}
                        AND p.primary_pss_id IS NULL
                        ORDER BY p.last_name, p.first_name
                        LIMIT 100
                    `;
                } else {
                    // All PSS (default)
                    participants = await sql`
                        SELECT 
                            p.id, p.first_name, p.last_name, p.preferred_name,
                            p.email, p.phone, p.status, p.date_of_birth, p.gender,
                            p.intake_date, p.referral_source, p.primary_pss_id,
                            CASE 
                                WHEN u.display_name IS NOT NULL AND u.display_name != '' THEN u.display_name
                                ELSE TRIM(COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, ''))
                            END as primary_pss_name,
                            (SELECT COUNT(*) FROM saved_goals g WHERE g.participant_id = p.id AND g.status != 'abandoned') as goals_count,
                            (SELECT COUNT(*) FROM session_notes sn WHERE sn.participant_id = p.id AND NOT sn.is_archived) as notes_count
                        FROM participants p
                        LEFT JOIN users u ON u.id = p.primary_pss_id
                        WHERE p.organization_id = ${organizationId}::uuid
                        AND p.status = ${status}
                        ORDER BY p.last_name, p.first_name
                        LIMIT 100
                    `;
                }
            }
        } else {
            // No organization specified - fetch participants user has access to
            if (search && search.length >= 2) {
                const searchPattern = `%${search.toLowerCase()}%`;
                
                participants = await sql`
                    SELECT DISTINCT 
                        p.id, p.first_name, p.last_name, p.preferred_name,
                        p.email, p.phone, p.status, p.primary_pss_id,
                        CASE 
                            WHEN pu.display_name IS NOT NULL AND pu.display_name != '' THEN pu.display_name
                            ELSE TRIM(COALESCE(pu.first_name, '') || ' ' || COALESCE(pu.last_name, ''))
                        END as primary_pss_name
                    FROM participants p
                    LEFT JOIN organization_members om ON p.organization_id = om.organization_id
                    LEFT JOIN users pu ON pu.id = p.primary_pss_id
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
                        p.email, p.phone, p.status, p.primary_pss_id,
                        CASE 
                            WHEN pu.display_name IS NOT NULL AND pu.display_name != '' THEN pu.display_name
                            ELSE TRIM(COALESCE(pu.first_name, '') || ' ' || COALESCE(pu.last_name, ''))
                        END as primary_pss_name
                    FROM participants p
                    LEFT JOIN organization_members om ON p.organization_id = om.organization_id
                    LEFT JOIN users pu ON pu.id = p.primary_pss_id
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
