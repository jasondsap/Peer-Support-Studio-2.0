import { NextAuthOptions } from "next-auth";
import CognitoProvider from "next-auth/providers/cognito";
import { getOrCreateUser, getUserOrganizations } from "@/lib/db";

export const authOptions: NextAuthOptions = {
    providers: [
        CognitoProvider({
            clientId: process.env.COGNITO_CLIENT_ID!,
            clientSecret: process.env.COGNITO_CLIENT_SECRET!,
            issuer: process.env.COGNITO_ISSUER!,
            checks: ["pkce", "state"],
        }),
    ],
    callbacks: {
        async signIn({ user, account }) {
            if (account?.provider === "cognito" && user.email) {
                try {
                    // Create or update user in our database
                    await getOrCreateUser(
                        account.providerAccountId,
                        user.email,
                        user.name || undefined
                    );
                    return true;
                } catch (error) {
                    console.error("Error syncing user to database:", error);
                    // Still allow sign in even if DB sync fails
                    return true;
                }
            }
            return true;
        },
        async jwt({ token, account, profile }) {
            if (account) {
                token.sub = account.providerAccountId;
                token.accessToken = account.access_token;
            }
            return token;
        },
        async session({ session, token }) {
            if (session.user) {
                session.user.id = token.sub as string;
                
                // Fetch user's organizations
                try {
                    const orgs = await getUserOrganizations(token.sub as string);
                    (session as any).organizations = orgs;
                    
                    // Set current org (first one or from cookie/preference)
                    if (orgs.length > 0) {
                        (session as any).currentOrganization = orgs[0];
                    }
                } catch (error) {
                    console.error("Error fetching organizations:", error);
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
    session: {
        strategy: "jwt",
        maxAge: 8 * 60 * 60, // 8 hours - HIPAA session timeout
    },
    debug: process.env.NODE_ENV === "development",
};
