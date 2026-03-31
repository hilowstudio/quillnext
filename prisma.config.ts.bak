import "dotenv/config";
import { defineConfig } from "@prisma/config";

export default defineConfig({
    schema: "prisma/schema.prisma",
    engineType: "binary",
    datasource: {
        // @ts-expect-error - provider property is valid in Prisma 7 but missing in some types
        provider: "postgresql",
        url: process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL,
    },
});