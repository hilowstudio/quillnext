
import { NextResponse } from "next/server";
import { db, withTenant } from "@/server/db";

export const dynamic = "force-dynamic";

export async function GET() {
    // --- TEMPORARY RLS cutover diagnostics (remove after cutover) ---
    const TEST_ORG = "ce2ba60e-011a-4fa5-a444-7e6970944aa1";
    const safe = async <T,>(fn: () => Promise<T>): Promise<T | string> => {
        try { return await fn(); } catch (e) { return `err: ${e instanceof Error ? e.message : String(e)}`; }
    };

    const start = performance.now();
    const ping = await safe(() => db.$queryRaw`SELECT 1`);
    const duration = performance.now() - start;

    const connectedRole = await safe(async () => {
        const r = await db.$queryRaw<{ u: string }[]>`SELECT current_user AS u`;
        return r[0]?.u ?? null;
    });
    // Expect 1 if withTenant correctly stamps the tenant GUC on the tx connection.
    const withTenantStudentCount = await safe(() =>
        withTenant((tx) => tx.student.count(), undefined, { organizationId: TEST_ORG, userId: null }),
    );
    // Expect 0 under app_user with no context (RLS fail-closed); 1+ means RLS isn't active.
    const plainStudentCount = await safe(() => db.student.count());

    return NextResponse.json(
        {
            status: typeof ping === "string" ? "unhealthy" : duration > 1000 ? "degraded" : "healthy",
            latency_ms: Math.round(duration),
            rls: {
                RLS_ENABLED_raw: process.env.RLS_ENABLED ?? null,
                RLS_ENABLED: process.env.RLS_ENABLED === "true",
                connectedRole,
                withTenantStudentCount, // -> 1 means withTenant + GUC works
                plainStudentCount,      // -> 0 means RLS is enforcing on app_user
            },
            timestamp: new Date().toISOString(),
        },
        { status: 200 },
    );
}
