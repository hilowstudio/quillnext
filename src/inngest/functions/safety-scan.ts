import { inngest } from "@/inngest/client";
import { assessMessageSafety } from "@/lib/safety/guard";
import { decideSafetyResolution, isCaregiverHardStop } from "@/lib/safety/policy";
import { withTenant } from "@/server/db";
import { sendSafetyAlert } from "@/lib/notifications/safety-alert";
import { buildStoredFlagContent } from "@/lib/safety/flag-storage";
import { setRlsContext } from "@/server/rls-context";

export const scanMessage = inngest.createFunction(
    { id: "scan-chat-message" },
    { event: "chat/message.sent" },
    async ({ event }) => {
        const { message, studentId, organizationId, conversationContext } = event.data;
        // Background worker has no request — establish RLS tenant context from the event.
        setRlsContext({ organizationId, userId: null });

        if (!message || typeof message !== 'string' || message.trim().length === 0) {
            return { skipped: true };
        }

        // 1. DETECT — pass recent conversation context so multi-turn patterns are visible (Q-12-011).
        const result = await assessMessageSafety(message, conversationContext);

        // 2. DECIDE (Policy Layer - Initial)
        let resolution = decideSafetyResolution(result);

        // 3. PATTERN SCALAR (Escalation Logic)
        // HARD STOP (Minimum Social Responsibility): NEVER escalate toward caregiver notification
        // when the caregiver is implicated OR the child fears disclosure. STUDENT_OPTIONAL_OUTREACH
        // is itself a hard-stop output of decideSafetyResolution; without the two extra guards below
        // it could be upgraded to a PARENT_SUMMARY_* and emailed to the very caregiver the child fears.
        if (
            !result.isSafe &&
            resolution !== "INTERNAL_LOG_ONLY" &&
            resolution !== "SUPPORTIVE_ONLY" &&
            !isCaregiverHardStop(result)
        ) {

            // Check last 10 days
            const tenDaysAgo = new Date();
            tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);

            const recentFlags = await withTenant(
                (tx) => tx.safetyFlag.findMany({
                    where: {
                        studentId: studentId,
                        createdAt: { gte: tenDaysAgo }
                    },
                    orderBy: { createdAt: 'desc' },
                    select: { category: true, reasoning: true }
                }),
                undefined,
                { organizationId, userId: null },
            );

            // Rule A: Frequency (>=3 flags in same category)
            const sameCategoryCount = recentFlags.filter(f => f.category === result.category).length;

            // Rule B: Evidence Escalation (Thought -> Action/Plan)
            // Parse evidence level from stored reasoning string "[EVIDENCE:LEVEL] ..."
            const hasEscalated = recentFlags.some(f => {
                const match = f.reasoning.match(/\[EVIDENCE:(.*?)\]/);
                const prevLevel = match ? match[1] : "UNKNOWN";
                return (prevLevel === "THOUGHT") &&
                    (["PLAN", "ACTION", "INTENT"].includes(result.evidenceLevel));
            });

            if (sameCategoryCount >= 2 || hasEscalated) { // >=2 previous + current = 3
                console.log(`[SAFETY] Pattern Escalation Triggered for ${studentId}`);

                // Upgrade Logic
                if (resolution === "STUDENT_OPTIONAL_OUTREACH") {
                    resolution = "PARENT_SUMMARY_SAFETY_COACH";
                } else if (resolution === "PARENT_SUMMARY_SAFETY_COACH") {
                    resolution = "PARENT_SUMMARY_URGENT";
                }
            }
        }

        if (!result.isSafe) {
            console.warn(`[SAFETY] Unsafe message detected for student ${studentId}:`, result);

            // 4. STORE. Data-minimize the persisted content for caregiver hard-stop flags (Q-12-009):
            // SafetyFlag is org-readable, so a child's disclosure naming/ fearing a caregiver is redacted
            // before storage. The [EVIDENCE:LEVEL] tag is preserved for future pattern escalation.
            const stored = buildStoredFlagContent(message, result);
            const flag = await withTenant(
                (tx) => tx.safetyFlag.create({
                    data: {
                        studentId,
                        severity: result.severity,
                        category: result.category,
                        message: stored.message,
                        reasoning: stored.reasoning,
                        implicatedCaregiver: result.implicatedCaregiver,
                        resolution: resolution
                    }
                }),
                undefined,
                { organizationId, userId: null },
            );

            // 5. ACT (Gated by Policy)
            if (resolution === "PARENT_SUMMARY_SAFETY_COACH" || resolution === "PARENT_SUMMARY_URGENT") {
                const alert = await sendSafetyAlert(flag.id, organizationId);
                if (!alert.sent) {
                    console.error(`[SAFETY] Alert delivery FAILED for flag ${flag.id}: ${alert.error}`);
                }
            } else {
                console.log(`[SAFETY] Resolution '${resolution}' applied. Notification SUPPRESSED.`);
            }
        }

        return { isSafe: result.isSafe, result, resolution };
    }
);
