import { PrismaClient } from "@/generated/client";
import { PrismaPg } from "@prisma/adapter-pg";

const createPrismaClient = () => {
  // Pass a PoolConfig (not a pre-built pg.Pool) so the adapter creates its own
  // pool — avoids a dual @types/pg version conflict between the root types and
  // the copy nested under @prisma/adapter-pg.
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  const client = new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

  return client; // Extensions can be added here if needed
};

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createPrismaClient> | undefined;
};

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;