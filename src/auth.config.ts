import type { NextAuthConfig } from "next-auth";

/**
 * Base Auth.js configuration, merged into the full instance in `auth.ts`.
 * Kept dependency-light (no Prisma/Node-only imports) so it stays edge-safe.
 *
 * NOTE: the former `authorized()` callback was removed — it never ran. This app gates routes
 * via `src/proxy.ts` (the Next 16 proxy/middleware), not NextAuth's middleware wrapper, so the
 * callback was dead config.
 */
export const authConfig = {
  providers: [], // Providers added in auth.ts

  pages: {
    signIn: "/login",
  },
} satisfies NextAuthConfig;
