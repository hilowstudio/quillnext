"use server";

import { auth } from "@/auth";
import { SafetyRegexEngine } from "@/lib/safety/guard";
import type { SafetyAssessment } from "@/lib/safety/types";

export interface SafetyPrecheckResult {
    concern: boolean;
    category?: SafetyAssessment["category"];
}

/**
 * Synchronous, in-the-moment safety pre-check for the chat UI (Q-12-007). Runs the pure regex fast-path
 * on the student's latest message and returns ONLY whether a concern was detected + its category — never
 * the patterns, the message, or any stored data — so the client can surface the verified crisis-resources
 * affordance immediately, in parallel with the streamed reply and independent of the async flag pipeline
 * (route.ts). It notifies no one and reads no DB. Best-effort and fail-closed-to-quiet: on any error or
 * unauthenticated/blank input it returns `{ concern: false }` and never throws into the chat path.
 *
 * NOTE: this only drives the child-facing HELP affordance. The authoritative detection + caregiver
 * notification still run server-side in the async safety-scan job — this pre-check never gates either.
 */
export async function precheckMessageSafety(message: string): Promise<SafetyPrecheckResult> {
    try {
        const session = await auth();
        if (!session?.user || typeof message !== "string" || message.trim().length === 0) {
            return { concern: false };
        }
        const hit = SafetyRegexEngine.scan(message);
        return hit ? { concern: true, category: hit.category } : { concern: false };
    } catch {
        return { concern: false };
    }
}
