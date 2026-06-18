CREATE TYPE "ProfileType" AS ENUM ('PARENT', 'STUDENT');
CREATE TYPE "ProfileViewMode" AS ENUM ('STANDARD', 'KID');

CREATE TABLE "profiles" (
  "id"           TEXT PRIMARY KEY,
  "account_id"   TEXT NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "type"         "ProfileType" NOT NULL,
  "display_name" TEXT NOT NULL,
  "avatar_config" JSONB,
  "pin_hash"     TEXT,
  "view_mode"    "ProfileViewMode" NOT NULL DEFAULT 'STANDARD',
  "user_id"      TEXT REFERENCES "users"("id") ON DELETE SET NULL,
  "is_owner"     BOOLEAN NOT NULL DEFAULT false,
  "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"   TIMESTAMP(3) NOT NULL
);
CREATE INDEX "profiles_account_id_idx" ON "profiles"("account_id");

DROP POLICY IF EXISTS app_user_rls ON public.profiles;
ALTER TABLE "profiles" ENABLE ROW LEVEL SECURITY;
CREATE POLICY app_user_rls ON public.profiles FOR ALL TO app_user USING (account_id = app.current_org()) WITH CHECK (account_id = app.current_org());
GRANT SELECT, INSERT, UPDATE, DELETE ON "profiles" TO app_user;

-- Learner (Student) <-> Profile 1:1 link; FK on the learner side. ON DELETE SET NULL preserves
-- learning data if a profile is removed (the guarded cascade comes with profile deletion later).
ALTER TABLE "students" ADD COLUMN "profile_id" TEXT UNIQUE REFERENCES "profiles"("id") ON DELETE SET NULL;
