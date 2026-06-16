import { PrismaClient, Prisma } from "@/generated/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { getRlsContext } from "./rls-context";

// When true, the app connects as the non-bypass `app_user` role and the data layer stamps
// the per-request tenant GUCs that the RLS policies read. OFF by default so the DB-side RLS
// (migration 00000000000002_rls_policies) stays inert until a verified cutover.
const RLS_ENABLED = process.env.RLS_ENABLED === "true";

const createBaseClient = () => {
  // Pass a PoolConfig (not a pre-built pg.Pool) so the adapter creates its own pool —
  // avoids a dual @types/pg version conflict between the root types and the copy nested
  // under @prisma/adapter-pg.
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
};

const globalForPrisma = globalThis as unknown as {
  prismaBase: PrismaClient | undefined;
};

// The un-extended client. `withTenant` and the per-query extension both build on this so
// they never recurse through the extension.
const base = globalForPrisma.prismaBase ?? createBaseClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prismaBase = base;

function tenantGucValues(): { org: string; user: string } {
  const ctx = getRlsContext();
  return { org: ctx?.organizationId ?? "", user: ctx?.userId ?? "" };
}

/**
 * Run interactive-transaction or raw work with the tenant GUCs set on the transaction's
 * connection, so RLS sees the caller's org. Use this anywhere the per-query extension can't
 * transparently wrap a single model op:
 *   - `db.$transaction(async tx => ...)`  ->  `withTenant(async tx => ...)`
 *   - raw `db.$queryRaw` / `db.$executeRaw`  ->  `withTenant(tx => tx.$queryRaw`...``)`
 * INSIDE `fn`, always use the provided `tx` (not `db`) so ops run on the GUC-set connection.
 * When RLS is disabled this is a thin pass-through transaction (no behavior change).
 */
export function withTenant<T>(
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
  options?: { maxWait?: number; timeout?: number },
): Promise<T> {
  return base.$transaction(async (tx) => {
    if (RLS_ENABLED) {
      const { org, user } = tenantGucValues();
      await tx.$executeRaw`SELECT set_config('app.current_org', ${org}, true), set_config('app.current_user', ${user}, true)`;
    }
    return fn(tx);
  }, options);
}

const createClient = (): PrismaClient => {
  if (!RLS_ENABLED) return base;
  // Per-query: wrap each model operation in a transaction that first stamps the tenant GUCs,
  // on the SAME connection as the query (array-form $transaction guarantees one connection).
  const extended = base.$extends({
    query: {
      $allModels: {
        async $allOperations({ args, query }) {
          const ctx = getRlsContext();
          // No tenant context (login, global reads, boot): run as-is. Org-scoped tables fail
          // closed at the DB; auth/global tables are permissive for app_user.
          if (!ctx) return query(args);
          const [, result] = await base.$transaction([
            base.$executeRaw`SELECT set_config('app.current_org', ${ctx.organizationId ?? ""}, true), set_config('app.current_user', ${ctx.userId ?? ""}, true)`,
            query(args) as Prisma.PrismaPromise<unknown>,
          ]);
          return result;
        },
      },
    },
  });
  // The extended client is structurally a superset of PrismaClient for the operations the app
  // uses; cast so the rest of the codebase keeps a plain PrismaClient type.
  return extended as unknown as PrismaClient;
};

const globalForClient = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db = globalForClient.prisma ?? createClient();
if (process.env.NODE_ENV !== "production") globalForClient.prisma = db;
