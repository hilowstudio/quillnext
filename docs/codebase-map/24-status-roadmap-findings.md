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
| Resource generation / Creation Station (10) | **PARTIAL** | resources 9, curriculum_specs 2, bundles 2 | Works; FILE source is a stub, generation does **no input validation** (Q-10-004). |
| Curriculum compiler — Inngest (23) | **DONE** | bundles 2 (completed) | Multi-step fan-out within Vercel's 60s/step ceiling. |
| Living Library (14) | **PARTIAL** | books 5, videos 1, articles 1, documents 0 | 2 dead routes; write-path trusts client org/user (Q-14-005). |
| OER ingestion + RAG corpora (13/15/23) | **DONE** | book_text_chunks 2,785, textbook_docs 3, textbook_chunks 1,581, coverage 90, book_extractions 6 + 18 sections | Real ingestion has run; `searchVideos`/video-vector path dead (Q-15). |
| Students / learners (16) | **DONE** | learners 2, learner_profiles 2 | Create-student self-heals a missing org. |
| Assessment & grading (16/18) | **BUILT, UNEXERCISED** | assessments / items / attempts / responses / progress all **0** | No real student-taking flow; grading API has **no input validation** (Q-18-001). |
| Planner / scheduling (21) | **BUILT, UNEXERCISED** | schedule_items 0, custom_events 0 | Tenant-solid; "Auto-Reschedule" + `isLocked` unimplemented (Q-21-003). |
| Transcripts (22) | **BUILT, UNEXERCISED** | transcripts 0 | `generateTranscriptData` discards real grades (Q-22-002); `PrintLayout` dead. |
| Family discipleship (20) | **MIXED** | bible_memory 51, prayer_entries 2, catechism_progress 0, church_notes 0, prayer_categories 0 | bible-memory/prayer live; **prayer delete broken** (Q-20-002); missions/neighbor/devotionals/catechism **unauthenticated** (Q-20-001). |
| Thinkling chat (11) | **DONE** | (no table) | Streams Gemini; tenant-guarded; **no tools wired**; heavy PII debug logging (Q-11). |
| Child safety (12/23) | **DONE** (fails OPEN) | **safety_flags 15** | Pipeline has fired; LLM path **fails open** (Q-12-001); email-only; no UI reads flags. |
| Context engine (09) | **DONE** | (n/a) | Real production prompt path; 2 dead components. |
| AI core (08) | **DONE** | (n/a) | **Gemini-only** — no OpenAI provider despite the "Gemini+OpenAI" framing; retirement-fallback machinery dead; 2 prompt-builders. |
| App shell / nav (06) | **DONE** | (n/a) | Large **dead 2nd-generation** nav/shell surface (CommandPalette, MainNav, UserNav, …). |
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
- Flip on RLS (`RLS_ENABLED=true` + `DATABASE_URL`→`app_user`) after verifying `app_user` GRANTs
  (Q-001) — today the app bypasses the DB's 98 policies.
- Close write-path trust + IDOR gaps: Q-10-001/002/003, Q-14-005, Q-16-002, Q-17-003/004, Q-18-001/002.
- Make child-safety **fail closed** (Q-12-001); add a UI to review `SafetyFlag` rows.
- Remove/auth-gate the unauthenticated infra-disclosure `/api/health` route (Q-24-001) and the
  unauthenticated discipleship/spine endpoints (Q-19-001, Q-20-001).

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

0 CRITICAL · **10 HIGH** · **35 MED open** · 71 LOW · 44 INFO (chapter findings) + foundational findings
from 02/04. Full evidence/impact for each is in the owning chapter's §7.

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

### Foundational (chapters 02 & 04)
- `Q-001` [HIGH] App bypasses DB RLS (RLS_ENABLED off + BYPASSRLS connection role); app-layer org
  filters are the sole live boundary. *(refined by Phase C: DB has 98 policies on all 67 tables +
  an `app_user` role — see §8.)*
- `Q-002` [LOW] Supabase JS clients are dead; their "PostgREST is public" comment is now stale (RLS on).
- `Q-003` [LOW] `SignInButton` component dead. · `Q-004` [MED] `allowDangerousEmailAccountLinking:true`.
- `Q-005` [LOW] org stamped on JWT only at login (mitigated by DB re-read). · `Q-006` [INFO]
  `deleteAccount` is a tenant-wide destructive cascade (OWNER-gated).
- `Q-011` [LOW] org-FK column naming drift (`account_id` vs `organization_id`). · `Q-012` [INFO]
  spine dual identity (`code`+`uuid`) — **resolved by ch.19: queries key on `id`**. · `Q-013` [LOW]
  stringly-typed status/category fields bypass enums. · `Q-014` [INFO] `TextbookTopicCoverage.topicId`
  has no FK.

### HIGH (10) — all from the feature chapters
| id | title |
|---|---|
| Q-10-001 | `getSourceMetadata` reads org tables on plain `db` with no tenant predicate (IDOR). |
| Q-10-002 | compile/patch curriculum actions write org rows on plain `db` (app-check only). |
| Q-10-003 | `suggestCourseBlocks` creates CourseBlocks on plain `db` after app-only ownership check. |
| Q-12-001 | Safety LLM deep-path **fails OPEN** on any error — detection silently disabled. |
| Q-14-001 | Dead route `GET /api/library/search` runs a global cross-org vector scan before org-filtering. |
| Q-14-004 | Generated-resources query builds a Prisma `where` from unvalidated `searchParams`. |
| Q-17-001 | Activity-creation page POSTs to a **nonexistent** route — activity authoring broken. |
| Q-18-001 | Grading API POST has **zero input validation** (trusts client scores/method). |
| Q-20-001 | Unauthenticated server actions + ungated RSC pages (missions/catechism/neighbor/devotionals). |
| Q-20-002 | `deletePrayerEntry(string)` vs `z.object` schema → prayer delete always fails. |

### MED (35 open) — by theme (see chapter §7 for evidence)
- **Tenancy / authz drift (raw `db` + manual checks, RLS off):** Q-11-001, Q-14-005, Q-14-006,
  Q-15-001, Q-16-002, Q-17-002, Q-17-003, Q-17-004, Q-18-002.
- **Broken / N+1 / missing validation:** Q-10-004, Q-18-003, Q-20-003, Q-20-006, Q-05-002.
- **Dead code / duplication / drift:** Q-03-001, Q-06-001, Q-06-002, Q-08-001, Q-09-001, Q-14-002,
  Q-14-003, Q-16-003, Q-19-003, Q-20-004, Q-21-003, Q-22-002, Q-22-003, Q-23-002.
- **Safety vocabulary / robustness:** Q-12-003, Q-12-004.
- **Config / infra / privacy posture:** ~~Q-01-001~~ ✅ resolved 2026-06-19 (README rewritten + `.env.example`;
  QSF docs removed — Session 2), ~~Q-01-002~~ ✅ resolved 2026-06-19 (`images.remotePatterns: []` — Session 2),
  Q-03-003 (seeders bypass RLS w/ TLS verify off), Q-05-001 (PARENT "idle" is a 15-min absolute cap),
  Q-19-001 (spine REST unauthenticated).
- **Synthesis-chapter additions (§9 ops):** **Q-24-001** [MED] `/api/health` is an unauthenticated
  diagnostic that discloses DB host/project-ref/connection-role/`RLS_ENABLED`/table counts/commit —
  explicitly marked "TEMPORARY … remove this route" but still present.
- **Account lockout (raised 2026-06-19):** **Q-05-010** no in-app recovery for a forgotten PARENT PIN
  (the only PIN mutations are PARENT-gated) — owner-parent lockout risk; recommend an email-verified reset.

### LOW (74 total) + INFO (fully triaged 2026-06-19, see CHANGELOG.md)
**INFO:** all 44 actioned — 28 resolved / 9 removed / 1 deferred / 1 partial / 1 verified / 1 accepted /
3 re-graded→LOW (Q-13-005, Q-20-010, Q-23-003) / 0 open; chapter §7 entries are marked ✅ / ◑ / ⏳ / 🔻.
**LOW: 74 total (71 original + 3 re-graded); 71 still open.** Session 1 (2026-06-19, ch.01 LOW) closed 3:
Q-01-003 ✅ removed (`prisma.config.ts.bak` deleted), Q-01-005 ✅ resolved (`verify-seed.ts` + `debug-connect.ts`
deleted, tsconfig excludes trimmed), and — consequentially — Q-03-002 ✅ removed (same `verify-seed.ts` deletion);
Q-01-004 reviewed → kept OPEN (owner). Hotspots: ch.11 (debug logging), ch.08
(dead model/retirement helpers). Recurring themes: dead exports, missing Zod on REST routes, unbounded
`findMany` (no `take`), and Gemini-model-name churn.

## 8. Live-DB grounding appendix (Phase C, read-only)

- **RLS:** every one of the 67 public tables has `rls_enabled=true` with **98 policies**; an
  `app_user` role exists (`rolbypassrls=false`, can login). `postgres`/`service_role` have
  `BYPASSRLS=true`. The app runs `RLS_ENABLED=false` and (by inference, since it functions with GUCs
  unset) connects as a BYPASSRLS role → **policies present but not enforced for the app** (Q-001).
  `_prisma_migrations` is the only table with RLS-but-no-policy (advisor INFO).
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
