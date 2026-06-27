import { NextRequest, NextResponse } from 'next/server';
import { getSession, getInternalUserId, requireOrgAccess } from '@/lib/auth';
import { sql, logAuditEvent } from '@/lib/db';

// GET /api/saved-goals - List saved goals
export async function GET(req: NextRequest) {
    try {
        const session = await getSession();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const userId = await getInternalUserId(session.user.id, session.user.email);
        if (!userId) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const { searchParams } = new URL(req.url);
        const organizationId = searchParams.get('organization_id');
        const participantId = searchParams.get('participant_id');
        const status = searchParams.get('status') || 'active';
        const search = searchParams.get('search');

        if (!organizationId) {
            return NextResponse.json({ error: 'organization_id required' }, { status: 400 });
        }

        // Verify org access before touching PHI
        try {
            await requireOrgAccess(organizationId);
        } catch {
            return NextResponse.json({ error: 'Organization access denied' }, { status: 403 });
        }

        // Single goal fetch by ID
        const id = searchParams.get('id');
        if (id) {
            const result = await sql`
                SELECT 
                    sg.*,
                    p.first_name as participant_first_name,
                    p.last_name as participant_last_name,
                    p.preferred_name as participant_preferred_name
                FROM saved_goals sg
                LEFT JOIN participants p ON sg.participant_id = p.id
                WHERE sg.id = ${id} AND sg.organization_id = ${organizationId}
            `;

            if (result.length === 0) {
                return NextResponse.json({ error: 'Goal not found' }, { status: 404 });
            }

            return NextResponse.json({ goal: result[0] });
        }

        let goals;

        if (participantId && status === 'all') {
            goals = await sql`
                SELECT 
                    sg.*,
                    p.first_name as participant_first_name,
                    p.last_name as participant_last_name,
                    p.preferred_name as participant_preferred_name
                FROM saved_goals sg
                LEFT JOIN participants p ON sg.participant_id = p.id
                WHERE sg.organization_id = ${organizationId}
                AND sg.participant_id = ${participantId}
                ORDER BY sg.created_at DESC
            `;
        } else if (participantId) {
            goals = await sql`
                SELECT 
                    sg.*,
                    p.first_name as participant_first_name,
                    p.last_name as participant_last_name,
                    p.preferred_name as participant_preferred_name
                FROM saved_goals sg
                LEFT JOIN participants p ON sg.participant_id = p.id
                WHERE sg.organization_id = ${organizationId}
                AND sg.participant_id = ${participantId}
                AND sg.status = ${status}
                ORDER BY sg.created_at DESC
            `;
        } else if (status === 'all') {
            goals = await sql`
                SELECT 
                    sg.*,
                    p.first_name as participant_first_name,
                    p.last_name as participant_last_name,
                    p.preferred_name as participant_preferred_name
                FROM saved_goals sg
                LEFT JOIN participants p ON sg.participant_id = p.id
                WHERE sg.organization_id = ${organizationId}
                ORDER BY sg.created_at DESC
            `;
        } else {
            goals = await sql`
                SELECT 
                    sg.*,
                    p.first_name as participant_first_name,
                    p.last_name as participant_last_name,
                    p.preferred_name as participant_preferred_name
                FROM saved_goals sg
                LEFT JOIN participants p ON sg.participant_id = p.id
                WHERE sg.organization_id = ${organizationId}
                AND sg.status = ${status}
                ORDER BY sg.created_at DESC
            `;
        }

        return NextResponse.json({ goals });
    } catch (error) {
        console.error('Error fetching goals:', error);
        return NextResponse.json(
            { error: 'Failed to fetch goals' },
            { status: 500 }
        );
    }
}

// POST /api/saved-goals - Create a new saved goal
export async function POST(req: NextRequest) {
    try {
        const session = await getSession();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const userId = await getInternalUserId(session.user.id, session.user.email);
        if (!userId) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const body = await req.json();
        const {
            organization_id,
            participant_id,
            participant_name,
            goal_area,
            desired_outcome,
            motivation_level,
            strengths,
            challenges,
            timeframe,
            smart_goal,
            goal_data,
            source_assessment_id,
            source_type,
        } = body;

        if (!organization_id) {
            return NextResponse.json({ error: 'organization_id required' }, { status: 400 });
        }

        // Verify org access before creating PHI
        try {
            await requireOrgAccess(organization_id);
        } catch {
            return NextResponse.json({ error: 'Organization access denied' }, { status: 403 });
        }

        const result = await sql`
            INSERT INTO saved_goals (
                user_id, organization_id, participant_id, participant_name,
                goal_area, desired_outcome, motivation_level, strengths,
                challenges, timeframe, smart_goal, goal_data, status,
                source_assessment_id, source_type
            ) VALUES (
                ${userId},
                ${organization_id},
                ${participant_id || null},
                ${participant_name || null},
                ${goal_area || null},
                ${desired_outcome || null},
                ${motivation_level || null},
                ${strengths || null},
                ${challenges || null},
                ${timeframe || null},
                ${smart_goal || null},
                ${goal_data || null},
                'active',
                ${source_assessment_id || null},
                ${source_type || null}
            )
            RETURNING *
        `;

        await logAuditEvent(
            userId,
            organization_id,
            'create',
            'saved_goal',
            result[0].id,
            { participant_id: participant_id || null, goal_area: goal_area || null, source_type: source_type || null, source_assessment_id: source_assessment_id || null }
        );

        return NextResponse.json({ goal: result[0] });
    } catch (error) {
        console.error('Error creating goal:', error);
        return NextResponse.json(
            { error: 'Failed to create goal' },
            { status: 500 }
        );
    }
}

// PUT /api/saved-goals - Update a saved goal
export async function PUT(req: NextRequest) {
    try {
        const session = await getSession();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const userId = await getInternalUserId(session.user.id, session.user.email);
        if (!userId) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const body = await req.json();
        const { id, organization_id } = body;

        if (!id || !organization_id) {
            return NextResponse.json({ error: 'id and organization_id required' }, { status: 400 });
        }

        // Verify org access before mutating PHI
        try {
            await requireOrgAccess(organization_id);
        } catch {
            return NextResponse.json({ error: 'Organization access denied' }, { status: 403 });
        }

        const result = await sql`
            UPDATE saved_goals 
            SET 
                status = COALESCE(${body.status || null}, status),
                progress = COALESCE(${body.progress !== undefined ? body.progress : null}, progress),
                smart_goal = COALESCE(${body.smart_goal || null}, smart_goal),
                timeframe = COALESCE(${body.timeframe || null}, timeframe),
                goal_data = COALESCE(${body.goal_data || null}, goal_data),
                completed_at = CASE 
                    WHEN ${body.status || null} = 'completed' THEN NOW() 
                    ELSE completed_at 
                END,
                updated_at = NOW()
            WHERE id = ${id} AND organization_id = ${organization_id}
            RETURNING *
        `;

        if (result.length === 0) {
            return NextResponse.json({ error: 'Goal not found' }, { status: 404 });
        }

        await logAuditEvent(
            userId,
            organization_id,
            'update',
            'saved_goal',
            id,
            { updated_fields: Object.keys(body).filter(k => k !== 'id' && k !== 'organization_id') }
        );

        return NextResponse.json({ goal: result[0] });
    } catch (error) {
        console.error('Error updating goal:', error);
        return NextResponse.json(
            { error: 'Failed to update goal' },
            { status: 500 }
        );
    }
}

// DELETE /api/saved-goals - Delete a saved goal
export async function DELETE(req: NextRequest) {
    try {
        const session = await getSession();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const userId = await getInternalUserId(session.user.id, session.user.email);
        if (!userId) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');
        const organizationId = searchParams.get('organization_id');

        if (!id || !organizationId) {
            return NextResponse.json({ error: 'id and organization_id required' }, { status: 400 });
        }

        // Verify org access before deleting PHI
        try {
            await requireOrgAccess(organizationId);
        } catch {
            return NextResponse.json({ error: 'Organization access denied' }, { status: 403 });
        }

        const result = await sql`
            DELETE FROM saved_goals WHERE id = ${id} AND organization_id = ${organizationId}
            RETURNING id
        `;

        if (result.length === 0) {
            return NextResponse.json({ error: 'Goal not found' }, { status: 404 });
        }

        await logAuditEvent(
            userId,
            organizationId,
            'delete',
            'saved_goal',
            id,
            { action: 'delete' }
        );

        return NextResponse.json({ success: true, deleted_id: id });
    } catch (error) {
        console.error('Error deleting goal:', error);
        return NextResponse.json(
            { error: 'Failed to delete goal' },
            { status: 500 }
        );
    }
}
