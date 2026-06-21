"use server";

import { headers } from "next/headers";
import { Resend } from "resend";
import { auth } from "@/auth";
import { getCurrentUserOrg } from "@/lib/auth-helpers";
import { withTenant } from "@/server/db";
import { verifyPinWithThrottle } from "@/server/profiles/pin-verify";
import { signPinResetToken, verifyPinResetToken } from "@/lib/profile-pin-reset-token";

export type PinResetResult = { ok: true } | { ok: false; error: string };

function authSecret(): string {
  const s = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET (or NEXTAUTH_SECRET) is not set");
  return s;
}

/** Build the app origin from the incoming request headers (works on Vercel + locally, no env needed). */
async function requestOrigin(): Promise<string | null> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host) return null;
  const proto = h.get("x-forwarded-proto") ?? (process.env.NODE_ENV === "production" ? "https" : "http");
  return `${proto}://${host}`;
}

const esc = (s: string) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * Email the org OWNER a single-use link to clear the owner PARENT profile's PIN. This is the only
 * in-app recovery for a forgotten owner PIN — every other PIN mutation requires already being IN the
 * PARENT profile, which the PIN itself gates (Q-05-010). In the shared-family-login model the
 * authenticated session alone cannot prove "owner, not student", so the out-of-band factor is the
 * owner's own inbox: the link is sent to the session user's verified email and is bound to that
 * login + org + the owner profile.
 *
 * Returns ok even when there is nothing to send (no owner profile / no PIN set) so profile state is
 * not leaked; returns ok:false only on a genuine config/send failure so the picker can surface it.
 */
export async function requestOwnerPinReset(): Promise<PinResetResult> {
  const session = await auth();
  const email = session?.user?.email;
  if (!session?.user?.id || !email) return { ok: false, error: "You must be signed in." };

  const { organizationId } = await getCurrentUserOrg(session);
  if (!organizationId) return { ok: false, error: "No organization." };

  const owner = await withTenant(
    (tx) =>
      tx.profile.findFirst({
        where: { organizationId, type: "PARENT", isOwner: true },
        select: { id: true, pinHash: true },
      }),
    undefined,
    { organizationId, userId: null },
  );
  // Nothing to reset (no owner profile, or it has no PIN) — report success without sending.
  if (!owner || !owner.pinHash) return { ok: true };

  const origin = await requestOrigin();
  if (!origin) return { ok: false, error: "Could not build the reset link. Try again." };

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("[PIN RESET NOT SENT] RESEND_API_KEY not configured. Owner PIN reset was not emailed.");
    return { ok: false, error: "Email is not configured. Please contact support." };
  }
  const from = process.env.ACCOUNT_EMAIL_FROM || "Quill & Compass <onboarding@resend.dev>";

  const token = await signPinResetToken(
    { uid: session.user.id, org: organizationId, profileId: owner.id },
    authSecret(),
    Date.now(),
  );
  const link = `${origin}/select-profile/reset-pin?token=${encodeURIComponent(token)}`;

  const subject = "Reset your Quill & Compass parent PIN";
  const text =
    `You asked to reset your parent profile PIN.\n\n` +
    `Open this link to clear it (valid for 15 minutes), then set a new PIN from Manage Profiles:\n${link}\n\n` +
    `If you didn't request this, you can ignore this email — your PIN is unchanged.`;
  const html = `
<div style="font-family: -apple-system, Segoe UI, sans-serif; max-width: 520px; color:#1f2937;">
  <h2 style="color:#1f2937; margin-bottom:4px;">Reset your parent PIN</h2>
  <p>You asked to reset your Quill &amp; Compass parent profile PIN.</p>
  <p style="margin:20px 0;">
    <a href="${esc(link)}" style="background:#3f6f5b; color:#fff; padding:10px 18px; border-radius:8px; text-decoration:none; display:inline-block;">Clear my parent PIN</a>
  </p>
  <p style="color:#6b7280; font-size:13px;">This link is valid for 15 minutes. Afterward, set a new PIN from Manage Profiles.</p>
  <p style="color:#6b7280; font-size:13px;">If you didn't request this, you can ignore this email — your PIN is unchanged.</p>
</div>`.trim();

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({ from, to: email, subject, text, html });
    if (error) {
      console.error("[PIN RESET FAILED] Resend error:", error);
      return { ok: false, error: "Could not send the reset email. Try again." };
    }
    return { ok: true };
  } catch (e) {
    console.error("[PIN RESET FAILED] Exception while sending owner PIN reset:", e);
    return { ok: false, error: "Could not send the reset email. Try again." };
  }
}

/**
 * Consume a PIN-reset token and clear the owner PARENT profile's PIN + throttle counters (so the
 * owner can set a new PIN immediately). Requires the SAME login + org the token was issued to, on
 * top of the signature + 15-min expiry, and only ever clears the org's owner PARENT profile.
 */
export async function confirmOwnerPinReset(token: string): Promise<PinResetResult> {
  const { userId, organizationId } = await getCurrentUserOrg();
  if (!organizationId) return { ok: false, error: "No organization." };

  const claims = await verifyPinResetToken(token, authSecret(), Date.now());
  if (!claims || claims.uid !== userId || claims.org !== organizationId) {
    return { ok: false, error: "This reset link is invalid or has expired." };
  }

  const owner = await withTenant(
    (tx) =>
      tx.profile.findFirst({
        where: { id: claims.profileId, organizationId, type: "PARENT", isOwner: true },
        select: { id: true },
      }),
    undefined,
    { organizationId, userId: null },
  );
  if (!owner) return { ok: false, error: "This reset link is invalid or has expired." };

  await withTenant(
    (tx) =>
      tx.profile.update({
        where: { id: owner.id },
        data: { pinHash: null, pinFailedCount: 0, pinWindowStart: null },
      }),
    undefined,
    { organizationId, userId: null },
  );
  return { ok: true };
}

/**
 * Reset (clear) a CHILD (STUDENT) profile's PIN from the picker, authorized by the PARENT PIN. This is
 * the recovery for a locked-out child: the parent is the authority above the child, so no email is
 * needed — the gate is the org's owner PARENT PIN, verified through the shared rate-limited
 * `verifyPinWithThrottle` (so a wrong parent PIN throttles on the owner's counters, and an
 * owner with no PIN passes through, mirroring the picker's other parent-gated entry points). No active
 * profile is set; on success the child can select their now-PIN-less profile. Only STUDENT profiles can
 * be reset this way — a parent's own PIN uses the email flow (`requestOwnerPinReset`) / Manage Profiles.
 */
export async function resetChildPinWithParentPin(
  childProfileId: string,
  parentPin?: string,
): Promise<PinResetResult> {
  const { organizationId } = await getCurrentUserOrg();
  if (!organizationId) return { ok: false, error: "No organization." };

  const owner = await withTenant(
    (tx) =>
      tx.profile.findFirst({
        where: { organizationId, type: "PARENT", isOwner: true },
        select: { id: true, pinHash: true },
      }),
    undefined,
    { organizationId, userId: null },
  );
  if (!owner) return { ok: false, error: "No owner profile." };

  const verified = await verifyPinWithThrottle(owner.id, organizationId, owner.pinHash, parentPin);
  if (!verified.ok) return verified;

  // Target must be an in-org STUDENT — never reset a PARENT this way.
  const child = await withTenant(
    (tx) =>
      tx.profile.findFirst({
        where: { id: childProfileId, organizationId, type: "STUDENT" },
        select: { id: true },
      }),
    undefined,
    { organizationId, userId: null },
  );
  if (!child) return { ok: false, error: "Profile not found." };

  await withTenant(
    (tx) =>
      tx.profile.update({
        where: { id: child.id },
        data: { pinHash: null, pinFailedCount: 0, pinWindowStart: null },
      }),
    undefined,
    { organizationId, userId: null },
  );
  return { ok: true };
}
