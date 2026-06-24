import { NextRequest, NextResponse } from 'next/server';
import { getSession, getInternalUserId } from '@/lib/auth';
import { sql, validateUUID } from '@/lib/db';

async function getCtx() {
    const session = await getSession();
    if (!session?.user?.id) return { error: 'Unauthorized', status: 401 as const };
    const userId = await getInternalUserId(session.user.id, session.user.email);
    if (!userId) return { error: 'User not found', status: 404 as const };
    const organizationId = session.currentOrganization?.id;
    if (!organizationId) return { error: 'No organization selected', status: 400 as const };
    return { userId, organizationId };
}

// GET - all curriculum enrollments for a participant, with progress
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
    try {
        const ctx = await getCtx();
        if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
        if (!validateUUID(params.id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

        // Participant must belong to the caller's org.
        const owns = await sql`
            SELECT id FROM participants WHERE id = ${params.id}::uuid AND organization_id = ${ctx.organizationId}
        `;
        if (owns.length === 0) return NextResponse.json({ error: 'Participant not found' }, { status: 404 });

        const enrollments = await sql`
            SELECT e.id, e.curriculum_id, e.status, e.enrolled_at, e.completed_at,
                c.name AS curriculum_name, c.source AS curriculum_source,
                (SELECT COUNT(*) FROM curriculum_modules m WHERE m.curriculum_id = c.id)::int AS total_modules,
                (SELECT COUNT(*) FROM module_completions mc WHERE mc.enrollment_id = e.id)::int AS modules_completed
            FROM curriculum_enrollments e
            JOIN curricula c ON c.id = e.curriculum_id
            WHERE e.participant_id = ${params.id}::uuid AND e.organization_id = ${ctx.organizationId}
            ORDER BY e.enrolled_at DESC
        `;

        return NextResponse.json({ success: true, enrollments });
    } catch (error) {
        console.error('Participant curricula GET error:', error);
        return NextResponse.json({ error: 'Failed to load curricula' }, { status: 500 });
    }
}
