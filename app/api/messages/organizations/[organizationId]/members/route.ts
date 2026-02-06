import { NextRequest, NextResponse } from "next/server";
import { getSessionWithUserId, requireOrgAccess } from "@/lib/auth";
import { sql } from "@/lib/db";

// ============================================================================
// GET - List organization members
// ============================================================================

export async function GET(
    req: NextRequest,
    { params }: { params: { organizationId: string } }
) {
    try {
        const session = await getSessionWithUserId();
        const organizationId = params.organizationId;

        // Verify org access
        await requireOrgAccess(organizationId);

        // Fetch members with user info
        const members = await sql`
            SELECT 
                u.id,
                u.first_name,
                u.last_name,
                u.email,
                u.avatar_url,
                u.phone,
                om.role,
                om.status,
                om.joined_at
            FROM organization_members om
            JOIN users u ON om.user_id = u.id
            WHERE om.organization_id = ${organizationId}
            AND om.status = 'active'
            AND u.id != ${session.internalUserId}
            ORDER BY u.first_name, u.last_name
        `;

        return NextResponse.json({ members });

    } catch (error) {
        console.error("Error fetching organization members:", error);
        const message = error instanceof Error ? error.message : "Failed to fetch members";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
