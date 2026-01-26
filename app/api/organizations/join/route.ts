// app/api/organizations/join/route.ts
// Join an organization using invite code

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { organization_id, invite_code } = body;

        if (!organization_id && !invite_code) {
            return NextResponse.json(
                { error: 'Organization ID or invite code required' },
                { status: 400 }
            );
        }

        // Get user ID
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
                { error: 'User not found' },
                { status: 400 }
            );
        }

        // Find organization
        let orgId = organization_id;
        let orgName = '';

        if (invite_code && !orgId) {
            const orgResult = await sql`
                SELECT id, name FROM organizations WHERE invite_code = ${invite_code.toUpperCase()}
            `;
            if (orgResult.length === 0) {
                return NextResponse.json(
                    { error: 'Invalid invite code' },
                    { status: 404 }
                );
            }
            orgId = orgResult[0].id;
            orgName = orgResult[0].name;
        } else {
            // Verify org exists and code matches
            const orgResult = await sql`
                SELECT id, name, invite_code FROM organizations WHERE id = ${orgId}
            `;
            if (orgResult.length === 0) {
                return NextResponse.json(
                    { error: 'Organization not found' },
                    { status: 404 }
                );
            }
            
            // If invite_code provided, verify it matches
            if (invite_code && orgResult[0].invite_code !== invite_code.toUpperCase()) {
                return NextResponse.json(
                    { error: 'Invalid invite code for this organization' },
                    { status: 400 }
                );
            }
            
            orgName = orgResult[0].name;
        }

        // Check if already a member
        const existingMembership = await sql`
            SELECT id, status FROM organization_members
            WHERE user_id = ${userId} AND organization_id = ${orgId}
        `;

        if (existingMembership.length > 0) {
            if (existingMembership[0].status === 'active') {
                return NextResponse.json(
                    { error: 'You are already a member of this organization' },
                    { status: 400 }
                );
            }
            
            // Reactivate membership
            await sql`
                UPDATE organization_members
                SET status = 'active', updated_at = NOW()
                WHERE id = ${existingMembership[0].id}
            `;
        } else {
            // Create new membership (default role: pss)
            await sql`
                INSERT INTO organization_members (user_id, organization_id, role, status)
                VALUES (${userId}, ${orgId}, 'pss', 'active')
            `;
        }

        return NextResponse.json({
            success: true,
            message: `Successfully joined ${orgName}`,
            organization: {
                id: orgId,
                name: orgName,
            },
        });

    } catch (error) {
        console.error('Error joining organization:', error);
        return NextResponse.json(
            { error: 'Failed to join organization' },
            { status: 500 }
        );
    }
}
