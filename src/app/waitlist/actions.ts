"use server";

import { z } from "zod";
import { Resend } from "resend";

/**
 * Waitlist signup capture for the public `/waitlist` landing page.
 *
 * Design note: there is no waitlist table by design (the seeded prod DB is precious and a new model
 * means a migration). Signups are delivered to the owner's inbox via Resend — that inbox IS the list.
 * Mirrors the fail-loud posture of `src/lib/notifications/safety-alert.ts`: we NEVER report success
 * to a visitor unless a provider accepted the owner-notification email.
 */

const waitlistSchema = z.object({
    email: z.string().trim().email("Please enter a valid email address.").max(254),
    firstName: z.string().trim().max(80).optional(),
    // Honeypot: a hidden field real users never see. If a bot fills it, we pretend success and send nothing.
    company: z.string().optional(),
});

export type JoinWaitlistInput = z.infer<typeof waitlistSchema>;
export type JoinWaitlistResult = { ok: true } | { ok: false; error: string };

const MAIL_FALLBACK =
    "We couldn't reach our mail service. Please email adam@quillandcompass.app and I'll add you by hand.";

const esc = (s: string) =>
    String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export async function joinWaitlist(input: JoinWaitlistInput): Promise<JoinWaitlistResult> {
    const parsed = waitlistSchema.safeParse(input);
    if (!parsed.success) {
        return {
            ok: false,
            error: parsed.error.issues[0]?.message ?? "Please check your details and try again.",
        };
    }
    const { email, firstName, company } = parsed.data;

    // Honeypot tripped → look successful, deliver nothing.
    if (company && company.trim().length > 0) {
        return { ok: true };
    }

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
        console.error(`[WAITLIST] RESEND_API_KEY not configured. Signup NOT captured: ${email}`);
        return { ok: false, error: MAIL_FALLBACK };
    }

    const notifyTo = process.env.WAITLIST_NOTIFY_TO || "adam@quillandcompass.app";
    const from =
        process.env.WAITLIST_FROM ||
        process.env.SAFETY_ALERT_FROM ||
        "Quill & Compass <onboarding@resend.dev>";
    const name = firstName && firstName.length > 0 ? firstName : "(no name given)";

    try {
        const resend = new Resend(apiKey);

        // 1) Notify the owner. This send is the source of truth — its success is the signup's success.
        const ownerRes = await resend.emails.send({
            from,
            to: notifyTo,
            subject: "New waitlist signup",
            text: `New Quill & Compass waitlist signup.\n\nEmail: ${email}\nName: ${name}\n`,
            html:
                `<p>New Quill &amp; Compass waitlist signup.</p>` +
                `<p><strong>Email:</strong> ${esc(email)}<br/><strong>Name:</strong> ${esc(name)}</p>`,
        });
        if (ownerRes.error) {
            console.error(`[WAITLIST] Resend error notifying owner for ${email}:`, ownerRes.error);
            return { ok: false, error: MAIL_FALLBACK };
        }

        // 2) Best-effort confirmation to the subscriber. A failure here does NOT fail the signup —
        //    the owner already has the address.
        try {
            await resend.emails.send({
                from,
                to: email,
                subject: "You're on the Quill & Compass waitlist",
                text:
                    "Thanks for joining the Quill & Compass waitlist.\n\n" +
                    "I'll write once, when the 2026-27 school year opens. No spam, no selling your address, ever.\n\n" +
                    "Adam\nadam@quillandcompass.app",
                html:
                    `<p>Thanks for joining the Quill &amp; Compass waitlist.</p>` +
                    `<p>I'll write once, when the 2026-27 school year opens. No spam, no selling your address, ever.</p>` +
                    `<p>Adam<br/>adam@quillandcompass.app</p>`,
            });
        } catch (e) {
            console.warn(`[WAITLIST] Owner notified but confirmation to ${email} failed:`, e);
        }

        return { ok: true };
    } catch (e) {
        console.error(`[WAITLIST] Exception during signup for ${email}:`, e);
        return { ok: false, error: MAIL_FALLBACK };
    }
}
