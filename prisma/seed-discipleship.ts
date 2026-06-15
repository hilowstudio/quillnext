import 'dotenv/config';
import { PrismaClient } from "../src/generated/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import fs from 'fs';
import path from 'path';

// Create a Prisma client for seeding (Prisma 7 requires a driver adapter).
const createPrismaClient = () => {
    const connectionString = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;

    if (!connectionString) {
        throw new Error("DATABASE_URL or DIRECT_DATABASE_URL environment variable is required");
    }

    const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } });
    const adapter = new PrismaPg(pool);

    return new PrismaClient({ adapter });
};

const prisma = createPrismaClient();

async function main() {
    console.log('📖 Seeding Devotionals...');

    const dataPath = path.join(process.cwd(), 'prisma', 'data', 'devotionals.json');

    if (!fs.existsSync(dataPath)) {
        console.error('❌ Devotionals data file not found at:', dataPath);
        process.exit(1);
    }

    const rawData = fs.readFileSync(dataPath, 'utf8');
    const devotionals = JSON.parse(rawData);

    console.log(`Found ${devotionals.length} devotionals to seed.`);

    // processing in chunks to avoid overwhelming the connection
    const chunkSize = 50;
    for (let i = 0; i < devotionals.length; i += chunkSize) {
        const chunk = devotionals.slice(i, i + chunkSize);

        await Promise.all(
            chunk.map(async (dev: any) => {
                // Ensure month/day/time uniqueness handling or upsert
                await prisma.devotional.upsert({
                    where: {
                        month_day_time: {
                            month: dev.month,
                            day: dev.day,
                            time: dev.time,
                        },
                    },
                    update: {
                        keyverse: dev.keyverse,
                        body: dev.body,
                    },
                    create: {
                        month: dev.month,
                        day: dev.day,
                        time: dev.time,
                        keyverse: dev.keyverse,
                        body: dev.body,
                    },
                });
            })
        );
        console.log(`Processed ${Math.min(i + chunkSize, devotionals.length)}/${devotionals.length}`);
    }

    console.log('✅ Devotionals seeding complete.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
