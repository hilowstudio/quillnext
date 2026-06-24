# quillnext Codebase Map — Index

A code-truth map of the **quillnext** codebase (product brand *"Quill & Compass"*) — a Next.js 16 /
React 19 / Prisma 7 / Supabase homeschool platform combining AI curriculum generation, learning
management, and family discipleship.

- **Authored against commit `b585c1e`** by reading the source (not prior docs — those were stale and
  deleted). Each chapter stamps the same SHA; re-verify if HEAD has moved far.
- **How it was built:** every tracked code file was read start→EOF and assigned to exactly one
  chapter (manifest audit: **405 code files, 0 unaccounted**). Foundational chapters 02 & 04 were
  hand-written; 01 + 03 + 05–23 were drafted by per-chapter readers and re-checked by adversarial
  verifiers against source; 24 + this index were synthesized. Claims are verified against **code**
  (and, where noted, read-only live-DB introspection), never against other docs.
- **Operating skill:** `.claude/skills/quillnext-mastery/SKILL.md` encodes the rules, conventions,
  and anchor gotchas used to produce and maintain this map. Read it before extending these docs.

## The one thing to know first

**DB Row-Level Security is now LIVE — cutover executed 2026-06-23 (Q-001 ✅).** All 67 tables have RLS +
98 policies; the running app connects as the non-bypass **`app_user`** role with `RLS_ENABLED=true`, so the
DB-side policies enforce tenant isolation and the application layer's explicit `organizationId` filters +
`getCurrentUserOrg` are now **defense-in-depth**, not the only boundary. The connection is derived from the
Vercel↔Supabase integration's `POSTGRES_URL` (role swapped to `app_user` via `APP_USER_PASSWORD`; see
`src/lib/db-url.ts` `withRole`). History, mechanism + rollback: the **RLS-cutover runbook** in **24 §5/§8** +
**04**, and the **2026-06-23 CHANGELOG round** (incl. the auth-incident post-mortem).

## Conventions

- **Chapter template:** Scope → Purpose/intent → Architecture & key files → Data flow → Status table
  → Integration points → Findings.
- **Status legend** (always with `file:line` evidence): **DONE** (implemented + wired) · **PARTIAL**
  (happy-path, gaps remain) · **STUB** (placeholder, unwired) · **DEAD** (zero importers repo-wide) ·
  **EXPERIMENTAL** (prototype/script, not in the production path).
- **Findings:** `Q-<chapter>-<seq>` (e.g. `Q-10-001`), severity `CRITICAL/HIGH/MED/LOW/INFO`, with
  evidence + impact. Foundational findings from 02/04 are `Q-0NN`. **All findings are documented, not
  fixed.** The canonical roll-up is **24 §7**; full detail lives in each chapter's §7.

## Chapters

| # | File | Covers |
|---|---|---|
| 00 | `00-INDEX.md` | This index: conventions, status legend, chapter directory, coverage guarantee. |
| 01 | `01-platform-build-config.md` | Toolchain, npm scripts, Next/TS/ESLint/PostCSS/Vitest/Prisma config, CI, Tailwind v4 entry, env-var appendix. |
| 02 | `02-data-model.md` | `prisma/schema.prisma` — all **68 models / 23 enums** (+`PendingSafetyScan`, migration 0018), the org-scoped vs global ownership partition, cross-cutting patterns (polymorphic CourseBlock, global dedup, spine cross-walks, pgvector). *Hand-written.* |
| 03 | `03-migrations-seeds.md` | The 16 migrations (incl. the RLS-policy SQL), the 6 idempotent seeders + their data sources, schema↔migration drift. |
| 04 | `04-security-auth-tenancy.md` | NextAuth v5 (Google/JWT), the `proxy.ts` route + profile gate, the signed active-profile cookie, the tenancy machinery (`getCurrentUserOrg`/`withTenant`/`CONTEXT_FREE_MODELS`), the RLS-bypass reality, Supabase/Firebase clients. *Hand-written.* |
| 05 | `05-profiles.md` | Profile picker, PIN set/verify/throttle, avatar editing, parent-as-learner "My Learning", backfill, KID-view seam. (Best-tested subsystem.) |
| 06 | `06-app-shell-navigation.md` | Root layout, profile-aware home router, GlobalShell/Sidebar/AccountMenu, icons — and a large **dead** 2nd-generation nav surface. |
| 07 | `07-ui-primitives.md` | shadcn/Radix UI primitives, `cn()`, `MarkdownContent`, `useZodForm`. |
| 08 | `08-ai-core.md` | Gemini model routing/config, guardrails, AI output schemas, personality AI, Thinkling system prompt; the **two prompt-builders**; dead OpenAI/retirement machinery. |
| 09 | `09-context-engine.md` | `MasterContext` assembly + serialization (the real AI prompt path), completeness scoring, smart defaults, the `/context` inspector. |
| 10 | `10-resource-generation-creation-station.md` | Creation Station UI + `generateResourceCore` pipeline, the generative-UI path, the curriculum compiler trigger/explode. |
| 11 | `11-thinkling-chat.md` | Student AI tutoring chat: `/api/chat` streaming, tenant guard, safety-event emission. |
| 12 | `12-safety.md` | Child-safety detect→decide→escalate→store→act pipeline; Resend email alerts; **fails-open** risk. |
| 13 | `13-oer-sources-corpus.md` | OER source adapters (by-title vs by-subject registries), metadata APIs (Google Books/OpenLibrary/YouTube), transcript scrape, ISBN dedup, commentary parser. |
| 14 | `14-living-library.md` | Per-org resource catalog UI + library API routes + add/extract flows; dead routes & write-path trust gaps. |
| 15 | `15-vector-rag-caching.md` | `vector.ts` pgvector RAW-SQL substrate, RAG stage→drain→embed, textbook-coverage, the two caching modules. |
| 16 | `16-students-learners.md` | Learner lifecycle, assessment wizard, parent/student dashboards; create-student org self-heal. |
| 17 | `17-courses-blocks-onboarding.md` | Course builder, polymorphic block tree, course actions/REST, course pacing, onboarding/blueprint wizard (creates the Org). |
| 18 | `18-grading-assessment-runtime.md` | Grading runtime (attempts/responses/AI feedback); no real taking flow; unvalidated grading API. |
| 19 | `19-curriculum-spine-api.md` | Read API over the global academic spine (REST routes + spine actions); resolves the spine `id`-vs-`code` question; dead query module. |
| 20 | `20-family-discipleship.md` | The 9-feature discipleship suite (bible-memory/study, catechism, prayer, church, devotionals, heart-check, missions, neighbor); ESV + Joshua Project + commentary integrations; unauthenticated content actions. |
| 21 | `21-planner-scheduling.md` | Weekly planner DnD grid + scheduling actions (`distributeCourse`); unimplemented auto-reschedule. |
| 22 | `22-transcripts-records.md` | Transcript builder/preview/PDF export, data-export; dead `PrintLayout`; lossy `generateTranscriptData`. |
| 23 | `23-background-jobs-content-pipelines.md` | The 11 Inngest jobs (extraction/ingest/compile/safety/process-document), AI extraction libs, and the static reference corpora (by shape). |
| 24 | `24-status-roadmap-findings.md` | **Synthesis:** product overview, status dashboard (code × live-DB), end-to-end journeys, roadmap (what's left), test-coverage map, the **canonical findings register**, DB-grounding appendix, and the ops catch-all files. |
| — | `CHANGELOG.md` | Running log of findings-driven code changes + owner follow-ups (kept in lockstep with the chapters). |

## Findings at a glance

0 CRITICAL · **0 HIGH** · 0 MED · 1 LOW open · 44 INFO (chapter findings) + foundational `Q-0NN` from
02/04 (`Q-001` [HIGH] **✅ RESOLVED 2026-06-23** — RLS cutover LIVE; `Q-011`/`Q-013`/`Q-23-003` shipped in
migrations 16/17; foundational MED fully closed). **The findings program is complete except 2 owner-accepted
LOWs.** Child-safety Q-12-007 [HIGH] **✅ RESOLVED 2026-06-23** (in-the-moment Hybrid layer, built after the
owner's legal sign-off; see 24 §5/§7). **2026-06-23
(later): child-safety Phase 1 shipped** — Q-12-008/009/010/011/012 [MED] + Q-12-013 [LOW] all ✅ resolved
(+ non-safety Q-10-010 / Q-16-001 [LOW]). **Q-09-005 ✅ resolved 2026-06-23** (generator consolidation onto
`generateResourceCore`). Open **MED (0)**; open **LOW (1)** = **Q-01-004** only (lint warn-ratchet,
owner-accepted / kept-open by design; burndown pass 1 done 2026-06-23 — 8 rules locked warn→error,
637→548 warnings, Tier C pending sign-off). See **24 §5/§7** for the roadmap + full register.

## Excluded from line-by-line reading (documented by shape)

`src/generated/*` (generated Prisma client), `src/data/catechisms/*` (~27K lines of TS data),
`src/server/data/Matthew-Henry-Commentary-Volumes/*` (~82MB HTML), counties/mission/heidelberg JSON.
Their structure and consumers are documented in **03** (seeds) and **23** (pipelines).
