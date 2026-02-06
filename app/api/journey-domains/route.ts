import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

// GET - Fetch domains for an organization
export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const organizationId = searchParams.get('organization_id');

        if (!organizationId) {
            return NextResponse.json({ error: 'organization_id required' }, { status: 400 });
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
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { id, domain_label, description, statuses, color, icon, is_active, display_order } = body;

        if (!id) {
            return NextResponse.json({ error: 'Domain id required' }, { status: 400 });
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
            RETURNING *
        `;

        if (result.length === 0) {
            return NextResponse.json({ error: 'Domain not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true, domain: result[0] });
    } catch (error) {
        console.error('Error updating journey domain:', error);
        return NextResponse.json({ error: 'Failed to update domain' }, { status: 500 });
    }
}

// DELETE - Soft delete a domain (set is_active = false)
export async function DELETE(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'Domain id required' }, { status: 400 });
        }

        await sql`
            UPDATE journey_domains
            SET is_active = false, updated_at = NOW()
            WHERE id = ${id}
        `;

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting journey domain:', error);
        return NextResponse.json({ error: 'Failed to delete domain' }, { status: 500 });
    }
}
