"use server";

import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { getCurrentUserOrg } from "@/lib/auth-helpers";
import { withTenant } from "@/server/db";
import { setActiveProfile, clearActiveProfile } from "@/server/profiles/active-profile";
import { checkPinRateLimit, recordPinFailure, clearPinAttempts } from "@/server/profiles/pin-rate-limit";

export type SelectProfileResult = { ok: false; error: string };

/**
 * Select a profile and start its session. For PIN-protected profiles, verifies the PIN (bcrypt,
 * rate-limited) before setting the cookie. On success this REDIRECTS to "/" and never returns;
 * only failures return a result the client can show.
 */
export async function selectProfile(profileId: string, pin?: string): Promise<SelectProfileResult> {
  const { organizationId, userId } = await getCurrentUserOrg();
  if (!organizationId) return { ok: false, error: "No organization." };

  // pinHash is read here (server-only) for verification — it is never returned to the client.
  const profile = await withTenant(
    (tx) =>
      tx.profile.findUnique({
        where: { id: profileId },
        select: { id: true, organizationId: true, type: true, pinHash: true },
      }),
    undefined,
    { organizationId, userId: null },
  );

  if (!profile || profile.organizationId !== organizationId) {
    return { ok: false, error: "Profile not found." };
  }

  if (profile.pinHash) {
    const key = `${userId}:${profile.id}`;
    const gate = checkPinRateLimit(key, Date.now());
    if (!gate.allowed) {
      return { ok: false, error: `Too many attempts. Try again in ${Math.ceil(gate.retryAfterMs / 1000)}s.` };
    }
    const ok = pin ? await bcrypt.compare(pin, profile.pinHash) : false;
    if (!ok) {
      recordPinFailure(key, Date.now());
      return { ok: false, error: "Incorrect PIN." };
    }
    clearPinAttempts(key);
  }

  await setActiveProfile({ profileId: profile.id, type: profile.type });
  redirect("/");
}

/** Clear the active profile and return to the picker ("Switch Profile"). */
export async function switchProfile(): Promise<void> {
  await clearActiveProfile();
  redirect("/select-profile");
}
