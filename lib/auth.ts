import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { sql } from "./db";

// Re-export authOptions so other files can import from @/lib/auth
export { authOptions };

// Extended session type with organizations
export interface ExtendedSession {
    user: {
        id: string;
        name?: string | null;
        email?: string | null;
        image?: string | null;
    };
    organizations: Array<{
        id: string;
        name: string;
        slug: string;
        type: string;
        role: string;
    }>;
    currentOrganization?: {
        id: string;
        name: string;
        slug: string;
        type: string;
        role: string;
    };
    expires: string;
}

/**
 * Get the current session on the server
 */
export async function getSession(): Promise<ExtendedSession | null> {
    return await getServerSession(authOptions) as ExtendedSession | null;
}

/**
 * Get the current user or null
 */
export async function getCurrentUser() {
    const session = await getSession();
    return session?.user ?? null;
}

/**
 * Require authentication - throws if not authenticated
 */
export async function requireAuth() {
    const session = await getSession();
    if (!session?.user?.id) {
        throw new Error("Unauthorized");
    }
    return session;
}

/**
 * Require organization membership
 */
export async function requireOrgAccess(organizationId: string) {
    const session = await requireAuth();
    
    const hasAccess = session.organizations?.some(
        org => org.id === organizationId
    );
    
    if (!hasAccess) {
        throw new Error("Organization access denied");
    }
    
    const org = session.organizations.find(o => o.id === organizationId);
    return { session, organization: org! };
}

/**
 * Require specific role in organization
 */
export async function requireOrgRole(
    organizationId: string,
    allowedRoles: string[]
) {
    const { session, organization } = await requireOrgAccess(organizationId);
    
    if (!allowedRoles.includes(organization.role)) {
        throw new Error("Insufficient permissions");
    }
    
    return { session, organization };
}

/**
 * Get the internal user ID (UUID) from Cognito sub or email
 */
export async function getInternalUserId(cognitoSub: string, email?: string | null): Promise<string | null> {
    // First try by cognito_sub
    let result = await sql`
        SELECT id FROM users WHERE cognito_sub = ${cognitoSub}
    `;
    
    if (result[0]?.id) {
        return result[0].id;
    }
    
    // Fallback: try by email
    if (email) {
        result = await sql`
            SELECT id FROM users WHERE email = ${email}
        `;
        
        if (result[0]?.id) {
            // Update the cognito_sub for future lookups
            await sql`
                UPDATE users SET cognito_sub = ${cognitoSub} WHERE id = ${result[0].id}
            `;
            return result[0].id;
        }
    }
    
    return null;
}

/**
 * Get session with internal user ID
 */
export async function getSessionWithUserId() {
    const session = await requireAuth();
    const userId = await getInternalUserId(session.user.id, session.user.email);
    
    if (!userId) {
        throw new Error("User not found in database");
    }
    
    return { ...session, internalUserId: userId };
}

// Type augmentation for NextAuth
declare module "next-auth" {
    interface Session {
        user: {
            id: string;
            name?: string | null;
            email?: string | null;
            image?: string | null;
        };
    }
}

declare module "next-auth/jwt" {
    interface JWT {
        sub: string;
        accessToken?: string;
    }
}
