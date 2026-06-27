import { NextRequest, NextResponse } from 'next/server';
import { getSession, getInternalUserId, requireOrgAccess } from '@/lib/auth';
import { sql, logAuditEvent } from '@/lib/db';

// GET - Fetch journey entries
export async function GET(request: NextRequest) {
    try {
        const session = await getSession();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const userId = await getInternalUserId(session.user.id, session.user.email);
        if (!userId) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const { searchParams } = new URL(request.url);
        const organizationId = searchParams.get('organization_id');
        const participantId = searchParams.get('participant_id');
        const domainId = searchParams.get('domain_id');
        const startDate = searchParams.get('start_date');
        const endDate = searchParams.get('end_date');
        const limit = parseInt(searchParams.get('limit') || '100');

        if (!organizationId) {
            return NextResponse.json({ error: 'organization_id required' }, { status: 400 });
        }

        try {
            await requireOrgAccess(organizationId);
        } catch {
            return NextResponse.json({ error: 'Organization access denied' }, { status: 403 });
        }

        // Build query based on filters
        let entries;
        
        if (participantId && domainId) {
            entries = await sql`
                SELECT 
                    je.id,
                    je.participant_id,
                    je.domain_id,
                    jd.domain_key,
                    jd.domain_label,
                    jd.color as domain_color,
                    je.status_key,
                    je.status_label,
                    je.entry_date,
                    je.notes,
                    je.contributing_factors,
                    je.is_milestone,
                    je.milestone_type,
                    je.linked_note_id,
                    je.linked_goal_id,
                    je.created_at,
                    u.display_name as created_by_name
                FROM journey_entries je
                JOIN journey_domains jd ON jd.id = je.domain_id
                LEFT JOIN users u ON u.id = je.created_by
                WHERE je.organization_id = ${organizationId}
                AND je.participant_id = ${participantId}
                AND je.domain_id = ${domainId}
                ORDER BY je.entry_date DESC, je.created_at DESC
                LIMIT ${limit}
            `;
        } else if (participantId) {
            entries = await sql`
                SELECT 
                    je.id,
                    je.participant_id,
                    je.domain_id,
                    jd.domain_key,
                    jd.domain_label,
                    jd.color as domain_color,
                    je.status_key,
                    je.status_label,
                    je.entry_date,
                    je.notes,
                    je.contributing_factors,
                    je.is_milestone,
                    je.milestone_type,
                    je.linked_note_id,
                    je.linked_goal_id,
                    je.created_at,
                    u.display_name as created_by_name
                FROM journey_entries je
                JOIN journey_domains jd ON jd.id = je.domain_id
                LEFT JOIN users u ON u.id = je.created_by
                WHERE je.organization_id = ${organizationId}
                AND je.participant_id = ${participantId}
                ORDER BY je.entry_date DESC, je.created_at DESC
                LIMIT ${limit}
            `;
        } else {
            // All entries for org (for reports)
            entries = await sql`
                SELECT 
                    je.id,
                    je.participant_id,
                    p.first_name as participant_first_name,
                    p.last_name as participant_last_name,
                    p.preferred_name as participant_preferred_name,
                    je.domain_id,
                    jd.domain_key,
                    jd.domain_label,
                    jd.color as domain_color,
                    je.status_key,
                    je.status_label,
                    je.entry_date,
                    je.notes,
                    je.is_milestone,
                    je.milestone_type,
                    je.created_at
                FROM journey_entries je
                JOIN journey_domains jd ON jd.id = je.domain_id
                JOIN participants p ON p.id = je.participant_id
                WHERE je.organization_id = ${organizationId}
                ORDER BY je.entry_date DESC, je.created_at DESC
                LIMIT ${limit}
            `;
        }

        return NextResponse.json({ success: true, entries });
    } catch (error) {
        console.error('Error fetching journey entries:', error);
        return NextResponse.json({ error: 'Failed to fetch entries' }, { status: 500 });
    }
}

// POST - Create a new entry
export async function POST(request: NextRequest) {
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
        const {
            organization_id,
            participant_id,
            domain_id,
            status_key,
            status_label,
            entry_date,
            notes,
            contributing_factors,
            is_milestone,
            milestone_type,
            linked_note_id,
            linked_goal_id
        } = body;

        if (!organization_id || !participant_id || !domain_id || !status_key || !entry_date) {
            return NextResponse.json({
                error: 'organization_id, participant_id, domain_id, status_key, and entry_date required'
            }, { status: 400 });
        }

        try {
            await requireOrgAccess(organization_id);
        } catch {
            return NextResponse.json({ error: 'Organization access denied' }, { status: 403 });
        }

        const result = await sql`
            INSERT INTO journey_entries (
                organization_id,
                participant_id,
                domain_id,
                status_key,
                status_label,
                entry_date,
                notes,
                contributing_factors,
                is_milestone,
                milestone_type,
                linked_note_id,
                linked_goal_id,
                created_by
            ) VALUES (
                ${organization_id},
                ${participant_id},
                ${domain_id},
                ${status_key},
                ${status_label || status_key},
                ${entry_date},
                ${notes || null},
                ${contributing_factors || []},
                ${is_milestone || false},
                ${milestone_type || null},
                ${linked_note_id || null},
                ${linked_goal_id || null},
                ${userId || null}
            )
            RETURNING *
        `;

        // Fetch full entry with domain info
        const fullEntry = await sql`
            SELECT 
                je.*,
                jd.domain_key,
                jd.domain_label,
                jd.color as domain_color
            FROM journey_entries je
            JOIN journey_domains jd ON jd.id = je.domain_id
            WHERE je.id = ${result[0].id}
        `;

        await logAuditEvent(userId, organization_id, 'create', 'journey_entry', result[0].id, {
            participant_id,
            domain_id,
            status_key
        });

        return NextResponse.json({ success: true, entry: fullEntry[0] });
    } catch (error) {
        console.error('Error creating journey entry:', error);
        return NextResponse.json({ error: 'Failed to create entry' }, { status: 500 });
    }
}

// PATCH - Update an entry
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
        const {
            id,
            organization_id,
            status_key,
            status_label,
            entry_date,
            notes,
            contributing_factors,
            is_milestone,
            milestone_type
        } = body;

        if (!id) {
            return NextResponse.json({ error: 'Entry id required' }, { status: 400 });
        }

        if (!organization_id) {
            return NextResponse.json({ error: 'organization_id required' }, { status: 400 });
        }

        try {
            await requireOrgAccess(organization_id);
        } catch {
            return NextResponse.json({ error: 'Organization access denied' }, { status: 403 });
        }

        const result = await sql`
            UPDATE journey_entries
            SET
                status_key = COALESCE(${status_key}, status_key),
                status_label = COALESCE(${status_label}, status_label),
                entry_date = COALESCE(${entry_date}, entry_date),
                notes = COALESCE(${notes}, notes),
                contributing_factors = COALESCE(${contributing_factors}, contributing_factors),
                is_milestone = COALESCE(${is_milestone}, is_milestone),
                milestone_type = COALESCE(${milestone_type}, milestone_type),
                updated_at = NOW()
            WHERE id = ${id}
            AND organization_id = ${organization_id}
            RETURNING *
        `;

        if (result.length === 0) {
            return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
        }

        await logAuditEvent(userId, organization_id, 'update', 'journey_entry', id, {
            status_key
        });

        return NextResponse.json({ success: true, entry: result[0] });
    } catch (error) {
        console.error('Error updating journey entry:', error);
        return NextResponse.json({ error: 'Failed to update entry' }, { status: 500 });
    }
}

// DELETE - Remove an entry
export async function DELETE(request: NextRequest) {
    try {
        const session = await getSession();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const userId = await getInternalUserId(session.user.id, session.user.email);
        if (!userId) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        const organizationId = searchParams.get('organization_id');

        if (!id) {
            return NextResponse.json({ error: 'Entry id required' }, { status: 400 });
        }

        if (!organizationId) {
            return NextResponse.json({ error: 'organization_id required' }, { status: 400 });
        }

        try {
            await requireOrgAccess(organizationId);
        } catch {
            return NextResponse.json({ error: 'Organization access denied' }, { status: 403 });
        }

        const deleted = await sql`
            DELETE FROM journey_entries
            WHERE id = ${id}
            AND organization_id = ${organizationId}
            RETURNING id
        `;

        if (deleted.length === 0) {
            return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
        }

        await logAuditEvent(userId, organizationId, 'delete', 'journey_entry', id);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting journey entry:', error);
        return NextResponse.json({ error: 'Failed to delete entry' }, { status: 500 });
    }
}
