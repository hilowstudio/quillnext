import 'dotenv/config'
import { defineConfig } from '@prisma/config'

export default defineConfig({
    schema: 'prisma/schema.prisma',
    migrations: {
        path: 'prisma/migrations',
        seed: 'tsx prisma/seed.ts',
    },
    datasource: {
        // Prefer DIRECT TCP (DIRECT_DATABASE_URL) for migrations/studio; fall back to the
        // pooled DATABASE_URL. Use process.env (NOT @prisma/config's env(), which THROWS on a
        // missing variable) so `prisma generate` still succeeds on Vercel, where
        // DIRECT_DATABASE_URL is not set at build time.
        url: process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL,
    },
})
