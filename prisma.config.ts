import 'dotenv/config'
import { defineConfig, env } from '@prisma/config'

export default defineConfig({
    schema: 'prisma/schema.prisma',
    migrations: {
        path: 'prisma/migrations',
        seed: 'tsx prisma/seed.ts',
    },
    datasource: {
        // Prefer DIRECT TCP via DIRECT_DATABASE_URL for migrations/studio
        url: env('DIRECT_DATABASE_URL') ?? env('DATABASE_URL'),
    },
})
