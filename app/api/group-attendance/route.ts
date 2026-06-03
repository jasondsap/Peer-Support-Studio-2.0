import { NextRequest, NextResponse } from 'next/server';
import { getSession, getInternalUserId } from '@/lib/auth';
import { sql } from '@/lib/db';

// GET - a single participant's group attendance across activities (for the participant record).
export async function GET(request: NextRequest) {
    try {
        const session = await getSession();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const userId = await getInternalUserId(session.user.id, session.user.email);
        if (!userId) return NextResponse.json({ error: 'User not found' }, { status: 404 });
        const organizationId = session.currentOrganization?.id;
        if (!organizationId) return NextResponse.json({ error: 'No organization' }, { status: 404 });

        const { searchParams } = new URL(request.url);
        const participantId = searchParams.get('participant_id');
        if (!participantId) {
            return NextResponse.json({ error: 'participant_id is required' }, { status: 400 });
        }

        const attendance = await sql`
            SELECT
                ga.id, ga.attendance_status, ga.source, ga.check_in_time,
                a.id AS activity_id, a.name AS activity_name,
                a.activity_type, a.activity_date
            FROM group_attendance ga
            JOIN group_activities a ON a.id = ga.activity_id
            WHERE ga.participant_id = ${participantId}::uuid
              AND ga.organization_id = ${organizationId}
            ORDER BY a.activity_date DESC
            LIMIT 200
        `;

        return NextResponse.json({ success: true, attendance });
    } catch (error: any) {
        console.error('Group attendance GET error:', error);
        return NextResponse.json({ error: 'Failed to fetch attendance' }, { status: 500 });
    }
}
