import { NextRequest, NextResponse } from 'next/server';
import { getSession, getInternalUserId } from '@/lib/auth';
import { sql } from '@/lib/db';

// GET - Fetch all goals for a specific participant
export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getSession();
        
        if (!session?.user?.id) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const participantId = params.id;

        // Get internal user ID
        const userId = await getInternalUserId(session.user.id, session.user.email);
        
        if (!userId) {
            return NextResponse.json(
                { error: 'User not found' },
                { status: 404 }
            );
        }

        // Get the participant's name to match against saved_goals
        const participantResult = await sql`
            SELECT id, first_name, last_name 
            FROM participants 
            WHERE id = ${participantId}::uuid
        `;

        if (participantResult.length === 0) {
            return NextResponse.json(
                { error: 'Participant not found' },
                { status: 404 }
            );
        }

        const participant = participantResult[0];
        const fullName = `${participant.first_name} ${participant.last_name}`;
        const searchPattern = `%${participant.first_name}%${participant.last_name}%`;

        // Fetch goals from saved_goals table matching by participant_name
        const goals = await sql`
            SELECT 
                id,
                participant_name,
                goal_area,
                desired_outcome,
                smart_goal,
                timeframe,
                created_at
            FROM saved_goals
            WHERE user_id = ${userId}::uuid
            AND (
                participant_name = ${fullName}
                OR participant_name ILIKE ${searchPattern}
            )
            ORDER BY created_at DESC
        `;

        // Transform to simpler format for the form
        const transformedGoals = goals.map((goal: any) => ({
            id: goal.id,
            title: goal.smart_goal || `${goal.goal_area}: ${(goal.desired_outcome || '').substring(0, 50)}...`,
            description: goal.desired_outcome,
            goal_area: goal.goal_area,
            timeframe: goal.timeframe,
            status: 'Active',
            created_at: goal.created_at,
        }));

        return NextResponse.json({ 
            goals: transformedGoals,
            count: transformedGoals.length
        });

    } catch (error) {
        console.error('Error fetching participant goals:', error);
        return NextResponse.json(
            { error: 'Failed to fetch goals' },
            { status: 500 }
        );
    }
}
