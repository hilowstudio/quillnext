import { auth } from "@/auth";
import type { Session } from "next-auth";
import { db } from "@/server/db";
import { setRlsContext } from "@/server/rls-context";

/**
 * Get current user's organization ID
 * Throws if user is not authenticated
 */
// Allow passing session to avoid re-fetching
export async function getCurrentUserOrg(existingSession?: Session | null) {
  const session = existingSession || await auth();

  if (!session?.user?.id) {
    console.error("getCurrentUserOrg: No user ID in session", session);
    throw new Error("User not authenticated");
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, organizationId: true },
  });

  if (!user) {
    throw new Error("User not found");
  }

  // Establish the RLS tenant context for the rest of this request, so every subsequent query
  // is automatically scoped to this org/user when RLS is enabled (see src/server/db.ts).
  setRlsContext({ organizationId: user.organizationId, userId: user.id });

  return {
    userId: user.id,
    organizationId: user.organizationId,
  };
}

