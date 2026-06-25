// =============================================================================
// Participant Portal Access API
// File: app/api/participants/[id]/portal/route.ts
//
// Enabling portal access for a participant:
//   1. Creates (or finds) a Cognito user in the SHARED user pool that the
//      participant portal (https://my.peersupportstudio.com) authenticates
//      against — using the participant's name + email and a known temporary
//      password (Peer!1234). Cognito's own email is suppressed.
//   2. Stores the cognito_sub on participant_credentials and flips
//      portal_enabled = true.
//   3. Sends the login details to the participant via Resend.
//
// PATCH supports re-sending the invite and resetting the temp password.
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { getSessionWithUserId, requireOrgAccess } from "@/lib/auth";
import { sql, logAuditEvent } from "@/lib/db";
import { sendEmail } from "@/lib/email/resend";
import {
    CognitoIdentityProviderClient,
    AdminCreateUserCommand,
    AdminGetUserCommand,
    AdminSetUserPasswordCommand,
} from "@aws-sdk/client-cognito-identity-provider";

export const runtime = "nodejs";

// ─────────────────────────────────────────────────────────────────────────
// Cognito config — mirrors app/api/organizations/[id]/members/route.ts.
// Region + pool id are derived from COGNITO_ISSUER
// (https://cognito-idp.{region}.amazonaws.com/{userPoolId}). AdminCreateUser
// operates at the POOL level, so the participant becomes available to the
// portal app client even though this app uses a different client id.
// ─────────────────────────────────────────────────────────────────────────
const issuerUrl = process.env.COGNITO_ISSUER || "";
const issuerParts = issuerUrl.replace("https://", "").split("/");
const derivedRegion = issuerParts[0]?.split(".")[1] || "";
const USER_POOL_ID = process.env.COGNITO_USER_POOL_ID || issuerParts[1] || "";
const cognitoRegion =
    derivedRegion ||
    process.env.APP_AWS_REGION ||
    process.env.AWS_REGION ||
    "us-east-2";

const awsAccessKey =
    process.env.COGNITO_ADMIN_ACCESS_KEY_ID ||
    process.env.COGNITO_AWS_ACCESS_KEY_ID ||
    process.env.APP_AWS_ACCESS_KEY_ID ||
    process.env.AWS_ACCESS_KEY_ID ||
    "";
const awsSecretKey =
    process.env.COGNITO_ADMIN_SECRET_ACCESS_KEY ||
    process.env.COGNITO_AWS_SECRET_ACCESS_KEY ||
    process.env.APP_AWS_SECRET_ACCESS_KEY ||
    process.env.AWS_SECRET_ACCESS_KEY ||
    "";

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

const PORTAL_URL =
    process.env.PARTICIPANT_PORTAL_URL || "https://my.peersupportstudio.com";
// Known temporary password handed to participants. They are forced to set
// their own password on first sign-in (Cognito FORCE_CHANGE_PASSWORD state).
const DEFAULT_TEMP_PASSWORD = "Peer!1234";

// ─────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────

/** Create the Cognito user if absent; return their sub and whether we made them. */
async function ensureCognitoUser(
    email: string,
    firstName: string,
    lastName: string
): Promise<{ sub: string | null; created: boolean }> {
    try {
        const existing = await cognitoClient.send(
            new AdminGetUserCommand({ UserPoolId: USER_POOL_ID, Username: email })
        );
        const sub =
            existing.UserAttributes?.find((a) => a.Name === "sub")?.Value || null;
        return { sub, created: false };
    } catch (err: any) {
        if (err?.name !== "UserNotFoundException") throw err;

        const created = await cognitoClient.send(
            new AdminCreateUserCommand({
                UserPoolId: USER_POOL_ID,
                Username: email,
                UserAttributes: [
                    { Name: "email", Value: email },
                    { Name: "email_verified", Value: "true" },
                    { Name: "given_name", Value: firstName },
                    { Name: "family_name", Value: lastName },
                ],
                TemporaryPassword: DEFAULT_TEMP_PASSWORD,
                // We deliver credentials ourselves via Resend, so silence Cognito.
                MessageAction: "SUPPRESS",
            })
        );
        const sub =
            created.User?.Attributes?.find((a) => a.Name === "sub")?.Value || null;
        return { sub, created: true };
    }
}

/** Reset a participant's Cognito password back to the temp password. */
async function resetCognitoPassword(email: string): Promise<void> {
    await cognitoClient.send(
        new AdminSetUserPasswordCommand({
            UserPoolId: USER_POOL_ID,
            Username: email,
            Password: DEFAULT_TEMP_PASSWORD,
            Permanent: false, // forces a change on next sign-in
        })
    );
}

function buildPortalEmail(opts: {
    firstName: string;
    email: string;
    tempPassword?: string | null;
}): { subject: string; html: string; text: string } {
    const { firstName, email, tempPassword } = opts;
    const greeting = firstName ? `Hi ${firstName},` : "Hello,";

    const credsHtml = tempPassword
        ? `
        <table style="width:100%;border-collapse:collapse;margin:16px 0;background:#f3f7fb;border:1px solid #d6e4f0;border-radius:8px;">
          <tr><td style="padding:12px 16px;color:#0E2235;"><strong>Email:</strong> ${email}</td></tr>
          <tr><td style="padding:12px 16px;border-top:1px solid #e2ecf5;color:#0E2235;"><strong>Temporary password:</strong> ${tempPassword}</td></tr>
        </table>
        <p style="color:#444;font-size:14px;">For your security, you'll be asked to create your own password the first time you sign in.</p>`
        : `
        <p style="color:#444;font-size:14px;"><strong>Your email:</strong> ${email}</p>
        <p style="color:#444;font-size:14px;">Sign in with the password you set previously. If you've forgotten it, ask your peer support specialist to reset it for you.</p>`;

    const credsText = tempPassword
        ? `Email: ${email}\nTemporary password: ${tempPassword}\n\nFor your security, you'll be asked to create your own password the first time you sign in.`
        : `Your email: ${email}\n\nSign in with the password you set previously. If you've forgotten it, ask your peer support specialist to reset it for you.`;

    const html = `<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background:#f5f7fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
    <div style="max-width:560px;margin:0 auto;padding:24px;">
      <div style="background:linear-gradient(135deg,#1A73A8 0%,#30B27A 100%);color:#fff;padding:28px 24px;border-radius:10px 10px 0 0;text-align:center;">
        <h1 style="margin:0;font-size:20px;">Your Peer Support Studio Portal is Ready</h1>
      </div>
      <div style="background:#ffffff;padding:24px;border:1px solid #e6ebf1;border-top:none;border-radius:0 0 10px 10px;">
        <p style="color:#222;">${greeting}</p>
        <p style="color:#444;">Your peer support specialist has set up your portal account. You can message your specialist, track your goals, and check in on your recovery — from your phone or computer.</p>
        ${credsHtml}
        <p style="text-align:center;margin:24px 0;">
          <a href="${PORTAL_URL}" style="display:inline-block;background:#1A73A8;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;">Sign in to your portal</a>
        </p>
        <p style="color:#666;font-size:13px;">Or visit <a href="${PORTAL_URL}" style="color:#1A73A8;">${PORTAL_URL.replace(
        /^https?:\/\//,
        ""
    )}</a></p>
        <p style="color:#888;font-size:12px;margin-top:24px;">Questions? Reply to your specialist or reach out to your care team. This is an automated message — please don't reply to this email.</p>
      </div>
    </div>
  </body>
</html>`;

    const text = `${greeting}

Your peer support specialist has set up your Peer Support Studio portal account.

${credsText}

Sign in here: ${PORTAL_URL}

Questions? Reach out to your peer support specialist or care team.`;

    return {
        subject: "Your Peer Support Studio Portal is Ready",
        html,
        text,
    };
}

/** Send the portal email; never throws — returns whether it went out. */
async function sendPortalEmail(opts: {
    firstName: string;
    email: string;
    tempPassword?: string | null;
}): Promise<{ sent: boolean; error: string | null }> {
    try {
        const { subject, html, text } = buildPortalEmail(opts);
        await sendEmail({ to: opts.email, subject, html, text });
        return { sent: true, error: null };
    } catch (err: any) {
        console.error("Portal email send failed:", err);
        return { sent: false, error: err?.message || "Failed to send email" };
    }
}

// =============================================================================
// POST - Enable portal access (create Cognito user + email credentials)
// =============================================================================
export async function POST(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getSessionWithUserId();
        const body = await req.json();
        const { organization_id, email } = body;
        const participantId = params.id;

        if (!organization_id || !email) {
            return NextResponse.json(
                { error: "organization_id and email are required" },
                { status: 400 }
            );
        }

        await requireOrgAccess(organization_id);

        const participant = await sql`
            SELECT id, first_name, last_name
            FROM participants
            WHERE id = ${participantId}
            AND organization_id = ${organization_id}
        `;

        if (participant.length === 0) {
            return NextResponse.json(
                { error: "Participant not found" },
                { status: 404 }
            );
        }

        const firstName = (participant[0].first_name || "").trim();
        const lastName = (participant[0].last_name || "").trim();
        const cleanEmail = email.toLowerCase().trim();

        // ── Step 1: Create or find the Cognito user ──
        let cognitoSub: string | null = null;
        let cognitoCreated = false;
        try {
            const result = await ensureCognitoUser(cleanEmail, firstName, lastName);
            cognitoSub = result.sub;
            cognitoCreated = result.created;
        } catch (cognitoError: any) {
            console.error("Cognito error:", cognitoError);
            return NextResponse.json(
                {
                    error: `Failed to set up portal login: ${
                        cognitoError?.message || "Cognito error"
                    }`,
                },
                { status: 500 }
            );
        }

        // ── Step 2: Upsert participant_credentials ──
        const existing = await sql`
            SELECT id FROM participant_credentials
            WHERE participant_id = ${participantId}
        `;

        let credentialId;
        if (existing.length > 0) {
            const updated = await sql`
                UPDATE participant_credentials
                SET
                    email = ${cleanEmail},
                    cognito_sub = COALESCE(${cognitoSub}, cognito_sub),
                    portal_enabled = true,
                    status = 'active',
                    updated_at = NOW()
                WHERE participant_id = ${participantId}
                RETURNING id
            `;
            credentialId = updated[0].id;
        } else {
            const created = await sql`
                INSERT INTO participant_credentials (
                    participant_id, email, cognito_sub, portal_enabled, status
                )
                VALUES (${participantId}, ${cleanEmail}, ${cognitoSub}, true, 'active')
                RETURNING id
            `;
            credentialId = created[0].id;
        }

        // ── Step 3: Email the participant their login details ──
        // Only include the temp password when we just created the account; an
        // existing Cognito user already has their own password.
        const emailResult = await sendPortalEmail({
            firstName,
            email: cleanEmail,
            tempPassword: cognitoCreated ? DEFAULT_TEMP_PASSWORD : null,
        });

        // ── Step 4: Audit ──
        await logAuditEvent(
            session.internalUserId,
            organization_id,
            "PORTAL_ACCESS_ENABLED",
            "participant",
            participantId,
            {
                email: cleanEmail,
                cognito_user_created: cognitoCreated,
                welcome_email_sent: emailResult.sent,
            }
        );

        return NextResponse.json({
            success: true,
            credential_id: credentialId,
            cognito_user_created: cognitoCreated,
            email_sent: emailResult.sent,
            message:
                `Portal access enabled for ${firstName} ${lastName}`.trim() +
                (emailResult.sent ? `. Login details sent to ${cleanEmail}.` : "."),
            warning: emailResult.error
                ? `Portal is enabled, but the email could not be sent: ${emailResult.error}`
                : null,
        });
    } catch (error) {
        console.error("Error enabling portal access:", error);
        const message =
            error instanceof Error ? error.message : "Failed to enable portal access";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

// =============================================================================
// PATCH - Re-send invite email or reset the temporary password
// Body: { organization_id, action: 'resend' | 'reset_password' }
// =============================================================================
export async function PATCH(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getSessionWithUserId();
        const body = await req.json();
        const { organization_id, action } = body;
        const participantId = params.id;

        if (!organization_id || !action) {
            return NextResponse.json(
                { error: "organization_id and action are required" },
                { status: 400 }
            );
        }
        if (action !== "resend" && action !== "reset_password") {
            return NextResponse.json(
                { error: "action must be 'resend' or 'reset_password'" },
                { status: 400 }
            );
        }

        await requireOrgAccess(organization_id);

        const rows = await sql`
            SELECT pc.id, pc.email, pc.portal_enabled, p.first_name, p.last_name
            FROM participant_credentials pc
            JOIN participants p ON pc.participant_id = p.id
            WHERE pc.participant_id = ${participantId}
            AND p.organization_id = ${organization_id}
        `;

        if (rows.length === 0) {
            return NextResponse.json(
                { error: "Portal access has not been set up for this participant yet" },
                { status: 404 }
            );
        }
        if (!rows[0].portal_enabled) {
            return NextResponse.json(
                { error: "Portal access is currently disabled. Enable it first." },
                { status: 400 }
            );
        }

        const cleanEmail = (rows[0].email || "").toLowerCase().trim();
        const firstName = (rows[0].first_name || "").trim();
        let tempPassword: string | null = null;

        if (action === "reset_password") {
            try {
                await resetCognitoPassword(cleanEmail);
                tempPassword = DEFAULT_TEMP_PASSWORD;
            } catch (cognitoError: any) {
                console.error("Cognito password reset error:", cognitoError);
                return NextResponse.json(
                    {
                        error: `Failed to reset password: ${
                            cognitoError?.message || "Cognito error"
                        }`,
                    },
                    { status: 500 }
                );
            }
        }

        const emailResult = await sendPortalEmail({
            firstName,
            email: cleanEmail,
            tempPassword,
        });

        await logAuditEvent(
            session.internalUserId,
            organization_id,
            action === "reset_password"
                ? "PORTAL_PASSWORD_RESET"
                : "PORTAL_INVITE_RESENT",
            "participant",
            participantId,
            { email: cleanEmail, email_sent: emailResult.sent }
        );

        if (!emailResult.sent) {
            return NextResponse.json(
                {
                    error: `Could not send email: ${emailResult.error}`,
                },
                { status: 502 }
            );
        }

        return NextResponse.json({
            success: true,
            email_sent: true,
            message:
                action === "reset_password"
                    ? `Password reset to the temporary password and emailed to ${cleanEmail}.`
                    : `Invite re-sent to ${cleanEmail}.`,
        });
    } catch (error) {
        console.error("Error updating portal access:", error);
        const message =
            error instanceof Error ? error.message : "Failed to update portal access";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

// =============================================================================
// DELETE - Disable portal access
// =============================================================================
export async function DELETE(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getSessionWithUserId();
        const { searchParams } = new URL(req.url);
        const organizationId = searchParams.get("organization_id");
        const participantId = params.id;

        if (!organizationId) {
            return NextResponse.json(
                { error: "organization_id is required" },
                { status: 400 }
            );
        }

        await requireOrgAccess(organizationId);

        const participant = await sql`
            SELECT id FROM participants
            WHERE id = ${participantId}
            AND organization_id = ${organizationId}
        `;

        if (participant.length === 0) {
            return NextResponse.json(
                { error: "Participant not found" },
                { status: 404 }
            );
        }

        await sql`
            UPDATE participant_credentials
            SET
                portal_enabled = false,
                updated_at = NOW()
            WHERE participant_id = ${participantId}
        `;

        await logAuditEvent(
            session.internalUserId,
            organizationId,
            "PORTAL_ACCESS_DISABLED",
            "participant",
            participantId,
            {}
        );

        return NextResponse.json({
            success: true,
            message: "Portal access disabled",
        });
    } catch (error) {
        console.error("Error disabling portal access:", error);
        const message =
            error instanceof Error ? error.message : "Failed to disable portal access";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

// =============================================================================
// GET - Check portal access status
// =============================================================================
export async function GET(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        await getSessionWithUserId();
        const { searchParams } = new URL(req.url);
        const organizationId = searchParams.get("organization_id");
        const participantId = params.id;

        if (!organizationId) {
            return NextResponse.json(
                { error: "organization_id is required" },
                { status: 400 }
            );
        }

        await requireOrgAccess(organizationId);

        const credentials = await sql`
            SELECT
                pc.*,
                p.first_name,
                p.last_name
            FROM participant_credentials pc
            JOIN participants p ON pc.participant_id = p.id
            WHERE pc.participant_id = ${participantId}
            AND p.organization_id = ${organizationId}
        `;

        if (credentials.length === 0) {
            return NextResponse.json({
                has_portal_access: false,
                portal_enabled: false,
                credentials: null,
            });
        }

        return NextResponse.json({
            has_portal_access: true,
            portal_enabled: credentials[0].portal_enabled,
            credentials: {
                id: credentials[0].id,
                email: credentials[0].email,
                status: credentials[0].status,
                last_login_at: credentials[0].last_login_at,
                created_at: credentials[0].created_at,
            },
        });
    } catch (error) {
        console.error("Error checking portal access:", error);
        const message =
            error instanceof Error ? error.message : "Failed to check portal access";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
