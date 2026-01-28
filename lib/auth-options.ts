// /lib/auth-options.ts (or wherever you keep it)
import type { NextAuthOptions } from "next-auth";
import CognitoProvider from "next-auth/providers/cognito";
import { getOrCreateUser, getUserOrganizations } from "@/lib/db";

/**
 * NOTE (TypeScript):
 * If you want TS to recognize session.user.id, add a module augmentation file:
 * /types/next-auth.d.ts
 *
 * declare module "next-auth" {
 *   interface Session {
 *     user: { id: string; email?: string | null; name?: string | null };
 *     organizations?: any[];
 *     currentOrganization?: any;
 *   }
 * }
 */
export const authOptions: NextAuthOptions = {
    providers: [
        CognitoProvider({
            clientId: process.env.COGNITO_CLIENT_ID!,
            clientSecret: process.env.COGNITO_CLIENT_SECRET!,
            issuer: process.env.COGNITO_ISSUER!,
            // These are commonly recommended for Cognito
            checks: ["pkce", "state"],
        }),
    ],

    // Make sure NextAuth has a stable secret in Vercel
    secret: process.env.NEXTAUTH_SECRET,

    session: {
        strategy: "jwt",
        // 8 hours (HIPAA-friendly idle/session policy choice)
        maxAge: 8 * 60 * 60,
    },

    callbacks: {
        /**
         * Runs on sign-in. Good place to sync/create user row in Neon.
         */
        async signIn({ user, account }) {
            try {
                if (account?.provider === "cognito") {
                    const cognitoSub = account.providerAccountId; // Cognito user id (sub)
                    const email = user.email ?? null;
                    const name = user.name ?? undefined;

                    if (email) {
                        // Create or update user in DB (Neon)
                        await getOrCreateUser(cognitoSub, email, name);
                    } else {
                        // Email missing can happen depending on scopes / Cognito config
                        console.warn("Cognito signIn: user.email missing; DB sync skipped.");
                    }
                }
                return true;
            } catch (err) {
                // You can decide whether to block sign-in if DB sync fails.
                // For MVP, allowing sign-in is often fine:
                console.error("signIn callback error:", err);
                return true;
            }
        },

        /**
         * Controls what goes into the JWT.
         * Critical: ensure token.sub is the Cognito sub so we can map it into session.user.id.
         */
        async jwt({ token, account }) {
            if (account?.provider === "cognito") {
                // Store Cognito "sub" (providerAccountId) in token.sub
                token.sub = account.providerAccountId;

                // Optional: pass through tokens if you need them later
                // (Avoid sending these to the client unless absolutely necessary)
                (token as any).accessToken = account.access_token;
                (token as any).idToken = account.id_token;
            }

            return token;
        },

        /**
         * Controls what ends up in `useSession()` / `getServerSession()`.
         * Critical: session.user.id must exist for your requireAuth() logic.
         */
        async session({ session, token }) {
            if (session.user) {
                session.user.id = token.sub as string;

                // Attach organizations to the session (optional but your app uses it)
                try {
                    const orgs = await getUserOrganizations(token.sub as string);
                    (session as any).organizations = orgs ?? [];

                    if ((session as any).organizations.length > 0) {
                        (session as any).currentOrganization = (session as any).organizations[0];
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
