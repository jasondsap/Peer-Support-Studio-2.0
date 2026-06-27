import { NextRequest, NextResponse } from 'next/server';
import { getSession, getInternalUserId } from '@/lib/auth';
import { sql, logAuditEvent, validateUUID } from '@/lib/db';

const MANAGE_ROLES = ['owner', 'admin', 'supervisor'];
const LESSON_SOURCES = ['saved', 'template'];

// Normalize an attached-lesson pair: only keep a valid uuid + known source together.
function normalizeLesson(lessonId: any, lessonSource: any): { id: string | null; source: string | null } {
    if (lessonId && validateUUID(lessonId) && LESSON_SOURCES.includes(lessonSource)) {
        return { id: lessonId, source: lessonSource };
    }
    return { id: null, source: null };
}

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

// Confirm the curriculum belongs to the caller's org before any module mutation.
async function ownsCurriculum(curriculumId: string, organizationId: string) {
    const rows = await sql`
        SELECT id FROM curricula WHERE id = ${curriculumId}::uuid AND organization_id = ${organizationId}
    `;
    return rows.length > 0;
}

// GET - modules for a curriculum
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
    try {
        const ctx = await getCtx();
        if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
        if (!validateUUID(params.id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
        if (!(await ownsCurriculum(params.id, ctx.organizationId))) {
            return NextResponse.json({ error: 'Curriculum not found' }, { status: 404 });
        }

        const modules = await sql`
            SELECT * FROM curriculum_modules WHERE curriculum_id = ${params.id}::uuid
            ORDER BY sort_order, module_number
        `;
        return NextResponse.json({ success: true, modules });
    } catch (error) {
        console.error('Modules GET error:', error);
        return NextResponse.json({ error: 'Failed to load modules' }, { status: 500 });
    }
}

// POST - add a module
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
    try {
        const ctx = await getCtx();
        if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
        if (!MANAGE_ROLES.includes(ctx.role)) {
            return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
        }
        if (!validateUUID(params.id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
        if (!(await ownsCurriculum(params.id, ctx.organizationId))) {
            return NextResponse.json({ error: 'Curriculum not found' }, { status: 404 });
        }

        const m = await request.json();
        if (!m?.title || !m.title.trim()) {
            return NextResponse.json({ error: 'Module title is required' }, { status: 400 });
        }
        const objectives = Array.isArray(m.learning_objectives) && m.learning_objectives.length
            ? m.learning_objectives : null;

        const next = await sql`
            SELECT COALESCE(MAX(module_number), 0) + 1 AS n, COALESCE(MAX(sort_order), -1) + 1 AS s
            FROM curriculum_modules WHERE curriculum_id = ${params.id}::uuid
        `;

        const lesson = normalizeLesson(m.lesson_id, m.lesson_source);

        const row = await sql`
            INSERT INTO curriculum_modules
                (curriculum_id, module_number, title, description, minimum_hours, minimum_minutes, learning_objectives, sort_order, lesson_id, lesson_source)
            VALUES (
                ${params.id}::uuid,
                ${m.module_number ?? next[0].n},
                ${m.title.trim()},
                ${m.description || null},
                ${m.minimum_hours ?? null},
                ${m.minimum_minutes ?? null},
                ${objectives},
                ${m.sort_order ?? next[0].s},
                ${lesson.id}::uuid,
                ${lesson.source}
            )
            RETURNING *
        `;
        return NextResponse.json({ success: true, module: row[0] });
    } catch (error) {
        console.error('Modules POST error:', error);
        return NextResponse.json({ error: 'Failed to add module' }, { status: 500 });
    }
}

// PUT - update a module (module_id in body)
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
    try {
        const ctx = await getCtx();
        if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
        if (!MANAGE_ROLES.includes(ctx.role)) {
            return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
        }
        if (!validateUUID(params.id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
        if (!(await ownsCurriculum(params.id, ctx.organizationId))) {
            return NextResponse.json({ error: 'Curriculum not found' }, { status: 404 });
        }

        const body = await request.json();
        const { module_id, title, description, minimum_hours, minimum_minutes, learning_objectives, module_number, sort_order } = body;
        if (!module_id || !validateUUID(module_id)) {
            return NextResponse.json({ error: 'module_id is required' }, { status: 400 });
        }
        const objectives = Array.isArray(learning_objectives) ? (learning_objectives.length ? learning_objectives : null) : null;

        const result = await sql`
            UPDATE curriculum_modules SET
                title = COALESCE(${title ?? null}, title),
                description = ${description ?? null},
                minimum_hours = ${minimum_hours ?? null},
                minimum_minutes = ${minimum_minutes ?? null},
                learning_objectives = ${objectives},
                module_number = COALESCE(${module_number ?? null}, module_number),
                sort_order = COALESCE(${sort_order ?? null}, sort_order)
            WHERE id = ${module_id}::uuid AND curriculum_id = ${params.id}::uuid
            RETURNING *
        `;
        if (result.length === 0) return NextResponse.json({ error: 'Module not found' }, { status: 404 });

        // Only touch the attached-lesson columns when the caller sends lesson_id
        // (lets an "attach lesson" action change just the link; null detaches).
        // Done as a separate UPDATE so ordinary edits never clobber an existing link.
        if (Object.prototype.hasOwnProperty.call(body, 'lesson_id')) {
            const lesson = normalizeLesson(body.lesson_id, body.lesson_source);
            const relinked = await sql`
                UPDATE curriculum_modules
                SET lesson_id = ${lesson.id}::uuid, lesson_source = ${lesson.source}
                WHERE id = ${module_id}::uuid AND curriculum_id = ${params.id}::uuid
                RETURNING *
            `;
            return NextResponse.json({ success: true, module: relinked[0] });
        }

        return NextResponse.json({ success: true, module: result[0] });
    } catch (error) {
        console.error('Modules PUT error:', error);
        return NextResponse.json({ error: 'Failed to update module' }, { status: 500 });
    }
}

// DELETE - remove a module (module_id in query or body)
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
    try {
        const ctx = await getCtx();
        if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
        if (!MANAGE_ROLES.includes(ctx.role)) {
            return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
        }
        if (!validateUUID(params.id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
        if (!(await ownsCurriculum(params.id, ctx.organizationId))) {
            return NextResponse.json({ error: 'Curriculum not found' }, { status: 404 });
        }

        const moduleId = new URL(request.url).searchParams.get('module_id');
        if (!moduleId || !validateUUID(moduleId)) {
            return NextResponse.json({ error: 'module_id is required' }, { status: 400 });
        }

        const result = await sql`
            DELETE FROM curriculum_modules
            WHERE id = ${moduleId}::uuid AND curriculum_id = ${params.id}::uuid
            RETURNING id
        `;
        if (result.length === 0) return NextResponse.json({ error: 'Module not found' }, { status: 404 });
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Modules DELETE error:', error);
        return NextResponse.json({ error: 'Failed to delete module' }, { status: 500 });
    }
}
