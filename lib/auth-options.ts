// /lib/auth-options.ts
import type { NextAuthOptions } from "next-auth";
import CognitoProvider from "next-auth/providers/cognito";
import { getOrCreateUser, getUserOrganizations } from "@/lib/db";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

export const authOptions: NextAuthOptions = {
    providers: [
        CognitoProvider({
            clientId: process.env.COGNITO_CLIENT_ID!,
            clientSecret: process.env.COGNITO_CLIENT_SECRET!,
            issuer: process.env.COGNITO_ISSUER!,
            checks: ["pkce", "state"],
        }),
    ],

    secret: process.env.NEXTAUTH_SECRET,

    session: {
        strategy: "jwt",
        maxAge: 8 * 60 * 60,
    },

    callbacks: {
        async signIn({ user, account }) {
            try {
                if (account?.provider === "cognito") {
                    const cognitoSub = account.providerAccountId;
                    const email = user.email ?? null;
                    const name = user.name ?? undefined;
                    if (email) {
                        await getOrCreateUser(cognitoSub, email, name);
                    } else {
                        console.warn("Cognito signIn: user.email missing; DB sync skipped.");
                    }
                }
                return true;
            } catch (err) {
                console.error("signIn callback error:", err);
                return true;
            }
        },

        async jwt({ token, account }) {
            if (account?.provider === "cognito") {
                token.sub = account.providerAccountId;
                (token as any).accessToken = account.access_token;
                (token as any).idToken = account.id_token;
            }
            return token;
        },

        async session({ session, token }) {
            if (session.user) {
                session.user.id = token.sub as string;

                try {
                    const orgs = await getUserOrganizations(token.sub as string);
                    (session as any).organizations = orgs ?? [];

                    if ((session as any).organizations.length > 0) {
                        // Read saved org preference from DB
                        let savedOrgId: string | null = null;
                        try {
                            const prefResult = await sql`
                                SELECT preferences->>'selected_org_id' AS selected_org_id
                                FROM users
                                WHERE cognito_sub = ${token.sub as string}
                                LIMIT 1
                            `;
                            savedOrgId = prefResult[0]?.selected_org_id ?? null;
                        } catch {
                            // Non-fatal — fall back to first org
                        }

                        const matchedOrg = savedOrgId
                            ? (session as any).organizations.find((o: any) => o.id === savedOrgId)
                            : null;

                        (session as any).currentOrganization =
                            matchedOrg ?? (session as any).organizations[0];
                    }
                } catch (err) {
                    console.error("session callback org lookup error:", err);
                    (session as any).organizations = [];
                }
            }
            return session;
        },
    },

    pages: {
        signIn: "/auth/signin",
        error: "/auth/error",
    },

    debug: process.env.NODE_ENV === "development",
};
