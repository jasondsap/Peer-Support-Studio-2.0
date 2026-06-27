import { NextRequest, NextResponse } from 'next/server';
import { getSession, getInternalUserId, requireOrgAccess } from '@/lib/auth';
import { sql, logAuditEvent } from '@/lib/db';
import { generateUniqueKioskCode } from '@/lib/kiosk';

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

        // Pagination — default 50 per page, capped at 200
        const rawLimit = parseInt(searchParams.get('limit') || '50', 10);
        const rawOffset = parseInt(searchParams.get('offset') || '0', 10);
        const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 200) : 50;
        const offset = Number.isFinite(rawOffset) ? Math.max(rawOffset, 0) : 0;

        let participants;
        let total = 0;

        if (organizationId) {
            // Verify org access before touching PHI
            try {
                await requireOrgAccess(organizationId);
            } catch {
                return NextResponse.json(
                    { error: 'Organization access denied' },
                    { status: 403 }
                );
            }

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

            // Search filter — matches name, email, or phone (digits-only for phone)
            if (search && search.length >= 2) {
                const searchPattern = `%${search.toLowerCase()}%`;
                const digitsOnly = search.replace(/\D/g, '');
                conditions.push(`(
                    LOWER(p.first_name) LIKE $${paramIndex}
                    OR LOWER(p.last_name) LIKE $${paramIndex}
                    OR LOWER(COALESCE(p.preferred_name, '')) LIKE $${paramIndex}
                    OR LOWER(p.first_name || ' ' || p.last_name) LIKE $${paramIndex}
                    OR LOWER(COALESCE(p.email, '')) LIKE $${paramIndex}
                    ${digitsOnly.length >= 3
                        ? `OR regexp_replace(COALESCE(p.phone, ''), '\\D', '', 'g') LIKE $${paramIndex + 1}`
                        : ''}
                )`);
                values.push(searchPattern);
                paramIndex++;
                if (digitsOnly.length >= 3) {
                    values.push(`%${digitsOnly}%`);
                    paramIndex++;
                }
            }

            const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

            // Total count for pagination (uses the same filters/values, no limit)
            try {
                const countRows = await sql(
                    `SELECT COUNT(*)::int AS total FROM participants p ${whereClause}`,
                    values
                );
                total = countRows?.[0]?.total ?? 0;
            } catch (e) {
                console.error('Error counting participants:', e);
            }

            // Append pagination params
            const limitParam = paramIndex;
            values.push(limit);
            paramIndex++;
            const offsetParam = paramIndex;
            values.push(offset);
            paramIndex++;

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
                LIMIT $${limitParam} OFFSET $${offsetParam}
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
            total = Array.isArray(participants) ? participants.length : 0;
        }

        return NextResponse.json({
            success: true,
            participants,
            total,
            limit,
            offset,
        });
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

        // Verify org access before creating PHI
        try {
            await requireOrgAccess(organization_id);
        } catch {
            return NextResponse.json(
                { error: 'Organization access denied' },
                { status: 403 }
            );
        }

        // Duplicate detection — only when DOB is provided and not forced.
        // Match on last_name (case-insensitive) + date_of_birth within the same org.
        const force = body.force === true;
        if (!force && date_of_birth) {
            try {
                const dupes = await sql`
                    SELECT id, first_name, last_name, preferred_name, date_of_birth
                    FROM participants
                    WHERE organization_id = ${organization_id}::uuid
                      AND LOWER(last_name) = LOWER(${last_name})
                      AND date_of_birth = ${date_of_birth}
                    LIMIT 10
                `;
                if (dupes.length > 0) {
                    return NextResponse.json(
                        {
                            error: 'possible_duplicate',
                            matches: dupes.map((d: any) => ({
                                id: d.id,
                                name: `${d.preferred_name || d.first_name} ${d.last_name}`,
                                date_of_birth: d.date_of_birth,
                            })),
                        },
                        { status: 409 }
                    );
                }
            } catch (e) {
                // Never block creation on a failed duplicate check.
                console.error('Duplicate check failed, continuing:', e);
            }
        }

        // Assign a kiosk check-in code unique within the org.
        const kioskCode = await generateUniqueKioskCode(organization_id);

        const result = await sql`
            INSERT INTO participants (
                organization_id, first_name, last_name, preferred_name,
                date_of_birth, gender, email, phone,
                address_line1, address_line2, city, state, zip,
                emergency_contact_name, emergency_contact_phone, emergency_contact_relationship,
                intake_date, referral_source, internal_notes, status,
                primary_pss_id, location_id, kiosk_code
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
                ${location_id || null},
                ${kioskCode}
            )
            RETURNING *
        `;

        await logAuditEvent(
            userId,
            organization_id,
            'create',
            'participant',
            result[0].id,
            { first_name, last_name }
        );

        return NextResponse.json({ success: true, participant: result[0] });
    } catch (error) {
        console.error('Error creating participant:', error);
        return NextResponse.json(
            { error: 'Failed to create participant' },
            { status: 500 }
        );
    }
}

// PATCH - Bulk update participants (reassign PSS / set location / change status)
export async function PATCH(request: NextRequest) {
    try {
        const session = await getSession();

        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const userId = await getInternalUserId(session.user.id, session.user.email);
        if (!userId) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const body = await request.json();
        const { organization_id, ids, updates } = body || {};

        if (!organization_id) {
            return NextResponse.json(
                { error: 'organization_id is required' },
                { status: 400 }
            );
        }

        if (!Array.isArray(ids) || ids.length === 0) {
            return NextResponse.json(
                { error: 'ids must be a non-empty array' },
                { status: 400 }
            );
        }

        if (!updates || typeof updates !== 'object') {
            return NextResponse.json(
                { error: 'updates object is required' },
                { status: 400 }
            );
        }

        // Verify org access before touching PHI
        try {
            await requireOrgAccess(organization_id);
        } catch {
            return NextResponse.json(
                { error: 'Organization access denied' },
                { status: 403 }
            );
        }

        // Only allow a small, safe set of bulk-editable fields
        const allowedFields = ['primary_pss_id', 'location_id', 'status'];
        const setClauses: string[] = [];
        const values: unknown[] = [];
        let paramIndex = 1;

        for (const field of allowedFields) {
            if (field in updates) {
                const raw = updates[field];
                const val = raw === '' ? null : raw;
                if ((field === 'primary_pss_id' || field === 'location_id')) {
                    setClauses.push(`${field} = $${paramIndex}::uuid`);
                } else {
                    setClauses.push(`${field} = $${paramIndex}`);
                }
                values.push(val);
                paramIndex++;
            }
        }

        if (setClauses.length === 0) {
            return NextResponse.json(
                { error: 'No valid fields to update' },
                { status: 400 }
            );
        }

        // ids and org as final params — org scoping enforced in WHERE
        const idsParam = paramIndex;
        values.push(ids);
        paramIndex++;
        const orgParam = paramIndex;
        values.push(organization_id);
        paramIndex++;

        const updateQuery = `
            UPDATE participants
            SET ${setClauses.join(', ')}, updated_at = NOW()
            WHERE id = ANY($${idsParam}::uuid[])
              AND organization_id = $${orgParam}::uuid
            RETURNING id
        `;

        const result = await sql(updateQuery, values);
        const updatedIds = (result || []).map((r: any) => r.id);

        await logAuditEvent(
            userId,
            organization_id,
            'update',
            'participant',
            updatedIds.join(','),
            { action: 'bulk_update', count: updatedIds.length, updated_fields: Object.keys(updates) }
        );

        return NextResponse.json({ success: true, updated: updatedIds.length, ids: updatedIds });
    } catch (error) {
        console.error('Error bulk-updating participants:', error);
        return NextResponse.json(
            { error: 'Failed to update participants' },
            { status: 500 }
        );
    }
}
