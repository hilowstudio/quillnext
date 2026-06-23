import { PrismaClient, Prisma } from "@/generated/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { getRlsContext, setRlsContext, type RlsContext } from "./rls-context";

// When true, the app connects as the non-bypass `app_user` role and the data layer stamps
// the per-request tenant GUCs that the RLS policies read. OFF by default so the DB-side RLS
// (migration 00000000000002_rls_policies) stays inert until a verified cutover.
// Case/whitespace-insensitive so "TRUE"/"True"/"1" in the env also enable it.
const RLS_ENABLED = ["true", "1", "yes", "on"].includes(
  (process.env.RLS_ENABLED ?? "").trim().toLowerCase(),
);

// Connection-string resolution — shared by the adapter AND the startup diagnostic so they can
// never disagree. Accepts BOTH our manual name (DATABASE_URL) and the POOLED names the
// Vercel↔Supabase integration injects (POSTGRES_URL / POSTGRES_PRISMA_URL) — same database,
// different variable names. First non-empty wins; set DATABASE_URL to override the integration.
const DB_CONNECTION: { source: string; url: string | undefined } = (() => {
  if (process.env.DATABASE_URL) return { source: "DATABASE_URL", url: process.env.DATABASE_URL };
  if (process.env.POSTGRES_URL) return { source: "POSTGRES_URL", url: process.env.POSTGRES_URL };
  if (process.env.POSTGRES_PRISMA_URL) return { source: "POSTGRES_PRISMA_URL", url: process.env.POSTGRES_PRISMA_URL };
  return { source: "NONE", url: undefined };
})();

// Supabase's pooler/direct certs are signed by a Supabase CA that isn't in Node's trust store, so
// SSL cert verification must stay OFF (ssl.rejectUnauthorized=false below). A `sslmode=` param in
// the connection string (the Vercel↔Supabase integration adds `sslmode=require`) overrides that and
// re-enables verification → "Error opening a TLS connection: self-signed certificate in certificate
// chain". Strip sslmode/ssl from the URL so the ssl option is the sole authority — SSL itself stays
// ON because that option is truthy. (The old manual pooler URL worked precisely because it had no
// sslmode param.)
function withoutSslParams(url: string | undefined): string | undefined {
  if (!url) return url;
  try {
    const u = new URL(url);
    u.searchParams.delete("sslmode");
    u.searchParams.delete("ssl");
    return u.toString();
  } catch {
    return url; // not a parseable URL — leave it untouched
  }
}

const createBaseClient = () => {
  const adapter = new PrismaPg({
    connectionString: withoutSslParams(DB_CONNECTION.url),
    ssl: { rejectUnauthorized: false },
  });
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
};

const globalForPrisma = globalThis as unknown as {
  prismaBase: PrismaClient | undefined;
  dbDiagLogged: boolean | undefined;
};

// The un-extended client. `withTenant`, the per-query extension, and the tenant resolver all
// build on this so they never recurse through the extension.
const base = globalForPrisma.prismaBase ?? createBaseClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prismaBase = base;

// Parse a connection string to host/projectRef WITHOUT exposing the password.
function describeDbUrl(url: string | undefined): Record<string, string | null> {
  if (!url) return { error: "no connection string resolved (DATABASE_URL/POSTGRES_URL/POSTGRES_PRISMA_URL all empty)" };
  try {
    const u = new URL(url);
    const userParts = decodeURIComponent(u.username).split("."); // pooler username = postgres.<projectRef>
    return {
      host: u.hostname,
      port: u.port || null,
      database: u.pathname.replace(/^\//, "") || null,
      userRole: userParts[0] ?? null, // postgres | app_user
      projectRef: userParts[1] ?? null, // Supabase project ref
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

// TEMPORARY connection diagnostic — the replacement for the removed `/api/health`. Logs ONCE per
// process (grep `[db-diag]` in Vercel logs): which env var the runtime actually used, which database
// that resolves to (host/projectRef/current_database/current_user), and whether the global
// extraction tables exist there — so a wrong-DB / env-mismatch is visible without an endpoint.
// Fire-and-forget; never throws. REMOVE once the env wiring is confirmed.
async function logDbDiagnostics(client: PrismaClient): Promise<void> {
  console.log(
    `[db-diag] source=${DB_CONNECTION.source}`,
    "url:", describeDbUrl(DB_CONNECTION.url),
    `RLS_ENABLED=${process.env.RLS_ENABLED ?? "null"}`,
    `VERCEL_ENV=${process.env.VERCEL_ENV ?? "null"}`,
    `commit=${(process.env.VERCEL_GIT_COMMIT_SHA ?? "").slice(0, 7) || "null"}`,
  );
  try {
    const r = await client.$queryRaw<
      { db: string; usr: string; ip: string | null }[]
    >`SELECT current_database() AS db, current_user AS usr, host(inet_server_addr())::text AS ip`;
    console.log("[db-diag] runtime:", r[0] ?? null);
  } catch (e) {
    console.error("[db-diag] runtime query failed:", e instanceof Error ? e.message : String(e));
  }
  const count = async (fn: () => Promise<number>) => {
    try { return await fn(); } catch (e) { return `ERR: ${e instanceof Error ? e.message : String(e)}`; }
  };
  console.log("[db-diag] tablesVisible:", {
    book_extractions: await count(() => client.bookExtraction.count()),
    video_extractions: await count(() => client.videoExtraction.count()),
  });
}

if (!globalForPrisma.dbDiagLogged) {
  globalForPrisma.dbDiagLogged = true;
  void logDbDiagnostics(base);
}

// Models whose RLS policies don't depend on the tenant GUC: auth tables (permissive — and
// NextAuth's adapter writes them during sign-in, before any session exists) and global
// reference data (read-only for app_user). Skipping them avoids both needless work and
// recursion (resolving a tenant calls auth(), which uses the adapter during sign-in).
const CONTEXT_FREE_MODELS = new Set([
  "User", "Account", "Session", "VerificationToken",
  "Subject", "Strand", "Topic", "Subtopic", "Objective", "GradeBand", "ResourceKind",
  "Catechism", "CatechismQuestion", "CommentaryChapter", "CommentarySection",
  "Devotional", "County", "PrayerCategory",
  // Global cross-org shared book-extraction catalog: readable by all orgs (USING true) and
  // written by the producer as app_user — must skip the per-request org GUC like other globals.
  "BookExtraction",
  // Global cross-org shared video-extraction catalog + transcript chunks (same pattern).
  "VideoExtraction", "VideoExtractionChunk",
  // Global cross-org shared book section facts sheets + spine cross-walk + gap backlog.
  "BookExtractionSection", "BookSectionObjective", "SpineGap",
  // Global cross-org shared full-text chunks (public-domain books, pgvector RAG).
  "BookTextChunk",
  // Global cross-org shared open-textbook corpus (subject-keyed RAG grounding).
  "TextbookDocument", "TextbookChunk",
  // Global cross-org shared textbook↔spine-Topic coverage cross-walk.
  "TextbookTopicCoverage",
]);

/**
 * Resolve the tenant context for the current request. If `getCurrentUserOrg()` already
 * established it on this async frame, use that. Otherwise (the common React Server Components
 * case — `getCurrentUserOrg`'s `enterWith` runs in its own frame and does NOT propagate back to
 * the page's subsequent queries) fall back to reading the session for the user id and looking up
 * the CURRENT org from the DB. The DB lookup (not the login-time JWT) is what makes this correct
 * immediately after onboarding. The result is memoized on this frame. Returns null when there's
 * no session (login / background boot) → org-scoped tables fail closed.
 */
async function resolveTenant(): Promise<RlsContext | null> {
  const existing = getRlsContext();
  if (existing) return existing;
  try {
    const { auth } = await import("@/auth");
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) return null;
    const user = await base.user.findUnique({
      where: { id: userId },
      select: { organizationId: true },
    });
    const ctx: RlsContext = { organizationId: user?.organizationId ?? null, userId };
    setRlsContext(ctx);
    return ctx;
  } catch {
    // Not in a request scope (e.g. boot) — fail closed rather than throw.
    return null;
  }
}

function setConfigRaw(tx: Pick<PrismaClient, "$executeRaw">, ctx: RlsContext | null) {
  return tx.$executeRaw`SELECT set_config('app.current_org', ${ctx?.organizationId ?? ""}, true), set_config('app.current_user', ${ctx?.userId ?? ""}, true)`;
}

/**
 * Run interactive-transaction or raw work with the tenant GUCs set on the transaction's
 * connection. Use this where the per-query extension can't transparently wrap a single op:
 *   - `db.$transaction(async tx => ...)`  ->  `withTenant(async tx => ...)`
 *   - raw `db.$queryRaw` / `db.$executeRaw`  ->  `withTenant(tx => tx.$queryRaw`...``)`
 * Inside `fn`, always use the provided `tx`. A no-op pass-through transaction when RLS is off.
 */
export async function withTenant<T>(
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
  options?: { maxWait?: number; timeout?: number },
  ctxOverride?: RlsContext | null,
): Promise<T> {
  // Prefer an EXPLICITLY passed context (org threaded as a plain argument) — this is the only
  // reliable path in the Next runtime, which does not propagate AsyncLocalStorage/the request
  // into the Prisma query layer. Falls back to resolving from session only when not provided.
  const ctx = ctxOverride !== undefined ? ctxOverride : (RLS_ENABLED ? await resolveTenant() : null);
  return base.$transaction(async (tx) => {
    if (RLS_ENABLED) await setConfigRaw(tx, ctx);
    return fn(tx);
  }, options);
}

const createClient = (): PrismaClient => {
  if (!RLS_ENABLED) return base;
  const extended = base.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, args, query }) {
          if (model && CONTEXT_FREE_MODELS.has(model)) return query(args);
          const ctx = await resolveTenant();
          if (!ctx) return query(args); // no session → org tables fail closed
          const [, result] = await base.$transaction([
            setConfigRaw(base, ctx),
            query(args) as Prisma.PrismaPromise<unknown>,
          ]);
          return result;
        },
      },
    },
  });
  return extended as unknown as PrismaClient;
};

const globalForClient = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db = globalForClient.prisma ?? createClient();
if (process.env.NODE_ENV !== "production") globalForClient.prisma = db;
