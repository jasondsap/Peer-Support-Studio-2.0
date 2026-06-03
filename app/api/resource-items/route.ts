import { NextRequest, NextResponse } from 'next/server';
import { getSession, getInternalUserId } from '@/lib/auth';
import { sql } from '@/lib/db';

const MANAGE_ROLES = ['admin', 'owner'];

async function getUserContext(session: any) {
    const userId = await getInternalUserId(session.user.id, session.user.email);
    if (!userId) return null;
    const organizationId = session.currentOrganization?.id;
    if (!organizationId) return null;
    const role = session.currentOrganization?.role || '';
    return { userId, organizationId, role };
}

// GET - active catalog items for the org (supplies dropdown)
export async function GET(request: NextRequest) {
    try {
        const session = await getSession();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const ctx = await getUserContext(session);
        if (!ctx) return NextResponse.json({ error: 'User not found' }, { status: 404 });

        const items = await sql`
            SELECT id, category, name, unit, default_cost, active
            FROM resource_items
            WHERE organization_id = ${ctx.organizationId} AND active = true
            ORDER BY category, name
        `;
        return NextResponse.json({ success: true, items });
    } catch (error: any) {
        console.error('Resource items GET error:', error);
        return NextResponse.json({ error: 'Failed to fetch items' }, { status: 500 });
    }
}

// POST - add a catalog item
export async function POST(request: NextRequest) {
    try {
        const session = await getSession();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const ctx = await getUserContext(session);
        if (!ctx) return NextResponse.json({ error: 'User not found' }, { status: 404 });
        if (!MANAGE_ROLES.includes(ctx.role)) {
            return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
        }

        const body = await request.json();
        const { name, category, unit, default_cost } = body;
        if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 });

        const result = await sql`
            INSERT INTO resource_items (organization_id, category, name, unit, default_cost)
            VALUES (
                ${ctx.organizationId}::uuid,
                ${category || 'other'},
                ${name},
                ${unit || null},
                ${default_cost ?? null}
            )
            ON CONFLICT (organization_id, name) DO UPDATE
                SET category = EXCLUDED.category, unit = EXCLUDED.unit,
                    default_cost = EXCLUDED.default_cost, active = true
            RETURNING *
        `;
        return NextResponse.json({ success: true, item: result[0] });
    } catch (error: any) {
        console.error('Resource items POST error:', error);
        return NextResponse.json({ error: 'Failed to add item' }, { status: 500 });
    }
}

// PATCH - edit a catalog item (admin/owner)
export async function PATCH(request: NextRequest) {
    try {
        const session = await getSession();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const ctx = await getUserContext(session);
        if (!ctx) return NextResponse.json({ error: 'User not found' }, { status: 404 });
        if (!MANAGE_ROLES.includes(ctx.role)) {
            return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
        }

        const body = await request.json();
        const { id, name, category, unit, default_cost, active } = body;
        if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

        const result = await sql`
            UPDATE resource_items SET
                name = COALESCE(${name ?? null}, name),
                category = COALESCE(${category ?? null}, category),
                unit = COALESCE(${unit ?? null}, unit),
                default_cost = COALESCE(${default_cost ?? null}, default_cost),
                active = COALESCE(${active ?? null}, active)
            WHERE id = ${id}::uuid AND organization_id = ${ctx.organizationId}
            RETURNING *
        `;
        if (result.length === 0) {
            return NextResponse.json({ error: 'Item not found' }, { status: 404 });
        }
        return NextResponse.json({ success: true, item: result[0] });
    } catch (error: any) {
        console.error('Resource items PATCH error:', error);
        return NextResponse.json({ error: 'Failed to update item' }, { status: 500 });
    }
}

// DELETE - remove a catalog item (admin/owner). Past log entries are unaffected
// (item name/category are denormalized into each log's details at save time).
export async function DELETE(request: NextRequest) {
    try {
        const session = await getSession();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const ctx = await getUserContext(session);
        if (!ctx) return NextResponse.json({ error: 'User not found' }, { status: 404 });
        if (!MANAGE_ROLES.includes(ctx.role)) {
            return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

        const result = await sql`
            DELETE FROM resource_items
            WHERE id = ${id}::uuid AND organization_id = ${ctx.organizationId}
            RETURNING id
        `;
        if (result.length === 0) {
            return NextResponse.json({ error: 'Item not found' }, { status: 404 });
        }
        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Resource items DELETE error:', error);
        return NextResponse.json({ error: 'Failed to delete item' }, { status: 500 });
    }
}
