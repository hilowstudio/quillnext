import { NextResponse } from "next/server";
import { db } from "@/server/db";

export const dynamic = "force-dynamic";

/**
 * TEMPORARY diagnostic: which DATABASE does THIS runtime actually talk to?
 *
 * Hit this on the production domain AND on the URL Inngest has registered for the app
 * (Inngest dashboard -> Apps -> the app's URL host). If `db.projectRef` /
 * `runtime.current_database` / `tablesVisible` differ between the two, the web app and the
 * Inngest worker are pointed at different databases (e.g. a Vercel Preview env with its own
 * DATABASE_URL) — which is why the worker reports `book_extractions does not exist` while the
 * web app sees it. Remove this route once the env mismatch is resolved.
 */
export async function GET() {
  const safe = async <T,>(fn: () => Promise<T>): Promise<T | string> => {
    try {
      return await fn();
    } catch (e) {
      return `err: ${e instanceof Error ? e.message : String(e)}`;
    }
  };

  // Parse DATABASE_URL WITHOUT exposing the password — just the host + Supabase project ref.
  let dbUrlInfo: Record<string, string | null> = { parseError: "no DATABASE_URL" };
  try {
    const u = new URL(process.env.DATABASE_URL ?? "");
    const userParts = decodeURIComponent(u.username).split(".");
    dbUrlInfo = {
      host: u.hostname,
      port: u.port || null,
      database: u.pathname.replace(/^\//, "") || null,
      userRole: userParts[0] ?? null, // app_user | postgres
      projectRef: userParts[1] ?? null, // the Supabase project ref, e.g. liflosyuonigkiyhwsny
    };
  } catch (e) {
    dbUrlInfo = { parseError: e instanceof Error ? e.message : String(e) };
  }

  const runtime = await safe(async () => {
    const r = await db.$queryRaw<
      { db: string; usr: string; ip: string | null }[]
    >`SELECT current_database() AS db, current_user AS usr, host(inet_server_addr())::text AS ip`;
    return r[0] ?? null;
  });

  // Do the newly-migrated tables exist for THIS runtime's connection?
  const tablesVisible = {
    book_extractions: await safe(() => db.bookExtraction.count()),
    video_extractions: await safe(() => db.videoExtraction.count()),
  };

  return NextResponse.json(
    {
      env: {
        VERCEL_ENV: process.env.VERCEL_ENV ?? null,
        commit: (process.env.VERCEL_GIT_COMMIT_SHA ?? "").slice(0, 7) || null,
        RLS_ENABLED: process.env.RLS_ENABLED ?? null,
      },
      databaseUrl: dbUrlInfo, // host + projectRef (password never included)
      runtime, // current_database / current_user / server ip as seen by this runtime
      tablesVisible, // counts, or an "err: ..." string if the table isn't visible here
      timestamp: new Date().toISOString(),
    },
    { status: 200 },
  );
}
