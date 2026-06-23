import { db } from "@/server/db";
import { inngest } from "@/inngest/client";

// Drain a bounded batch per request so a backlog can't add unbounded latency to a chat turn.
const MAX_DRAIN_BATCH = 20;
// After this many failed re-enqueue attempts a row is left in place (skipped by the drain query) for
// manual review rather than retried forever or deleted — a safety signal is never auto-discarded.
const MAX_ATTEMPTS = 10;

/**
 * Persist a dropped safety-scan enqueue so the signal is never permanently lost (Q-12-010).
 *
 * Called from the chat route when `inngest.send("chat/message.sent")` throws. Best-effort: the caller
 * must guard this so a failure here can never break the chat response — if both Inngest AND this write
 * fail, the signal is lost and the caller logs loudly. Runs under the request's org context, so the
 * RLS WITH CHECK (account_id = app.current_org()) is satisfied by the session-derived organizationId.
 */
export async function persistPendingScan(args: {
    studentId: string;
    message: string;
    organizationId: string;
}): Promise<void> {
    await db.pendingSafetyScan.create({
        data: {
            studentId: args.studentId,
            message: args.message,
            organizationId: args.organizationId,
        },
    });
}

/**
 * Drain this org's pending safety-scans by re-enqueueing them, then deleting on success (Q-12-010).
 *
 * Called opportunistically at the start of a chat request, so it runs under the request's own org
 * context — RLS-clean, with no privileged or cross-org background read (the chosen drain strategy:
 * "drain on the org's next chat request"). Best-effort and fully self-contained: it must never throw
 * into the chat path, so the caller wraps it in try/catch and it bounds its own batch.
 *
 * Poison rows (>= MAX_ATTEMPTS failed re-enqueues) are left in place — skipped by the query, surfaced
 * in logs — rather than deleted, so a child-safety signal is never silently discarded.
 */
export async function drainPendingSafetyScans(organizationId: string): Promise<void> {
    const pending = await db.pendingSafetyScan.findMany({
        where: { organizationId, attempts: { lt: MAX_ATTEMPTS } },
        orderBy: { createdAt: "asc" },
        take: MAX_DRAIN_BATCH,
    });

    for (const row of pending) {
        try {
            await inngest.send({
                name: "chat/message.sent",
                data: { studentId: row.studentId, message: row.message, organizationId },
            });
            await db.pendingSafetyScan.delete({ where: { id: row.id } });
        } catch (err) {
            // Inngest is likely still unavailable — bump attempts and stop this round; the next chat
            // request retries. We do NOT delete the row, so the safety signal survives the outage.
            console.error(
                `[SAFETY] Failed to re-enqueue pending scan ${row.id} (attempt ${row.attempts + 1}):`,
                err,
            );
            await db.pendingSafetyScan
                .update({
                    where: { id: row.id },
                    data: { attempts: { increment: 1 }, lastAttemptAt: new Date() },
                })
                .catch(() => {});
            break;
        }
    }
}
