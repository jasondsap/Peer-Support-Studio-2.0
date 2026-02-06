// =============================================================================
// Participant Portal Access API
// File: app/api/participants/[id]/portal/route.ts
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { getSessionWithUserId, requireOrgAccess } from "@/lib/auth";
import { sql, logAuditEvent } from "@/lib/db";

// POST - Enable portal access for a participant
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

        // Verify participant belongs to this org
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

        // Check if credentials already exist
        const existing = await sql`
            SELECT id, portal_enabled FROM participant_credentials
            WHERE participant_id = ${participantId}
        `;

        let credentialId;

        if (existing.length > 0) {
            // Update existing
            const updated = await sql`
                UPDATE participant_credentials
                SET 
                    email = ${email},
                    portal_enabled = true,
                    status = 'active',
                    updated_at = NOW()
                WHERE participant_id = ${participantId}
                RETURNING id
            `;
            credentialId = updated[0].id;
        } else {
            // Create new
            const created = await sql`
                INSERT INTO participant_credentials (
                    participant_id, 
                    email, 
                    portal_enabled, 
                    status
                )
                VALUES (${participantId}, ${email}, true, 'active')
                RETURNING id
            `;
            credentialId = created[0].id;
        }

        // Log audit event
        await logAuditEvent(
            session.internalUserId,
            organization_id,
            'PORTAL_ACCESS_ENABLED',
            'participant',
            participantId,
            { email }
        );

        return NextResponse.json({
            success: true,
            credential_id: credentialId,
            message: `Portal access enabled for ${participant[0].first_name} ${participant[0].last_name}`
        });

    } catch (error) {
        console.error("Error enabling portal access:", error);
        const message = error instanceof Error ? error.message : "Failed to enable portal access";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

// DELETE - Disable portal access for a participant
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

        // Verify participant belongs to this org
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

        // Disable portal access
        await sql`
            UPDATE participant_credentials
            SET 
                portal_enabled = false,
                updated_at = NOW()
            WHERE participant_id = ${participantId}
        `;

        // Log audit event
        await logAuditEvent(
            session.internalUserId,
            organizationId,
            'PORTAL_ACCESS_DISABLED',
            'participant',
            participantId,
            {}
        );

        return NextResponse.json({
            success: true,
            message: "Portal access disabled"
        });

    } catch (error) {
        console.error("Error disabling portal access:", error);
        const message = error instanceof Error ? error.message : "Failed to disable portal access";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

// GET - Check portal access status
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

        // Get portal credentials
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
                credentials: null
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
                created_at: credentials[0].created_at
            }
        });

    } catch (error) {
        console.error("Error checking portal access:", error);
        const message = error instanceof Error ? error.message : "Failed to check portal access";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
