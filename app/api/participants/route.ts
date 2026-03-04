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

        // Get query parameters
        const searchParams = request.nextUrl.searchParams;
        const organizationId = searchParams.get('organization_id') || searchParams.get('organizationId');
        const search = searchParams.get('search');
        const status = searchParams.get('status') || 'active';
        const pssFilter = searchParams.get('pss_filter') || 'all';
        const locationFilter = searchParams.get('location_filter') || 'all';

        let participants;

        if (organizationId) {
            // Build dynamic query with parameterized values
            const conditions: string[] = [];
            const values: unknown[] = [];
            let paramIndex = 1;

            // Always filter by org
            conditions.push(`p.organization_id = $${paramIndex}::uuid`);
            values.push(organizationId);
            paramIndex++;

            // Status filter
            if (status !== 'all') {
                conditions.push(`p.status = $${paramIndex}`);
                values.push(status);
                paramIndex++;
            }

            // PSS filter
            if (pssFilter === 'mine') {
                conditions.push(`p.primary_pss_id = $${paramIndex}::uuid`);
                values.push(userId);
                paramIndex++;
            } else if (pssFilter === 'unassigned') {
                conditions.push(`p.primary_pss_id IS NULL`);
            } else if (pssFilter !== 'all') {
                conditions.push(`p.primary_pss_id = $${paramIndex}::uuid`);
                values.push(pssFilter);
                paramIndex++;
            }

            // Location filter
            if (locationFilter === 'unassigned') {
                conditions.push(`p.location_id IS NULL`);
            } else if (locationFilter !== 'all') {
                conditions.push(`p.location_id = $${paramIndex}::uuid`);
                values.push(locationFilter);
                paramIndex++;
            }

            // Search filter
            if (search && search.length >= 2) {
                const searchPattern = `%${search.toLowerCase()}%`;
                conditions.push(`(
                    LOWER(p.first_name) LIKE $${paramIndex}
                    OR LOWER(p.last_name) LIKE $${paramIndex}
                    OR LOWER(COALESCE(p.preferred_name, '')) LIKE $${paramIndex}
                    OR LOWER(p.first_name || ' ' || p.last_name) LIKE $${paramIndex}
                )`);
                values.push(searchPattern);
                paramIndex++;
            }

            const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

            const queryText = `
                SELECT 
                    p.id, p.first_name, p.last_name, p.preferred_name,
                    p.email, p.phone, p.status, p.date_of_birth, p.gender,
                    p.intake_date, p.referral_source, p.primary_pss_id, p.location_id,
                    CASE 
                        WHEN u.display_name IS NOT NULL AND u.display_name != '' THEN u.display_name
                        ELSE TRIM(COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, ''))
                    END as primary_pss_name,
                    l.name as location_name,
                    l.short_name as location_short_name,
                    (SELECT COUNT(*) FROM saved_goals g WHERE g.participant_id = p.id AND g.status != 'abandoned') as goals_count,
                    (SELECT COUNT(*) FROM session_notes sn WHERE sn.participant_id = p.id AND NOT sn.is_archived) as notes_count
                FROM participants p
                LEFT JOIN users u ON u.id = p.primary_pss_id
                LEFT JOIN locations l ON l.id = p.location_id
                ${whereClause}
                ORDER BY p.last_name, p.first_name
                LIMIT 100
            `;

            participants = await sql(queryText, values);
        } else {
            // No organization specified - fetch participants user has access to
            if (search && search.length >= 2) {
                const searchPattern = `%${search.toLowerCase()}%`;
                
                participants = await sql`
                    SELECT DISTINCT 
                        p.id, p.first_name, p.last_name, p.preferred_name,
                        p.email, p.phone, p.status, p.primary_pss_id, p.location_id,
                        CASE 
                            WHEN pu.display_name IS NOT NULL AND pu.display_name != '' THEN pu.display_name
                            ELSE TRIM(COALESCE(pu.first_name, '') || ' ' || COALESCE(pu.last_name, ''))
                        END as primary_pss_name,
                        l.name as location_name,
                        l.short_name as location_short_name
                    FROM participants p
                    LEFT JOIN organization_members om ON p.organization_id = om.organization_id
                    LEFT JOIN users pu ON pu.id = p.primary_pss_id
                    LEFT JOIN locations l ON l.id = p.location_id
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
                        p.email, p.phone, p.status, p.primary_pss_id, p.location_id,
                        CASE 
                            WHEN pu.display_name IS NOT NULL AND pu.display_name != '' THEN pu.display_name
                            ELSE TRIM(COALESCE(pu.first_name, '') || ' ' || COALESCE(pu.last_name, ''))
                        END as primary_pss_name,
                        l.name as location_name,
                        l.short_name as location_short_name
                    FROM participants p
                    LEFT JOIN organization_members om ON p.organization_id = om.organization_id
                    LEFT JOIN users pu ON pu.id = p.primary_pss_id
                    LEFT JOIN locations l ON l.id = p.location_id
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

// POST - Create a new participant
export async function POST(request: NextRequest) {
    try {
        const session = await getSession();

        if (!session?.user?.id) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const userId = await getInternalUserId(session.user.id, session.user.email);

        if (!userId) {
            return NextResponse.json(
                { error: 'User not found' },
                { status: 404 }
            );
        }

        const body = await request.json();
        const {
            organization_id, first_name, last_name, preferred_name,
            date_of_birth, gender, email, phone,
            address_line1, address_line2, city, state, zip,
            emergency_contact_name, emergency_contact_phone, emergency_contact_relationship,
            referral_source, internal_notes, is_reentry_participant, primary_pss_id,
            location_id
        } = body;

        if (!organization_id || !first_name || !last_name) {
            return NextResponse.json(
                { error: 'organization_id, first_name, and last_name are required' },
                { status: 400 }
            );
        }

        const result = await sql`
            INSERT INTO participants (
                organization_id, first_name, last_name, preferred_name,
                date_of_birth, gender, email, phone,
                address_line1, address_line2, city, state, zip,
                emergency_contact_name, emergency_contact_phone, emergency_contact_relationship,
                intake_date, referral_source, internal_notes, status,
                primary_pss_id, location_id
            ) VALUES (
                ${organization_id}::uuid,
                ${first_name},
                ${last_name},
                ${preferred_name || null},
                ${date_of_birth || null},
                ${gender || null},
                ${email || null},
                ${phone || null},
                ${address_line1 || null},
                ${address_line2 || null},
                ${city || null},
                ${state || null},
                ${zip || null},
                ${emergency_contact_name || null},
                ${emergency_contact_phone || null},
                ${emergency_contact_relationship || null},
                NOW(),
                ${referral_source || null},
                ${internal_notes || null},
                'active',
                ${primary_pss_id || userId}::uuid,
                ${location_id || null}
            )
            RETURNING *
        `;

        return NextResponse.json({ success: true, participant: result[0] });
    } catch (error) {
        console.error('Error creating participant:', error);
        return NextResponse.json(
            { error: 'Failed to create participant' },
            { status: 500 }
        );
    }
}
