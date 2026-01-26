// app/api/organizations/route.ts
// Create a new organization

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

// Helper to generate a slug from name
function generateSlug(name: string): string {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .substring(0, 50);
}

// Helper to generate invite code
function generateInviteCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { name, type = 'peer_org' } = body;

        if (!name || name.trim().length < 2) {
            return NextResponse.json(
                { error: 'Organization name is required (min 2 characters)' },
                { status: 400 }
            );
        }

        // Get user ID from session or look up by email
        let userId = (session as any).userId;
        
        if (!userId && session.user.email) {
            const userResult = await sql`
                SELECT id FROM users WHERE email = ${session.user.email}
            `;
            if (userResult.length > 0) {
                userId = userResult[0].id;
            }
        }

        if (!userId) {
            return NextResponse.json(
                { error: 'User not found. Please complete your profile first.' },
                { status: 400 }
            );
        }

        // Generate unique slug
        let slug = generateSlug(name);
        let slugSuffix = 0;
        let uniqueSlug = slug;
        
        while (true) {
            const existing = await sql`
                SELECT id FROM organizations WHERE slug = ${uniqueSlug}
            `;
            if (existing.length === 0) break;
            slugSuffix++;
            uniqueSlug = `${slug}-${slugSuffix}`;
        }

        // Generate invite code
        const inviteCode = generateInviteCode();

        // Create organization
        const orgResult = await sql`
            INSERT INTO organizations (name, slug, type, invite_code)
            VALUES (${name.trim()}, ${uniqueSlug}, ${type}, ${inviteCode})
            RETURNING id, name, slug, type, invite_code
        `;

        const organization = orgResult[0];

        // Add creator as admin
        await sql`
            INSERT INTO organization_members (user_id, organization_id, role, status)
            VALUES (${userId}, ${organization.id}, 'admin', 'active')
        `;

        return NextResponse.json({
            success: true,
            organization: {
                id: organization.id,
                name: organization.name,
                slug: organization.slug,
                type: organization.type,
                invite_code: organization.invite_code,
            },
        });

    } catch (error) {
        console.error('Error creating organization:', error);
        return NextResponse.json(
            { error: 'Failed to create organization' },
            { status: 500 }
        );
    }
}

// GET - List user's organizations (alternative endpoint)
export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const userEmail = session.user.email;

        const organizations = await sql`
            SELECT 
                o.id,
                o.name,
                o.slug,
                o.type,
                o.invite_code,
                om.role
            FROM organizations o
            JOIN organization_members om ON o.id = om.organization_id
            JOIN users u ON om.user_id = u.id
            WHERE u.email = ${userEmail}
              AND om.status = 'active'
            ORDER BY o.name
        `;

        return NextResponse.json({ organizations });

    } catch (error) {
        console.error('Error fetching organizations:', error);
        return NextResponse.json(
            { error: 'Failed to fetch organizations' },
            { status: 500 }
        );
    }
}
