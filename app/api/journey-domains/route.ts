import { NextRequest, NextResponse } from 'next/server';
import { getSession, getInternalUserId, requireOrgAccess } from '@/lib/auth';
import { sql, logAuditEvent } from '@/lib/db';

// GET - Fetch domains for an organization
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

        if (!organizationId) {
            return NextResponse.json({ error: 'organization_id required' }, { status: 400 });
        }

        try {
            await requireOrgAccess(organizationId);
        } catch {
            return NextResponse.json({ error: 'Organization access denied' }, { status: 403 });
        }

        const domains = await sql`
            SELECT 
                id,
                domain_key,
                domain_label,
                description,
                statuses,
                color,
                icon,
                is_active,
                display_order,
                created_at
            FROM journey_domains
            WHERE organization_id = ${organizationId}
            AND is_active = true
            ORDER BY display_order, domain_label
        `;

        return NextResponse.json({ success: true, domains });
    } catch (error) {
        console.error('Error fetching journey domains:', error);
        return NextResponse.json({ error: 'Failed to fetch domains' }, { status: 500 });
    }
}

// POST - Create a new domain
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
            domain_key,
            domain_label,
            description,
            statuses,
            color,
            icon,
            display_order
        } = body;

        if (!organization_id || !domain_key || !domain_label) {
            return NextResponse.json({ error: 'organization_id, domain_key, and domain_label required' }, { status: 400 });
        }

        try {
            await requireOrgAccess(organization_id);
        } catch {
            return NextResponse.json({ error: 'Organization access denied' }, { status: 403 });
        }

        const result = await sql`
            INSERT INTO journey_domains (
                organization_id,
                domain_key,
                domain_label,
                description,
                statuses,
                color,
                icon,
                display_order
            ) VALUES (
                ${organization_id},
                ${domain_key},
                ${domain_label},
                ${description || null},
                ${JSON.stringify(statuses || [])},
                ${color || '#6B7280'},
                ${icon || 'circle'},
                ${display_order || 0}
            )
            RETURNING *
        `;

        await logAuditEvent(userId, organization_id, 'create', 'journey_domain', result[0].id, {
            domain_key,
            domain_label
        });

        return NextResponse.json({ success: true, domain: result[0] });
    } catch (error: any) {
        console.error('Error creating journey domain:', error);
        if (error.message?.includes('duplicate key')) {
            return NextResponse.json({ error: 'Domain with this key already exists' }, { status: 409 });
        }
        return NextResponse.json({ error: 'Failed to create domain' }, { status: 500 });
    }
}

// PATCH - Update a domain
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
        const { id, organization_id, domain_label, description, statuses, color, icon, is_active, display_order } = body;

        if (!id) {
            return NextResponse.json({ error: 'Domain id required' }, { status: 400 });
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
            UPDATE journey_domains
            SET
                domain_label = COALESCE(${domain_label}, domain_label),
                description = COALESCE(${description}, description),
                statuses = COALESCE(${statuses ? JSON.stringify(statuses) : null}, statuses),
                color = COALESCE(${color}, color),
                icon = COALESCE(${icon}, icon),
                is_active = COALESCE(${is_active}, is_active),
                display_order = COALESCE(${display_order}, display_order),
                updated_at = NOW()
            WHERE id = ${id}
            AND organization_id = ${organization_id}
            RETURNING *
        `;

        if (result.length === 0) {
            return NextResponse.json({ error: 'Domain not found' }, { status: 404 });
        }

        await logAuditEvent(userId, organization_id, 'update', 'journey_domain', id);

        return NextResponse.json({ success: true, domain: result[0] });
    } catch (error) {
        console.error('Error updating journey domain:', error);
        return NextResponse.json({ error: 'Failed to update domain' }, { status: 500 });
    }
}

// DELETE - Soft delete a domain (set is_active = false)
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
            return NextResponse.json({ error: 'Domain id required' }, { status: 400 });
        }

        if (!organizationId) {
            return NextResponse.json({ error: 'organization_id required' }, { status: 400 });
        }

        try {
            await requireOrgAccess(organizationId);
        } catch {
            return NextResponse.json({ error: 'Organization access denied' }, { status: 403 });
        }

        const result = await sql`
            UPDATE journey_domains
            SET is_active = false, updated_at = NOW()
            WHERE id = ${id}
            AND organization_id = ${organizationId}
            RETURNING id
        `;

        if (result.length === 0) {
            return NextResponse.json({ error: 'Domain not found' }, { status: 404 });
        }

        await logAuditEvent(userId, organizationId, 'delete', 'journey_domain', id);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting journey domain:', error);
        return NextResponse.json({ error: 'Failed to delete domain' }, { status: 500 });
    }
}
