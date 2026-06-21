import { withTenant } from "@/server/db";
import { Resend } from "resend";

const esc = (s: string) =>
    String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export interface SafetyAlertResult {
    sent: boolean;
    error?: string;
    recipients?: string[];
}

/**
 * Delivery-layer defense-in-depth for the caregiver hard-stop (T1-E). A caregiver email may be
 * sent ONLY for an explicit parent-summary resolution AND only when the caregiver is not the
 * implicated threat — so a caller bug (wrong resolution, or a hard-stop flag) can never email an
 * implicated caregiver, independent of the policy gate. Mirrors `isCaregiverHardStop` (policy.ts)
 * at the boundary.
 *
 * NOTE: `SafetyFlag` persists `implicatedCaregiver` but NOT `disclosureRisk`, so the
 * fear-of-disclosure axis of the hard-stop cannot be re-checked here. That residual is covered by
 * the child-safety hardening roadmap (alert-summary / storage hardening) — see ch.12 §7 / ch.24.
 */
export function isAlertDeliverable(flag: { resolution: string | null; implicatedCaregiver: boolean }): boolean {
    if (flag.implicatedCaregiver) return false;
    return flag.resolution === "PARENT_SUMMARY_URGENT" || flag.resolution === "PARENT_SUMMARY_SAFETY_COACH";
}

/**
 * Delivers a child-safety summary to the responsible caregivers via Resend.
 *
 * Safety invariant: `safetyFlag.alertSent` is set to true ONLY after a provider
 * confirms delivery. If the provider is unconfigured, there are no caregiver
 * recipients, or the send fails, we log LOUDLY and leave alertSent=false — we
 * must never claim an abuse/self-harm alert was delivered when it was not.
 *
 * Required env: RESEND_API_KEY, SAFETY_ALERT_FROM (a Resend-verified sender,
 * e.g. "Quill & Compass Safety <safety@quillandcompass.com>").
 */
export async function sendSafetyAlert(flagId: string, organizationId: string): Promise<SafetyAlertResult> {
    // Org-scoped read on the trusted-job path: the explicit `student.organizationId` predicate
    // is the live boundary today (RLS off; SafetyFlag has no org column of its own — it scopes
    // through the student relation, mirroring the RLS policy `student_id IN (… account_id = org)`),
    // and the explicit-ctx withTenant wrap is the reliable RLS-ready path — matching how the rest
    // of the safety job stamps the tenant (safety-scan.ts).
    const flag = await withTenant(
        (tx) =>
            tx.safetyFlag.findFirst({
                where: { id: flagId, student: { organizationId } },
                include: {
                    student: {
                        include: {
                            organization: {
                                include: { users: true },
                            },
                        },
                    },
                },
            }),
        undefined,
        { organizationId, userId: null },
    );

    if (!flag) {
        console.error(`[SAFETY ALERT] Flag not found: ${flagId}`);
        return { sent: false, error: "Flag not found" };
    }

    // Delivery-layer hard-stop (T1-E): refuse to email unless this is an explicit parent-summary
    // resolution with no implicated caregiver. In normal operation the policy + job already
    // guarantee this; the guard exists so a caller bug can never email a feared/implicated
    // caregiver. Log loudly and leave alertSent=false.
    if (!isAlertDeliverable(flag)) {
        console.error(
            `[SAFETY ALERT BLOCKED] Refusing to send for flag ${flagId} ` +
            `(student ${flag.studentId}): resolution=${flag.resolution}, ` +
            `implicatedCaregiver=${flag.implicatedCaregiver}. A caregiver alert must be a ` +
            `PARENT_SUMMARY_* resolution with no implicated caregiver (delivery-layer hard-stop, T1-E).`,
        );
        return { sent: false, error: "Alert not deliverable (delivery-layer hard-stop)" };
    }

    // Responsible adults in the student's organization.
    const recipients = flag.student.organization.users
        .filter((u) => u.email && (u.role === "OWNER" || u.role === "PARENT" || u.role === "ADMIN"))
        .map((u) => u.email as string);

    const studentName = `${flag.student.firstName} ${flag.student.lastName || ""}`.trim();
    // Strip the internal "[EVIDENCE:LEVEL]" prefix used for pattern matching.
    const reasoning = flag.reasoning.replace(/^\[EVIDENCE:[^\]]*\]\s*/, "");

    let guidanceText = "";
    let guidanceHtml = "";
    if (flag.resolution === "PARENT_SUMMARY_SAFETY_COACH") {
        guidanceText =
            "\nGUIDANCE FOR CAREGIVERS:\n" +
            "Please respond calmly, avoid shame or physical punishment.\n" +
            "Increase supervision and privacy boundaries for all children.\n" +
            "Consider consulting a pediatrician or child therapist.";
        guidanceHtml =
            `<p><strong>Guidance for caregivers:</strong><br/>` +
            `Please respond calmly, avoid shame or physical punishment. ` +
            `Increase supervision and privacy boundaries for all children. ` +
            `Consider consulting a pediatrician or child therapist.</p>`;
    } else if (flag.resolution === "PARENT_SUMMARY_URGENT") {
        guidanceText =
            "\nURGENT GUIDANCE:\n" +
            "If you believe there is immediate danger, contact local emergency services.\n" +
            "Respond calmly and seek professional help immediately.";
        guidanceHtml =
            `<p style="color:#b91c1c;"><strong>Urgent guidance:</strong><br/>` +
            `If you believe there is immediate danger, contact local emergency services. ` +
            `Respond calmly and seek professional help immediately.</p>`;
    }

    const subject = `[SAFETY SUMMARY] Concern detected for ${flag.student.firstName}`;

    const text = `
SAFETY SUMMARY
----------------------
Student: ${studentName}
Category: ${flag.category}
Severity: ${flag.severity}

Our system detected a safety signal during a learning session.
We are sharing this summary so you can check in with the student.

AI Context:
${reasoning}
${guidanceText}

(Note: Specific message content is excluded to protect student privacy and prevent escalation).
    `.trim();

    const html = `
<div style="font-family: -apple-system, Segoe UI, sans-serif; max-width: 560px; color:#1f2937;">
  <h2 style="color:#b91c1c; margin-bottom:4px;">Safety Summary</h2>
  <p>Our system detected a safety signal during a learning session with <strong>${esc(studentName)}</strong>. We are sharing this summary so you can check in with the student.</p>
  <p style="margin:12px 0;">
    <strong>Category:</strong> ${esc(flag.category)}<br/>
    <strong>Severity:</strong> ${esc(flag.severity)}
  </p>
  <p><strong>AI context:</strong><br/>${esc(reasoning)}</p>
  ${guidanceHtml}
  <p style="color:#6b7280; font-size:12px; margin-top:16px;">Specific message content is excluded to protect student privacy and prevent escalation.</p>
</div>`.trim();

    // --- Fail-loud config + recipient checks (never mark sent without delivery) ---
    const apiKey = process.env.RESEND_API_KEY;
    // SAFETY_ALERT_FROM should be a Resend-verified domain sender in production. Fall back
    // to Resend's test sender (only delivers to the Resend account owner) so the API key
    // alone is enough to exercise the path in dev.
    const from = process.env.SAFETY_ALERT_FROM || "Quill & Compass Safety <onboarding@resend.dev>";
    if (!apiKey) {
        console.error(
            `[SAFETY ALERT NOT SENT] RESEND_API_KEY not configured. ` +
            `Flag ${flagId} (student ${flag.studentId}, ${flag.category}/${flag.severity}) was NOT delivered. ` +
            `Intended recipients: ${recipients.join(", ") || "(none found)"}`,
        );
        return { sent: false, error: "Email provider not configured", recipients };
    }
    if (!process.env.SAFETY_ALERT_FROM) {
        console.warn(
            "[SAFETY ALERT] SAFETY_ALERT_FROM not set — using Resend's test sender " +
            "(onboarding@resend.dev), which only delivers to the Resend account owner. " +
            "Set a verified-domain sender for production.",
        );
    }
    if (recipients.length === 0) {
        console.error(
            `[SAFETY ALERT NOT SENT] No caregiver emails (OWNER/PARENT/ADMIN) in organization for flag ${flagId} ` +
            `(student ${flag.studentId}). A safety concern was detected with no one to notify.`,
        );
        return { sent: false, error: "No caregiver recipients", recipients };
    }

    try {
        const resend = new Resend(apiKey);
        const { error } = await resend.emails.send({ from, to: recipients, subject, text, html });

        if (error) {
            console.error(`[SAFETY ALERT FAILED] Resend error for flag ${flagId}:`, error);
            return { sent: false, error: error.message || String(error), recipients };
        }

        // Only now is it true.
        await withTenant(
            (tx) => tx.safetyFlag.update({ where: { id: flagId }, data: { alertSent: true } }),
            undefined,
            { organizationId, userId: null },
        );
        return { sent: true, recipients };
    } catch (e) {
        console.error(`[SAFETY ALERT FAILED] Exception while sending flag ${flagId}:`, e);
        return { sent: false, error: e instanceof Error ? e.message : String(e), recipients };
    }
}
