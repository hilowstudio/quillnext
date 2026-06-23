import 'dotenv/config'
import { defineConfig } from '@prisma/config'

export default defineConfig({
    schema: 'prisma/schema.prisma',
    migrations: {
        path: 'prisma/migrations',
        seed: 'tsx prisma/seed.ts',
    },
    datasource: {
        // Prefer a DIRECT (non-pooling) URL for migrations/studio. DIRECT_DATABASE_URL is ours;
        // POSTGRES_URL_NON_POOLING is the Vercel↔Supabase integration's direct URL (same DB,
        // different name). Pooled URLs are last-resort fallbacks. Use process.env (NOT
        // @prisma/config's env(), which THROWS on a missing variable) so `prisma generate` still
        // succeeds on Vercel, where the direct URL is not set at build time.
        url:
            process.env.DIRECT_DATABASE_URL ||
            process.env.POSTGRES_URL_NON_POOLING ||
            process.env.DATABASE_URL ||
            process.env.POSTGRES_URL,
    },
})
