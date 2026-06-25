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
import { sendEmail } from '@/lib/email/resend';
import { randomInt } from 'crypto';
import {
    CognitoIdentityProviderClient,
    AdminCreateUserCommand,
    AdminGetUserCommand,
} from '@aws-sdk/client-cognito-identity-provider';

export const runtime = 'nodejs';

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

// Staff sign in to the main app, not the participant portal.
const STAFF_APP_URL = process.env.NEXTAUTH_URL || 'https://app.peersupportstudio.com';

// ─── Email helpers ───────────────────────────────────────────────────────────
// We set the temp password ourselves (suppressing Cognito's own email) so the
// invite goes out through Resend — the same proven channel used for participant
// and assessment-invite emails.

/**
 * Generate a unique, policy-safe temporary password (upper/lower/digit/symbol,
 * 12 chars). Ambiguous characters (O/0/I/l/1) are excluded so it's easy to type.
 */
function generateTempPassword(): string {
    const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const lower = 'abcdefghijkmnpqrstuvwxyz';
    const digits = '23456789';
    const symbols = '!@#$%*?-';
    const all = upper + lower + digits + symbols;
    const pick = (set: string) => set[randomInt(set.length)];

    const chars = [pick(upper), pick(lower), pick(digits), pick(symbols)];
    while (chars.length < 12) chars.push(pick(all));
    // Fisher–Yates shuffle so the required classes aren't always in front.
    for (let i = chars.length - 1; i > 0; i--) {
        const j = randomInt(i + 1);
        [chars[i], chars[j]] = [chars[j], chars[i]];
    }
    return chars.join('');
}

function buildStaffInviteEmail(opts: {
    firstName: string;
    email: string;
    orgName: string;
    tempPassword?: string | null;
}): { subject: string; html: string; text: string } {
    const { firstName, email, orgName, tempPassword } = opts;
    const greeting = firstName ? `Hi ${firstName},` : 'Hello,';

    const credsHtml = tempPassword
        ? `
        <table style="width:100%;border-collapse:collapse;margin:16px 0;background:#f3f7fb;border:1px solid #d6e4f0;border-radius:8px;">
          <tr><td style="padding:12px 16px;color:#0E2235;"><strong>Email:</strong> ${email}</td></tr>
          <tr><td style="padding:12px 16px;border-top:1px solid #e2ecf5;color:#0E2235;"><strong>Temporary password:</strong> ${tempPassword}</td></tr>
        </table>
        <p style="color:#444;font-size:14px;">You'll be asked to set your own password the first time you sign in.</p>`
        : `
        <p style="color:#444;font-size:14px;"><strong>Your email:</strong> ${email}</p>
        <p style="color:#444;font-size:14px;">You already have an account — just sign in with your existing password.</p>`;

    const credsText = tempPassword
        ? `Email: ${email}\nTemporary password: ${tempPassword}\n\nYou'll be asked to set your own password the first time you sign in.`
        : `Your email: ${email}\n\nYou already have an account — sign in with your existing password.`;

    const html = `<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background:#f5f7fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
    <div style="max-width:560px;margin:0 auto;padding:24px;">
      <div style="background:linear-gradient(135deg,#1A73A8 0%,#30B27A 100%);color:#fff;padding:28px 24px;border-radius:10px 10px 0 0;text-align:center;">
        <h1 style="margin:0;font-size:20px;">You've been added to ${orgName}</h1>
      </div>
      <div style="background:#ffffff;padding:24px;border:1px solid #e6ebf1;border-top:none;border-radius:0 0 10px 10px;">
        <p style="color:#222;">${greeting}</p>
        <p style="color:#444;">You've been invited to join <strong>${orgName}</strong> on Peer Support Studio. Sign in to document sessions, manage participants, and use the team's tools.</p>
        ${credsHtml}
        <p style="text-align:center;margin:24px 0;">
          <a href="${STAFF_APP_URL}" style="display:inline-block;background:#1A73A8;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;">Sign in to Peer Support Studio</a>
        </p>
        <p style="color:#666;font-size:13px;">Or visit <a href="${STAFF_APP_URL}" style="color:#1A73A8;">${STAFF_APP_URL.replace(
        /^https?:\/\//,
        ''
    )}</a></p>
        <p style="color:#888;font-size:12px;margin-top:24px;">This is an automated message — please don't reply to this email.</p>
      </div>
    </div>
  </body>
</html>`;

    const text = `${greeting}

You've been invited to join ${orgName} on Peer Support Studio.

${credsText}

Sign in here: ${STAFF_APP_URL}`;

    return { subject: `You've been added to ${orgName} on Peer Support Studio`, html, text };
}

/** Send the staff invite email; never throws — returns whether it went out. */
async function sendStaffInvite(opts: {
    firstName: string;
    email: string;
    orgName: string;
    tempPassword?: string | null;
}): Promise<{ sent: boolean; error: string | null }> {
    try {
        const { subject, html, text } = buildStaffInviteEmail(opts);
        await sendEmail({ to: opts.email, subject, html, text });
        return { sent: true, error: null };
    } catch (err: any) {
        console.error('Staff invite email failed:', err);
        return { sent: false, error: err?.message || 'Failed to send email' };
    }
}

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
        let tempPassword: string | null = null;

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
                    // User doesn't exist in Cognito — create them with a unique
                    // temp password and suppress Cognito's email; we send the
                    // branded invite via Resend below.
                    tempPassword = generateTempPassword();
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
                            TemporaryPassword: tempPassword,
                            // We email credentials ourselves via Resend.
                            MessageAction: 'SUPPRESS',
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
        const orgName = orgResult[0]?.name || 'your organization';

        // ── Step 5: Send the branded invite email via Resend ──
        const emailResult = await sendStaffInvite({
            firstName: first_name.trim(),
            email: email.toLowerCase().trim(),
            orgName,
            // Only include a password when we just created the Cognito account.
            tempPassword: isNewCognitoUser ? tempPassword : null,
        });

        const baseMessage = isNewCognitoUser
            ? `Invitation sent to ${email}. They'll receive an email with temporary login credentials.`
            : `${first_name} ${last_name} has been added to your organization. They already have an account and can log in now.`;

        return NextResponse.json({
            success: true,
            message: emailResult.sent
                ? baseMessage
                : `${first_name} ${last_name} was added, but the invite email could not be sent (${emailResult.error}). You can re-invite or share their login another way.`,
            email_sent: emailResult.sent,
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
