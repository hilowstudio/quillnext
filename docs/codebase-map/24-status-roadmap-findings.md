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
| Academic spine (02/19) | **DONE** (reference) | subjects 12, strands 86, topics 366, subtopics 1,626, **objectives 26,015**, grade_bands 4 | Huge seeded taxonomy; REST API now session-gated (Q-19-001 ✅ 2026-06-22). |
| Courses / blocks (17) | **PARTIAL** | courses 2, course_blocks 9, activities 0 | Activity authoring **wired** 2026-06-22 (Q-17-001 ✅ Session 35 — built the missing POST route); no activities seeded yet. |
| Resource generation / Creation Station (10) | **PARTIAL** | resources 9, curriculum_specs 2, bundles 2 | Works; FILE source is an unfinished feature (Q-10-005). LOW triaged 2026-06-20 (Session 18; deep-link source pre-select fixed Q-10-011). MED triaged 2026-06-20 (Session 19): Q-10-004 ✅ resolved (input validation now wired) + Q-10-010 ✅/🔻 (withTenant write fixed; lineage-id residual → LOW). Q-10-012 ✅ resolved (cross-org PII read on `[id]` page). HIGH triaged 2026-06-20 (Session 20): Q-10-001 ✅ resolved (live IDOR — auth+org predicate added to `getSourceMetadata`); Q-10-002/003 ✅ resolved (withTenant RLS-readiness wrap; adversarial pass confirmed no live vuln — really MED). **ch.10 fully triaged.** |
| Curriculum compiler — Inngest (23) | **DONE** | bundles 2 (completed) | Multi-step fan-out within Vercel's 60s/step ceiling. |
| Living Library (14) | **PARTIAL** | books 5, videos 1, articles 1, documents 0 | **LOW+MED triaged 2026-06-21 (S27/S28):** dead `POST /api/library/scan` removed (Q-14-002), `/library` nav + dead `revalidatePath` no-ops fixed (Q-14-003), write-path cross-tenant IDOR fixed + all catalog mutations parent-gated (Q-14-005/006), dead `GET` handler removed + create-route cache-bust (Q-14-007/008). **HIGH triaged 2026-06-21 (S29):** dead `GET /api/library/search` route removed (Q-14-001; its orphaned `searchBooks` also deleted → closes ch.15 Q-15-001) + the untyped `where` typed/coerced (Q-14-004 — org predicate always held, no leak, over-graded). **ch.14 fully triaged (LOW S27 / MED S28 / HIGH S29).** |
| OER ingestion + RAG corpora (13/15/23) | **DONE** | book_text_chunks 2,785, textbook_docs 3, textbook_chunks 1,581, coverage 90, book_extractions 6 + 18 sections | Real ingestion has run; `searchVideos`/video-vector path dead (Q-15). **ch.13 LOW triaged 2026-06-21 (Session 26):** dead single-hit registry wrappers removed (Q-13-001), gutenberg converged onto shared `matching.ts` (Q-13-002), LibreTexts silent-cliff now logged (Q-13-005), scrape-fragility cluster accepted by-design (Q-13-007). **Session 29 minted Q-13-009 [LOW]** (cross-edition extraction dedup fragmentation → roadmapped fingerprint feature, §5), so ch.13 has 1 OPEN LOW again; no MED/HIGH. |
| Students / learners (16) | **DONE** | learners 2, learner_profiles 2 | Create-student self-heals a missing org. **LOW triaged 2026-06-22 (Session 31):** broken assignment "Open Resource" link + dead `notes` block fixed (Q-16-004), ParentDashboard "Daily Liturgy" wired to the seeded `Devotional` table (Q-16-005), assessment route gained per-step Zod validation + lost 4 `any`s (Q-16-007); Q-16-001 kept OPEN — `/student/dashboard` re-documented as an unfinished built-but-unlinked daily view (roadmap §5). **MED triaged 2026-06-22 (Session 32):** Q-16-002 ✅ resolved (create-student learner/profile writes folded into one `withTenant` tx — RLS-ready + atomic) + Q-16-003 ✅ resolved (`student as any` replaced by a dedicated `studentCardSelect`/`StudentCardData` payload type). **ch.16 now LOW+MED done** (INFO Q-16-008 remains; no HIGH). |
| Assessment & grading (16/18) | **BUILT, UNEXERCISED** | assessments / items / attempts / responses / progress all **0** | No real student-taking flow (Q-18-006, roadmap); grading API now **validates + recomputes grades server-side** and is tenant/atomic-hardened (Q-18-001/002/003 ✅ 2026-06-22). |
| Planner / scheduling (21) | **BUILT, UNEXERCISED** | schedule_items 0, custom_events 0 | Tenant-solid; the no-op Auto-Reschedule button was removed (Q-21-003 ✅ 2026-06-22); reshuffle/`isLocked` roadmapped (§5). |
| Transcripts (22) | **BUILT, UNEXERCISED** | transcripts 0 | `generateTranscriptData` provides titles + parent-classified defaults by design (Q-22-002 ✅); dead `PrintLayout` removed (Q-22-001 ✅ 2026-06-22). |
| Family discipleship (20) | **MIXED** | bible_memory 51, prayer_entries 2, catechism_progress 0, church_notes 0, prayer_categories 0 | bible-memory/prayer live; prayer delete fixed (Q-20-002 ✅ 2026-06-22); missions/neighbor/devotionals/catechism content actions now session-gated (Q-20-001 ✅ 2026-06-22; pages were already proxy-gated). |
| Thinkling chat (11) | **DONE** | (no table) | Streams Gemini; tenant-guarded; **no tools wired** (dead `tools.ts` removed 2026-06-20). LOW triaged 2026-06-20: PII debug logging removed, `error.stack`/`details` no longer leaked to client, dead `apiUrl` + route query-param fallback removed, ModeSelector id-drift now compile-guarded. MED Q-11-001 ✅ resolved 2026-06-20 (org filter folded into the chat-route learner read — explicit `where:{id, organizationId}` predicate + fail-closed null-org guard). **ch.11 fully triaged.** |
| Child safety (12/23) | **DONE** | **safety_flags 15** | Pipeline has fired; LLM deep-path now **fails CLOSED** (Q-12-001 ✅ resolved 2026-06-20 / Session 25 — scanner error → durable `INTERNAL_LOG_ONLY` review flag, never auto-notifies); email-only; **no UI reads flags** (gates the deferred Q-12-007 feature). MED triaged 2026-06-20 (Session 24): Q-12-003 ✅ resolved (urgent routing severity-label-independent), Q-12-004 ✅ resolved (whitelist scoped per-pattern), T1-E delivery-layer hard-stop added. The owner's **child-safety hardening brief** minted Q-12-007 [HIGH] + Q-12-008..013 (§5 roadmap). **HIGH Q-12-007 (no in-the-moment child-facing layer) ⏳ deferred/OPEN** — structural feature + legal `[DECISION]`. (LOW S23: Q-12-002 removed, Q-12-005/006 resolved.) **ch.12 fully triaged (LOW S23 / MED S24 / HIGH S25).** |
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
- *(Resolved 2026-06-22: prayer-entry delete (Q-20-002) + course delete (Q-14-009) string-vs-object bugs fixed; new
  memory verses now fetch their text on add (Q-20-003).)*
- No real **student-facing assessment-taking** flow — attempts are seeded blank, graded as `{}`
  (ch.18); grading writes no `letterGrade`/`isCorrect`.
- Transcript editor cannot add **test scores / notes / a signature** (render-only persisted fields; Q-22-003) — a
  deferred multi-field editor feature; the signature gap means an "official" transcript can't be signed via the app.
  *(Q-22-002 ✅ accepted: generate provides titles + parent-classified defaults — grade/credit have no schema source,
  subject is a spine-vs-registrar taxonomy mismatch.)*
- KID `viewMode` is a TODO stub (ch.05/16).
- `/student/dashboard` per-student daily-schedule checklist is fully built (auth+org gated; reads `getStudentDailySchedule`, toggles via `toggleItemStatus`) but **not linked from any live nav** — wire an inbound link (or fold it into the student dashboard) to ship it (Q-16-001, kept OPEN as unfinished; the weekly `/planner` is the only live scheduling surface today).
- Planner **bulk reshuffle / "Auto-Reschedule"** is unbuilt — the no-op button was removed 2026-06-22 (Q-21-003, owner
  chose remove-over-build); building it needs a reshuffle engine (recompute placement respecting holidays + school days)
  that reads/writes the currently-dead `StudentScheduleItem.isLocked` pin. A from-scratch multi-file feature.
- Prayer-journal **Public/Private toggle is half-built** (Q-20-008, ch.20): the `isPrivate` value is never persisted
  (create hardcodes `false`; schemas omit it) and there is no sharing path, so the Lock/badge never triggers. **Owner
  product decision:** either WIRE a real privacy/sharing model (needs a sharing surface) or REMOVE the misleading toggle +
  Lock/badge. No security impact (all prayer reads are already per-user).

**Community extraction library — semantic search + cross-edition dedup (planned feature, owner brief 2026-06-21 / Session 29).**
The book pipeline already dedups extraction cross-org via the global `BookExtraction` catalog keyed on `computeDedupKey`
(ISBN-13, else title|author slug) — the first org pays the LLM extraction; every later org links for free
(02-data-model.md:120). Two gaps remain before "extract once, enrich the library for everyone" is whole:
- **Cross-edition fragmentation (Q-13-009 [LOW], ch.13):** the ISBN-first key gives every printing/edition of the
  same work a distinct dedup key, so content-identical editions (e.g. two printings of *1984*) re-extract redundantly
  and fragment the shared corpus. Needs a content-fingerprint / fuzzy match that collapses editions onto ONE extraction.
- **"Pre-extracted ✓" discovery:** when a user searches Google Books/OpenLibrary to add a book (`lookupBook`), indicate
  whether a content-equivalent extraction already exists in the global corpus (semantic / fingerprint match over the
  cross-org `BookExtraction` set — NOT per-org `books`).
- **NOTE on the deleted code:** the old `GET /api/library/search` + `searchBooks` (deleted Session 29 — Q-14-001 /
  Q-15-001) and the parallel per-org video semantic-search pair `searchVideos` / `generateVideoEmbedding` (deleted
  Session 30 — Q-15-002/003) all did per-org cosine search over an org's own tables — the WRONG corpus/scope for this
  feature, so the real build is written fresh against the GLOBAL corpus, not revived from that dead code. This is a
  multi-file feature (new global-corpus query + a fingerprinting strategy + a UI badge, likely a `BookExtraction` schema
  touch) — out of a findings-resolution session's scope; sequence it as dedicated work.

**Hardening before a 2nd tenant (security/tenancy):**
- ~~Flip on RLS~~ ✅ **DONE 2026-06-23 (Q-001)** — the app connects as `app_user` with `RLS_ENABLED=true` and
  DB-side RLS enforced. The connection is **derived** from the integration's `POSTGRES_URL` via `withRole` +
  `APP_USER_PASSWORD` (NOT a hand-built `DATABASE_URL` → that broke auth on the first attempt; see the
  2026-06-23 CHANGELOG auth-incident post-mortem). The runbook below is retained as history + the rollback path.
- Close write-path trust + IDOR gaps: ~~Q-10-001/002/003~~ (✅ Session 20), ~~Q-14-005~~ (✅ Session 28), ~~Q-16-002~~ (✅ Session 32 — RLS-readiness wrap), ~~Q-17-003/004~~ (✅ Session 34 — parent-gate+Zod; merged org predicate in all 6 course-REST handlers), ~~Q-18-001/002~~ (✅ 2026-06-22 — grading POST: Zod validation + server-side recompute + merged org predicate; consolidated pass).
- **RLS-cutover blocker (NEW, Q-17-010, Session 34):** before flipping RLS, the `new:` taxonomy minting (`db.{subject,strand,topic,subtopic}.create` in `api/courses/route.ts` + `…/blocks/route.ts`) must be addressed — those reference tables are `app_user` **SELECT-only** (migration-2:139-144), so the creates fail-closed under RLS-on. Either add scoped INSERT policies in the batched migration, or move custom-taxonomy creation to a privileged/org-scoped path. NOT covered by Session 8's GRANT-level readiness check.
- ~~Make child-safety **fail closed** (Q-12-001)~~ ✅ **done 2026-06-20 (Session 25)** — the LLM deep-path now
  fails closed to an `INTERNAL_LOG_ONLY` review flag. Still open: **add a UI to review `SafetyFlag` rows**
  (no reader exists today — gates the in-the-moment-layer feature Q-12-007). See the **child-safety hardening
  brief** below for the full program.
- ~~Remove/auth-gate the unauthenticated infra-disclosure `/api/health` route (Q-24-001).~~ ✅ DONE 2026-06-22 — route
  removed (`git rm`, owner-approved; consolidated pass). *(The discipleship content actions Q-20-001 ✅ and the spine
  REST routes Q-19-001 ✅ were session-gated 2026-06-22.)*

**Child-safety hardening brief (owner, 2026-06-20 / Session 24).** A Tier-1/2/3 remediation brief for the
child-safety subsystem (ch.12). The app-layer, no-schema, no-legal subset was done in Session 24 (Q-12-003 ✅,
Q-12-004 ✅, T1-E delivery-layer hard-stop). The rest is tracked as findings (ch.12 §7) and drives dedicated
sessions. `[DECISION]` = legal/policy item needing the owner's written sign-off (do NOT implement unilaterally).

> **2026-06-23 (later) — Phase 1 DONE.** The whole app-layer subset shipped (TDD, CI green, migration 0018
> staged; see CHANGELOG): **Q-12-008 / 009 / 010 / 011 / 012 [MED] + Q-12-013 [LOW] all ✅ resolved.**
> **Then Q-12-007 [HIGH] BUILT (2026-06-23, owner written sign-off)** — T1-D/F: the in-the-moment **Hybrid** layer
> (sync regex pre-check → child-facing crisis affordance with verified resources + a parent SafetyFlag review UI at
> `/safety`) and the **T2-D legal `[DECISION]`** resolved = KEEP "Minimum Social Responsibility" (no auto-authority-
> report; the operator's personal mandated-reporter status = their own counsel's call). **The child-safety program
> is now COMPLETE.** ⚠️ UI smoke-test owed (no browser test in CI). (T3-F eval-set / second-classifier remains a
> roadmap item, not minted.)

- **Tier 1 (before any child uses it):** T1-A = **Q-12-001** [HIGH] ✅ **done (Session 25)** — fail-open classifier
  now returns a review-needed (`INTERNAL_LOG_ONLY`) assessment, never `NO_ACTION`; **roadmap refinement:** let
  transient errors THROW so Inngest retries before falling closed (touches the ch.23 job — no `step.run` wrapper,
  double-flag risk). T1-B = **Q-12-008** [MED] regex fabricates target/relationship/coercion. T1-C = **Q-12-003**
  ✅ done. T1-D + T1-F = **Q-12-007** [HIGH] (⏳ deferred Session 25, OPEN/HIGH) no in-the-moment child layer / inert
  resolutions / bot-promise gap / undelivered helplines / no output scan / persistent crisis affordance. T1-E ✅
  done. T1-G = **Q-12-009** [MED] org-readable disclosure snippet. T1-H = **Q-12-010** [MED] durable fallback for
  a dropped safety enqueue.
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
  2026-06-20), ~~Q-14-001/004~~ (✅ Session 29 — Q-14-001 dead cross-org-scan route removed; Q-14-004 typed/coerced,
  org predicate always held so no leak), ~~Q-17-001~~ (✅ Session 35 — route built, org-scoped),
  ~~Q-18-001/002~~ (✅ 2026-06-22 — grading POST merged org predicate + server-side validation/recompute),
  ~~Q-20-001/002~~ (✅ 2026-06-22 — discipleship content actions session-gated + prayer-delete fixed; global content, no
  org predicate needed). The remaining open items here are the **MED/LOW tenancy findings** (e.g. ch.16/21/22/23) + the
  ⏳-deferred RLS-cutover blockers. Today a missing `where:{organizationId}`
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

0 CRITICAL · **0 HIGH** · **0 MED open** · **1 LOW open** · 44 INFO (chapter findings) + foundational findings
from 02/04. Full evidence/impact for each is in the owning chapter's §7. *(**The entire findings program is now
complete except 1 owner-accepted LOW (Q-01-004, the lint warn-ratchet).** Foundational `Q-001` [HIGH] **✅ RESOLVED 2026-06-23** — RLS cutover LIVE.
**2026-06-23 (later): the child-safety hardening program shipped end-to-end** — Q-12-008/009/010/011/012 [MED] +
Q-12-013 [LOW] (Phase 1) and **Q-12-007 [HIGH]** (the in-the-moment Hybrid layer, built after the owner's written
legal sign-off), plus non-safety Q-10-010 + Q-16-001 [LOW]. **Q-09-005 [LOW] ✅ RESOLVED 2026-06-23** by
consolidating the two generators onto the source-aware `generateResourceCore` (see ch.10 §5/§7). Open HIGH =
none; open MED = none; open LOW = **Q-01-004** only (lint warn-ratchet, owner-accepted / kept-open by design).)*

> **Disposition note (2026-06-23 later / Q-09-005 — generator consolidation).** Owner chose to consolidate rather
> than build a second source-aware path. `GeneratorForm` now calls `generateResource` (→ `generateResourceCore`,
> which already does source-grounded RAG + student personalization + verify/revise + images) via a new pure mapper
> `lib/generators/resolve-source.ts` (precedence: book→video→objective→course→TOPIC-from-prompt). **Deleted** the
> standalone `creation-station/[id]` page + its `[id]`-only components (`SmartDefaultsSuggestions`,
> `ContextSuggestionsInline`, `smart-defaults.ts`) + `generateLearningTool` + the `@ai-sdk/rsc` dep (`streamUI`
> gone repo-wide); **redirected** the course-builder tool links to `/creation-station`; **kept** `GeneratorForm`
> (now course-builder-only, source-aware) + `ContextBadges`. Deletion tail verified clean. **LOW 2 → 1.** Known
> limitation: no ARTICLE/DOCUMENT source type yet (those fall back to TOPIC-from-prompt). CI: tsc 0, eslint 0-err,
> vitest **218/218** (+6). ⚠️ UI smoke-test owed (course-builder dialog + /creation-station). See CHANGELOG.md.

> **Disposition note (2026-06-23 later / Q-12-007 BUILT — last open HIGH closed).** After the owner's written
> sign-off (verified crisis resources + bot-wording redline + Hybrid architecture + KEEP the mandated-reporting
> policy), built the in-the-moment layer per `Q-12-007-hybrid-safety-spec.md`: a synchronous regex pre-check
> (`app/actions/safety-precheck.ts`) → child-facing **CrisisHelp** affordance (verified `lib/safety/crisis-resources.ts`);
> the `thinkling.ts` wording redline (+ a no-invent-numbers rule); and a **parent SafetyFlag review UI** (`/safety`
> + `getSafetyFlags`/`markSafetyFlagReviewed`, closing the "no SafetyFlag UI reader" gap) + a Sidebar link.
> **Fail-safe:** the affordance NOTIFIES NO ONE (resources only). **HIGH 1 → 0.** ⚠️ UI smoke-test owed (no browser
> test in CI; re-verify resources periodically). CI: tsc 0, eslint 0-err, vitest **212/212** (30 files, +10).
> Nothing pushed. New headline: **0 CRITICAL · 0 HIGH · 0 MED · 2 LOW (owner-accepted).** See CHANGELOG.md.

> **Disposition note (2026-06-23 later / child-safety Phase 1 + 2 non-safety LOWs):** kicked off the
> child-safety hardening program (owner decisions: bounded hardening first / legal in parallel; Q-12-007 =
> **Hybrid** architecture, **gated on written legal sign-off**; KEEP the reporting policy + add verified
> non-US-inclusive crisis resources; DO Q-16-001/Q-10-010, LEAVE Q-09-005/Q-01-004). **Closed 8 findings**
> (TDD, CI green, nothing pushed). **MED 5 → 0:** Q-12-008 (regex routing labels — violence→OTHER_CHILD stays
> urgent, incest→SIBLING), Q-12-009 (redact snippet+reasoning for hard-stop flags, keep `[EVIDENCE:]` tag),
> Q-12-010 (durable `PendingSafetyScan` dead-letter + drain-on-next-chat; **migration 0018** dry-run-validated
> in BEGIN…ROLLBACK incl. app_user org-isolation, STAGED not pushed), Q-12-011 (bounded conversation context to
> the LLM deep-path), Q-12-012 (prompt-injection fencing). **LOW 5 → 2:** Q-12-013 (z.infer + reasoning
> audit/parent split), Q-10-010 (same-org lineage-FK check), Q-16-001 (Sidebar "Daily Schedule" link);
> Q-01-004 + Q-09-005 left (owner-accepted). Partition: 8 in-scope → 8 closed; 0 unaccounted. **HIGH was 1 at this
> point** (Q-12-007); it was **subsequently BUILT the same day → HIGH 1 → 0** (see the Q-12-007 note above). CI: tsc
> 0, eslint 0-err, vitest **202/202** (+14 safety tests, 28 files); only migration 0018 staged. Doc-currency:
> ch.12 §5 "free String" rows → enums (already shipped by 0016); ch.12 §1 + ch.02 gained the new safety files
> + `PendingSafetyScan` model. See CHANGELOG.md round.

> **Disposition note (2026-06-22, Session 34 / 17-MED):** all **3** OPEN ch.17 MED closed (owner-approved;
> 3-skeptic adversarial Workflow — one per finding, each tasked to REFUTE the draft — all reproduce / FIX,
> high-confidence, with 2 sharpenings adopted + 1 latent bug surfaced). **Q-17-002 ✅ RESOLVED** — one-line fix:
> `CourseBuilder.tsx:683` passed `courseId` as `organizationId` to `ResourcePicker` → all 6 library tabs empty;
> changed to the real `organizationId` prop (already wired, guaranteed non-null). **Q-17-003 ✅ RESOLVED** — added
> a Zod `createCourseApiSchema` (`lib/schemas/courses.ts`, NOT `.uuid()` so `new:` minting survives; +10 tests) +
> `assertParentProfile()`→403 to `POST /api/courses`, mirroring the twin `library/books/route.ts`; skeptic caught
> a name clash with the existing `actions.ts:12` `createCourseSchema`. **Q-17-004 ✅ RESOLVED** — merged the org
> filter into the course lookup in all **6** REST handlers (`findFirst({where:{id, organizationId}})` + fail-closed
> null-org guard, replacing the droppable `findUnique` + `!==`); **no `withTenant`** (route handlers have a session,
> so the per-query extension GUC-scopes under RLS-on — the merged predicate is the live boundary + RLS-ready).
> **Minted Q-17-010 [MED] ⏳ DEFERRED** — the adversarial pass found the `new:` taxonomy CREATEs (Subject/Strand/
> Topic/Subtopic; 4 sites) write **SELECT-only** RLS tables (migration-2:139-144, "writes only via migrations/seeds
> as superuser") → fail-closed under RLS-on; verified at file:line, cross-linked to the Q-001 cutover (Workstream B).
> **Net: MED 20 − 3 resolved + 1 minted = 18 open.** Partition: 3 in-scope → 3 resolved; +1 minted-deferred; 0
> unaccounted. Consequential doc-currency (not new findings): ch.04 §3.5 `assertParentProfile` consumer count 11 → 13
> (+`api/courses/route.ts`, a count already stale since Session 28) and ch.05 §6 importer list gained the same.
> CI green (tsc 0, eslint 0/**1314**, vitest **148/148** / 23 files — +10 schema tests); `prisma/migrations/`
> untouched; 6 code files M + 1 test. **ch.17 now LOW+MED done; HIGH Q-17-001 remains.** See CHANGELOG.md round 37.

> **Disposition note (2026-06-22, Session 30 / 15-LOW):** all **4** OPEN ch.15 LOW closed (owner-approved;
> 4-skeptic adversarial Workflow — one per finding, each tasked to refute the draft; all reproduce at current code,
> high-confidence, and 2 of my drafts were overridden toward REMOVE). **Q-15-002 ✅ REMOVED** (`searchVideos` deleted
> — the per-org video twin of the S29 `searchBooks` deletion; built-but-unwired, zero importers across 5 vectors, no UI
> consumer). **Q-15-003 ✅ REMOVED** (`generateVideoEmbedding` deleted — wrote `video_resources.embedding`, a column
> NOTHING reads; dead at both ends; also corrected the doc's wrong claim that `searchVideos` depended on it). **Q-15-004
> ✅ REMOVED** (`git rm src/lib/cache.ts` — superseded dead caching scaffold; the inline `revalidateTag` pattern shipped
> instead, never importing its `CACHE_TAGS` taxonomy). **Q-15-005 ✅ ACCEPTED (won't-fix)** (`crossWalkTextbookTopics`
> N+1 ≤250 cosine queries — bounded best-effort bg Inngest step; verified NO vector index on `textbook_chunks.embedding`,
> so a set-based rewrite has no algorithmic gain + regression risk). **LOW 35 → 31 open.** Partition: 4 in-scope → 4
> closed (3 removed, 1 accepted); 0 unaccounted. No new findings / re-grades / deferrals; no out-of-chapter sibling
> finding (ch.23/24 references are code-currency only). The §5 "Community extraction library" roadmap NOTE updated — the
> video family it flagged is now deleted. CI green (tsc 0, eslint 0/**661**, vitest 130/130 / 22 files);
> `prisma/migrations/` untouched. **ch.15 now FULLY TRIAGED** (LOW S30; MED Q-15-001 resolved-by-removal S29; no HIGH).
> See CHANGELOG.md round 33.

> **Disposition note (2026-06-21, Session 28 / 14-MED):** all **4** OPEN ch.14 MED closed (owner-approved;
> 4-skeptic adversarial Workflow — all reproduce, FIX_AS_PROPOSED/REMOVE; sharpened Q-14-005 to a true HIGH).
> **Q-14-002 ✅ REMOVED** (dead `POST /api/library/scan` route deleted — zero callers; ISBN uses `lookupBook`).
> **Q-14-003 ✅ RESOLVED** (`ResourceList.tsx:41` `/library`→`/living-library`; 2 dead `revalidatePath("/library")`
> no-ops deleted from the extract routes; + a sibling dead `revalidatePath("/resources")` in `deleteResource` deleted
> — consequential cleanup, not a new finding). **Q-14-005 ✅ RESOLVED** (cross-tenant write IDOR — `addArticle`/
> `addDocuments` now derive `{organizationId,userId}` via `getCurrentUserOrg()` + a null-org guard + `assertParentProfile()`,
> dropping the client-supplied org/user args; adversarially graded a true HIGH but fix-and-CLOSED, so the re-grade is moot).
> **Q-14-006 ✅ RESOLVED** (`assertParentProfile()`→clean 403 added to all 4 create/extract API routes; the
> `addArticle`/`addDocuments` actions got the same gate as part of Q-14-005). **MED 27 → 23 open.** Partition: 4
> in-scope → 4 closed (1 removed, 3 resolved); 0 unaccounted. No new findings / re-grades / deferrals; the ch.13/15/23
> sibling line-ref shifts are code-currency only (no finding moved out of ch.14). **ch.14 now LOW+MED done** (HIGH
> Q-14-001/004 remain — part of the "HIGH 7" tenancy cluster). CI green (tsc 0, eslint 0/664, vitest 130/130 / 22
> files); `prisma/migrations/` untouched. See CHANGELOG.md round 31.

> **Reconcile note (2026-06-20, Session 25 / 12-HIGH):** of the 2 OPEN ch.12 HIGH, **Q-12-001 ✅ RESOLVED**
> (the LLM deep-path catch now FAILS CLOSED — returns an `isSafe:false` `INTERNAL_LOG_ONLY` "needs human
> review" assessment, never a safe one, so a scanner error stores a durable flag and never auto-notifies;
> +`guard.test.ts`; unanimous 3-lens adversarial Workflow; overrode the dedicated-resolution alternative).
> **Q-12-007 re-verified & ⏳ DEFERRED** — kept **OPEN/HIGH** (no re-grade): the structural in-the-moment-layer
> feature + the legal T2-D `[DECISION]` are beyond a resolution session (§9.3); the bot-promise wording +
> undelivered-helpline sub-items are owner-decision (owner: leave-as-is). **HIGH 8 → 7 open.** No new findings
> / re-grades / deferrals of new items; no out-of-chapter sibling finding (the fix is contained in ch.12
> guard.ts). CI green (tsc 0, eslint 0/666, vitest 118/118 / 21 files — +1 test); `prisma/migrations/` untouched.
> See CHANGELOG.md round 28.

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
- `Q-001` [HIGH] **✅ RESOLVED 2026-06-23 — RLS cutover LIVE.** The app now connects as the non-bypass
  `app_user` role with `RLS_ENABLED=true` and DB-side RLS enforced; app-layer org filters are now
  defense-in-depth. Connection is derived from the integration's `POSTGRES_URL` via `withRole` +
  `APP_USER_PASSWORD` (`src/lib/db-url.ts`); see the 2026-06-23 CHANGELOG round incl. the auth-incident
  post-mortem. *(Original finding: the app bypassed DB RLS — RLS_ENABLED off + BYPASSRLS connection role;
  app-layer org filters were then the sole live boundary.)* *(refined by Phase C: DB has 98 policies on all 67
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

### HIGH (1 open) — Q-12-007 only (⏳ deferred)
> **3 → 1 (Consolidated final pass, 2026-06-22, ch.20 HIGH):** **Q-20-001 🔻→LOW + ✅ RESOLVED** — the
> `/family-discipleship` unauthenticated-content finding was over-graded: the central proxy (`src/proxy.ts`, git-verified
> to predate the doc SHA) fail-closed gates the whole subtree (pages AND the server-action POSTs to those page routes),
> and the data is global non-tenant content, so the "unauthenticated surface / quota vector" did not exist for normal
> invocation. Fixed anyway (defense-in-depth per the proxy's own "backstop NOT a replacement" note): added `auth()` to the
> 7 content actions. **Q-20-002 ✅ RESOLVED** — the broken prayer-delete (`deletePrayerEntry(string)` vs an `{id}` schema)
> fixed to `{ id }`; over-graded HIGH (a broken feature, not a vuln). The identical pattern broke course delete →
> minted-and-resolved **Q-14-009** [MED]. **Only Q-12-007 (⏳ deferred — no in-the-moment child-safety layer) remains.**
> See CHANGELOG.md round 46.
> **4 → 3 (Consolidated final pass, 2026-06-22, ch.18 HIGH):** **Q-18-001 ✅ RESOLVED** — the grading POST now
> validates its body (Zod `gradeAttemptApiSchema` + `safeParse`→400) and **recomputes the grade server-side**
> (clamps each item score to `[0, item.points]`, derives `scorePoints`/`maxPoints` from the items, ignores client
> totals, enum-checks `gradingMethod`) — a forged/buggy POST can no longer persist garbage grades. +`grading.test.ts`
> (11). Folded in the deferred LOW Q-18-004 (client now sends a derived AI_ASSISTED-vs-MANUAL method, server-validated).
> Adversarially designed (3-skeptic Workflow: recompute over bounds-only). Remaining HIGH: ch.12×1 (Q-12-007 ⏳) +
> ch.20×2 (Q-20-001/002). See CHANGELOG.md round 41.
> **5 → 4 (Session 35, 2026-06-22):** **Q-17-001 ✅ RESOLVED** — owner chose BUILD: created the missing
> `POST /api/courses/[id]/blocks/[blockId]/activities` route (the feature was ~90% scaffolded — Activity model,
> form UI, read/display, and the "Add Activity" entry point all existed; only the create handler was missing).
> Mirrors `blocks/route.ts` POST + the Q-17-003 parent-gate (→403) + the Q-17-004 merged-predicate org check;
> no Objective minting (the form drops `new:` custom objectives), no new RLS blocker (activities/activity_objectives
> are join-scoped ORG tables, not SELECT-only like Q-17-010). +13 `createActivityApiSchema` tests; "(coming soon)"
> copy corrected. ch.19 Q-19-002 confirmed unaffected (page unchanged at its cited line). See CHANGELOG.md round 38.
> **7 → 5 (Session 29, 2026-06-21):** the ch.14 HIGH pair closed. **Q-14-001 ✅ RESOLVED (removed)** — deleted the
> dead `GET /api/library/search` route (zero callers; an unscoped cross-org pgvector scan + a per-request embedding
> call, reachable by any authed user); its orphaned sole consumer `searchBooks` was also deleted → closes ch.15
> MED **Q-15-001** (resolved-by-removal). **Q-14-004 ✅ RESOLVED** — typed the generated-resources `where`
> (`Prisma.ResourceWhereInput`) + coerced all 4 `searchParams` (no leak — the org predicate always held; HIGH was
> over-graded, really MED/LOW input-validation; fix-and-close → re-grade moot). Owner deleted the wrong-scoped
> per-org book-search; the **community semantic-search + cross-edition-dedup** vision is captured in the §5 roadmap
> + new **Q-13-009** [LOW]. A 2-finding adversarial Workflow confirmed both (reproduces ✓ / sound ✓ / high-confidence).
> **8 → 7 (Session 25, 2026-06-20):** **Q-12-001 ✅ RESOLVED** — the safety LLM deep-path catch now FAILS
> CLOSED (returns an `isSafe:false` `INTERNAL_LOG_ONLY` "needs human review" assessment, never a safe one), so
> a scanner error stores a durable flag and can never auto-notify a caregiver. **Q-12-007 stays ⏳ OPEN/HIGH**
> (re-verified; structural feature + legal `[DECISION]` deferred to the §5 roadmap — see ch.12 §7).
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
| ~~Q-12-001~~ ✅ | **RESOLVED 2026-06-20 (Session 25)** — the safety LLM deep-path catch (guard.ts:194-225) now FAILS CLOSED: returns an `isSafe:false` / `category:"OTHER"` / `severity:"TIER_3"` → `INTERNAL_LOG_ONLY` "needs human review" assessment, so a model outage stores a durable flag (never `NO_ACTION`) and can never email a caregiver on an unclassified message. +`guard.test.ts`; unanimous 3-lens Workflow; no migration (free String columns). Throw-for-Inngest-retry refinement is roadmap (§5). |
| Q-12-007 | **No in-the-moment child-facing safety layer** — the pipeline is async/post-hoc (route.ts streams the reply in parallel, no input pre-check / output scan), and 4 of 6 resolutions only log (no channel to the child). Minted Session 24; **re-verified & ⏳ DEFERRED Session 25** (kept OPEN/HIGH): structural feature + legal T2-D `[DECISION]` beyond a resolution session (§9.3); bot-promise wording + undelivered-helpline sub-items are owner-decision (owner: leave-as-is). See ch.12 §7 + §5 roadmap. |
| ~~Q-14-001~~ ✅ | **RESOLVED 2026-06-21 (Session 29)** — deleted the dead `GET /api/library/search` route (zero callers; ran an unscoped cross-org pgvector scan + a per-request embedding, reachable by any authed user). Its orphaned sole consumer `searchBooks` was also removed → closes ch.15 **Q-15-001**. Community semantic search roadmapped fresh against the global corpus (§5 + Q-13-009). |
| ~~Q-14-004~~ ✅ | **RESOLVED 2026-06-21 (Session 29)** — typed the generated-resources `where` as `Prisma.ResourceWhereInput` + coerced all 4 `searchParams` to single strings (a duplicate `?studentId=a&studentId=b` array no longer 500s the page). `organizationId` always present → no leak; HIGH over-graded (really MED/LOW), fix-and-close → re-grade moot. |
| ~~Q-17-001~~ ✅ | **RESOLVED 2026-06-22 (Session 35)** — owner chose BUILD over remove. Created the missing `POST /api/courses/[id]/blocks/[blockId]/activities/route.ts` (auth + `assertParentProfile`→403 + `getCurrentUserOrg`/null-org guard + `createActivityApiSchema` validation + course/block org-scoped `findFirst` lookups + LESSON-only check + computed `position` + `Activity` create + optional `ActivityObjective` link to an existing global Objective). No Objective minting (the client drops `new:`); no new RLS blocker (join-scoped, not SELECT-only like Q-17-010). The create→display loop now closes end-to-end. +13 `createActivityApiSchema` tests; stale "(coming soon)" copy + author-comments corrected. |
| ~~Q-18-001~~ ✅ | **RESOLVED 2026-06-22 (consolidated pass)** — grading POST now Zod-validates the body (`gradeAttemptApiSchema`→400) and **recomputes the grade server-side**: each item score clamped to `[0, item.points]`, `scorePoints`/`maxPoints` derived from the items (client totals ignored/stripped), `gradingMethod` enum-checked. Folds in Q-18-004 (client sends a derived, server-validated method). +`grading.test.ts` (11). Adversarially designed. |
| ~~Q-20-001~~ ✅ | **RESOLVED 2026-06-22 (consolidated pass)** — 🔻 over-graded (proxy fail-closed gates the whole `/family-discipleship` subtree incl. server-action POSTs; data is global non-tenant content). Added defense-in-depth `auth()` to the 7 content actions anyway (per the proxy's "backstop NOT a replacement"). Fix-and-close → re-grade moot. |
| ~~Q-20-002~~ ✅ | **RESOLVED 2026-06-22 (consolidated pass)** — broken prayer-delete (`deletePrayerEntry(string)` vs `{id}` schema) fixed to `{ id }`; over-graded HIGH (broken feature, not a vuln). Identical pattern broke course delete → minted-and-resolved Q-14-009 [MED]. |

### MED (6 open) — by theme (see chapter §7 for evidence)
> **Count basis:** this by-theme list is the canonical MED tally (the 37→35→33→30→28→27→26→25→24→27→23→22→20→**18** lineage — Session 24 net +3: closed 2 ch.12 MED + minted 5; Session 28 closed the 4 ch.14 MED → 27→23; Session 29 closed 1 ch.15 MED → 23→22; Session 32 closed 2 ch.16 MED → 22→20; Session 34 net −2: closed the 3 ch.17 MED (Q-17-002/003/004) + minted 1 (Q-17-010 ⏳ deferred) → 20→18). **Foundational**
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
> Session 28 (2026-06-21, 14-MED) closed **4** ch.14 MED — Q-14-002 ✅ removed (dead `POST /api/library/scan`),
> Q-14-003 ✅ resolved (`/library`→`/living-library` nav + dead `revalidatePath` no-ops), Q-14-005 ✅ resolved
> (cross-tenant write IDOR — server-derived org/user + parent gate; adversarially a true HIGH, fix-and-closed → re-grade
> moot), Q-14-006 ✅ resolved (parent-gate→403 on the 4 create/extract API routes) — so **27 → 23**.
> Session 29 (2026-06-21, 14-HIGH) closed **1** ch.15 MED — **Q-15-001 ✅ resolved-by-removal** (`searchBooks` was
> deleted with the dead `/api/library/search` route during the ch.14 Q-14-001 HIGH fix — the cross-org-scan primitive
> is gone, not patched) — so **23 → 22**. (Cross-chapter: the finding is owned by ch.15; the count moves in ch.15/ch.24.)
> Session 32 (2026-06-22, 16-MED) closed **2** ch.16 MED — Q-16-002 ✅ resolved (the create-student learner/profile
> writes folded into one `withTenant({organizationId,userId:null})` tx — RLS-ready + atomic; self-heal org-create stays
> raw by necessity) and Q-16-003 ✅ resolved (dedicated `studentCardSelect` + `StudentCardData` payload type in the
> canonical query module; `StudentCard` prop typed, the `student as any` dropped) — both fix-and-closed (true grade LOW,
> carried MED on cluster/convention; re-grade moot) — so **22 → 20**.
> Session 34 (2026-06-22, 17-MED) closed **3** ch.17 MED — Q-17-002 ✅ resolved (CourseBuilder passed `courseId`
> as `organizationId` to ResourcePicker → empty library tabs; one-line fix to the real org prop), Q-17-003 ✅ resolved
> (`POST /api/courses` got a Zod `createCourseApiSchema` + `assertParentProfile()`→403), Q-17-004 ✅ resolved (org
> filter merged into all 6 course-REST handlers' lookups; no `withTenant` — route handlers are session-scoped so the
> per-query extension GUC-scopes under RLS-on) — **20 → 17** — then **minted 1** (Q-17-010 ⏳ deferred, the `new:`
> taxonomy CREATEs hit SELECT-only RLS tables → fail under RLS-on; see the new by-theme entry below) — **17 → 18**.
> **Consolidated final pass (2026-06-22, ch.18 MED) closed 2** ch.18 MED — Q-18-002 ✅ resolved (grading POST org filter
> merged into the attempt lookup via the `assessment.course` relation + fail-closed null-org guard) and Q-18-003 ✅ resolved
> (header + item writes now ONE `withTenant` tx — atomic — and the per-item N+1 `findFirst` dropped for `updateMany`; an
> adversarial pass overrode an initial `db.$transaction([…])` which would nest tenant tx on the RLS-extended client) —
> **18 → 16**.
> **Consolidated final pass (2026-06-22, ch.19 MED) closed 2** ch.19 MED — Q-19-001 ✅ resolved (added an `auth()`→401
> session gate + normalized `runtime="nodejs"` across the 6 Academic-Spine REST routes; no org filter — global reference
> data; every consumer is an authed page) and Q-19-003 ✅ removed (dead `server/queries/curriculum.ts`, 4 helpers / 0
> importers / 218 lines; move-aside tsc delta = 0) — **16 → 14**.
> **Consolidated final pass (2026-06-22, ch.20 MED) closed 3** ch.20 MED — Q-20-003 ✅ resolved (bible-memory
> `getBibleText({reference})` arg-shape fix), Q-20-004 ✅ removed (5 dead legacy `family-discipleship/actions.ts` exports),
> Q-20-006 ✅ resolved (fixed+wired the `bible-memory.ts` schemas into the 4 live actions; dead `copyFolderToStudent`
> removed) — **14 → 11**.
> **Consolidated final pass (2026-06-22, ch.21 MED) closed 1** — Q-21-003 ✅ removed (owner chose remove-over-build:
> deleted the no-op Auto-Reschedule button; the reshuffle/`isLocked` feature is roadmapped §5 to be built fresh) — **11 → 10**.
> **Consolidated final pass (2026-06-22, ch.22 MED) closed 2** — Q-22-002 ✅ accepted (over-graded→LOW: grade/credit have no
> schema source; the course's spine `subject` is a different taxonomy than the transcript registrar dropdown, so "General"
> +parent-classify is correct-by-design) + Q-22-003 ✅ accepted/roadmap (tests/notes/signature editor = a deferred §5
> feature; pre9th/template are dead data) — **10 → 8**. *(Reconcile 2026-06-22, ch.23 pass: the ch.20-MED step above was miswritten `14 → 12` — should be `14 → 11` (14 − 3 = 11); that +1 cascaded through ch.21/22. Corrected so the lineage lands on the itemized open-MED list = 8: Q-12-008/009/010/011/012, Q-17-010, Q-23-002, Q-24-001.)*
> **Consolidated final pass (2026-06-22, ch.23 MED) closed 1** — Q-23-002 ✅ removed (dead web-grounded section
> producer chain, ~148 lines; zero importers; the live section path is the full-text `structureSectionsFromText`) — **8 → 7**.
> **Consolidated final pass (2026-06-22, ch.24) closed 1** — Q-24-001 ✅ removed (`git rm` the unauthenticated
> `/api/health` infra-disclosure diagnostic; owner-approved) — **7 → 6**.
- **Tenancy / authz drift (raw `db` + manual checks, RLS off):** ~~Q-11-001~~ ✅ resolved 2026-06-20
  (explicit `where:{id, organizationId}` predicate in the chat-route guard + fail-closed `if(!organizationId)`;
  no `withTenant` — single-op read, mirrors Q-10-001; Session 22), ~~Q-14-005~~ ✅ resolved 2026-06-21
  (cross-tenant write IDOR — `addArticle`/`addDocuments` derive org/user via `getCurrentUserOrg()` + null-guard +
  `assertParentProfile()`, client args dropped; adversarially a true HIGH, fix-and-closed; Session 28),
  ~~Q-14-006~~ ✅ resolved 2026-06-21 (`assertParentProfile()`→403 on the 4 create/extract API routes; Session 28),
  ~~Q-15-001~~ ✅ resolved-by-removal 2026-06-21 (`searchBooks` deleted with the dead `/api/library/search` route —
  ch.14 Q-14-001; the cross-org-scan primitive is gone, not patched; Session 29),
  ~~Q-16-002~~ ✅ resolved 2026-06-22 (create-student learner + learnerProfile creates folded into the existing
  `withTenant({organizationId,userId:null})` tx — all four org-scoped learner writes now tenant-stamped + atomic;
  no live vuln, RLS-readiness only; self-heal org-create stays raw under the relaxed null-context org INSERT policy;
  Session 32), ~~Q-17-002~~ ✅ resolved 2026-06-22 (CourseBuilder passed `courseId` as `organizationId` to
  ResourcePicker → all 6 library tabs empty; one-line fix to the real org prop, already wired; Session 34),
  ~~Q-17-003~~ ✅ resolved 2026-06-22 (`POST /api/courses` got a Zod `createCourseApiSchema` + `assertParentProfile()`
  →403, mirroring the `library/books` twin; global taxonomy minting stays by-design; Session 34),
  ~~Q-17-004~~ ✅ resolved 2026-06-22 (org filter merged into all 6 course-REST handlers' lookups —
  `findFirst({where:{id, organizationId}})` + fail-closed null-org guard, replacing the droppable `findUnique` + `!==`;
  no `withTenant` — route handlers are session-scoped so the per-query extension GUC-scopes under RLS-on; Session 34),
  ~~Q-18-002~~ ✅ resolved 2026-06-22 (grading POST: org filter merged into the attempt lookup via the `assessment.course`
  relation — AssessmentAttempt has no direct org column — + fail-closed null-org guard, replacing the post-fetch `!==`;
  writes moved into a `withTenant` tx; no live vuln, RLS-readiness + refactor-safety; consolidated pass).
- **RLS-cutover blocker — app writes to SELECT-only reference tables:** **Q-17-010** [MED] ✅ **RESOLVED 2026-06-23** (migration 0016 added scoped `app_user` INSERT policies on the taxonomy tables); *originally ⏳ deferred 2026-06-22*
  (minted Session 34) — the `new:` inline minting does `db.{subject,strand,topic,subtopic}.create` (4 sites:
  `api/courses/route.ts:35,59`, `api/courses/[id]/blocks/route.ts:132,167`) but migration-2:139-144 grants
  `app_user` **SELECT-only** on those reference tables (no INSERT policy → "writes only via migrations/seeds as
  superuser") → every such create fails-closed under RLS-on. No live vuln (RLS off today); belongs to the Q-001
  RLS-cutover gate (needs scoped INSERT policies via the batched migration, OR moving custom-taxonomy creation to a
  privileged/org-scoped path). NOT caught by Q-001's GRANT-level readiness check (row-policy-blind).
- **Broken / N+1 / missing validation:** ~~Q-10-004~~ ✅ resolved 2026-06-20 (corrected + wired
  `generateResourceSchema` via `safeParse` in `generateResource`; Session 19),
  ~~Q-18-003~~ ✅ resolved 2026-06-22 (grading POST: header + item writes now one atomic `withTenant` tx; the per-item
  N+1 `findFirst` replaced by `updateMany` on the `@@unique([attemptId,itemId])`; consolidated pass),
  ~~Q-20-003~~ ✅ resolved 2026-06-22 (bible-memory `addVerseToUser`: `getBibleText({reference})` arg-shape fix so a new
  verse fetches text immediately; consolidated pass),
  ~~Q-20-006~~ ✅ resolved 2026-06-22 (wired the fixed `bible-memory.ts` schemas — .cuid()→.uuid() — into the 4 live
  bible-memory actions; dead `copyFolderToStudent` removed; +test; consolidated pass),
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
  ~~Q-14-002~~ ✅ removed 2026-06-21 (dead `POST /api/library/scan` route deleted — zero callers; Session 28),
  ~~Q-14-003~~ ✅ resolved 2026-06-21 (`ResourceList.tsx:41` `/library`→`/living-library`; 2 dead
  `revalidatePath("/library")` no-ops + a sibling dead `revalidatePath("/resources")` deleted; Session 28),
  ~~Q-16-003~~ ✅ resolved 2026-06-22 (dedicated `studentCardSelect` + `StudentCardData` payload type added to the
  canonical `server/queries/students.ts`; `/students` list query + `StudentCard` prop now use it; the `student as any`
  cast + `student: any` prop dropped — single source of truth, no over-fetch; type-DX only, Session 32),
  ~~Q-19-003~~ ✅ removed 2026-06-22 (dead `server/queries/curriculum.ts` — 4 helpers, 0 importers, 218 lines; consolidated pass),
  ~~Q-20-004~~ ✅ removed 2026-06-22 (5 dead legacy `family-discipleship/actions.ts` exports + naming collision; consolidated pass),
  ~~Q-21-003~~ ✅ removed 2026-06-22 (owner chose remove-over-build: deleted the no-op Auto-Reschedule button; reshuffle/`isLocked` feature roadmapped §5),
  ~~Q-22-002~~ ✅ accepted 2026-06-22 (grade/credit have no schema source; subject is a spine-vs-registrar taxonomy mismatch — "General"+parent-classify is correct-by-design; over-graded→LOW),
  ~~Q-22-003~~ ✅ accepted/roadmap 2026-06-22 (tests/notes/signature editor = a deferred §5 feature; pre9th/template are dead data), ~~Q-23-002~~ ✅ removed 2026-06-22 (dead web-grounded section chain — `groundBookSections`/`structureBookSections` + helpers, ~148 lines; live path = `structureSectionsFromText`; consolidated pass).
- **Safety vocabulary / robustness:** ~~Q-12-003~~ ✅ resolved 2026-06-20 (Session 24 — urgent-notify routing
  made severity-label-independent; the DB enum-typing stays deferred with ch.02 Q-013), ~~Q-12-004~~ ✅ resolved
  2026-06-20 (Session 24 — academic whitelist scoped per-pattern; explicit self-harm + incest-action disclosures
  no longer cloakable; +tests).
- **Child-safety hardening (owner brief, 2026-06-20 / Session 24 — §5 roadmap, ch.12 §7):** Q-12-008 (regex
  fast-path fabricates target/relationship/coercion), Q-12-009 (child disclosure snippet stored org-readable for
  hard-stop flags), Q-12-010 (a dropped safety-scan enqueue is only logged — sole signal lost), Q-12-011 (scanner
  sees one message, no conversation context), Q-12-012 (prompt-injection into the safety + Thinkling prompts).
  *(Companion HIGH = Q-12-007 in the HIGH table, ⏳ deferred/OPEN; companion LOW = Q-12-013; T1-A = Q-12-001 ✅ resolved Session 25.)*
- **Config / infra / privacy posture:** ~~Q-01-001~~ ✅ resolved 2026-06-19 (README rewritten + `.env.example`;
  QSF docs removed — Session 2), ~~Q-01-002~~ ✅ resolved 2026-06-19 (`images.remotePatterns: []` — Session 2),
  ~~Q-03-003~~ ✅ accepted 2026-06-19 (by-design: bypass-RLS required for global reference writes;
  `rejectUnauthorized:false` is the Supabase-standard posture, repo-wide incl. runtime `db.ts:16` — Session 5),
  ~~Q-05-001~~ ❌ DISMISSED 2026-06-19 (PARENT idle IS sliding — the proxy re-stamps `iat` every >5 min,
  `proxy.ts:74-89`; the "absolute cap" claim overlooked the proxy; Session 10),
  ~~Q-19-001~~ ✅ resolved 2026-06-22 (the 6 Academic-Spine REST routes got an `auth()`→401 session gate + `runtime="nodejs"` normalized; no org filter — global reference data; every consumer is an authed page; consolidated pass).
- **Synthesis-chapter additions (§9 ops):** ~~**Q-24-001**~~ [MED] ✅ REMOVED 2026-06-22 (consolidated pass / ch.24,
  owner-approved) — `git rm src/app/api/health/route.ts`. The unauthenticated diagnostic disclosed DB host/project-ref/
  connection-role/`RLS_ENABLED`/table counts/commit; it was self-marked "TEMPORARY … remove this route" and had zero
  references repo-wide.
- **Account lockout (raised 2026-06-19):** ~~**Q-05-010**~~ ✅ RESOLVED 2026-06-19 (Session 10) — built an
  email-verified owner-PIN reset (Resend): picker "Forgot your parent PIN?" → 15-min token → `/select-profile/reset-pin`
  → `confirmOwnerPinReset` clears the owner PARENT `pinHash` (out-of-band factor = the owner's inbox).

### LOW (78 total) + INFO (fully triaged 2026-06-19, see CHANGELOG.md)
**INFO:** all 44 actioned — 28 resolved / 9 removed / 1 deferred / 1 partial / 1 verified / 1 accepted /
3 re-graded→LOW (Q-13-005, Q-20-010, Q-23-003) / 0 open; chapter §7 entries are marked ✅ / ◑ / ⏳ / 🔻.
**LOW: 78 total (71 original + 4 re-graded + 3 new: Q-10-011, Q-12-013, Q-13-009); 5 still open** (was 8 at the 2026-06-22 close; **Q-011, Q-013, Q-23-003 ✅ resolved 2026-06-23** in migrations 16/17 → 5).

> **Count basis — open LOW is itemized (this list is the ground truth, like the MED by-theme list).** The
> session-by-session prose *below* is **historical** and had silently drifted to **undercount** carried-forward
> deferred / kept-open / re-graded items (its tail read "4"); the authoritative current open-LOW set — verified
> against each chapter's §7 `Status:` line on 2026-06-22 — was the **9** below; the end-of-pass straggler sweep then
> closed Q-13-009 (✅ accepted), leaving **8**. (HIGH/MED reconcile fine via their own lists; this is the one grade whose
> running tally was prose-only.)
> **Open LOW set (authoritative, 5 — Q-011/Q-013/Q-23-003 closed 2026-06-23):**
> 1. **Q-01-004** (ch.01) — lint rules downgraded to warnings; owner-accepted deliberate adoption ratchet → **kept-OPEN (owner)**. *(Burndown 2026-06-23: baseline corrected for a stale `.claude/worktrees/` lint-pollution; **11 rules locked warn→error** (passes 1+2, incl. the react-hooks trio); then the `as any` cast burn-down COMPLETED (waves 1–17, 2026-06-24): no-explicit-any **273→153**, **0 casts in src** (+ a surfaced AI SDK v4→v5 migration); then the **`: any` ANNOTATION phase COMPLETED (153→0, 2026-06-24/25) → `no-explicit-any` LOCKED warn→error (12 rules locked now)**, surfacing+fixing several real bugs the `any` hid (Living Library select gaps, planner smart-slot, onboarding off-days, transcript narratives) and correcting a laundering slip (external `response.json()` now Zod-validated). Remaining Tier C = the **no-unused-vars** FINAL pass + no-img-element 11 (by design); **Q-01-004 closes when no-unused-vars locks.** See CHANGELOG + the any-annotation-burndown-approach memory.)*
> 2. **Q-09-005** (ch.09) — the unbuilt source-specific context-injection half of source-anchored generation → **kept-OPEN (unfinished feature)**.
> 3. **Q-10-010** (ch.10) — unverified caller-supplied lineage-id *write* on `generate-tool.tsx` (no cross-org *read* leak) → 🔻 re-graded MED→LOW, **⏳ deferred** with the Q-001 RLS-cutover audit.
> 4. ~~**Q-011**~~ ✅ **RESOLVED 2026-06-23** (ch.02 — migration 0016 renamed `organization_id`→`account_id` on transcripts + curriculum_specs + recreated the coupled RLS policies).
> 5. ~~**Q-013**~~ ✅ **RESOLVED 2026-06-23** (ch.02 — migrations 0016 + 0017 converted all 12 stringly-typed columns to DB enums).
> 6. **Q-12-013** (ch.12) — safety type/contract cleanups → **⏳ OPEN, deferred WITH the child-safety brief**. (2nd stray, surfaced this pass — minted in ch.12's MED cell after its LOW cell.) The straggler sweep re-verified it as **substantially overstated**: sub-claim (c) `isSafe`-is-unused is **refuted** (load-bearing store-the-flag gate at `safety-scan.ts:80`); `coercion` is by-design; `reasoning` dual-use is already handled (`[EVIDENCE:]` tag stripped at `notifications/safety-alert.ts:90`). Genuine residual = 2 minor safety refactors (z.infer-derive + reasoning split), deferred with Q-12-008..012 (§5). Evidence corrected in ch.12 §7.
> 7. **Q-16-001** (ch.16) — built-but-unlinked per-student daily-schedule view → **kept-OPEN (unfinished)**; wire-an-inbound-link roadmapped §5.
> 8. ~~**Q-23-003**~~ ✅ **RESOLVED 2026-06-23** (ch.23 — migration 0016 added `DocumentResource.extraction_status`; `process-document` got `onFailure`→FAILED + EXTRACTED-on-success + retries).
>
> *Closed by the end-of-pass straggler sweep:* ~~Q-13-009~~ ✅ ACCEPTED 2026-06-22 (ch.13 — ISBN-first dedup is correct-by-design; cross-edition collapse = a roadmapped content-fingerprint feature, §5). **9 → 8 open.**

*Historical running log (numbers below reflect the drifted prose tally; retained for provenance):* Session 1 (2026-06-19, ch.01 LOW) closed 3:
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
unfinished source-specific-context-injection feature, not dead fields). Session 18 (2026-06-20, ch.10 LOW) closed 3 + minted-and-resolved 1 → **45 open**: Q-10-005 ✅ resolved-by-doc (FILE upload re-documented as an unfinished feature, kept) + Q-10-006 ✅ accepted (DEEP_VISION grounding relies on gemini-2.5-pro's native YouTube processing — honest-incomplete, by-design) + Q-10-007 ✅ resolved (deleted dead `let tools: any = {}`; remaining boundary `any`s accepted under Q-01-004); new **Q-10-011 ✅ resolved** (GeneratorsClient dropped the `sourceId`/`url` deep-link params → 5 library "Use in Generator" buttons pre-selected no source; now read from `searchParams`). Session 19 (2026-06-20, ch.10 MED) re-graded **1 into LOW → 46 open**: Q-10-010's residual sub-claim 2 (unverified caller-supplied lineage ids on `generate-tool.tsx` — confirmed **no** cross-org read leak; low-value unverified-FK write) 🔻 re-graded MED→LOW + ⏳ deferred with the HIGH tenancy cluster (sub-claim 1, the plain-`db` write, was ✅ resolved via `withTenant`). Session 21 (2026-06-20, ch.11 LOW) closed 4 → **42 open**: Q-11-002 ✅ resolved (removed PII/debug `console.log`s — session email, full request JSON/chat, etc. — and stopped returning `error.stack`/`details` to the client; generic 400/500 bodies) + Q-11-003 ✅ resolved (removed dead `apiUrl` + stale commented options + the now-unreachable route query-param fallback) + Q-11-004 ✅ resolved (removed unused `Scales` import + added `as const satisfies` guard so a renamed/mistyped mode id fails compilation) + Q-11-005 ✅ removed (`git rm` the entirely-dead `src/lib/types/tools.ts`). Session 23 (2026-06-20, ch.12 LOW) closed 3 → **39 open**: Q-12-002 ✅ removed (dead `recommendedResolution` schema/type field — collected from the model, never read; REMOVE over WIRE to protect the deterministic "Minimum Social Responsibility" policy) + Q-12-005 ✅ resolved (`sendSafetyAlert` flag read/update moved off raw `db` onto explicit-ctx `withTenant` + an explicit `student.organizationId` predicate — no live vuln, but the one safety-pipeline op that could silently fail-closed at the RLS cutover) + Q-12-006 ✅ resolved (caregiver hard-stop centralized into one shared `isCaregiverHardStop()` predicate consumed by both `policy.ts` and the job; De Morgan-identical, the two independent runtime re-checks preserved). **Session 24 (2026-06-20, ch.12 MED) minted 1 new LOW → 40 open:** Q-12-013 (safety type/contract cleanups — unused `ageGap` + always-`NONE` regex `coercion`, `SafetyAssessment` hand-maintained vs the Zod schema, unused `isSafe`, dual-use `reasoning`; from the child-safety hardening brief). **Session 26 (2026-06-21, ch.13 LOW) closed 4 → 36 open:** Q-13-001 ✅ removed (dead single-hit `discoverFullText`/`findFullText` registry wrappers + the orphaned `BookTextResult` interface — superseded by the all-hits + fetch-fallback path) + Q-13-002 ✅ resolved (gutenberg.ts converged onto the shared `matching.ts` helpers; bespoke `scoreMatch` now delegates to `scoreTitleAuthor`, byte-identical; added the sources layer's FIRST unit test `matching.test.ts`; corrected the false matching.ts header that listed gutenberg as a consumer) + Q-13-005 ✅ resolved (LibreTexts deki-token silent coverage cliff now `console.error`-logged at the `assembleLibreTextsSections` `!tree?.page` degradation point — adversarial pass moved the log off the benign token-scrape onto the book-level failure that captures token/markup/network causes) + Q-13-007 ✅ accepted/correct-by-design (fail-safe null is the right guard for HTML/DOM scraping; no unguarded JSON trust-boundary; the by-title scrapers have registry-fallthrough masking, the corpus-only LibreTexts cliff is covered by Q-13-005). **Session 27 (2026-06-21, ch.14 LOW) closed 2 → 34 open:** Q-14-007 ✅ resolved (deleted the dead `GET /api/library/books` handler — zero callers, duplicated the books slice of `getLibraryResources`; also removed the unused GET-scoped `userId`) + Q-14-008 ✅ resolved (the book/video CREATE routes now `revalidateTag(`library-${org}`)` like the add-actions/extract routes, so the cached `/living-library` catalog busts on add instead of staying stale to the 1h TTL; corrected the finding's false `router.refresh()`-bypasses-the-cache hedge — `unstable_cache` Data Cache only clears via revalidateTag/TTL). **Session 29 (2026-06-21, ch.14 HIGH) minted 1 new LOW
→ 35 open:** Q-13-009 (ch.13) — cross-org extraction dedup fragments across editions of the same work (`computeDedupKey`
is ISBN-first, so different printings of *1984* re-extract redundantly + fragment the community corpus); the proper fix is
a roadmapped content-fingerprint dedup feature (24 §5), so LOW now. **Session 30 (2026-06-22, ch.15 LOW) closed 4 →
31 open:** Q-15-002 ✅ removed (`searchVideos` deleted — the per-org video twin of the S29 `searchBooks`; built-but-unwired,
zero importers, no UI consumer) + Q-15-003 ✅ removed (`generateVideoEmbedding` deleted — wrote `video_resources.embedding`,
a column nothing reads; dead at both ends) + Q-15-004 ✅ removed (`git rm src/lib/cache.ts` — superseded dead caching
scaffold; the inline `revalidateTag` pattern shipped instead, never importing its `CACHE_TAGS` taxonomy) + Q-15-005 ✅
accepted/won't-fix (`crossWalkTextbookTopics` N+1 ≤250 cosine queries — bounded best-effort bg Inngest step; **no vector
index** on `textbook_chunks.embedding` so a set-based rewrite has no algorithmic gain + carries regression risk).
**Session 31 (2026-06-22, ch.16 LOW) closed 3 → 28 open:** Q-16-004 ✅ resolved (fixed the broken
`/living-library/resource/undefined` "Open Resource" link via the already-selected `assignment.resource.id` +
deleted the dead `notes` block — `ResourceAssignment.notes` has no producer) + Q-16-005 ✅ resolved (wired the
ParentDashboard "Daily Liturgy" card to the seeded `Devotional` table via a new bare-`db` `getTodayDevotional()`
+ prop — honest dynamic content with a static fallback) + Q-16-007 ✅ resolved (per-step `assessmentSchema`
discriminated union via `safeParse` → 400 before the paid AI call + dropped 4 `any`s; permissive on values so the
nested interests payload still parses, precise on per-step shape). **Q-16-001 kept OPEN** (re-documented from
"orphaned/dead" to an **unfinished built-but-unlinked daily-schedule view** — owner keeps it; wire-an-inbound-link
roadmapped §5; the cascade fns `getStudentDailySchedule`/`toggleItemStatus` + INFO Q-21-010 stay live, no ch.21 change).
**Session 33 (2026-06-22, ch.17 LOW) closed 3 → 25 open:** Q-17-005 ✅ removed (`git rm` dead `course-pacing.ts`,
~193 lines — zero importers, build-safety proven via move-aside + `tsc` delta; the live `distributeCourse` never
consulted pacing output; ch.21 §6 cross-refs updated) + Q-17-006 ✅ resolved (added shared
`validateBlockNesting`/`BLOCK_KIND_ALLOWED_PARENTS` to `lib/schemas/courses.ts` + the file's first test
`courses.test.ts` (8 cases), enforced on the create POST + edit PATCH — PATCH validates the **merged** post-update
`(kind, parentKind)` pair since the two change independently; owner chose FIX over the leaning-ACCEPT, single-tenant
so no live security/crash impact) + Q-17-007 ✅ resolved (comment-only correction of the stale "Step 3 removed /
only 2 steps" comments in `blueprint.ts`/`onboarding.ts` — the 3-step wizard is correct and the only reader of
`progress.step` renders step 3 as the live Environment form, not "Done"; same shape as Q-09-001, no behavioral change).
**Consolidated final pass (2026-06-22, ch.18 LOW) closed 3 → 22 open:** Q-18-005 ✅ accepted/correct-by-design
(`letterGrade`/`AssessmentItemResponse.isCorrect` never written — re-verify CONFIRMED **zero readers** anywhere in
src/, so the "transcripts see nulls" impact was overstated; the transcript subsystem types course grades into a
`TranscriptData` JSON blob and never queries attempts — populating them now is false precision needing an attempt-level
grading scale that doesn't exist → aspirational columns, roadmapped §5) + Q-18-006 ✅ accepted/correct-by-design (no
student-facing assessment-taking flow — a multi-file feature explicitly "a separate, larger feature", already on the
§5 roadmap; Q-18-006 is the canonical register home, ch.16 mints none) + Q-18-007 ✅ resolved (grading save UX: 4
blocking `alert()` → sonner `toast`, `window.location.reload()` → `router.refresh()`, matching NewAttemptForm /
PrayerJournalClient.tsx:117-119). **Q-18-004 ⏳ deferred** (grades always labeled `AI_ASSISTED`; MANUAL never set) —
folded into the Q-18-001 server-side payload-validation fix (same pass, ch.18 HIGH): `gradingMethod` has zero readers
and stays client-spoofable until validated server-side; a standalone client heuristic was refuted (adversarial pass).
**Then ✅ resolved in the ch.18 HIGH cell (same pass)** — the client now sends a derived AI_ASSISTED-vs-MANUAL method,
server enum-validated alongside the Q-18-001 fix → **22 → 21 open.**
**Consolidated final pass (2026-06-22, ch.19 LOW) closed 3 (all ✅ ACCEPTED by-design — doc-only cell; adversarial pass
refuted the action-bias on all three) → 18 open:** Q-19-002 ✅ accepted (the ungated `getSubtopicObjectives` read is
correct-by-design for global Objective data — its true twin `spine-actions.getObjectives` is also ungated; a session gate
would regress + relitigate a reviewed decision; the Zod-skip is an inert footgun on a plain-String id — auth-gate sub-claim
rejected, doc's false "security comments" framing corrected) + Q-19-004 ✅ accepted (merging the two diverged read surfaces
is disproportionate; the dead 3rd copy is removed by Q-19-003; corrected the false "small/complete" premise — the spine IS
user-growable, but unbounded REST reads are the *correct* complete-dropdown behavior; a `take` ceiling is an optional
owner-discretionary nicety, not done) + Q-19-006 ✅ accepted (cosmetic runtime/try-catch drift; corrected the inaccurate
evidence — only subjects+topics pin runtime, NOT resource-kinds; the pins are redundant-with-the-Node-default; runtime
normalization folds into the Q-19-001 MED edit). No code change this cell.
**Consolidated final pass (2026-06-22, ch.20 LOW) closed 4 → 14 open:** Q-20-005 ✅ resolved (SPLIT — removed 3 dead
symbols `searchBible`/`fetchUnreachedByCountry`/`toggleQuestionMastery` + the searchBible orphan tail; `lib/schemas/bible-memory.ts`
kept for fix+wire by Q-20-006) + Q-20-007 ✅ accepted (the `/students/*` suite pages are proxy-gated — the "renders
unauthenticated" impact was FALSE; cross-tenant studentId residual is inert, used only for hrefs / org-asserted actions) +
Q-20-008 ✅ accepted/won't-fix (the `isPrivate` toggle is half-built — value never persisted, Lock/badge never triggers — no
leak since all prayer reads are per-user; wire-vs-remove is a deferred product/UI decision, §5 roadmap) + Q-20-010 ✅
accepted (cold-path `fs.readFile` micro-opt; only Missions calls it, the 175KB is already RSC-serialized to the client, and
React `cache()` would be a no-op). Adversarial pass corrected the action-bias on 007/010 + the factual evidence on 007/008/010.
**Consolidated final pass (2026-06-22, ch.21 LOW) closed 5 → 9 open:** Q-21-001 ✅ resolved (`getNextSchoolDays` reads
`classroom.schoolDaysOfWeek` with a Mon-Fri fallback for null/empty — fixes 4-day/Sunday schedules) + Q-21-002 ✅ resolved
(wired the dead `distributeCourseSchema` via `safeParse`; +test) + Q-21-004 ✅ resolved (ad-hoc add now awaits the write
before `router.refresh()`, mirroring `handleDragEnd` — also fixed a dead `toast.promise` error branch that showed success
on failure) + Q-21-005 ✅ resolved (removed a dead server-helper import from the client PlannerGrid) + Q-21-009 ✅ resolved
(un-exported `getHolidays` — live via `isHoliday`, dead export keyword dropped).
**Consolidated final pass (2026-06-22, ch.22 LOW) closed 5 → 4 open:** Q-22-001 ✅ removed (dead `PrintLayout.tsx` + 4
sibling primitives) + Q-22-004 ✅ removed (dead `deleteTranscript` + orphaned `assertParentProfile` import,
`getDefaultCoursesForGrade`, `validateCourse`) + Q-22-005 ✅ accepted (data-export raw-db org reads: explicit `orgId`
predicate is the live boundary RLS-off + `resolveTenant()` GUC-scopes RLS-on — already RLS-ready; "no backstop" framing
corrected) + Q-22-006 ✅ resolved (PDF empty-card `0.0`→`formatGPA(0)`/`formatCredits(0)` precision + removed the
duplicate GPA/Cr line + 3 dead CSS blocks; the full preview↔PDF merge stays accepted) + Q-22-008 ✅ accepted
(`isOfficial` aspirational orphaned column, like Q-18-005's letterGrade — removal=migration, wiring=feature).
**Consolidated final pass (2026-06-22, ch.23 LOW) closed 3** — Q-23-001 ✅ accepted (operator-triggered ops
pipeline — correct PARTIAL, not removable; misleading "user-triggered" comments noted), Q-23-004 ✅ accepted
(non-blocking QA gate is deliberate Gemini-outage tolerance; tightening is an owner §5 quality-tuning call),
Q-23-006 ✅ removed (`git rm src/data/heidelberg.json` — 2,480-line orphan, zero importers, incompatible shape vs
the live `catechisms/heidelberg.ts`). Q-23-003 stays **⏳ deferred** (batched migration). **This pass also reconciled
the LOW headline: the prose tail "4 → 1" was wrong — true open LOW = 9 (the carried-forward deferred/kept-open set
+ the newly-surfaced 2nd stray Q-12-013); see the authoritative itemized set at the top of this section.**
**End-of-pass straggler sweep (2026-06-22) closed 1 → 8 open:** Q-13-009 ✅ accepted (ISBN-first cross-edition dedup is
correct-by-design; cross-edition collapse = a roadmapped content-fingerprint feature, §5). Q-12-013 stays ⏳ OPEN,
deferred WITH the child-safety brief — the sweep re-verified it as **substantially overstated** (sub-claim (c)
`isSafe`-is-unused **refuted**: it is the load-bearing store-the-flag gate at `safety-scan.ts:80`; `coercion` is by-design;
`reasoning` dual-use is already handled), evidence corrected in ch.12 §7; genuine residual = 2 minor safety refactors
folded into the §5 child-safety program.
Recurring themes: dead
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
| ~~`src/app/api/health/route.ts`~~ | **REMOVED** | ✅ `git rm` 2026-06-22 (Q-24-001, owner-approved) — was an unauthenticated DB-diagnostic leaking host/projectRef/connection-role/`RLS_ENABLED`/table counts/commit; self-labelled temporary, zero references. |
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
