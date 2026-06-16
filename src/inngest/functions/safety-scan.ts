import { inngest } from "@/inngest/client";
import { assessMessageSafety } from "@/lib/safety/guard";
import { decideSafetyResolution } from "@/lib/safety/policy";
import { db } from "@/server/db";
import { sendSafetyAlert } from "@/lib/notifications/safety-alert";
import { SafetyResolution } from "@/lib/safety/types";

export const scanMessage = inngest.createFunction(
    { id: "scan-chat-message" },
    { event: "chat/message.sent" },
    async ({ event }) => {
        const { message, studentId } = event.data;

        if (!message || typeof message !== 'string' || message.trim().length === 0) {
            return { skipped: true };
        }

        // 1. DETECT
        const result = await assessMessageSafety(message);

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
            !result.implicatedCaregiver &&
            result.disclosureRisk !== "HIGH"
        ) {

            // Check last 10 days
            const tenDaysAgo = new Date();
            tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);

            const recentFlags = await db.safetyFlag.findMany({
                where: {
                    studentId: studentId,
                    createdAt: { gte: tenDaysAgo }
                },
                orderBy: { createdAt: 'desc' },
                select: { category: true, reasoning: true }
            });

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

            // 4. STORE
            const flag = await db.safetyFlag.create({
                data: {
                    studentId,
                    severity: result.severity,
                    category: result.category,
                    // DATA MINIMIZATION: Store snippet only
                    message: message.substring(0, 100) + (message.length > 100 ? "..." : ""),
                    // Store evidence level in reasoning for future pattern matching
                    reasoning: `[EVIDENCE:${result.evidenceLevel}] ${result.reasoning}`,
                    implicatedCaregiver: result.implicatedCaregiver,
                    resolution: resolution
                }
            });

            // 5. ACT (Gated by Policy)
            if (resolution === "PARENT_SUMMARY_SAFETY_COACH" || resolution === "PARENT_SUMMARY_URGENT") {
                const alert = await sendSafetyAlert(flag.id);
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
