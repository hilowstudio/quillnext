import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { PrismaClient } from "@/generated/client";
import { db } from "@/server/db";
import { authConfig } from "./auth.config";

// Create a separate Prisma client for the adapter if needed


/**
 * Main Auth.js entry point
 * Combines edge-safe config with database adapter
 */
const authInstance = NextAuth({
  adapter: PrismaAdapter(db as any),
  session: { strategy: "jwt" },
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
  debug: false,
  ...authConfig,
  cookies: {
    // The PKCE verifier cookie must NOT be Secure / "__Secure-"-prefixed on local
    // dev (http://localhost) — browsers drop such cookies over http, so the OAuth
    // callback fails with "pkceCodeVerifier value could not be parsed". Use the
    // hardened form only in production (HTTPS); prod behavior is unchanged.
    pkceCodeVerifier: {
      name: `${process.env.NODE_ENV === "production" ? "__Secure-" : ""}next-auth.pkce.code_verifier`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        domain: process.env.NODE_ENV === "production" ? ".quillandcompass.app" : undefined,
        path: "/",
      },
    },
  },
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.organizationId = user.organizationId;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
        session.user.organizationId = token.organizationId;
      }
      return session;
    },
  },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
});

// Export handlers for API routes
export const { handlers, auth, signIn, signOut } = authInstance;

// Also export GET and POST directly for convenience
export const { GET, POST } = handlers;

