# 24 — Project Status, Roadmap & Findings Register (synthesis)

> Synthesis chapter — written against commit `b585c1e`, grounded in all chapters (01–23) **and**
> read-only live-DB introspection (Phase C). Owns no feature code; it also documents the **ops
> catch-all** files (§9). Findings detail lives in each chapter's §7; this is the canonical roll-up.

---

## 1. What quillnext is

**quillnext** (product brand **"Quill & Compass"**, domain `quillandcompass.app`, contact
`adam@quillandcompass.app`) is a single-developer, bootstrapped **homeschool/micro-school platform**
that combines three things in one Next.js app:

1. **AI curriculum generation** — generate lessons, worksheets, quizzes, and whole curricula
   personalized to a student's learning profile, the family's educational philosophy, and faith
   background, grounded in an academic "spine" and a corpus of open educational resources.
2. **Curriculum/learning management** — courses → blocks → activities, a "Living Library" of
   books/videos/articles/documents, scheduling/planner, assessment & grading, and transcripts.
3. **Family discipleship** — Bible memory, Bible study (Matthew Henry commentary + ESV), catechism,
   prayer journal, devotionals, missions (Joshua Project), "neighbor love" (US-county needs), and a
   safety-monitored student AI chat ("Thinkling").

Stated product values (from `about`/`privacy`/`terms`, ch.01/§9): **calm technology** — no ads, no
tracking/analytics, no engagement mechanics, no push notifications; **data sovereignty** (full JSON
export + hard delete); **AI transparency** (generated content labelled, parent-reviewed). Monetization
is a *planned* paid subscription (Stripe "preparation" noted in the changelog; **not implemented**).
Production has exactly one user (the owner).

## 2. Architecture at a glance

```
Browser ── src/proxy.ts (route gate + profile gate) ── App Router (server components / actions)
   │                                                        │
   │  NextAuth v5 (Google OAuth, JWT)                       ├── src/server/db.ts → Prisma 7 (PrismaPg) → Supabase Postgres
   │                                                        │        (RLS provisioned at DB; app bypasses it — ch.04)
   │                                                        ├── src/lib/ai/* → Vercel AI SDK → Google Gemini (only)
   │                                                        ├── src/lib/context/* (master context → prompts)
   │                                                        ├── src/lib/sources/* + src/lib/utils/vector.ts (OER + pgvector RAG)
   │                                                        └── Inngest (11 jobs) ←→ /api/inngest  (extraction, ingest, compile, safety)
   └── Firebase Storage (documents/images)   Resend (safety-alert email)   ESV / Joshua Project / Google Books APIs
```
Full detail: build/config **01**, data model **02**, migrations/seeds **03**, security/tenancy **04**.

## 3. Status dashboard (code status × live-DB evidence)

DB row counts are from the owner's single seeded org (Phase C, read-only). "0 rows" usually means
*built but not yet exercised*, not *broken* — cross-referenced with code status.

| Domain (chapter) | Code status | DB evidence | Notes |
|---|---|---|---|
| Auth / login (04) | **DONE** | users 1, accounts 1, sessions 0 (JWT) | Google OAuth + JWT. |
| Profiles / PIN / picker (05) | **DONE** (KID view STUB) | profiles 3 | Best-tested area; `viewMode=KID` falls through to standard view (TODO). |
| Onboarding / blueprint (17) | **DONE** | organizations 1, classrooms 1, instructors 1, holidays 29 | Step-1 creates the Org. |
| Academic spine (02/19) | **DONE** (reference) | subjects 12, strands 86, topics 366, subtopics 1,626, **objectives 26,015**, grade_bands 4 | Huge seeded taxonomy; REST API unauthenticated (Q-19-001). |
| Courses / blocks (17) | **PARTIAL** | courses 2, course_blocks 9, **activities 0** | Activity authoring is **BROKEN** (Q-17-001: POSTs to a nonexistent route). |
| Resource generation / Creation Station (10) | **PARTIAL** | resources 9, curriculum_specs 2, bundles 2 | Works; FILE source is an unfinished feature (Q-10-005). LOW triaged 2026-06-20 (Session 18; deep-link source pre-select fixed Q-10-011). MED triaged 2026-06-20 (Session 19): Q-10-004 ✅ resolved (input validation now wired) + Q-10-010 ✅/🔻 (withTenant write fixed; lineage-id residual → LOW). Q-10-012 ✅ resolved (cross-org PII read on `[id]` page). HIGH triaged 2026-06-20 (Session 20): Q-10-001 ✅ resolved (live IDOR — auth+org predicate added to `getSourceMetadata`); Q-10-002/003 ✅ resolved (withTenant RLS-readiness wrap; adversarial pass confirmed no live vuln — really MED). **ch.10 fully triaged.** |
| Curriculum compiler — Inngest (23) | **DONE** | bundles 2 (completed) | Multi-step fan-out within Vercel's 60s/step ceiling. |
| Living Library (14) | **PARTIAL** | books 5, videos 1, articles 1, documents 0 | 2 dead routes; write-path trusts client org/user (Q-14-005). |
| OER ingestion + RAG corpora (13/15/23) | **DONE** | book_text_chunks 2,785, textbook_docs 3, textbook_chunks 1,581, coverage 90, book_extractions 6 + 18 sections | Real ingestion has run; `searchVideos`/video-vector path dead (Q-15). |
| Students / learners (16) | **DONE** | learners 2, learner_profiles 2 | Create-student self-heals a missing org. |
| Assessment & grading (16/18) | **BUILT, UNEXERCISED** | assessments / items / attempts / responses / progress all **0** | No real student-taking flow; grading API has **no input validation** (Q-18-001). |
| Planner / scheduling (21) | **BUILT, UNEXERCISED** | schedule_items 0, custom_events 0 | Tenant-solid; "Auto-Reschedule" + `isLocked` unimplemented (Q-21-003). |
| Transcripts (22) | **BUILT, UNEXERCISED** | transcripts 0 | `generateTranscriptData` discards real grades (Q-22-002); `PrintLayout` dead. |
| Family discipleship (20) | **MIXED** | bible_memory 51, prayer_entries 2, catechism_progress 0, church_notes 0, prayer_categories 0 | bible-memory/prayer live; **prayer delete broken** (Q-20-002); missions/neighbor/devotionals/catechism **unauthenticated** (Q-20-001). |
| Thinkling chat (11) | **DONE** | (no table) | Streams Gemini; tenant-guarded; **no tools wired** (dead `tools.ts` removed 2026-06-20). LOW triaged 2026-06-20: PII debug logging removed, `error.stack`/`details` no longer leaked to client, dead `apiUrl` + route query-param fallback removed, ModeSelector id-drift now compile-guarded. MED Q-11-001 ✅ resolved 2026-06-20 (org filter folded into the chat-route learner read — explicit `where:{id, organizationId}` predicate + fail-closed null-org guard). **ch.11 fully triaged.** |
| Child safety (12/23) | **DONE** (fails OPEN) | **safety_flags 15** | Pipeline has fired; LLM path **fails open** (Q-12-001); email-only; no UI reads flags. MED triaged 2026-06-20 (Session 24): Q-12-003 ✅ resolved (urgent routing severity-label-independent), Q-12-004 ✅ resolved (whitelist scoped per-pattern), T1-E delivery-layer hard-stop added. The owner's **child-safety hardening brief** minted Q-12-007 [HIGH] + Q-12-008..013 (§5 roadmap). HIGH Q-12-001 (fail-open) remains. (LOW S23: Q-12-002 removed, Q-12-005/006 resolved.) |
| Context engine (09) | **DONE** | (n/a) | Real production prompt path; LOW triaged 2026-06-20 (2 dead components + dead `bookPreferences` removed, truncation reorder bug fixed); MED Q-09-001 ✅ resolved 2026-06-20 (stale tenant-threading comment corrected — code was already correct). Only Q-09-005 LOW (unfinished media-narrowing) remains. **ch.09 fully triaged** (LOW S16 / MED S17; no HIGH). |
| AI core (08) | **DONE** | (n/a) | **Gemini-only** — no OpenAI provider (the `@ai-sdk/openai` dep + dead retirement-fallback machinery removed 2026-06-19, Q-08-006/002); the 2 prompt-builders now share one Inkling guardrail source (Q-08-001 resolved 2026-06-19). |
| App shell / nav (06) | **DONE** | (n/a) | Dead 2nd-gen nav surface **fully removed** 2026-06-19 (CommandPalette/MainNav/UserNav/SidebarClientIslands + CreationDrawer/ContextNav all deleted); Q-06-001/002 ✅ closed. ch.06 fully triaged (LOW S11 / MED S12). |
| UI primitives (07) | **DONE** | (n/a) | No whole-file dead primitives. |
| Background jobs (23) | **DONE** | extractions/chunks populated | 11 Inngest functions. |
| Monetization / billing | **NOT BUILT** | — | Only "Stripe preparation" in the changelog. |

## 4. End-to-end journeys (traced through code)

1. **Sign-in → onboarding → home.** `/login` → `signIn("google")` (04) → `proxy.ts` lets the
   session through → `/` (`app/page.tsx`, 06) → `getCurrentUserOrg`; no org ⇒ `/onboarding` →
   3-step wizard → `saveClassroomStep` creates the Organization + owner PARENT profile (17) →
   `/select-profile` → signed `active_profile` cookie (04/05) → ParentDashboard.
2. **Generate a resource.** Creation Station (10) → context engine assembles `MasterContext` (09) →
   RAG retrieval over pgvector corpora (15) → Gemini via AI SDK with guardrails (08) → verify/revise
   → `Resource` written via `withTenant`. Curriculum compile instead emits an Inngest event (23) →
   `CurriculumBundle` → `explodeCurriculumBundle` materializes a Course (17).
3. **Add & extract a library book.** Library (14) → Google Books/OCR lookup → `/api/library/books`
   → extract route enqueues `book/extract.requested` (23) → global `BookExtraction` + sections +
   full-text chunks (deduped cross-org) → results copied down per org.
4. **Student safety.** Thinkling chat (11) → `/api/chat` (tenant-checked) emits `chat/message.sent`
   → `safety-scan` job (23/12): regex + Gemini assessment → policy → `SafetyFlag` row → Resend email
   to parents (only when policy says so).
5. **Discipleship (live path).** Bible memory (20): student practices 8-step mastery → tenant-guarded
   actions persist progress (`bible_memory`, 51 rows seeded).

## 5. Roadmap — what's left (inferred from code + DB)

**Broken / unfinished (fix to "work"):**
- Activity authoring posts to a missing route → whole activity flow dead (Q-17-001).
- Prayer-entry delete always fails (string vs object schema) (Q-20-002); new memory verses persist
  empty text (Q-20-003).
- No real **student-facing assessment-taking** flow — attempts are seeded blank, graded as `{}`
  (ch.18); grading writes no `letterGrade`/`isCorrect`.
- `generateTranscriptData` discards real grade/credit/subject data (Q-22-002); transcript builder
  can't edit several persisted fields (Q-22-003).
- KID `viewMode` is a TODO stub (ch.05/16).
- Planner "Auto-Reschedule" + `isLocked` unimplemented (Q-21-003).

**Hardening before a 2nd tenant (security/tenancy):**
- Flip on RLS (`RLS_ENABLED=true` + `DATABASE_URL`→`app_user`) — today the app bypasses the DB's 98
  policies (Q-001). **`app_user` cutover-readiness verified read-only 2026-06-19 (Session 8)** — the
  GRANT/role side is ready; see the ordered **RLS-cutover runbook** immediately below.
- Close write-path trust + IDOR gaps: ~~Q-10-001/002/003~~ (✅ Session 20), Q-14-005, Q-16-002, Q-17-003/004, Q-18-001/002.
- Make child-safety **fail closed** (Q-12-001); add a UI to review `SafetyFlag` rows. See the **child-safety
  hardening brief** below for the full program.
- Remove/auth-gate the unauthenticated infra-disclosure `/api/health` route (Q-24-001) and the
  unauthenticated discipleship/spine endpoints (Q-19-001, Q-20-001).

**Child-safety hardening brief (owner, 2026-06-20 / Session 24).** A Tier-1/2/3 remediation brief for the
child-safety subsystem (ch.12). The app-layer, no-schema, no-legal subset was done in Session 24 (Q-12-003 ✅,
Q-12-004 ✅, T1-E delivery-layer hard-stop). The rest is tracked as findings (ch.12 §7) and drives dedicated
sessions. `[DECISION]` = legal/policy item needing the owner's written sign-off (do NOT implement unilaterally).
- **Tier 1 (before any child uses it):** T1-A = **Q-12-001** [HIGH] fail-open classifier (refine: return a
  review-needed assessment, never `NO_ACTION`). T1-B = **Q-12-008** [MED] regex fabricates target/relationship/
  coercion. T1-C = **Q-12-003** ✅ done. T1-D + T1-F = **Q-12-007** [HIGH] no in-the-moment child layer / inert
  resolutions / bot-promise gap / no output scan / persistent crisis affordance. T1-E ✅ done. T1-G = **Q-12-009**
  [MED] org-readable disclosure snippet. T1-H = **Q-12-010** [MED] durable fallback for a dropped safety enqueue.
- **Tier 2:** T2-A = **Q-12-011** [MED] conversation context for the scanner. T2-B → folded into **Q-12-013**
  [LOW] (`ageGap`/regex-`coercion` unused). T2-C = **Q-12-012** [MED] prompt-injection hardening. **T2-D
  `[DECISION]`** mandated-reporting vs the keep-secret policy — legal, no code without sign-off (paired with the
  T1-F promise-gap in Q-12-007).
- **Tier 3:** T3-A/B/C → **Q-12-013** [LOW] (derive type from Zod, drop/derive `isSafe`, split audit-log from the
  parent summary). T3-D/E → Q-12-013 (Thinkling "STOP immediately" wording, alert idempotency). T3-F = build a
  labeled crisis/benign eval set + consider a stronger model / second guardrail classifier (measurement gap —
  roadmap item, not yet a minted finding).
- **Resources caveat:** any crisis/support resources surfaced must be verified, current, and cover non-US users
  (do not hardcode a single US number).

#### Q-001 RLS-cutover runbook (`app_user` readiness verified read-only 2026-06-19, Session 8)
There is **no code fix** — the RLS enforcement path is already written and dormant (`db.ts:115-131`
per-query `$extends`; `withTenant` GUC stamping `db.ts:107-110`). "Fixing" Q-001 = an **infra cutover**
(env flag + DB-connection-role secret), gated on two parallel workstreams that **both** must complete
before any flip:
- **Workstream A (infra, owner/ops):** the cutover itself (this runbook).
- **Workstream B (code, per-query):** the org-filter audit — ~~Q-10-001/002/003~~ (✅ Session 20,
  2026-06-20), Q-14-001/004, Q-17-001, Q-18-001, Q-20-001/002. Today a missing `where:{organizationId}`
  is a benign omission; **under RLS it becomes a 0-rows / broken-feature**, so the audit MUST land first
  or the flip breaks the live app.

Read-only verification (Session 8) of the GRANT/role side — **ready**: `app_user` is `BYPASSRLS=false`
+ `LOGIN=true`, holds full SELECT/INSERT/UPDATE/DELETE on **all 68 public tables (0 grant gaps)**,
EXECUTE on `app.current_org()`/`app.current_user_id()`, USAGE on `public`+`app`; 0 sequences (Prisma
text ids) so 0 sequence gaps; 68/68 tables RLS-enabled, 98 policies on the 67 app tables
(`_prisma_migrations` is the only RLS-without-policy table → deny-all for `app_user`, harmless: runtime
Prisma never reads it, migrations run via the direct/`postgres` URL). The only `BYPASSRLS` **login**
role is `postgres` (`service_role` is `LOGIN=false`), so the app connects as `postgres` today.

Ordered steps:
1. **Finish workstream B** (the per-query org-filter audit) — RLS turns silent omissions into broken features.
2. **Add observability on the fail-closed path** (`db.ts:120-121`, `resolveTenant()→null→empty-GUC`):
   log when an *authenticated* request resolves a null org, so a lost-`AsyncLocalStorage`-context
   (which returns empty results that look like data loss, not access-denied) is detectable, not silent.
3. **Confirm `app_user` has a usable password** set out-of-band (`ALTER ROLE app_user LOGIN PASSWORD …`;
   LOGIN is already granted) and add the `app_user` `DATABASE_URL` to Vercel as a **new** secret while
   **keeping the current `postgres` URL** for rollback.
4. **Stage/test on a branch-DB clone** (no staging env exists today): exercise onboarding (org create
   needs the null-context INSERT allowance, migration `02:64`), RSC reads, server-action writes, Inngest
   jobs (`runWithRlsContext` + explicit `ctx`), and raw `$queryRaw`.
5. **Flip together** — set `RLS_ENABLED=true` **and** repoint `DATABASE_URL`→`app_user` in the same
   change (one without the other either still bypasses RLS or fails everything closed).
6. **Verify in prod** (the owner's org renders), keeping `prisma migrate`/`_prisma_migrations` on the
   direct/`postgres` URL.
7. **Rollback (one-way-door mitigation):** revert `DATABASE_URL`→`postgres` + `RLS_ENABLED=false` and
   redeploy. No DB rollback needed (no schema change).

**Feature completion (built-but-unused per DB):** assessment/grading runtime, scheduling, transcripts,
documents, catechism progress, prayer categories — wire UIs / exercise end-to-end.

**Product gaps:** billing/subscription (not built); OpenAI failover (anchored but absent); large dead
code removal (2nd-gen nav, retirement machinery, dead routes/components).

## 6. Test-coverage map

CI (ch.01) runs `tsc --noEmit` + ESLint + `vitest run` only — **no DB/integration/e2e**. The suite is
~12 small unit-test files, **~10 of them in the profiles subsystem** (`src/server/profiles/*.test.ts`,
`src/app/select-profile/actions.test.ts`, `src/lib/{profile-access,active-profile-cookie}.test.ts`),
plus a trivial `src/smoke.test.ts`. **Everything else — AI generation, grading, courses, library,
tenancy, discipleship, Inngest jobs — has effectively zero automated tests.** Given RLS is bypassed
and many actions rely on hand-written org checks, the absence of tenancy tests is itself a risk.

## 7. Consolidated findings register

0 CRITICAL · **8 HIGH** · **27 MED open** · **40 LOW open** · 44 INFO (chapter findings) + foundational findings
from 02/04. Full evidence/impact for each is in the owning chapter's §7.

> **Reconcile note (2026-06-20, Session 24 / 12-MED):** closed the 2 ch.12 MED (Q-12-003 ✅ resolved — urgent
> routing made severity-label-independent; Q-12-004 ✅ resolved — academic whitelist scoped per-pattern) and,
> per the owner's child-safety hardening brief, **minted 7 new findings**: **Q-12-007** [HIGH] (no in-the-moment
> child layer), **Q-12-008/009/010/011/012** [MED] (regex field fabrication, org-readable disclosure snippet,
> dropped-enqueue loss, no conversation context, prompt-injection), **Q-12-013** [LOW] (type/contract cleanups).
> Net: HIGH 7→**8**, MED 24−2+5 = **27**, LOW 39+1 = **40**. T1-E (delivery-layer hard-stop) also landed (no
> finding — a hardening add). The brief roadmap is in §5 below.

> **Reconcile note (2026-06-19, Session 2 / 01-MED):** the chapter-MED tally was internally inconsistent —
> this line read 35, the §7 "MED" header read 36, but the by-theme list enumerated **37** distinct ids (the
> count was never bumped when Q-24-001 and Q-05-010 were added). True open MED was **37**; Session 2 resolved
> Q-01-001 + Q-01-002 → **35 open**. All three spots now read 35.

> **Update 2026-06-19 (final):** the **44 INFO** findings were fully triaged & actioned (owner-approved):
> **28 resolved in code** (incl. Q-06-005 — `CommandPalette` deleted), 9 removed (by-design/owner),
> 1 deferred (Q-08-008 observability), 1 partial (Q-14-010), 1 verified-no-change (Q-21-007),
> 3 re-graded INFO→LOW (Q-13-005, Q-20-010, Q-23-003 — the last still a deferred migration),
> 1 accepted/won't-fix (Q-05-008), and **0 still open**. One new finding was raised: **Q-05-010 [MED]**
> (no parent-PIN recovery). The
> HIGH / MED / LOW tiers remain **documented, not fixed**. Per-finding record: `CHANGELOG.md`.

> **Disposition note (2026-06-19, Session 3 / 02-LOW):** the two OPEN LOW findings in ch.02 §7 — `Q-011`
> (org-FK column naming) and `Q-013` (stringly-typed status/category fields) — were re-verified at their
> cited `file:line` (both reproduce exactly) and **owner-deferred** into the batched migration. Both require
> schema/migration changes that §9 forbids without an approved migration, so they stay **tracked-OPEN**;
> **LOW count is unchanged at 71** (deferred ≠ closed). The batched stringly-typed→enum + naming-rename
> migration now bundles **Q-23-003 (ch.23) + Q-011 + Q-013** (see CHANGELOG.md "Deferred migrations"). No
> code change this session; `prisma/` untouched. CI green (tsc 0, eslint 0/687, vitest 58/58).

> **Disposition note (2026-06-19, Session 4 / 03-LOW):** the two OPEN LOW findings in ch.03 §7 were
> re-verified at their `file:line` and **fixed in code** (owner-approved): `Q-03-004` — `seed.ts` now derives
> `sortOrder` from the master-JSON array index at every spine level (Subject→Objective, create + update),
> correcting the false "updated from sequenced data" comments (seed-only; the already-seeded DB keeps
> physical-row order until a re-seed/backfill, since the spine block is skipped on a populated DB); `Q-03-005` —
> a preflight in `seed-generator-content-types.ts` counts referencing `Resource`/`BookGeneratedMaterial` rows
> and aborts with a clear message before the destructive `deleteMany`, replacing reliance on the raw RESTRICT
> FK crash. **LOW 71 → 69 open.** CI green (tsc 0, eslint 0/687, vitest 58/58); the `prisma/` change is scoped
> to the two seed scripts (no migration). See CHANGELOG.md round 7.

> **Disposition note (2026-06-19, Session 5 / 03-MED):** the two OPEN MED findings in ch.03 §7 were
> re-verified at their `file:line` and closed (owner-approved): `Q-03-001` ✅ **REMOVED** — the dead + broken
> `prisma/seed-book.ts` (`return new PrismaClient()` with no driver adapter → throws under Prisma 7; zero
> importers/scripts; excluded from `tsc` at `tsconfig.json:40`) was `git rm`'d, the same disposition as
> Session 1's `verify-seed.ts`; `Q-03-003` ✅ **ACCEPTED** (by-design) — the bypass-RLS half is *required*
> (seeders write global reference tables that are read-only for `app_user`), and `rejectUnauthorized:false` is
> the Supabase-standard posture that is **repo-wide, not seeder-specific** — the production runtime
> `src/server/db.ts:16` uses the identical setting on every request; the proper fix (pin the Supabase CA cert /
> `verify-full`) is a deliberate infra task across runtime + seeders, out of scope for a seed session. **MED 35
> → 33 open.** CI green (tsc 0, eslint 0/687, vitest 58/58); `prisma/migrations/` untouched (only the dead seed
> file removed). See CHANGELOG.md round 8.

> **Disposition note (2026-06-19, Session 6 / 04-LOW):** the three OPEN LOW findings in ch.04 §7 were
> re-verified at their `file:line` (all reproduce) and closed (owner-approved). **Q-002 ✅ REMOVED** — the two
> dead `@supabase/supabase-js` JS-SDK wrappers (`lib/supabase/client.ts` + `server.ts`, zero importers; stale
> "PostgREST is public" comment; `server.ts` defaulted to the BYPASSRLS service-role key) were `git rm`'d, the
> now-orphaned `@supabase/supabase-js` dependency `npm uninstall`'d, and the 3 `SUPABASE_*` JS-client env vars
> dropped from `.env.example`; **Prisma/Postgres (`DATABASE_URL`) and the Supabase dev MCP are untouched** — a
> point the owner flagged, so it is stated explicitly. **Q-003 ✅ REMOVED** — the zero-importer `SignInButton`
> dead UI was `git rm`'d (login/signup use inline server-action forms). **Q-005 ✅ RESOLVED** — the finding's
> ask was an audit of direct session-org reads; the audit found the **only** code reading the JWT-stamped
> `session.user.organizationId` is `proxy.ts:59`, which uses it solely to validate the active-profile cookie
> binding and **fails closed** on a stale-null org (→ `/select-profile`), is **edge-bound** (no DB, so
> `getCurrentUserOrg` is structurally unavailable), and org only ever transitions null→real once — correct-by-design,
> no code change. **LOW 69 → 66 open.** Consequential doc-currency fixes (code-is-truth): ch.01 §6 external-services
> + env-var appendix de-listed the removed `SUPABASE_*` keys and the already-removed `@ai-sdk/openai` (Q-08-006,
> Session 2). CI green (tsc 0, eslint 0/687, vitest 58/58); `prisma/migrations/` untouched. See CHANGELOG.md round 9.

> **Disposition note (2026-06-19, Session 7 / 04-MED):** the sole OPEN MED in ch.04 §7 — `Q-004`
> `allowDangerousEmailAccountLinking: true` (`auth.ts:57`) — was re-verified at its `file:line` (reproduces)
> and **resolved by REMOVAL** (owner-approved): the flag was deleted so it defaults to `false`. **Provably
> regression-free** — the lone provider is Google (`auth.ts:53`; `auth.config.ts:12` is `providers:[]`), and
> `User`/`Account` rows are written ONLY by the NextAuth PrismaAdapter at sign-in (repo-wide grep: zero
> `user.create`/`createUser`/`account.create`; `blueprint.ts`/`students` only `user.update`), so the
> orphaned-`User` state that makes Auth.js throw `OAuthAccountNotLinked` cannot arise and removal changes no
> normal sign-in. **Default-secure** — a future second provider can no longer silently link same-email accounts
> (the exact footgun the finding warned of). Two adversarial lenses confirmed `breaksSignIn=false` and both
> re-graded the latent risk LOW; removal closes it outright. **MED reconcile:** Q-004 is the only foundational
> MED and was never part of the by-theme **33** (the 37→35→33 lineage; foundational findings live in their own
> section, like Q-001 [HIGH] outside the "HIGH 10"). With it resolved, open foundational MED = **0** and the
> by-theme **33** is now the complete open-MED set — headline unchanged at **33**. No new findings / re-grades /
> deferrals; no out-of-chapter sibling. CI green (tsc 0, eslint 0/687, vitest 58/58); `prisma/migrations/`
> untouched (only `src/auth.ts` changed). See CHANGELOG.md round 10.

> **Disposition note (2026-06-19, Session 10 / 05-MED):** the three OPEN MED in ch.05 §7 (+ the deferred LOW
> Q-05-003, bundled) were re-verified and closed (owner-approved). **Q-05-001 ❌ DISMISSED** — does NOT reproduce:
> the PARENT "absolute 15-min cap" claim is refuted by the proxy's sliding re-stamp (`proxy.ts:74-89`, re-signs the
> cookie with a fresh `iat` every >5 min of page activity — already documented in ch.04 §3.3), which predates the
> doc's own SHA (`ef686d9` ⊂ `b585c1e`); the finding overlooked `proxy.ts`. **Q-05-002 ✅ RESOLVED** (+ **Q-05-003
> ✅ RESOLVED**, LOW) — the triplicated throttle→compare→record/clear sequence collapsed into one shared
> `verifyPinWithThrottle` (`src/server/profiles/pin-verify.ts`) that shape-validates with `pinSchema` (gate→shape→
> compare order, so a malformed PIN skips bcrypt but still records a failure); +`pin-verify.test.ts`. **Q-05-010 ✅
> RESOLVED** — built an email-verified owner-PIN reset (Resend): picker "Forgot your parent PIN?" → `requestOwnerPinReset`
> emails a 15-min single-purpose token to the owner's verified email → `/select-profile/reset-pin` → `confirmOwnerPinReset`
> clears the owner PARENT `pinHash` (out-of-band factor = inbox possession); +`pin-reset.ts`/`profile-pin-reset-token.ts`
> (+tests), new env `ACCOUNT_EMAIL_FROM`. **Companion capability (owner-requested, same session):** a locked-out
> **child** PIN is reset by a parent entering the **parent PIN** (`resetChildPinWithParentPin`, STUDENT-only,
> rate-limited via `verifyPinWithThrottle`) — no email. **Reconcile:** all 3 ch.05 MEDs were in the by-theme **33** →
> **MED 33 → 30**; Q-05-003 was a tracked-OPEN deferred LOW → **LOW 63 → 62**. Partition: 4 in-scope → 1 dismissed
> (Q-05-001) · 3 resolved (Q-05-002, Q-05-003, Q-05-010); 0 unaccounted. No new findings / re-grades; no
> out-of-chapter sibling (all ch.05-only). CI green (tsc 0, eslint 0/687, vitest **85/85** across **16** files —
> +3 files/+23 tests); `prisma/migrations/` untouched. See CHANGELOG.md round 13.

> **Disposition note (2026-06-19, Session 11 / 06-LOW):** the two OPEN LOW findings in ch.06 §7 were
> re-verified at their `file:line` (both reproduce) and **✅ REMOVED** (owner-approved); a 3-lens adversarial
> Workflow was unanimous REMOVE (one lens moved the files aside and ran `tsc --noEmit` = 0 before *and* after).
> **Q-06-003** — deleted the dead legacy `UserNav.tsx` + its dead sole-importer `MainNav.tsx` (a forced pair:
> deleting `UserNav` alone would break `MainNav`'s import; `MainNav` itself had zero importers). **Q-06-004** —
> deleted the whole dead `SidebarClientIslands.tsx` (all 3 exports unused; the live `Sidebar.tsx` already
> implements the identical mobile drawer). Nothing orphaned (`AccountMenu` keeps its own `ProfileSettingsDialog`;
> the branding `<Image>` stays in `Sidebar`/`InklingToolkit`). **Both partially resolve MED `Q-06-001`**, which is
> narrowed to **`CreationDrawer` + `ContextNav`** for the ch.06 MED session (Q-06-002 covers `CreationDrawer`'s
> hardcoded org). **LOW 62 → 60 open.** Partition: 2 in-scope → 2 removed; 0 unaccounted. No new findings /
> re-grades / deferrals. Consequential doc-currency (code-is-truth, not new findings): the "3 `<Image>` usages"
> anchor (ch.01 Q-01-002 / CHANGELOG / SKILL §5) → **2** (MainNav was the 3rd); ch.05 §5/§6 `UserNav` cross-refs
> pruned. CI green (tsc 0, eslint 0/682, vitest **85/85** / 16 files); `prisma/migrations/` untouched. See
> CHANGELOG.md round 14.

> **Disposition note (2026-06-19, Session 12 / 06-MED):** both OPEN MED findings in ch.06 §7 re-verified at
> their `file:line` (both reproduce) and **closed** (owner-approved; a 3-lens adversarial Workflow was unanimous
> REMOVE — exhaustive reachability proof, collapsed "wire-it-instead" steelman, orphan/tail enumeration).
> **Q-06-001 ✅ REMOVED** — deleted the last two dead 2nd-gen files `CreationDrawer.tsx` + `ContextNav.tsx`
> (zero importers; Creation Station is already reachable 3 live ways; `ContextNav` had zero producers → always
> rendered `null`). **Q-06-002 ✅ RESOLVED by removal** — the hardcoded `organizationId="current-org-id-placeholder"`
> line was deleted with its dead host file (the live `/creation-station` route never had the bug; it resolves org
> server-side via `getCurrentUserOrg()`). **Cross-chapter tail:** deleting `CreationDrawer` orphaned exactly one
> module — `@/components/ui/sheet` (its sole importer) — which was **also removed** (ch.07 §1/§3/§5/§6 updated;
> no npm dep orphaned, `@radix-ui/react-dialog` is shared with `dialog.tsx`); `ContextNav` orphaned nothing.
> **MED 30 → 28 open.** Partition: 2 in-scope → 2 closed (1 removed, 1 resolved); 0 unaccounted. No new findings /
> re-grades / deferrals. CI green (tsc 0, eslint 0/**679**, vitest **85/85** / 16 files); `prisma/migrations/`
> untouched. **ch.06 now fully triaged** (LOW S11 / MED S12; no HIGH). See CHANGELOG.md round 15.

> **Disposition note (2026-06-19, Session 13 / 07-LOW):** the four OPEN LOW findings in ch.07 §7 re-verified at
> their `file:line` (all reproduce) and **closed** (owner-approved; a 4-agent adversarial Workflow challenged each
> draft and overturned two of them, then load-bearing claims were spot-verified at source). **Q-07-001 ✅ ACCEPTED**
> (correct-by-design) + comment corrected — the draft "add KaTeX (mirror ThinklingChat)" was rejected: the
> generation pipeline emits math as `\(...\)`/stripped (Siyavula/OpenStax), never bare `$...$` (the only delimiter
> remark-math parses by default), so KaTeX would render ~zero real math while its `singleDollarTextMath` default
> would mangle bare-`$` currency in word-problem/economics resources; the only real defect was the comment
> over-claiming ThinklingChat parity, now fixed. **Q-07-002 ✅ ACCEPTED (won't-fix)** — two icon libs coexist, but
> Phosphor is the de-facto house lib (**56** importer files vs lucide's **8**) and a repo-wide/visual standardization
> is disproportionate for a LOW (the draft's Phosphor→lucide direction was also backwards). **Q-07-003 ✅ RESOLVED** —
> `FormFieldContext` default `{}` → `null` (typed `| null`) + the `if (!fieldContext)` guard moved above the
> `getFieldState` deref (`form.tsx`); the dead guard is now reachable + type-honest (chose this over the
> `!fieldContext.name` half-fix). **Q-07-009 ✅ RESOLVED** — `SpecForm.tsx:15` import swapped from relative
> `../../../components/ui/form` to the `@/components/ui/form` alias (byte-identical target, zero behavioral change);
> the "single consumer" half is adoption state, not a defect (`form.tsx` is live). **LOW 60 → 56 open.** Partition:
> 4 in-scope → 4 closed (2 accepted, 2 resolved); 0 deferred / 0 unaccounted. No new findings / re-grades / deferrals;
> no out-of-chapter sibling (SpecForm is owned by ch.10 but the relative-path detail lived only in ch.07). CI green
> (tsc 0, eslint 0/**679**, vitest **85/85** / 16 files); `prisma/migrations/` untouched. **ch.07 now fully triaged**
> (LOW S13; no MED/HIGH). See CHANGELOG.md round 16.

> **Disposition note (2026-06-19, Session 14 / 08-LOW):** the four OPEN LOW findings in ch.08 §7 re-verified at
> their `file:line` (all reproduce) and **closed** (owner-approved; a 4-skeptic adversarial Workflow confirmed
> three and was overridden on the fourth). **Q-08-002 ✅ REMOVED** — the dead model-selection helpers in
> `config.ts` (`getModelByComplexity` + its sole-consumer `TaskComplexity` enum, `getDefaultModel`,
> `getStructuredModel`, `getGenerativeUIModel`, `withRetirementFallback`, `isModelRetiredError`) had 0 code
> importers; removed them plus the now-unused `ai` import + `GoogleModel` type + the stale comments naming them,
> and deleted the stale git-tracked source-tree doc `src/lib/ai/model-selection.md` (it documented the removed
> helpers and was independently stale vs code — "Gemini 3 Pro"/"four models"). **Q-08-003 ✅ REMOVED** — the
> `@deprecated buildCompletePrompt` and its only-callees (`buildSpineAwarePrompt`/`buildPersonalizedPrompt`/
> `buildFamilyContextPrompt`) + unreferenced `calculateAge` + unused `ObjectiveWithHierarchy` type went (the live
> `buildMasterPrompt`, the real personality-injection path via master-context, stays); the now-unused
> `import { db, withTenant }` was dropped. **Q-08-004 ✅ RESOLVED** — deleted the duplicated "DO NOT LEAD WORSHIP"
> line in the Thinkling system prompt (`thinkling.ts:47-48`), fixing the mis-numbered 1-2-3-3-4 list. **Q-08-005 ✅
> RESOLVED** — corrected the `LearningStyleSchema.contentDensity` enum typo `"Mirco-Learning"` → `"Micro-Learning"`
> (`personality.ts:47`); the skeptic's "feature is broken / rename to Overwhelmed" was overridden — `generateObject`
> constrains the **model output**, not the user's free-text answer (the wizard's "Overwhelmed" answer is mapped by
> the model to this structured value), and no code matches the literal, so the fix is zero-risk and no backfill is
> needed. **LOW 56 → 52 open.** Partition: 4 in-scope → 4 closed (2 removed, 2 resolved); 0 deferred / 0
> unaccounted. No new findings / re-grades / deferrals; no out-of-chapter sibling. CI green (tsc 0, eslint
> 0/**677**, vitest **85/85** / 16 files); `prisma/migrations/` untouched. **ch.08 LOW now done** (MED Q-08-001
> remains; no HIGH). See CHANGELOG.md round 17.

> **Disposition note (2026-06-19, Session 15 / 08-MED):** the sole OPEN MED in ch.08 §7 — `Q-08-001`
> (two divergent prompt-builders, both live) — re-verified at its `file:line` and **✅ RESOLVED**
> (owner-approved). Re-verify **sharpened** the finding: post-Q-08-003 the "duplication/drift" framing was
> stale — `PHILOSOPHY_PROMPTS` + family/faith context are present in BOTH paths (class `setFamilyContext`
> and `buildMasterPrompt`→`serializeMasterContext`, context-serializer.ts:107-114), and the master-context
> path's student personalization is actually richer. The ONLY real divergence was that `buildMasterPrompt`
> (→ AI grading feedback + the generate-tool generative-UI generator) ran with **no Inkling persona / ethical
> guardrails** (no-pastoral-care / no-simulacrum / draft-transparency / Nicene bounds), while the class
> `PromptBuilder` (resource generation) injects all of them. **Fix:** injected `INKLING_BASE_PERSONALITY` +
> `INKLING_ETHICAL_GUIDELINES` (from the shared `@/lib/constants/ai-guardrails`) into `buildMasterPrompt`
> above the serialized context + a draft-for-parental-review line (utils/prompt-builder.ts:3,54,56,70) — so
> BOTH generation families now carry identical, centrally-sourced guardrails (one-place maintenance). The
> builders stay **architecturally separate by design** (sync Prisma-entity vs async ID→MasterContext; ch.10
> "share almost no code") — explicitly **NOT merged**. A **3-lens adversarial pass** split 2-1: two lenses
> said FIX_NOW/converge/both-consumers/MED; the steelman warned the persona's "no-first-person/objective"
> block could flatten grading-feedback warmth and argued re-grade-LOW / inject-only-a-draft-line. Owner chose
> **full persona+guardrails, both consumers** (the no-simulacrum rule is in fact protective for child-facing
> feedback; per-student `toneInstructions` still modulate voice). **MED 28 → 27.** Partition: 1 in-scope → 1
> resolved; 0 deferred / 0 unaccounted. No new findings / re-grades / deferrals. Consequential doc-currency
> (not new findings): corrected stale `prompt-builder.ts:275/278/286-301` line refs in ch.09 (Session-14
> residual from the Q-08-003 shrink) and noted the guardrail convergence in ch.10/18. (Observed but **not**
> filed: `suggest-blocks.ts` assembles its own prompt from `getMasterContext` and is outside the two-builder
> scope — block *suggestions*, low-stakes; flagged in CHANGELOG for owner awareness, not minted as a finding.)
> CI green (tsc 0, eslint 0/**677**, vitest **85/85** / 16 files); `prisma/migrations/` untouched. **ch.08 now
> fully done** (LOW S14 / MED S15; no HIGH). See CHANGELOG.md round 18.

> **Disposition note (2026-06-20, Session 16 / 09-LOW):** the five OPEN LOW findings in ch.09 §7 re-verified at
> their `file:line` (all reproduce; a 10-agent adversarial Workflow corroborated each, and two of its outputs were
> **overridden** — see below). Partition: **5 in-scope → 1 accepted · 2 removed · 1 resolved · 1 kept-open**; 0
> unaccounted. **Q-09-002 ✅ ACCEPTED** (correct-by-design) — the bare `db.objective.findMany` is intentional global
> academic-spine access (`Objective` has no `organizationId`, in `CONTEXT_FREE_MODELS`) bounded by a tenant-verified
> learner; **overrode** the reco's "add a clarifying comment" — the verifier showed the invariant is already
> documented authoritatively at `db.ts:33-55`, and a comment pinning safety on the `courseIds` binding would
> *mislead* (it's a relevance filter, not the tenant boundary; sibling reads at `master-context.ts:618/:685` are safe
> for the same global-data reason with no course binding). **Q-09-003 ✅ REMOVED** — dead `bookPreferences` field
> (blank title/subject) + its feeder `bookIds` query + producer; zero readers repo-wide, redundant with the real
> book channel `LibraryContext.relevantBooks`, removes a wasted per-call DB round-trip. **Q-09-004 ✅ REMOVED** —
> dead `ContextInspector.tsx` (free-form-orgId anti-pattern) + `ContextPreview.tsx`; zero importers, superseded by
> the live `ContextInspectorClient`/`AIContextPreview`. **Q-09-006 ✅ RESOLVED** — rewrote `truncateContext` to a
> carry-forward section classifier that preserves original order, keeps the headerless `PHILOSOPHY_PROMPTS` blob with
> its FAMILY header, and sheds lowest-priority sections last (the old code classified every headerless line "other"
> → `indexOf -1` → sorted FIRST, scrambling the prompt under truncation); **overrode** the agents' proposed
> `split("\n\n")` fix — the philosophy injection emits `\n` + a `\n`-leading value, producing a triple-newline that
> would have *fragmented* the family block — and added 3 unit tests (the file's first coverage). **Q-09-005 kept
> ⏳ OPEN [LOW]** — re-documented from "DEAD fields" to an **unfinished feature**: the 5 `MasterContextParams` media
> ids (`courseBlockId/bookId/videoId/articleId/documentId`) are the unbuilt context-injection half of source-anchored
> generation (the lineage half — `generatedFrom*` — is live); safely removable (~4-file mechanical edit) but the
> owner is keeping the hook for a future/redesigned build. Also fixed the stale `prompt-builder.ts:268-272` cite in
> the finding's evidence (→ `:16-20`/`:31-35`). **LOW 52 → 48 open.** No new findings / re-grades / deferrals; no
> out-of-chapter finding sibling (one ch.16 §41 doc-currency fix — the `_components/ContextCompleteness.tsx` →
> `PersonalizationContextCard.tsx` rename residual). CI green (tsc 0, eslint 0/**672**, vitest **88/88** / 17 files);
> `prisma/migrations/` untouched. **ch.09 LOW now done** (MED Q-09-001 remains; no HIGH). See CHANGELOG.md round 19.

> **Disposition note (2026-06-20, Session 17 / 09-MED):** the sole OPEN MED in ch.09 §7 — **Q-09-001**
> (claimed tenant-threading drift between the `dashboard.ts` NOTE and `analyzeContextCompleteness`) — re-verified
> at its `file:line` and **✅ RESOLVED with a comment-only correction; no code change** (the runtime code was
> already correct). Re-verify proved the NOTE is **stale, not a bug**: it was added in `8a79c8c` and the *next*
> commit `5a77836` ("route org/user-scoped reads through withTenant for the Next runtime", ~1.5h later) threaded
> the tenant exactly as the NOTE said it was waiting for, but the comment was never updated. A hand-trace plus
> **two independent adversarial RLS skeptics (Workflow, both high-confidence, each tasked to *prove the NOTE
> still true* — both failed)** enumerated every org-scoped query reachable from the dashboard's
> `analyzeContextCompleteness(organizationId)` call (no options): `learner.count`/`course.count`/`book.count`
> (context-suggestions.ts:99/139/162) + `organization.findUnique`/`classroom.findFirst`/`videoResource.findMany`
> via `getMasterContext` (master-context.ts:262/874/776) — **all** via `withTenant(..., { organizationId,
> userId: null })`. The only bare-`db` reads in the subsystem are `db.objective.*` (global academic spine,
> `Objective` ∈ `CONTEXT_FREE_MODELS`), which are unreachable on the no-options path and correct-by-design even
> if reached. So the NOTE's "not yet tenant-threaded → returns empty under RLS" was false at HEAD. **Cross-chapter
> note:** `dashboard.ts` is owned by **ch.16**, so the comment fix is a code-currency edit in a ch.16 file, but the
> finding stays owned by **ch.09** (MED decrements in ch.09/ch.24, not ch.16); ch.16's §5 row doesn't reference the
> NOTE so no ch.16 doc edit was needed; no sibling finding exists elsewhere. **Severity:** over-graded MED for what
> is comment drift (finding's own "no live vuln"); the disposition skeptic put it at INFO — resolved (not merely
> re-graded), since correcting the comment leaves nothing to track. **MED 27 → 26 open.** Partition: 1 in-scope →
> 1 resolved; 0 unaccounted. CI green (tsc 0, eslint 0/**672**, vitest **88/88** / 17 files); `prisma/migrations/`
> untouched. **ch.09 now fully triaged** (LOW S16 / MED S17; no HIGH). See CHANGELOG.md round 20.

> **Disposition note (2026-06-20, Session 18 / 10-LOW):** the three OPEN LOW in ch.10 §7 re-verified at their
> `file:line` (all reproduce); a recommend→adversarial-verify Workflow (Explore agents) corroborated each, and
> hand-verification of the verifier's new claims surfaced a **separate real bug** (minted Q-10-011). Partition:
> **3 in-scope → 2 resolved · 1 accepted**; +1 new finding minted-and-resolved; 0 unaccounted.
> **Q-10-005 ✅ RESOLVED** (resolved-by-doc, no code) — FILE upload is an **unfinished** feature, not dead code:
> a live entry point (`DocumentList.tsx:184` "Use in Generator" → `?sourceType=FILE&sourceId=`) and a wired
> `file`→`fileContent` FileReader (`:112-120`) exist; FILE dead-ends only because `setFile` never fires
> (`FileUpload` unrendered). Re-documented §5/§7 (UNFINISHED, not DEAD); completing it is a backlog feature, not a
> finding (mirrors Q-09-005). **Q-10-006 ✅ ACCEPTED (by-design)** — the DEEP_VISION branch passes the playlist URL
> to `models.pro` ≡ `gemini-2.5-pro` (config.ts:11/15-16), the only Gemini model with native YouTube processing
> (config.ts:26,34,59); the unwired `google_search_retrieval` tool is a noted *future* enhancement, so grounding
> relies on native model capability, not a missing tool (the finding's "silently degrades" impact is overstated —
> traced the model reality, cf. Q-07-001). No code change. **Q-10-007 ✅ RESOLVED** — deleted the genuinely-dead
> `let tools: any = {}` (was generate-resource-core.ts:289; assigned, never read), removing 3 lint warnings
> (no-unused-vars / prefer-const / no-explicit-any); the remaining boundary `any`s (Prisma nested-where, AI-SDK
> `tool()`, generic verify/revise, `Resource.content` JSON) are accepted under the owner's `no-explicit-any`
> warn-ratchet (Q-01-004). **New Q-10-011 ✅ RESOLVED** — `GeneratorsClient` initialized `sourceId` from
> `bookId`/`videoId`/`courseId` only (`:52`) and `url` from `""` (`:59`), silently dropping the `sourceId`/`url`
> deep-link params that 5 library lists pass via `?sourceType=X&sourceId=…` (BookList/VideoList/CourseList/
> DocumentList/ArticleList) — those "Use in Generator" buttons pre-selected no source; fixed by reading both from
> `searchParams` (residual, noted: ParentDashboard's `topicText` TOPIC links need a `TopicSelector` initial-value
> prop, beyond this LOW; RecommendedBooks' unused `studentId` is harmless). **LOW 48 → 45 open.** No re-grades /
> deferrals; no out-of-chapter sibling finding (the 5 library components got no doc edit — they were already
> correct; the bug was in GeneratorsClient). CI green (tsc 0, eslint 0/**669**, vitest **88/88** / 17 files);
> `prisma/migrations/` untouched. **ch.10 LOW now done** (MED Q-10-004/010 + HIGH Q-10-001/002/003 remain).
> See CHANGELOG.md round 21.

### Foundational (chapters 02 & 04)
- `Q-001` [HIGH] **OPEN** — App bypasses DB RLS (RLS_ENABLED off + BYPASSRLS connection role);
  app-layer org filters are the sole live boundary. *(refined by Phase C: DB has 98 policies on all 67
  tables + an `app_user` role — see §8.)* **Cutover prep done 2026-06-19 (Session 8):** there is no
  code fix (the RLS path is already written/dormant); `app_user` cutover-readiness verified read-only
  (0 GRANT gaps, `BYPASSRLS=false`+`LOGIN=true`); the ordered **RLS-cutover runbook** + the
  infra/per-query two-workstream gate live in the roadmap (§5) and §8. Execution deferred to a dedicated
  infra task gated on the per-query audit; stays tracked-OPEN at HIGH (deferred ≠ closed) and outside
  the "HIGH 10" headline (foundational). See CHANGELOG.md round 11.
- ~~`Q-002`~~ ✅ [LOW] **REMOVED** 2026-06-19 (Session 6): the dead `lib/supabase/client.ts`+`server.ts`
  `@supabase/supabase-js` wrappers were deleted + the dep uninstalled + the 3 `SUPABASE_*` env vars dropped
  (Prisma is the sole data path; Postgres-via-`DATABASE_URL` + the dev MCP are unaffected).
- ~~`Q-003`~~ ✅ [LOW] `SignInButton` **REMOVED** 2026-06-19 (Session 6; zero-importer dead UI). ·
  ~~`Q-004`~~ ✅ [MED] `allowDangerousEmailAccountLinking:true` — **REMOVED** 2026-06-19 (Session 7): flag deleted
  (defaults to false); regression-free (single Google provider + adapter-only `User` creation → `OAuthAccountNotLinked`
  cannot fire) and default-secure. Sole foundational MED; open foundational MED now 0.
- ~~`Q-005`~~ ✅ [LOW] org stamped on JWT only at login — **RESOLVED** 2026-06-19 (Session 6): audit found the
  only direct session-org read is `proxy.ts:59` (fail-closed, edge-bound — DB unreachable); correct-by-design,
  no code change. · `Q-006` [INFO]
  `deleteAccount` is a tenant-wide destructive cascade (OWNER-gated).
- `Q-011` [LOW] ⏳ org-FK column naming drift (`account_id` vs `organization_id`) — **deferred to the
  batched migration** (Session 3, 2026-06-19). · `Q-012` [INFO]
  spine dual identity (`code`+`uuid`) — **resolved by ch.19: queries key on `id`**. · `Q-013` [LOW] ⏳
  stringly-typed status/category fields bypass enums — **deferred to the batched migration**; safety subset
  tracked at MED as Q-12-003 (Session 3, 2026-06-19). · `Q-014` [INFO] `TextbookTopicCoverage.topicId`
  has no FK.

### HIGH (8 open) — all from the feature chapters
> **7 → 8 (Session 24, 2026-06-20):** minted **Q-12-007** [HIGH] (no in-the-moment child-safety layer; 4 inert
> resolutions) from the owner's child-safety hardening brief — see §5 + ch.12 §7. The prior **10 → 7** lineage stands below.
> **10 → 7 (Session 20, 2026-06-20):** the ch.10 tenancy cluster **Q-10-001/002/003 ✅ RESOLVED** —
> Q-10-001 was a live IDOR (`getSourceMetadata` had no auth + no org predicate) closed with an
> auth+org gate + explicit `where:{organizationId}`; Q-10-002/003 were RLS-readiness hardening (a
> 3-skeptic adversarial pass confirmed both already had correct app-layer enforcement → **no live
> vuln**, really MED) closed by the explicit-ctx `withTenant` wrap that brings them to the area
> standard (`explode-bundle.ts`). This completes ch.10's slice of **Workstream B** (the per-query
> org-filter audit gating the Q-001 RLS cutover, §5). Earlier: Session 19 (2026-06-20) minted
> **Q-10-012** [HIGH] (a cross-org PII read on `creation-station/[id]/page.tsx`) and ✅ RESOLVED it the
> same session (born-resolved). ch.10 now has **4** HIGH findings total (Q-10-001/002/003 + Q-10-012),
> **all resolved** (0 open).
| id | title |
|---|---|
| ~~Q-10-001~~ ✅ | **RESOLVED 2026-06-20 (Session 20)** — live IDOR: `getSourceMetadata` had no auth + read org tables on plain `db` with no tenant predicate. Added a `getCurrentUserOrg()` gate + `findFirst({where:{id, organizationId}})`. |
| ~~Q-10-002~~ ✅ | **RESOLVED 2026-06-20 (Session 20)** — RLS-readiness (no live vuln): compile/patch curriculum writes wrapped in `withTenant({organizationId,userId})`, app-checks retained. Really MED (over-graded on cluster-membership). |
| ~~Q-10-003~~ ✅ | **RESOLVED 2026-06-20 (Session 20)** — RLS-readiness (no live vuln): `suggestCourseBlocks` course read + CourseBlock create-loop wrapped in `withTenant`, app-check retained, AI call kept outside the tx. Really MED. |
| ~~Q-10-012~~ ✅ | **RESOLVED 2026-06-20 (Session 19)** — `creation-station/[id]/page.tsx` read learner/book/video by URL-param id with no org-match guard (live cross-org PII read, RLS off); added the standard app-layer same-org guard on all 3 reads. Surfaced while tracing Q-10-010's inbound path. |
| Q-12-001 | Safety LLM deep-path **fails OPEN** on any error — detection silently disabled. |
| Q-12-007 | **No in-the-moment child-facing safety layer** — the pipeline is async/post-hoc (route.ts streams the reply in parallel, no input pre-check / output scan), and 4 of 6 resolutions only log (no channel to the child). Minted from the child-safety hardening brief (Session 24). |
| Q-14-001 | Dead route `GET /api/library/search` runs a global cross-org vector scan before org-filtering. |
| Q-14-004 | Generated-resources query builds a Prisma `where` from unvalidated `searchParams`. |
| Q-17-001 | Activity-creation page POSTs to a **nonexistent** route — activity authoring broken. |
| Q-18-001 | Grading API POST has **zero input validation** (trusts client scores/method). |
| Q-20-001 | Unauthenticated server actions + ungated RSC pages (missions/catechism/neighbor/devotionals). |
| Q-20-002 | `deletePrayerEntry(string)` vs `z.object` schema → prayer delete always fails. |

### MED (27 open) — by theme (see chapter §7 for evidence)
> **Count basis:** this by-theme list is the canonical MED tally (the 37→35→33→30→28→27→26→25→24→**27** lineage — Session 24 closed 2 ch.12 MED + minted 5 ch.12 MED → net +3). **Foundational**
> findings are listed in the Foundational section above and are **not** folded into this headline (same way
> Q-001 [HIGH] sits outside the "HIGH 10"). The sole foundational MED, **Q-004**, was ✅ RESOLVED 2026-06-19
> (Session 7), so open foundational MED is **0** and this list is the complete open-MED set. Session 10
> (2026-06-19, 05-MED) closed **3** of the ch.05 MEDs — Q-05-001 ❌ dismissed, Q-05-002 ✅ resolved,
> Q-05-010 ✅ resolved — so **33 → 30**. Session 12 (2026-06-19, 06-MED) closed **2** ch.06 MEDs —
> Q-06-001 ✅ removed, Q-06-002 ✅ resolved-by-removal — so **30 → 28**. Session 15 (2026-06-19, 08-MED) closed
> **1** ch.08 MED — Q-08-001 ✅ resolved (guardrail convergence into `buildMasterPrompt`) — so **28 → 27**.
> Session 17 (2026-06-20, 09-MED) closed **1** ch.09 MED — Q-09-001 ✅ resolved (stale `dashboard.ts`
> tenant-threading comment corrected; the code was already fully tenant-threaded via explicit-ctx
> `withTenant`) — so **27 → 26**.
> **Session 19 (2026-06-20, 10-MED) reconcile + closures:** first a **pre-existing partition fix** — the
> ch.10 MED **Q-10-010** (an original mastery-pass finding) was never folded into this by-theme list, so the
> headline "26" actually undercounted; the true open-MED was **27**. Session 19 then (a) ✅ RESOLVED **Q-10-004**
> (corrected + wired `generateResourceSchema`) and (b) handled **Q-10-010** — sub-claim 1 (plain-`db` write) ✅
> resolved via `withTenant`, sub-claim 2 (unverified lineage ids) 🔻 re-graded to **LOW** + ⏳ deferred with the
> HIGH tenancy cluster — so Q-10-010 leaves the MED grade. Net **27 → 25**.
> Session 22 (2026-06-20, 11-MED) closed **1** ch.11 MED — Q-11-001 ✅ resolved (folded the org filter into
> the chat-route learner read: `findFirst({where:{id, organizationId}})` + fail-closed null-org guard,
> replacing the droppable `findUnique` + `!==` comparison) — so **25 → 24**.
> **Session 24 (2026-06-20, 12-MED)** closed **2** ch.12 MED — Q-12-003 ✅ resolved (urgent routing made
> severity-label-independent — keyed on category/evidenceLevel/target, policy.ts:43-54) and Q-12-004 ✅ resolved
> (academic whitelist scoped per-pattern; explicit self-harm + incest-action disclosures `exemptFromWhitelist`)
> — **24 → 22** — then **minted 5** new ch.12 MED from the owner's child-safety hardening brief (Q-12-008/009/010/
> 011/012; see the new by-theme entry below) — **22 → 27**. Also minted Q-12-007 [HIGH] + Q-12-013 [LOW]; T1-E
> delivery-layer hard-stop added (no finding).
- **Tenancy / authz drift (raw `db` + manual checks, RLS off):** ~~Q-11-001~~ ✅ resolved 2026-06-20
  (explicit `where:{id, organizationId}` predicate in the chat-route guard + fail-closed `if(!organizationId)`;
  no `withTenant` — single-op read, mirrors Q-10-001; Session 22), Q-14-005, Q-14-006,
  Q-15-001, Q-16-002, Q-17-002, Q-17-003, Q-17-004, Q-18-002.
- **Broken / N+1 / missing validation:** ~~Q-10-004~~ ✅ resolved 2026-06-20 (corrected + wired
  `generateResourceSchema` via `safeParse` in `generateResource`; Session 19), Q-18-003, Q-20-003, Q-20-006,
  ~~Q-05-002~~ ✅ resolved 2026-06-19 (PIN shape now validated in the shared `verifyPinWithThrottle`; Session 10).
- **Tenancy / authz drift — ch.10 generative-UI (raw `db` + unverified ids):** ~~Q-10-010~~ 🔻 re-graded to
  LOW + ⏳ deferred 2026-06-20 (Session 19) — sub-claim 1 (plain-`db` write) ✅ resolved via `withTenant`;
  sub-claim 2 (unverified caller-supplied lineage ids on `generate-tool.tsx`) confirmed to leak **no** cross-org
  read (re-scoped/unconsumed ids — see [[Q-09-005]]), residual is a low-value unverified-FK *write* → re-graded
  LOW, tracked with the HIGH tenancy cluster + RLS-cutover audit. *(This finding had been missing from the MED
  list — see the Session-19 count-basis note above.)*
- **Dead code / duplication / drift:** ~~Q-03-001~~ ✅ removed 2026-06-19 (`prisma/seed-book.ts` deleted —
  dead + broken under Prisma 7; Session 5), ~~Q-06-001~~ ✅ removed 2026-06-19 (last dead 2nd-gen nav files
  `CreationDrawer`+`ContextNav` deleted; also removed the orphaned `ui/sheet` — Session 12), ~~Q-06-002~~ ✅ resolved
  2026-06-19 (hardcoded org placeholder deleted with its dead host `CreationDrawer` — Session 12),
  ~~Q-08-001~~ ✅ resolved 2026-06-19 (the two prompt-builders now share one Inkling guardrail source —
  `buildMasterPrompt` injects `INKLING_*`; builders stay separate by design; Session 15),
  ~~Q-09-001~~ ✅ resolved 2026-06-20 (stale `dashboard.ts` tenant-threading comment corrected; the code was
  already fully tenant-threaded — Session 17),
  Q-14-002, Q-14-003, Q-16-003, Q-19-003, Q-20-004, Q-21-003, Q-22-002, Q-22-003, Q-23-002.
- **Safety vocabulary / robustness:** ~~Q-12-003~~ ✅ resolved 2026-06-20 (Session 24 — urgent-notify routing
  made severity-label-independent; the DB enum-typing stays deferred with ch.02 Q-013), ~~Q-12-004~~ ✅ resolved
  2026-06-20 (Session 24 — academic whitelist scoped per-pattern; explicit self-harm + incest-action disclosures
  no longer cloakable; +tests).
- **Child-safety hardening (owner brief, 2026-06-20 / Session 24 — §5 roadmap, ch.12 §7):** Q-12-008 (regex
  fast-path fabricates target/relationship/coercion), Q-12-009 (child disclosure snippet stored org-readable for
  hard-stop flags), Q-12-010 (a dropped safety-scan enqueue is only logged — sole signal lost), Q-12-011 (scanner
  sees one message, no conversation context), Q-12-012 (prompt-injection into the safety + Thinkling prompts).
  *(Companion HIGH = Q-12-007 in the HIGH table; companion LOW = Q-12-013; T1-A = the existing HIGH Q-12-001.)*
- **Config / infra / privacy posture:** ~~Q-01-001~~ ✅ resolved 2026-06-19 (README rewritten + `.env.example`;
  QSF docs removed — Session 2), ~~Q-01-002~~ ✅ resolved 2026-06-19 (`images.remotePatterns: []` — Session 2),
  ~~Q-03-003~~ ✅ accepted 2026-06-19 (by-design: bypass-RLS required for global reference writes;
  `rejectUnauthorized:false` is the Supabase-standard posture, repo-wide incl. runtime `db.ts:16` — Session 5),
  ~~Q-05-001~~ ❌ DISMISSED 2026-06-19 (PARENT idle IS sliding — the proxy re-stamps `iat` every >5 min,
  `proxy.ts:74-89`; the "absolute cap" claim overlooked the proxy; Session 10),
  Q-19-001 (spine REST unauthenticated).
- **Synthesis-chapter additions (§9 ops):** **Q-24-001** [MED] `/api/health` is an unauthenticated
  diagnostic that discloses DB host/project-ref/connection-role/`RLS_ENABLED`/table counts/commit —
  explicitly marked "TEMPORARY … remove this route" but still present.
- **Account lockout (raised 2026-06-19):** ~~**Q-05-010**~~ ✅ RESOLVED 2026-06-19 (Session 10) — built an
  email-verified owner-PIN reset (Resend): picker "Forgot your parent PIN?" → 15-min token → `/select-profile/reset-pin`
  → `confirmOwnerPinReset` clears the owner PARENT `pinHash` (out-of-band factor = the owner's inbox).

### LOW (77 total) + INFO (fully triaged 2026-06-19, see CHANGELOG.md)
**INFO:** all 44 actioned — 28 resolved / 9 removed / 1 deferred / 1 partial / 1 verified / 1 accepted /
3 re-graded→LOW (Q-13-005, Q-20-010, Q-23-003) / 0 open; chapter §7 entries are marked ✅ / ◑ / ⏳ / 🔻.
**LOW: 77 total (71 original + 4 re-graded + 2 new: Q-10-011, Q-12-013); 40 still open.** Session 1 (2026-06-19, ch.01 LOW) closed 3:
Q-01-003 ✅ removed (`prisma.config.ts.bak` deleted), Q-01-005 ✅ resolved (`verify-seed.ts` + `debug-connect.ts`
deleted, tsconfig excludes trimmed), and — consequentially — Q-03-002 ✅ removed (same `verify-seed.ts` deletion);
Q-01-004 reviewed → kept OPEN (owner). Session 3 (2026-06-19, ch.02 LOW) reviewed Q-011 + Q-013 → both
**⏳ deferred** to the batched migration (still 71 open — deferred ≠ closed). Session 4 (2026-06-19, ch.03 LOW)
closed 2 → **69 open**: Q-03-004 ✅ resolved (seeder sets `sortOrder` from master-JSON array index) + Q-03-005
✅ resolved (FK-preflight guard before the destructive ResourceKind `deleteMany`). Session 6 (2026-06-19, ch.04 LOW)
closed 3 → **66 open**: Q-002 ✅ removed (dead `@supabase/supabase-js` JS clients + dep + env vars) + Q-003 ✅
removed (dead `SignInButton`) + Q-005 ✅ resolved (JWT-org-staleness audit: only `proxy.ts:59` reads it directly,
fail-closed + edge-bound; correct-by-design). Session 9 (2026-06-19, ch.05 LOW) closed 3 → **63 open**: Q-05-004 ✅
resolved (org-scoped learner-existence check before `enterAssessment` redirect) + Q-05-005 ✅ accepted (any-org-member
avatar edit is correct-by-design: the sole caller is the pre-active-profile picker, so a PARENT gate is structurally
impossible) + Q-05-006 ✅ resolved (CONFIRMED parent-as-learner leak; added the shared `excludeParentLearners`
where-fragment and applied it to all 12 student-facing roster/count queries — `data-export.ts` + `getMyLearning`
deliberately left unfiltered). Session 10 (2026-06-19, ch.05 MED) closed 1 LOW → **62 open**: Q-05-003 ✅ resolved
(the deferred PIN-throttle dedup landed as the shared `verifyPinWithThrottle` helper, bundled with Q-05-002).
Session 11 (2026-06-19, ch.06 LOW) closed 2 → **60 open**: Q-06-003 ✅ removed (dead legacy `UserNav.tsx` + its
dead sole-importer `MainNav.tsx`) + Q-06-004 ✅ removed (dead `SidebarClientIslands.tsx`); both partially resolved
MED Q-06-001 (now narrowed to `CreationDrawer` + `ContextNav`). Session 13 (2026-06-19, ch.07 LOW) closed 4 →
**56 open**: Q-07-001 ✅ accepted (KaTeX omission correct-by-design — pipeline emits `\(...\)`/stripped math not
bare `$...$`; default remark-math would mangle currency for ~zero math gain — + misleading comment corrected) +
Q-07-002 ✅ accepted/won't-fix (two icon libs; Phosphor 56 files = house lib vs lucide 8 — disproportionate to
standardize for a LOW) + Q-07-003 ✅ resolved (`FormFieldContext` default → `null` + guard reordered above the
deref) + Q-07-009 ✅ resolved (SpecForm import → `@/components/ui/form` alias). Session 14 (2026-06-19, ch.08 LOW)
closed 4 → **52 open**: Q-08-002 ✅ removed (dead `config.ts` model-selection helpers `getModelByComplexity`/
`TaskComplexity`/`getDefaultModel`/`getStructuredModel`/`getGenerativeUIModel`/`withRetirementFallback`/
`isModelRetiredError` + unused `ai` import; also deleted the stale tracked doc `src/lib/ai/model-selection.md`) +
Q-08-003 ✅ removed (dead utils prompt-builders `buildCompletePrompt`/`buildSpineAwarePrompt`/`buildPersonalizedPrompt`/
`buildFamilyContextPrompt` + unused `calculateAge`/`ObjectiveWithHierarchy`; live `buildMasterPrompt` kept) + Q-08-004
✅ resolved (deleted the duplicated "DO NOT LEAD WORSHIP" line in the Thinkling prompt) + Q-08-005 ✅ resolved
(`Mirco-Learning`→`Micro-Learning` schema-enum typo). Session 16 (2026-06-20, ch.09 LOW)
closed 4 → **48 open**: Q-09-002 ✅ accepted (bare `db.objective.findMany` correct-by-design — `Objective`
is global `CONTEXT_FREE_MODELS` spine, bounded by a tenant-verified learner; no comment added — the invariant
lives at `db.ts:33-55` and a courseIds-based comment would mis-frame the safety) + Q-09-003 ✅ removed (dead
`bookPreferences` placeholder field + its feeder `bookIds` query + producer; zero readers, redundant with
`LibraryContext.relevantBooks`) + Q-09-004 ✅ removed (dead `ContextInspector.tsx` + `ContextPreview.tsx`,
zero importers) + Q-09-006 ✅ resolved (rewrote `truncateContext` to a carry-forward classifier — preserves
section order, keeps the headerless `PHILOSOPHY_PROMPTS` blob with its FAMILY header, sheds lowest-priority
sections last; + 3 new unit tests, the file's first coverage); Q-09-005 kept **OPEN** (re-documented as an
unfinished source-specific-context-injection feature, not dead fields). Session 18 (2026-06-20, ch.10 LOW) closed 3 + minted-and-resolved 1 → **45 open**: Q-10-005 ✅ resolved-by-doc (FILE upload re-documented as an unfinished feature, kept) + Q-10-006 ✅ accepted (DEEP_VISION grounding relies on gemini-2.5-pro's native YouTube processing — honest-incomplete, by-design) + Q-10-007 ✅ resolved (deleted dead `let tools: any = {}`; remaining boundary `any`s accepted under Q-01-004); new **Q-10-011 ✅ resolved** (GeneratorsClient dropped the `sourceId`/`url` deep-link params → 5 library "Use in Generator" buttons pre-selected no source; now read from `searchParams`). Session 19 (2026-06-20, ch.10 MED) re-graded **1 into LOW → 46 open**: Q-10-010's residual sub-claim 2 (unverified caller-supplied lineage ids on `generate-tool.tsx` — confirmed **no** cross-org read leak; low-value unverified-FK write) 🔻 re-graded MED→LOW + ⏳ deferred with the HIGH tenancy cluster (sub-claim 1, the plain-`db` write, was ✅ resolved via `withTenant`). Session 21 (2026-06-20, ch.11 LOW) closed 4 → **42 open**: Q-11-002 ✅ resolved (removed PII/debug `console.log`s — session email, full request JSON/chat, etc. — and stopped returning `error.stack`/`details` to the client; generic 400/500 bodies) + Q-11-003 ✅ resolved (removed dead `apiUrl` + stale commented options + the now-unreachable route query-param fallback) + Q-11-004 ✅ resolved (removed unused `Scales` import + added `as const satisfies` guard so a renamed/mistyped mode id fails compilation) + Q-11-005 ✅ removed (`git rm` the entirely-dead `src/lib/types/tools.ts`). Session 23 (2026-06-20, ch.12 LOW) closed 3 → **39 open**: Q-12-002 ✅ removed (dead `recommendedResolution` schema/type field — collected from the model, never read; REMOVE over WIRE to protect the deterministic "Minimum Social Responsibility" policy) + Q-12-005 ✅ resolved (`sendSafetyAlert` flag read/update moved off raw `db` onto explicit-ctx `withTenant` + an explicit `student.organizationId` predicate — no live vuln, but the one safety-pipeline op that could silently fail-closed at the RLS cutover) + Q-12-006 ✅ resolved (caregiver hard-stop centralized into one shared `isCaregiverHardStop()` predicate consumed by both `policy.ts` and the job; De Morgan-identical, the two independent runtime re-checks preserved). **Session 24 (2026-06-20, ch.12 MED) minted 1 new LOW → 40 open:** Q-12-013 (safety type/contract cleanups — unused `ageGap` + always-`NONE` regex `coercion`, `SafetyAssessment` hand-maintained vs the Zod schema, unused `isSafe`, dual-use `reasoning`; from the child-safety hardening brief). Recurring themes: dead
exports, missing Zod on REST routes, unbounded `findMany` (no `take`), and Gemini-model-name churn.

## 8. Live-DB grounding appendix (Phase C, read-only)

- **RLS:** every one of the 67 public tables has `rls_enabled=true` with **98 policies**; an
  `app_user` role exists (`rolbypassrls=false`, can login). `postgres`/`service_role`/`supabase_admin`
  have `BYPASSRLS=true`. The app runs `RLS_ENABLED=false` and (by inference, since it functions with
  GUCs unset) connects as a BYPASSRLS role → **policies present but not enforced for the app** (Q-001).
  `_prisma_migrations` is the only table with RLS-but-no-policy (advisor INFO).
- **`app_user` cutover-readiness (re-verified read-only 2026-06-19, Session 8 — Q-001 prep):** the
  GRANT/role side is **ready**. `app_user` has full SELECT/INSERT/UPDATE/DELETE on **all 68 public
  tables (0 grant gaps)**, EXECUTE on `app.current_org()`/`app.current_user_id()`, USAGE on
  `public`+`app`; 0 sequences exist (Prisma text ids) so 0 sequence-grant gaps. The connection-role
  inference is **sharpened**: the only `BYPASSRLS` role that can log in is `postgres` (`service_role`
  is `LOGIN=false`; `supabase_admin` is the platform superuser), so the app connects as `postgres`
  today. The residual cutover risk is *not* the DB grants — it's the per-query org-filter audit
  (workstream B) + fail-closed observability + the env/secret flip. See the **RLS-cutover runbook** in
  the roadmap above.
- **Migrations:** Prisma owns them — `_prisma_migrations` has 16 rows; Supabase's own
  `list_migrations` is empty.
- **Extensions:** `vector` 0.8.0 (in `public` — advisor WARN), `uuid-ossp`, `pgcrypto`,
  `pg_stat_statements`. pgvector confirmed present (matches `Unsupported("vector")` columns).
- **Security advisors:** `rls_auto_enable()` is a `SECURITY DEFINER` function executable by `anon`/
  `authenticated` via RPC (WARN ×2); `vector` extension in `public` (WARN).
- **Performance advisors (all INFO):** 75 unindexed foreign keys, 24 unused indexes, 1 no-PK
  (`verification_tokens` — expected for the NextAuth composite key).
- **Seed reality:** spine + reference data fully seeded (objectives 26,015; counties 3,286; commentary
  1,189 ch / 3,363 sections; catechism Qs 880; devotionals 732; resource_kinds 686). RAG corpora
  populated (book_text_chunks 2,785; textbook_chunks 1,581). `prayer_categories` is **empty despite
  `seed-discipleship`** seeding devotionals — partial seed (note for ch.03/20). `video_extractions`
  empty despite 1 `video_resource` — that video was never extracted.

## 9. Ops catch-all (files this chapter owns)

| File | Status | Notes |
|---|---|---|
| `src/app/api/health/route.ts` | **PARTIAL / risk** | Unauthenticated DB-diagnostic; leaks host/projectRef/connection-role/`RLS_ENABLED`/table counts/commit. Self-labelled temporary. → Q-24-001. |
| `src/app/api/test/seed/route.ts` | DONE (safe) | 404 in prod + auth-required; was previously a public DB-write hole (now fixed). Non-prod only. |
| `src/server/utils/errorTaxonomy.ts` | PARTIAL | `ERROR_CODES`/`StandardError`/`createSuccessResponse`; only consumer is `src/server/actions/bible-study.ts`. |
| `src/types/index.ts` | DEAD (placeholder) | Comment-only stub; no exports. |
| `src/app/about/page.tsx` | DONE | Mission, funding transparency, design principles (calm-tech). |
| `src/app/privacy/page.tsx` | DONE | Thorough QSF-style policy; dated 2026-03-30; lists 3rd-party data sharing. |
| `src/app/terms/page.tsx` | DONE | ToS; dated 2026-03-30; "$0, free" liability clause. |
| `src/app/changelog/page.tsx` | DONE | Jan–Mar 2026 history; notes "Stripe integration preparation" (billing not built). |
| `scripts/backfill-profiles.ts` | EXPERIMENTAL (one-off) | Admin profile backfill; runs as `postgres` (RLS bypass); uses pure `buildProfileBackfill` planner (ch.05). |
| `scripts/check-course-integrity.js` | EXPERIMENTAL | Diagnostic: course→subject/strand FK integrity. |
| `scripts/debug-student-assignments.ts` | EXPERIMENTAL | Debug `ResourceAssignment` query. |
| `scripts/test-db.ts` | EXPERIMENTAL | DB connectivity trace. |
| `scripts/verify-gemini.ts` | EXPERIMENTAL (stale) | Tests **old** Gemini model names (2.0/1.5) — drift vs runtime config (ch.08). |
| `scripts/verse-anchor-prototype.ts` | EXPERIMENTAL | Validates commentary verse-anchor coverage before seeding. |

## 10. Coverage guarantee

Phase-A manifest (`git ls-files`, minus the agreed excluded generated/data corpora) = **405 code
files**. Phase-D audit: **390 covered by chapters 01–23 + hand-written 02/04** + **15 owned here**
= **0 unaccounted**. Every chapter reported `allFilesCovered=true` with no missed files and no
`NEEDS_REWORK` verdict. Excluded-from-line-read (documented by shape in 03/23): `src/generated/*`,
`src/data/catechisms/*`, `src/server/data/Matthew-Henry-Commentary-Volumes/*`, counties/mission JSON.
