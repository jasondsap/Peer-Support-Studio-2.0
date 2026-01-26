import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql } from '@/lib/db';

// GET /api/saved-goals - List saved goals
export async function GET(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const organizationId = searchParams.get('organization_id');
        const participantId = searchParams.get('participant_id');
        const status = searchParams.get('status') || 'active';
        const search = searchParams.get('search');

        if (!organizationId) {
            return NextResponse.json({ error: 'organization_id required' }, { status: 400 });
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
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
        } = body;

        if (!organization_id) {
            return NextResponse.json({ error: 'organization_id required' }, { status: 400 });
        }

        // Get user ID from email
        const userResult = await sql`
            SELECT id FROM users WHERE email = ${session.user.email}
        `;

        if (userResult.length === 0) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const userId = userResult[0].id;

        const result = await sql`
            INSERT INTO saved_goals (
                user_id, organization_id, participant_id, participant_name,
                goal_area, desired_outcome, motivation_level, strengths,
                challenges, timeframe, smart_goal, goal_data, status
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
                ${goal_data ? JSON.stringify(goal_data) : null},
                'active'
            )
            RETURNING *
        `;

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
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const { id, organization_id, status, progress } = body;

        if (!id || !organization_id) {
            return NextResponse.json({ error: 'id and organization_id required' }, { status: 400 });
        }

        let result;

        if (status === 'completed') {
            result = await sql`
                UPDATE saved_goals 
                SET status = ${status}, progress = ${progress || 100}, completed_at = NOW(), updated_at = NOW()
                WHERE id = ${id} AND organization_id = ${organization_id}
                RETURNING *
            `;
        } else if (status) {
            result = await sql`
                UPDATE saved_goals 
                SET status = ${status}, updated_at = NOW()
                WHERE id = ${id} AND organization_id = ${organization_id}
                RETURNING *
            `;
        } else if (progress !== undefined) {
            result = await sql`
                UPDATE saved_goals 
                SET progress = ${progress}, updated_at = NOW()
                WHERE id = ${id} AND organization_id = ${organization_id}
                RETURNING *
            `;
        } else {
            return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
        }

        if (result.length === 0) {
            return NextResponse.json({ error: 'Goal not found' }, { status: 404 });
        }

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
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');
        const organizationId = searchParams.get('organization_id');

        if (!id || !organizationId) {
            return NextResponse.json({ error: 'id and organization_id required' }, { status: 400 });
        }

        const result = await sql`
            DELETE FROM saved_goals WHERE id = ${id} AND organization_id = ${organizationId}
            RETURNING id
        `;

        if (result.length === 0) {
            return NextResponse.json({ error: 'Goal not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true, deleted_id: id });
    } catch (error) {
        console.error('Error deleting goal:', error);
        return NextResponse.json(
            { error: 'Failed to delete goal' },
            { status: 500 }
        );
    }
}
