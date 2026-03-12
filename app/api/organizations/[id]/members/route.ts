// ============================================================================
// Peer Support Studio - Organization Members API
// File: /app/api/organizations/[id]/members/route.ts
// GET  - List members of an organization
// POST - Invite a new team member (creates Cognito user + DB records)
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql } from '@/lib/db';
import {
    CognitoIdentityProviderClient,
    AdminCreateUserCommand,
    AdminGetUserCommand,
} from '@aws-sdk/client-cognito-identity-provider';

// Derive region and User Pool ID from COGNITO_ISSUER
// Format: https://cognito-idp.{region}.amazonaws.com/{userPoolId}
const issuerUrl = process.env.COGNITO_ISSUER || '';
const issuerParts = issuerUrl.replace('https://', '').split('/');
const derivedRegion = issuerParts[0]?.split('.')[1] || '';
const USER_POOL_ID = process.env.COGNITO_USER_POOL_ID || issuerParts[1] || '';
const cognitoRegion = derivedRegion || process.env.RESIDENT_POOL_REGION || process.env.APP_AWS_REGION || process.env.AWS_REGION || 'us-east-2';

// Resolve AWS credentials — check Cognito-specific, then app-level, then standard
const awsAccessKey = process.env.COGNITO_ADMIN_ACCESS_KEY_ID || process.env.COGNITO_AWS_ACCESS_KEY_ID || process.env.APP_AWS_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID || '';
const awsSecretKey = process.env.COGNITO_ADMIN_SECRET_ACCESS_KEY || process.env.COGNITO_AWS_SECRET_ACCESS_KEY || process.env.APP_AWS_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY || '';

// Initialize Cognito client with explicit credentials
const cognitoClient = new CognitoIdentityProviderClient({
    region: cognitoRegion,
    ...(awsAccessKey && awsSecretKey
        ? {
              credentials: {
                  accessKeyId: awsAccessKey,
                  secretAccessKey: awsSecretKey,
              },
          }
        : {}),
});

// ─── GET: List organization members ─────────────────────────────────────────
export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const orgId = params.id;
        const userEmail = session.user.email;

        // Verify the requesting user is a member of this org
        const memberCheck = await sql`
            SELECT om.role FROM organization_members om
            JOIN users u ON om.user_id = u.id
            WHERE om.organization_id = ${orgId}::uuid
              AND u.email = ${userEmail}
              AND om.status = 'active'
        `;

        if (memberCheck.length === 0) {
            return NextResponse.json(
                { error: 'Not a member of this organization' },
                { status: 403 }
            );
        }

        // Fetch all active members with user details
        const members = await sql`
            SELECT 
                om.id,
                om.user_id,
                om.role,
                om.status,
                om.joined_at,
                u.id as user_id,
                u.first_name,
                u.last_name,
                u.display_name,
                u.email
            FROM organization_members om
            JOIN users u ON u.id = om.user_id
            WHERE om.organization_id = ${orgId}::uuid
              AND om.status = 'active'
            ORDER BY 
                CASE om.role 
                    WHEN 'owner' THEN 1 
                    WHEN 'admin' THEN 2 
                    WHEN 'supervisor' THEN 3 
                    ELSE 4 
                END,
                u.first_name, u.last_name
        `;

        // Format to match frontend expectations
        const formatted = members.map((m: any) => ({
            id: m.id,
            user_id: m.user_id,
            role: m.role,
            status: m.status,
            joined_at: m.joined_at,
            user: {
                id: m.user_id,
                first_name: m.first_name,
                last_name: m.last_name,
                display_name: m.display_name,
                email: m.email,
            },
        }));

        return NextResponse.json({ members: formatted });
    } catch (error) {
        console.error('Error fetching org members:', error);
        return NextResponse.json(
            { error: 'Failed to fetch members' },
            { status: 500 }
        );
    }
}

// ─── POST: Invite a new team member ─────────────────────────────────────────
export async function POST(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const orgId = params.id;
        const userEmail = session.user.email;

        // Verify the requesting user is an admin/owner
        const memberCheck = await sql`
            SELECT om.role, om.user_id FROM organization_members om
            JOIN users u ON om.user_id = u.id
            WHERE om.organization_id = ${orgId}::uuid
              AND u.email = ${userEmail}
              AND om.status = 'active'
        `;

        if (memberCheck.length === 0) {
            return NextResponse.json(
                { error: 'Not a member of this organization' },
                { status: 403 }
            );
        }

        const inviterRole = memberCheck[0].role;
        const inviterUserId = memberCheck[0].user_id;
        if (!['owner', 'admin'].includes(inviterRole)) {
            return NextResponse.json(
                { error: 'Only admins and owners can invite team members' },
                { status: 403 }
            );
        }

        const body = await request.json();
        const { email, first_name, last_name, role } = body;

        // Validate required fields
        if (!email || !first_name || !last_name) {
            return NextResponse.json(
                { error: 'Email, first name, and last name are required' },
                { status: 400 }
            );
        }

        // Validate role
        const allowedRoles = ['admin', 'supervisor', 'pss'];
        const memberRole = allowedRoles.includes(role) ? role : 'pss';

        // Prevent non-owners from creating admins
        if (memberRole === 'admin' && inviterRole !== 'owner') {
            return NextResponse.json(
                { error: 'Only owners can assign the admin role' },
                { status: 403 }
            );
        }

        // ── Check if user already exists in this org ──
        const existingMember = await sql`
            SELECT om.id, om.status, u.email
            FROM organization_members om
            JOIN users u ON u.id = om.user_id
            WHERE om.organization_id = ${orgId}::uuid
              AND u.email = ${email.toLowerCase().trim()}
        `;

        if (existingMember.length > 0) {
            const member = existingMember[0];
            if (member.status === 'active') {
                return NextResponse.json(
                    { error: 'This person is already a member of your organization' },
                    { status: 409 }
                );
            }
            // If they were previously removed, reactivate them
            if (member.status === 'inactive' || member.status === 'removed') {
                await sql`
                    UPDATE organization_members 
                    SET status = 'active', role = ${memberRole}, joined_at = NOW()
                    WHERE id = ${member.id}
                `;
                return NextResponse.json({
                    success: true,
                    message: 'Team member reactivated successfully',
                    reactivated: true,
                });
            }
        }

        // ── Step 1: Create Cognito user ──
        let cognitoSub: string | null = null;
        let isNewCognitoUser = false;

        try {
            // Check if user already exists in Cognito
            try {
                const existingCognitoUser = await cognitoClient.send(
                    new AdminGetUserCommand({
                        UserPoolId: USER_POOL_ID,
                        Username: email.toLowerCase().trim(),
                    })
                );
                // User exists in Cognito — grab their sub
                cognitoSub = existingCognitoUser.UserAttributes?.find(
                    (attr) => attr.Name === 'sub'
                )?.Value || null;
                console.log(`Cognito: Existing user found for ${email}`);
            } catch (cognitoError: any) {
                if (cognitoError.name === 'UserNotFoundException') {
                    // User doesn't exist in Cognito — create them
                    const createResult = await cognitoClient.send(
                        new AdminCreateUserCommand({
                            UserPoolId: USER_POOL_ID,
                            Username: email.toLowerCase().trim(),
                            UserAttributes: [
                                { Name: 'email', Value: email.toLowerCase().trim() },
                                { Name: 'email_verified', Value: 'true' },
                                { Name: 'given_name', Value: first_name.trim() },
                                { Name: 'family_name', Value: last_name.trim() },
                            ],
                            // Cognito sends a temp password email automatically
                            DesiredDeliveryMediums: ['EMAIL'],
                            // Force password change on first login
                            ForceAliasCreation: false,
                        })
                    );

                    cognitoSub = createResult.User?.Attributes?.find(
                        (attr) => attr.Name === 'sub'
                    )?.Value || null;
                    isNewCognitoUser = true;
                    console.log(`Cognito: New user created for ${email}`);
                } else {
                    throw cognitoError;
                }
            }
        } catch (cognitoError: any) {
            console.error('Cognito error:', cognitoError);
            return NextResponse.json(
                { error: `Failed to create user account: ${cognitoError.message || 'Cognito error'}` },
                { status: 500 }
            );
        }

        // ── Step 2: Create or find user in DB ──
        let dbUser;

        const existingDbUser = await sql`
            SELECT id FROM users WHERE email = ${email.toLowerCase().trim()}
        `;

        if (existingDbUser.length > 0) {
            dbUser = existingDbUser[0];
        } else {
            // Insert new user record
            const newUser = await sql`
                INSERT INTO users (
                    email, first_name, last_name, cognito_sub, created_at, updated_at
                ) VALUES (
                    ${email.toLowerCase().trim()},
                    ${first_name.trim()},
                    ${last_name.trim()},
                    ${cognitoSub},
                    NOW(),
                    NOW()
                )
                RETURNING id
            `;
            dbUser = newUser[0];
        }

        // ── Step 3: Add to organization ──
        const membership = await sql`
            INSERT INTO organization_members (
                organization_id, user_id, role, status, joined_at, invited_at, invited_by
            ) VALUES (
                ${orgId}::uuid,
                ${dbUser.id}::uuid,
                ${memberRole},
                'active',
                NOW(),
                NOW(),
                ${inviterUserId}::uuid
            )
            RETURNING id, role, status, joined_at
        `;

        // ── Step 4: Get org name for response ──
        const orgResult = await sql`
            SELECT name FROM organizations WHERE id = ${orgId}::uuid
        `;

        return NextResponse.json({
            success: true,
            message: isNewCognitoUser
                ? `Invitation sent to ${email}. They will receive an email with temporary login credentials.`
                : `${first_name} ${last_name} has been added to your organization. They already have an account and can log in now.`,
            isNewUser: isNewCognitoUser,
            member: {
                id: membership[0].id,
                user_id: dbUser.id,
                role: membership[0].role,
                status: membership[0].status,
                joined_at: membership[0].joined_at,
                user: {
                    id: dbUser.id,
                    first_name: first_name.trim(),
                    last_name: last_name.trim(),
                    email: email.toLowerCase().trim(),
                },
            },
            organization: orgResult[0]?.name || 'your organization',
        });
    } catch (error: any) {
        console.error('Error inviting team member:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to invite team member' },
            { status: 500 }
        );
    }
}
