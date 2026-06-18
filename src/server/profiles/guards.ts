import "server-only";
import { getActiveProfile } from "./active-profile";

/**
 * Server-side defense-in-depth: require that the CURRENT active profile is PARENT.
 * Throws otherwise (no/STUDENT profile). Call at the very top of destructive/admin actions —
 * before any DB work — so a STUDENT session can't invoke them by calling the action directly,
 * even though the proxy already gates page navigation.
 */
export async function assertParentProfile(): Promise<void> {
  const active = await getActiveProfile();
  if (active?.type !== "PARENT") {
    throw new Error("This action requires a parent profile.");
  }
}
