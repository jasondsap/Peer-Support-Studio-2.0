import { NextRequest, NextResponse } from 'next/server';
import { getSession, getInternalUserId, requireOrgAccess } from '@/lib/auth';
import { sql, logAuditEvent } from '@/lib/db';

const ADMIN_ROLES = ['admin', 'owner', 'supervisor'];

/**
 * Note Templates API
 *
 * Org-scoped reusable note prefills. A template's `body` (jsonb) carries the
 * prefill payload for the note form, with a `kind` discriminator:
 *   { kind: 'manual', manual: {...partial ManualNoteForm formData} }
 *   { kind: 'quick',  quick: { title, content, sessionType, tags } }
 *
 * Visibility: shared templates (is_shared=true) are visible to the whole org;
 * private templates are visible only to their creator.
 */

// GET - list templates visible to the caller within an org
export async function GET(request: NextRequest) {
    try {
        const session = await getSession();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const searchParams = request.nextUrl.searchParams;
        const orgId =
            searchParams.get('organization_id') ||
            (session as any).currentOrganization?.id ||
            null;
        const kind = searchParams.get('kind'); // optional: 'manual' | 'quick'

        if (!orgId) {
            return NextResponse.json(
                { error: 'organization_id is required' },
                { status: 400 }
            );
        }

        await requireOrgAccess(orgId);

        const userId = await getInternalUserId(session.user.id, session.user.email);
        if (!userId) {
            return NextResponse.json(
                { error: 'User not found in database' },
                { status: 404 }
            );
        }

        const params: unknown[] = [orgId, userId];
        const where: string[] = [
            'organization_id = $1::uuid',
            '(is_shared = true OR created_by = $2::uuid)',
        ];
        if (kind) {
            params.push(kind);
            where.push(`body->>'kind' = $${params.length}`);
        }

        const templates = await sql(
            `SELECT id, organization_id, name, description, body, is_shared,
                    created_by, use_count, created_at, updated_at
             FROM note_templates
             WHERE ${where.join(' AND ')}
             ORDER BY use_count DESC, updated_at DESC`,
            params
        );

        return NextResponse.json({ templates });
    } catch (error) {
        console.error('Error listing note templates:', error);
        const message =
            error instanceof Error && error.message.includes('access denied')
                ? 'Organization access denied'
                : 'Failed to list note templates';
        const status = message === 'Organization access denied' ? 403 : 500;
        return NextResponse.json({ error: message }, { status });
    }
}

// POST - create a template, OR increment use_count when applying one
export async function POST(request: NextRequest) {
    try {
        const session = await getSession();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const userId = await getInternalUserId(session.user.id, session.user.email);
        if (!userId) {
            return NextResponse.json(
                { error: 'User not found in database' },
                { status: 404 }
            );
        }

        const payload = await request.json();

        // ── Apply path: best-effort use_count bump ──────────────────────────
        // ({ apply_id } with no create fields). Never break the apply flow.
        if (payload?.apply_id && !payload?.name) {
            try {
                await sql`
                    UPDATE note_templates
                    SET use_count = use_count + 1, updated_at = now()
                    WHERE id = ${payload.apply_id}::uuid
                `;
            } catch (e) {
                console.error('use_count increment failed (non-fatal):', e);
            }
            return NextResponse.json({ success: true });
        }

        // ── Create path ─────────────────────────────────────────────────────
        const {
            organization_id,
            name,
            description = null,
            body,
            is_shared = true,
        } = payload || {};

        if (!organization_id) {
            return NextResponse.json(
                { error: 'organization_id is required' },
                { status: 400 }
            );
        }
        if (!name || typeof name !== 'string' || !name.trim()) {
            return NextResponse.json({ error: 'name is required' }, { status: 400 });
        }
        if (!body || typeof body !== 'object') {
            return NextResponse.json(
                { error: 'body is required' },
                { status: 400 }
            );
        }

        await requireOrgAccess(organization_id);

        const rows = await sql`
            INSERT INTO note_templates (
                organization_id, name, description, body, is_shared, created_by, use_count
            ) VALUES (
                ${organization_id}::uuid,
                ${name.trim()},
                ${description || null},
                ${JSON.stringify(body)}::jsonb,
                ${is_shared === false ? false : true},
                ${userId}::uuid,
                0
            )
            RETURNING id, organization_id, name, description, body, is_shared,
                      created_by, use_count, created_at, updated_at
        `;

        await logAuditEvent(
            userId,
            organization_id,
            'create',
            'note_template',
            rows[0].id,
            { name: rows[0].name, is_shared: rows[0].is_shared }
        );

        return NextResponse.json({ template: rows[0] }, { status: 201 });
    } catch (error) {
        console.error('Error creating note template:', error);
        const message =
            error instanceof Error && error.message.includes('access denied')
                ? 'Organization access denied'
                : 'Failed to create note template';
        const status = message === 'Organization access denied' ? 403 : 500;
        return NextResponse.json({ error: message }, { status });
    }
}

// DELETE - remove a template (creator or org admin/owner/supervisor)
export async function DELETE(request: NextRequest) {
    try {
        const session = await getSession();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const searchParams = request.nextUrl.searchParams;
        const id = searchParams.get('id');
        const orgId = searchParams.get('organization_id');

        if (!id || !orgId) {
            return NextResponse.json(
                { error: 'id and organization_id are required' },
                { status: 400 }
            );
        }

        const { organization } = await requireOrgAccess(orgId);

        const userId = await getInternalUserId(session.user.id, session.user.email);
        if (!userId) {
            return NextResponse.json(
                { error: 'User not found in database' },
                { status: 404 }
            );
        }

        // Fetch within org to confirm ownership/scope
        const existing = await sql`
            SELECT id, created_by FROM note_templates
            WHERE id = ${id}::uuid AND organization_id = ${orgId}::uuid
        `;
        if (existing.length === 0) {
            return NextResponse.json(
                { error: 'Template not found' },
                { status: 404 }
            );
        }

        const isCreator = existing[0].created_by === userId;
        const isAdmin = ADMIN_ROLES.includes(organization?.role || '');
        if (!isCreator && !isAdmin) {
            return NextResponse.json(
                { error: 'Not permitted to delete this template' },
                { status: 403 }
            );
        }

        await sql`
            DELETE FROM note_templates
            WHERE id = ${id}::uuid AND organization_id = ${orgId}::uuid
        `;

        await logAuditEvent(userId, orgId, 'delete', 'note_template', id, {});

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting note template:', error);
        const message =
            error instanceof Error && error.message.includes('access denied')
                ? 'Organization access denied'
                : 'Failed to delete note template';
        const status = message === 'Organization access denied' ? 403 : 500;
        return NextResponse.json({ error: message }, { status });
    }
}
