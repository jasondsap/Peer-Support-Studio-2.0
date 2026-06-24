import { NextRequest, NextResponse } from 'next/server';
import { getSession, getInternalUserId } from '@/lib/auth';
import { sql, logAuditEvent, validateUUID } from '@/lib/db';

async function getCtx() {
    const session = await getSession();
    if (!session?.user?.id) return { error: 'Unauthorized', status: 401 as const };
    const userId = await getInternalUserId(session.user.id, session.user.email);
    if (!userId) return { error: 'User not found', status: 404 as const };
    const organizationId = session.currentOrganization?.id;
    if (!organizationId) return { error: 'No organization selected', status: 400 as const };
    const role = session.currentOrganization?.role || '';
    return { userId, organizationId, role };
}

async function ownsCurriculum(curriculumId: string, organizationId: string) {
    const rows = await sql`
        SELECT id FROM curricula WHERE id = ${curriculumId}::uuid AND organization_id = ${organizationId}
    `;
    return rows.length > 0;
}

// GET - enrolled participants with progress (modules completed / total)
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
    try {
        const ctx = await getCtx();
        if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
        if (!validateUUID(params.id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
        if (!(await ownsCurriculum(params.id, ctx.organizationId))) {
            return NextResponse.json({ error: 'Curriculum not found' }, { status: 404 });
        }

        const totalRow = await sql`
            SELECT COUNT(*)::int AS total FROM curriculum_modules WHERE curriculum_id = ${params.id}::uuid
        `;
        const totalModules = totalRow[0].total;

        const enrollments = await sql`
            SELECT e.*,
                p.first_name, p.last_name, p.preferred_name,
                (SELECT COUNT(*) FROM module_completions mc WHERE mc.enrollment_id = e.id)::int AS modules_completed
            FROM curriculum_enrollments e
            JOIN participants p ON p.id = e.participant_id
            WHERE e.curriculum_id = ${params.id}::uuid AND e.organization_id = ${ctx.organizationId}
            ORDER BY p.last_name, p.first_name
        `;

        return NextResponse.json({ success: true, enrollments, total_modules: totalModules });
    } catch (error) {
        console.error('Enrollments GET error:', error);
        return NextResponse.json({ error: 'Failed to load enrollments' }, { status: 500 });
    }
}

// POST - enroll one or more participants
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
    try {
        const ctx = await getCtx();
        if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
        if (!validateUUID(params.id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
        if (!(await ownsCurriculum(params.id, ctx.organizationId))) {
            return NextResponse.json({ error: 'Curriculum not found' }, { status: 404 });
        }

        const body = await request.json();
        const ids: string[] = Array.isArray(body.participant_ids)
            ? body.participant_ids
            : body.participant_id ? [body.participant_id] : [];
        const valid = ids.filter((p) => validateUUID(p));
        if (valid.length === 0) {
            return NextResponse.json({ error: 'participant_id is required' }, { status: 400 });
        }

        const enrolled = [];
        for (const pid of valid) {
            // Participant must belong to the same org.
            const owns = await sql`
                SELECT id FROM participants WHERE id = ${pid}::uuid AND organization_id = ${ctx.organizationId}
            `;
            if (owns.length === 0) continue;

            const row = await sql`
                INSERT INTO curriculum_enrollments (curriculum_id, participant_id, organization_id, enrolled_by)
                VALUES (${params.id}::uuid, ${pid}::uuid, ${ctx.organizationId}::uuid, ${ctx.userId}::uuid)
                ON CONFLICT (curriculum_id, participant_id) DO NOTHING
                RETURNING *
            `;
            if (row.length) enrolled.push(row[0]);
        }

        await logAuditEvent(ctx.userId, ctx.organizationId, 'enroll', 'curriculum', params.id);
        return NextResponse.json({ success: true, enrolled_count: enrolled.length, enrollments: enrolled });
    } catch (error) {
        console.error('Enrollments POST error:', error);
        return NextResponse.json({ error: 'Failed to enroll participant' }, { status: 500 });
    }
}
