import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Per-request tenant context for Row-Level Security.
 *
 * The DB enforces tenant isolation via RLS policies that read two Postgres GUCs
 * (`app.current_org`, `app.current_user`). This module carries the caller's org/user
 * for the duration of a request so the data layer (`src/server/db.ts`) can stamp those
 * GUCs onto each query's transaction. Empty/unset context = the policies fail CLOSED
 * (org-scoped tables return nothing), which is the safe default for un-authenticated /
 * pre-org code paths (login, global reference reads).
 *
 * Set once per request — `getCurrentUserOrg()` (the canonical tenant gate) calls
 * `setRlsContext` after resolving the session, so any query issued afterwards in the same
 * async context inherits it.
 */
export interface RlsContext {
  organizationId: string | null;
  userId: string | null;
}

const store = new AsyncLocalStorage<RlsContext>();

export function getRlsContext(): RlsContext | undefined {
  return store.getStore();
}

/** Establish context for the remainder of the current async context (per request). */
export function setRlsContext(ctx: RlsContext): void {
  store.enterWith(ctx);
}
