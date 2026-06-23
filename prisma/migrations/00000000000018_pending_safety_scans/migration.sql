-- Migration 0018 — durable dead-letter table for dropped safety-scan enqueues (Q-12-010).
--
-- When inngest.send("chat/message.sent") fails (transient Inngest/network outage), the chat route
-- persists the scan here instead of only logging it, so the child-safety signal is never permanently
-- lost. The org's next chat request drains (re-enqueues + deletes) these rows under its own request
-- context — RLS-clean, with no privileged/background cross-org read.
--
-- SAFETY: purely additive — CREATE TABLE only, no change to any existing table or row, no reseed.
-- RLS is enabled with the standard org-scoped app_user policy (mirrors migration 0016), so a row is
-- only ever visible to its own org under the non-bypass app_user runtime role.

CREATE TABLE "pending_safety_scans" (
    "id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_attempt_at" TIMESTAMP(3),

    CONSTRAINT "pending_safety_scans_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "pending_safety_scans_account_id_idx" ON "pending_safety_scans"("account_id");

ALTER TABLE "pending_safety_scans"
    ADD CONSTRAINT "pending_safety_scans_student_id_fkey"
    FOREIGN KEY ("student_id") REFERENCES "learners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "pending_safety_scans"
    ADD CONSTRAINT "pending_safety_scans_account_id_fkey"
    FOREIGN KEY ("account_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Tenancy. app_user is the non-bypass runtime role. The CRUD grant is also covered by migration 02's
-- ALTER DEFAULT PRIVILEGES (this table is created by the postgres migration role), but is repeated
-- here for explicitness. Org isolation is enforced via RLS, mirroring migration 0016's idiom for a
-- table with a direct account_id column.
GRANT SELECT, INSERT, UPDATE, DELETE ON "pending_safety_scans" TO app_user;

ALTER TABLE "pending_safety_scans" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS app_user_rls ON public.pending_safety_scans;
CREATE POLICY app_user_rls ON public.pending_safety_scans FOR ALL TO app_user
    USING (account_id = app.current_org())
    WITH CHECK (account_id = app.current_org());
