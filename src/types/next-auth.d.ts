// Module augmentation for Auth.js (NextAuth v5). Declares the custom fields the app stamps
// onto the JWT/session in src/auth.ts (the jwt + session callbacks), so they are typed instead
// of reached via `as any`. Fields are optional to mirror the runtime exactly (they are only set
// on first sign-in and may be null when a user has no org yet).
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
    interface Session {
        user: {
            id: string;
            organizationId?: string | null;
        } & DefaultSession["user"];
    }

    interface User {
        organizationId?: string | null;
    }
}

// Auth.js v5 defines JWT in @auth/core/jwt (next-auth/jwt re-exports it); augment the source
// so the callback `token` is typed, not reached via the `[key: string]: unknown` index signature.
declare module "@auth/core/jwt" {
    interface JWT {
        id?: string;
        organizationId?: string | null;
    }
}
