# CLAUDE.md — start here (quillnext / "Quill & Compass")

Orientation map for an agent (or human) resuming work on this repo. **Keep this THIN** — it points to
the canonical sources; depth lives there, not here. When this file and the code disagree, the code wins.

## What this is
A solo-developer, bootstrapped **homeschool / micro-school platform** ("Quill & Compass",
`quillandcompass.app`): AI curriculum generation (Gemini) + learning management + family discipleship,
in one app. Stack: **Next.js 16 (App Router) · React 19 · TS strict · Prisma 7 (PrismaPg adapter) ·
Supabase Postgres · NextAuth v5 (Google/JWT) · Vercel AI SDK→Gemini · Inngest · Firebase Storage ·
Tailwind 4.** Production has **one user (the owner)**. `main` **auto-deploys to Vercel production.**

## Read these first (canonical, in the repo)
1. **`docs/codebase-map/00-INDEX.md`** — the code-truth map (25 chapters: architecture, the 67-model data
   model, every subsystem's build status, conventions). Your answer to "where is X / what does X do / is X
   done." Stamped to commit `b585c1e` — re-verify cites at `file:line`.
2. **`docs/codebase-map/24-status-roadmap-findings.md`** — status dashboard, **roadmap (§5)**, and the
   **canonical findings register (§7)** with the open tallies.
3. **`docs/codebase-map/CHANGELOG.md`** — running history of every findings-driven change. **Read the latest
   (`2026-06-23`) round first** — the RLS cutover + migrations 0016/0017 + the auth-incident post-mortem.

(If you are this account's Claude Code, the agent memory under `.claude/.../memory/MEMORY.md` also auto-loads;
it's point-in-time — verify against current code.)

## Live operational reality (as of 2026-06-23 — verify before relying)
- **DB Row-Level Security is LIVE.** The app connects as the non-bypass **`app_user`** role with
  `RLS_ENABLED=true`; the DB-side policies enforce tenancy and the app-layer `where:{organizationId}`
  filters are now defense-in-depth, not the only boundary.
- **Connection mechanism:** `src/server/db.ts` resolves `DATABASE_URL` → `POSTGRES_URL` →
  `POSTGRES_PRISMA_URL`, then (when `RLS_ENABLED`) **derives** the `app_user` URL from that by swapping only
  role+password — `withRole()` in `src/lib/db-url.ts`, gated on a `APP_USER_PASSWORD` env var.
  **⚠️ NEVER set a hand-built `DATABASE_URL`** — doing so drops the Vercel↔Supabase integration's exact
  pooler host + routing params (`supa=base-pooler.x`) and **broke prod auth on the first cutover attempt**
  ("Can't reach database server at base"). Prod DB = Supabase project `liflosyuonigkiyhwsny`.
- **RLS rollback:** set `RLS_ENABLED=false` (or remove `APP_USER_PASSWORD`) → falls back to the postgres
  `POSTGRES_URL`, redeploy. No DB rollback needed (migrations are RLS-agnostic).

## Operating rules (owner-established — non-negotiable)
- **The Supabase DB is precious + seeded.** Migrations are **forward-only**: `prisma migrate deploy` ONLY —
  **NEVER `migrate dev` / `migrate reset` / `db push`** (they can wipe data / force a reseed). **Before
  applying ANY migration to prod, dry-run it in a `BEGIN … ROLLBACK` transaction on the real DB first**
  (pattern: a throwaway `pg`/`tsx` script — see the 2026-06-23 CHANGELOG round). Migrations connect via
  `DIRECT_DATABASE_URL` (postgres superuser); read-only introspection otherwise.
- **`main` auto-deploys to prod — commit/push ONLY when the owner explicitly asks.** Branch if needed.
- **CI gates (keep green):** `npx tsc --noEmit` (0 errors) · `npx eslint .` (0 errors; warnings OK) ·
  `npx vitest run` (all pass). After a schema change: `npx prisma generate && npm run postgenerate`.

## Done vs. left
- ✅ **Done:** codebase fully mapped + every finding triaged (CHANGELOG rounds 1–54); **RLS cutover LIVE**;
  batched migrations 0016/0017 shipped → **Q-001, Q-011, Q-013, Q-17-010, Q-23-003 all closed.**
- ⏳ **Open (all by design):** the **child-safety hardening brief** is the main remaining program —
  **1 HIGH `Q-12-007`** (no in-the-moment child-facing safety layer; needs a feature + a legal `[DECISION]`)
  + **5 MED** (`Q-12-008..012`). See ch.24 §5 + ch.12 §7. Plus **5 owner-accepted LOW** (lint ratchet
  `Q-01-004`, two unfinished features `Q-09-005`/`Q-16-001`, deferred FK-write `Q-10-010`, safety cleanups
  `Q-12-013`). Current open tally: **0 CRITICAL · 1 HIGH · 5 MED · 5 LOW.**
