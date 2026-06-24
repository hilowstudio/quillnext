---
name: quillnext-mastery
description: Use when reading, documenting, mastering, or onboarding onto the quillnext codebase — and as the standing operating discipline for the codebase-map documentation effort under docs/codebase-map/. Triggers on "master the codebase", "document quillnext", "codebase map", "what does X do / where is X", "is X done or a stub", "audit for bugs/dead code", or any deep-dive into quillnext architecture. Encodes the source-of-truth rules, reading discipline, doc conventions, the verified codebase map + gotchas, and the orchestration recipe.
---

# quillnext Mastery & Documentation

The operating manual for achieving and persisting total mastery of the `quillnext` codebase
(a Next.js 16 / React 19 homeschool-education + AI-generation + family-discipleship platform).
Built solo for ~1 year; mature but unfinished. **Read this skill first, then work in-skill.**

Authored against commit `b585c1e`. Re-verify gotchas if the SHA has moved a lot.

> The findings-resolution effort this skill drove is **COMPLETE** (all chapters, CHANGELOG rounds 1–54;
> no actionable backlog remains). §9 is preserved as a reusable playbook, distilled from 35+ sessions,
> for any future resolution work. This skill was consolidated from a session-by-session log into
> generalizable principles — the codebase map (§5) and the disposition playbook (§9) are the crown jewels.

---

## 1. Mission & non-negotiable rules

1. **Code is the only source of truth.** Markdown, comments, doc-strings, and prior maps are
   *claims to verify*, never facts. The owner deleted the old `docs/codebase-map/`,
   `docs/superpowers/`, `README.md`, and scorecards precisely because they were stale/misleading.
   When code and a comment disagree, the code wins and the disagreement is a finding.
2. **Document, don't fix.** During the mastery pass, fix nothing. Record every bug / vuln / dead
   code / risky assumption as a `Q-NNN` finding (§4). Fixes are separate, explicitly-approved work.
3. **The database is read-only and precious.** The Supabase Postgres DB is freshly built and
   seeded (the seed took a long time). Use **read-only** MCP introspection only
   (`list_tables`, `list_migrations`, `list_extensions`, `get_advisors`, bounded `SELECT`s).
   **Never** `apply_migration`, `execute_sql` with writes, branch ops, or storage/edge writes.
4. **Never push, never deploy.** `main` auto-deploys to Vercel production. Request owner permission
   to commit or push unless owner explicitly asks. Writes are limited to `docs/codebase-map/`,
   `.claude/skills/quillnext-mastery/`, and the memory dir.
5. **Mastery first, debugging second.** Understand what the code does and *intends* to do before
   chasing a bug. Don't rabbit-hole into a fix and lose the thread of the read.

---

## 2. Reading discipline (how to read for mastery)

- **Read every assigned file start → EOF.** For files >2000 lines, page with `offset`/`limit`
  until EOF — never infer the tail from the head. The Read tool warns on partial views; respect it.
- **Emit a per-file coverage checklist** for every chapter: `path → lines read → status`. This is
  what makes "no file skipped" auditable. A file is only "done" when read to EOF.
- **Trace imports both directions.** Record what each file imports (its dependencies) and who
  imports it (its consumers). Zero consumers repo-wide ⇒ candidate DEAD. Consumers prove DONE.
- **Distinguish intent from state.** Capture (a) what it's *meant* to do, (b) what it *currently*
  does, (c) the gap. Status vocabulary (§4) carries (b)/(c).
- **Excluded from line-by-line** (document *shape + how consumed* only, do NOT read every line):
  `src/generated/` (Prisma client), `src/data/catechisms/*` (~27K lines of TS data),
  `src/server/data/Matthew-Henry-Commentary-Volumes/` (~82MB HTML / 1,262 `.HTM`),
  counties JSON. Read the *seed/parse code* that consumes them, and a small sample of the data.

---

## 3. Documentation conventions

**Home:** `docs/codebase-map/`. One markdown per chapter, zero-padded (`01-…md` … `24-…md`),
plus `00-INDEX.md`. Chapter list and exact file ownership live in the approved plan.

**Every chapter uses this template:**
1. **Scope** — exact file/dir list this chapter owns (every tracked code file belongs to exactly one chapter).
2. **Purpose / intent** — what this area is for, in product terms.
3. **Architecture & key files** — the important modules, types, and entry points.
4. **Data flow** — request/response, server-action, or job flow through the files.
5. **Status table** — per unit, one of the status values below, with `file:line` evidence.
6. **Integration points** — imports, importers, env vars, external APIs, Prisma models, jobs.
7. **Findings** — `Q-NNN` items, also rolled into the central register (ch. 24).

Stamp each chapter header with the commit SHA it was written against (drift detection).

**Status legend (always with `file:line` evidence):**
- **DONE** — implemented and wired (has live consumers / route / job binding).
- **PARTIAL** — works for the happy path but has gaps, TODOs, or unhandled cases.
- **STUB** — placeholder body (returns mock/empty/`TODO`, not wired to real logic).
- **DEAD** — defined but zero importers/routes repo-wide; not reachable.
- **EXPERIMENTAL** — prototype/script not in the production path (e.g. `scripts/*-prototype.ts`).

**Verify claims against code, never against other docs.** DONE ⇒ grep importers/routes;
DEAD ⇒ confirm zero importers via Grep; STUB ⇒ point at the placeholder body; every referenced
env var / API / Prisma model must be confirmed to exist.

---

## 4. Findings register (`Q-NNN`)

One global, monotonically-numbered list (canonical copy in ch. 24). Each finding:

```
Q-007  [HIGH]  Missing org filter in <fn>  — src/app/actions/foo.ts:42
  Evidence: query reads Resource by id with no organizationId predicate; RLS is OFF (§5),
            so any authenticated user can read another org's resource.
  Impact:   cross-tenant data read.
  Status:   documented (not fixed)
```

Severity: `CRITICAL / HIGH / MED / LOW / INFO`. Categories worth their own sweep:
tenancy/authz, input validation, dead code, schema↔DB drift, duplication/drift, error handling,
secrets/logging, N+1/perf. **Document only — never fix during the mastery pass.**

### Triage bookkeeping — partition & reconcile
Treat any triage of findings into buckets (resolve / remove / defer / owner-decision / leave) as a
**set partition**, proven mechanically (the same discipline as the file manifest, §6):
- **Derive presented lists from the structured source** (the workflow's `id → verdict` map) — never
  hand-retype them; hand-transcription is where items get mis-routed or dropped.
- **Assert the partition:** every finding id appears in exactly one bucket; bucket sizes sum to the
  total; print the unaccounted count (must be 0).
- **Reconcile counts across artifacts:** the report, ch.24 register, and CHANGELOG must agree. A
  mismatch (e.g. "12" vs "13") is a bug signal, not a rounding difference — find the missing/dup item.
- **When you ADD a finding mid-session, bump EVERY tally spot in the same edit** (ch.24 top-line, the
  per-grade header, any per-chapter count). The by-theme *list* is ground truth; reconcile headers to it.
- **A grade headline may legitimately EXCLUDE foundational findings (`Q-0NN`)** — check the count basis
  before decrementing. Record a foundational closure in its own "Foundational" section + a one-line
  count-basis note, rather than bumping a headline that never counted it. (LOW inconsistently *does*
  count foundational LOWs — a known artifact; don't propagate it.)
- **Audit sibling roll-ups for stale tallies** — a count can drift in a doc you didn't touch. Grep the
  whole `/codebase-map` for the grade counts every session and reconcile ALL spots (incl. `00-INDEX.md`)
  to ch.24's by-theme ground truth; fixing such drift is a consequential doc-currency fix, not a new finding.

---

## 5. Verified codebase map & gotchas (anchor knowledge)

Stack: Next.js 16 App Router, React 19, TS 5.9 strict, Prisma 7.8 (`PrismaPg` adapter),
Postgres via Supabase, NextAuth v5 (Google OAuth, JWT), Vercel AI SDK (Gemini primary + OpenAI),
Inngest jobs, Firebase Admin, Tailwind 4, Radix, Tiptap, Zod, Vitest. ~67 models, 23 enums, 16
migrations, ~450 TS/TSX files (~55K lines of real logic).

**Orientation & gotchas (verified against code at `b585c1e` — re-check if changed):**
- **Middleware lives in `src/proxy.ts`** — `proxy.ts` is the Next.js 16+ filename convention for the
  middleware module (replaces `middleware.ts`); this is standard, not a quirk. It runs a fail-closed
  `PUBLIC_ROUTES` allowlist (`src/proxy.ts:23`), exports `proxy()` (`:42`), and its matcher excludes
  `api|_next|assets|favicon` (`:96`). Anything not public + unauthenticated is redirected; it also
  restamps the active-profile cookie. The matcher covers **page routes**, so a Server Action (it POSTs to
  its own page route) sits behind the same auth redirect as the page — but `proxy.ts` self-documents as a
  **backstop, NOT a replacement**: pages/actions must still self-gate (`getCurrentUserOrg()`/ownership).
- **`RLS_ENABLED` is OFF by default** (`src/server/db.ts:9`). When off, `db` is the bare Prisma
  client (`:114` returns `base`) — **DB row-level security is inert; the app layer is the ONLY live
  tenant boundary.** Therefore every org-scoped query MUST carry an explicit `organizationId`
  predicate; a missing one is a HIGH tenancy finding. Don't read the RLS *.sql migrations and assume
  isolation is enforced. When `RLS_ENABLED`, `db` is `base.$extends(...)` whose `$allOperations` wraps
  EACH op in its OWN `base.$transaction([setConfigRaw, query])` (`db.ts:113-132`) — so `withTenant` is
  the dormant explicit-ctx path, and `db.$transaction([...])` on the extended client NESTS transactions
  and breaks at cutover (see §9 tenancy playbook).
- **`CONTEXT_FREE_MODELS`** (`src/server/db.ts:37`) = global/shared reference + extraction tables
  that skip the per-query org GUC (academic spine, BookExtraction/VideoExtraction, textbook corpus,
  catechisms, commentary, counties, etc.). Reads are cross-org by design.
- **Canonical tenant gate:** `getCurrentUserOrg()` (`src/lib/auth-helpers.ts:10`) — resolves
  session → user → `organizationId` (returns `string | null`; `User.organizationId` is nullable, so
  callers need an `if (!organizationId)` guard). Server actions/queries should call it before touching data.
- **Two server-action homes:** `src/app/actions/` (~24 files) AND `src/server/actions/` +
  `src/server/profiles/`. Don't under-cover one.
- **Two prompt-builders:** `src/lib/ai/prompt-builder.ts` and `src/lib/utils/prompt-builder.ts` —
  reconcile (likely drift / dead copy); record which is live.
- **Two data/identity stacks coexist:** Prisma/NextAuth (primary) and Firebase Admin (storage only).
  Document what each is *actually* used for. **Supabase = the Postgres host, reached ONLY via
  Prisma/`DATABASE_URL`** — NOT a separate code stack. The old `@supabase/supabase-js` JS-SDK clients
  (`lib/supabase/client.ts`+`server.ts`) were **removed 2026-06-19 (Q-002, Session 6)** as dead code; the
  dev-time Supabase MCP is unrelated tooling. Beware: "Supabase" names both the live DB and the
  (now-deleted) JS SDK — keep them distinct (this exact ambiguity tripped the owner; see §9.3).
- **Global vs org-scoped extraction dedup:** the first org to extract a book/video populates the
  global `BookExtraction`/`VideoExtraction`; other orgs link for free. `vector.ts` does pgvector
  RAG over the global chunk tables.
- **Auth edge/node split:** `auth.config.ts` (edge-safe) vs `auth.ts` (node + Prisma adapter, PKCE
  cookie handling). Security-relevant and subtle.
- **Test skew:** ~10 of 12 test files are the profiles subsystem; AI/grading/courses/library/tenancy
  are effectively untested — that absence is itself a finding (ch. 24 test map).
- **`Unsupported("vector")`** columns: pgvector ops happen via raw SQL (`lib/utils/vector.ts`,
  Inngest workers), not the Prisma client.
- **`next/image` is barely used; `images.remotePatterns` governs nothing at runtime.** Only **2** `<Image>`
  usages exist, both local `/assets/branding/*` (`Sidebar.tsx:67`, `InklingToolkit.tsx:46`). *(Was 3 — `MainNav.tsx:49`
  was the 3rd, but `MainNav` was deleted as dead code 2026-06-19, Q-06-003 / Session 11.)*
  Every *remote* image (Google-OAuth + DiceBear avatars, YouTube/Books/OpenLibrary thumbnails, scraped
  article og:images) renders via plain `<img>` / Radix `AvatarImage`, which **bypass the optimizer**.
  `remotePatterns` is `[]` to close the `/_next/image` open proxy (Q-01-002, resolved 2026-06-19) — do not
  assume an image-host config change affects app rendering.
- **`Profile` ≠ `LearnerProfile` (easy to conflate).** `Profile` is the Netflix-style picker profile
  (`type` PARENT/STUDENT, pinHash, avatarConfig; `Learner.profileId` 1:1, nullable). `LearnerProfile` is the
  per-student **personality/learning-style assessment** payload (`LearnerProfile.studentId` → Learner). A finding
  about "profiles" can mean either; a Learner is a "student" iff its `profile.type` is STUDENT (or null for
  legacy/unlinked), **not** by whether it has a `LearnerProfile`.
- **Parent-as-learner rows exist by design** (My Learning: `enrollSelfInCourse` makes a `Learner` linked to the
  PARENT profile). Student-facing org-wide rosters/counts spread `excludeParentLearners`
  (`src/server/queries/learner-filters.ts`, `NOT:{profile:{is:{type:"PARENT"}}}` — Q-05-006, Session 9);
  **`data-export.ts` + `getMyLearning` are deliberately UNfiltered.** **Prisma null-relation gotcha:** to drop rows
  whose *nullable* to-one relation matches a value while KEEPING null-relation rows, use `NOT:{rel:{is:{…}}}` — a
  positive `rel:{is:{…STUDENT}}` would silently drop the null-relation rows.

---

## 6. Orchestration recipe (Workflow + read-only DB)

Ultracode is on — fan out with the **Workflow** tool, but stay in the loop and write the chapter
files yourself from agents' structured reports (keeps knowledge internalized).

- **Phase A — Manifest:** `git ls-files` (not `find`) minus the excluded set; map each path → one
  chapter; print any unowned path and stop. Shard chapters >~2,500 src lines (likely 10/14/20).
- **Phase B — Read & draft (pipeline per chapter):** reader agent (read-to-EOF + checklist + draft)
  → adversarial verifier (re-derive load-bearing claims from source). Do ch. **02** (data model) and
  **04** (security) first; everything references them.
- **Phase C — DB grounding (read-only):** `list_tables`, `list_migrations`, `list_extensions`,
  `get_advisors`, bounded `SELECT count(*)` to separate "seeded/working" from "stub" and to detect
  Prisma↔DB drift. Log drift as `Q-NNN`. **No writes, ever.**
- **Phase D — Audit & synthesize:** cross every per-file checklist vs the manifest (each path in
  exactly one chapter, read-to-EOF; diffs reopen the chapter), then write ch. 24 + `00-INDEX.md`,
  stamp SHAs.

Agents must: read-only (no builds/migrations/mutations), read assigned files to EOF, return the
per-file checklist + a templated chapter draft + `Q-NNN` findings.

---

## 7. Memory hooks (persist for future sessions)

After synthesis, write to the memory dir (and add `MEMORY.md` pointers):
- `project` — what quillnext is, the domain decomposition, current status, what's left.
- `feedback` — the owner's working rules (code-truth-only, document-don't-fix, DB read-only, never push).
- `reference` — pointer to `docs/codebase-map/00-INDEX.md` and the `Q-NNN` register.
Link related entries with `[[slug]]`. Verify a file/flag still exists before relying on a memory.

---

## 8. Self-check before claiming done

- [ ] Every tracked code file (minus excluded set) is in exactly one chapter, marked read-to-EOF.
- [ ] Unowned-file count printed = 0.
- [ ] Load-bearing claims reproduce at cited `file:line`; DEAD claims show zero importers.
- [ ] DB-truth statements match read-only MCP counts; drift logged as `Q-NNN`.
- [ ] `00-INDEX.md` names all chapters + the findings register; every named file exists.

---

## 9. Findings-resolution playbook (per document × grade cell)

**This effort is COMPLETE** (all chapters, CHANGELOG rounds 1–54; no actionable backlog). The
discipline below is preserved for any FUTURE resolution work (a re-map after major change, or a fresh
batch of findings). It is the proven loop, distilled.

Findings are worked off **cell-by-cell**, a **cell = one (chapter document × severity grade)** — e.g.
"`18-grading-assessment-runtime.md` — LOW". Cells run grade-ascending within a doc (**LOW → MED → HIGH**),
doc-ascending (01 → 24). Each cell leaves every `/codebase-map` doc current (the next cell trusts those
docs as truth).

**NOTE — this is the one place "document, don't fix" (§1) is lifted:** resolution DOES change code, but
only for owner-approved findings. All other hard rules hold: DB read-only / protect seeded data, **never
push**, no schema/migration changes without explicit approval (batch + defer), keep CI gates green.

**Two run modes — SAME per-cell discipline; they differ only in batching + how they end:**
- **One-cell mode** — owner pastes a per-cell prompt; do exactly ONE cell, then emit the next cell's prompt.
- **Consolidated pass** — owner triggers ONE pass clearing the whole remaining backlog; walk every OPEN
  cell in strict order (ch.18 LOW→MED→HIGH → ch.19 … → ch.24, skipping empty cells), applying the per-cell
  steps and **advancing** instead of stopping; end with a completion report. Update the
  `findings-resolution-progress` memory after each chapter (resumable) and append a `CHANGELOG.md` round
  per cell/chapter. **STOP and ask only for genuine forks** (build-vs-remove of a real feature,
  behavioral/tone change, anything destructive, a true product/legal `[DECISION]`); PROCEED automatically
  on clear-cut, adversarially-defended dispositions.

### Per-cell steps
0. **Load this skill + read the `findings-resolution-progress` memory** (the target cell / resume point).
   Work in-skill.
1. **Scope & re-verify.** Collect the target chapter's §7 **OPEN** findings of the target grade (skip ✅
   resolved/removed/accepted; ⏳ deferred and 🔻 re-graded stay tracked). Per §1 the doc is a *claim* —
   **re-verify each at its cited `file:line` against current code**; auto-dismiss any that no longer
   reproduce (note it). **Grep the OTHER `/codebase-map` docs for each finding's file/symbol** — the same
   file is often filed under two angles in two chapters, so one fix can close a sibling (update all
   affected docs in step 6). Empty cell → fast confirm-and-advance.
2. **Recommend (adversarial), then dispose** — apply the **Disposition playbook** below. Draft a
   code-grounded recommendation (re-read the cited code), then run an adversarial pass challenging it
   (over/under-engineering, hidden risk, correct severity, constraint conflict). A few findings → inline;
   many → the Workflow reader→verifier pipeline (§6). Return a defended recommendation per finding + a
   change-log of what the adversarial pass overrode.
3. **Owner decisions (partition).** Present recommendations bucketed: `FIX_NOW` / `BATCH_CLEANUP` /
   `LEAVE_AS_IS` (split: *correct-by-design* vs *not-worth-churn*) / `OWNER_DECISION` / `RE-GRADE` /
   `DISMISS`. **Derive the buckets mechanically from the structured recs and apply the §4 partition &
   reconcile check.** Use `AskUserQuestion` only for genuine forks; for a behavioral AI-prompt fork use
   **prompt-PREVIEW options** (render the real new artifact side-by-side). Owner instruction: **remove**
   correct-by-design findings; **explain** not-worth-churn ones; never silently drop one. **If the owner's
   reply reveals they misread the finding's scope → STOP, re-explain with the disambiguation, re-ask;
   never execute a decision made under a misapprehension** (e.g. "Supabase" = the live DB vs the dead JS SDK).
4. **Execute** the owner-approved changes. Edit by hand for control; fan out with Workflow only for large,
   well-bounded, parallelizable edits (verify hard after — agents can't catch visual/behavior regressions).
   For files an automation already touched this session, **Read before Edit** (freshness). With `replace_all`
   on identical blocks, watch for a handler that interleaves a line (forcing a separate edit).
5. **Verify (CI gates).** `npx tsc --noEmit` (0 errors), `npm run lint` (0 errors; warnings OK),
   `npm test` (all pass). Confirm `prisma/migrations/` **UNCHANGED**; an owner-approved `prisma/seed*.ts`
   edit is allowed but **never run** against the seeded DB. Confirm `git status` (scoped to your touched
   paths — the tree is noisy) shows only intended files. Recurring gate gotchas (environment artifacts,
   NOT regressions in your change):
   - **`prisma/seed*.ts` is excluded from tsc (`tsconfig.json:40`) AND lint (next-lint skips `prisma/`)** —
     edits there pass the green gates *unchecked*; run `npx eslint <changed seed file>` directly + hand-review.
   - **Deleting a route file → `tsc` `TS2307: Cannot find module '…/route.js'`** from stale `.next/types`;
     fix with `rm -rf .next/types .next/dev/types && npx tsc --noEmit` (gitignored, regenerate on build).
     Recurs for every dead-route deletion.
   - **Vitest "all files fail to collect / `reading 'config'` / no tests" = stale vite cache**, not
     flakiness; `rm -rf node_modules/.vite node_modules/.vitest && npm test` → 58/58. A docs-only session
     cannot break collection.
   - **A new `import "server-only"` module breaks any sibling test suite** that transitively imports it —
     add `vi.mock("server-only", () => ({}))` to each (`server-only` is not a real package here).
   - **`Date.now()`/`Math.random()`/any impure call in an RSC render body is a lint ERROR** (`react-hooks`)
     that tsc+tests miss — move it into a non-component (camelCase) helper the component awaits; run lint.
   - **The warning baseline can jump from the owner's intervening commit, not your change** — lint your
     touched files directly (0 new warnings) and note the shift; the 0-ERRORS gate is the real bar.
   - **`eslint .` silently lints leftover Workflow git-worktrees under `.claude/worktrees/`** — these are
     git-excluded (`.git/info/exclude`) so they're NOT in CI, but locally a stale `wf_*` worktree is a full
     repo copy → it **DOUBLES every warning/error count** and makes a freshly-locked rule "error" on the
     worktree's stale code (a phantom regression). Smell: counts look ~2× and `-f json` shows paths under
     `.claude/worktrees/`. Fix: ensure the eslint `ignores` covers `.claude/worktrees/**` (mirrors the git
     exclude). `git worktree list` to find it; it's the owner's call to `git worktree remove` (don't delete a
     worktree you didn't create — it may hold a prior session's commit). Found during the Q-01-004 burndown.
6. **Update ALL affected docs to current** (the next session's source of truth):
   - chapter §7 entries → `✅ RESOLVED` / `✅ REMOVED` (delete entry) / `⏳ DEFERRED` / `🔻 re-graded` /
     `✅ ACCEPTED`, each with a one-line note + `(see CHANGELOG.md)`; keep original evidence for history.
   - chapter §5 status rows if a unit's status changed (e.g. DEAD → REMOVED).
   - `24-status-roadmap-findings.md` register + tallies (counts, dated disposition note).
   - append a dated `CHANGELOG.md` section (per-finding: change, files, owner follow-ups, deferred items).
     Re-stamp a chapter's SHA if substantively edited.
   - **Update every chapter a change touched, not just the target** — a fix that closed a sibling finding
     elsewhere marks *that* doc's §7/§5/§1 and counts the sibling in the closed tally.
   - **Refresh `file:line` cites of the edited chapter's OWN still-OPEN findings** (and sibling chapters')
     if your edit shifted line numbers — currency, not a re-grade.
   - **Re-run the §4 partition check against the updated docs** (every finding accounted once; counts
     reconcile across §7 / ch.24 / CHANGELOG, including out-of-target-chapter siblings).
7. **Handoff.** Update the `findings-resolution-progress` memory: this session done, next target, owner
   follow-ups / new findings / deferred items, remaining sessions.
8. **Update the skill if you learned something** future sessions need (a new gotcha, process fix, recurring
   pattern). Prefer adding a *generalized principle* to the playbook over a session narrative.
9. **Advance (pass-mode) or emit the next-cell prompt (one-cell mode).** Pass-mode: advance to the next
   OPEN cell (skip empties, confirm against §7) and repeat; emit the completion report only when the
   backlog is clear. One-cell mode: emit ONLY the next cell's prompt (advance LOW→MED→HIGH then doc-ascending,
   skipping zero-OPEN cells) — never pre-compute the cell after it; lessons live in this skill body, **never**
   in the prompt.

---

### Disposition playbook (distilled from 35+ sessions)

The recurring patterns that decide *how* a finding resolves. Each is a generalization, not a recipe —
re-verify against current code. Worked examples live in `docs/codebase-map/` chapters + `CHANGELOG.md`.

**1 · Verification (every finding).**
- **Adversarial pass inverts action-bias.** The recommender (you or an agent) leans toward action —
  "add the plugin", "merge the builders", "batch the transaction". The adversarial pass exists to refute
  recommendations that don't survive. **Re-anchor the verifier's verdict to the finding's stated IMPACT** —
  a verifier optimizes for the question you posed and can miss the abuse surface the finding is about.
- **A schema/agent verdict validates SHAPE, not SUBSTANCE.** Agents return placeholder junk
  (`"test reason"`), reconstruct an input instead of reading it, and optimize for their sandbox. Eyeball
  every agent result and **re-derive the recommendation by hand** against real code/data before acting.
- **Verify what FLOWS through a config/pipeline, not just the data source.** Grep the consumer/renderer
  before sizing a fix — the answer can flip it (the image-optimizer `remotePatterns:[]` fix only worked
  because every remote image used plain `<img>`, bypassing `/_next/image`). A posture/config finding filed
  against ONE area is often **repo-wide** — grep the anti-pattern across the codebase (esp. the production
  runtime) before sizing; the broader scope can change the disposition.
- **Evidence beats assertion.** If a finding alleges a disabled/downgraded check hides debt (a lint rule
  at `warn`, a skipped gate), RUN the check and report real counts before recommending.

**2 · Right-sizing & disposition.**
- **Split a multi-claim finding; dispose of each claim separately** (avoids both "fix a non-issue" and
  "miss the real one"). Fix the cheap, provably-zero-risk half NOW; **RE-GRADE the residual only after you
  adversarially DISPROVE its scary impact** (the re-grade is earned by the disproof, not asserted).
- **fix-and-close makes a re-grade MOOT.** When a cheap zero-risk fix CLOSES the finding, decrement its
  *actual* grade + record the over-grade in the CHANGELOG — don't re-grade-and-keep-open. (Re-grade is for
  a *deferred* residual you're not closing.)
- **"audit X" findings resolve by doing the audit + following where it points** — sometimes a real fix,
  sometimes a by-design accept; performing the audit and recording the conclusion IS the resolution.
- **Never make a fix stricter than the consumer needs.** A `.url()`/`.uuid()` validator can reject input
  that works today (scheme-less URLs, topic phrases the prompt embeds verbatim). Validate at the ONE
  client-reachable boundary (the `"use server"` wrapper / route handler), NOT a shared core a trusted
  background job (Inngest) also calls directly.
- **An "unauthenticated server action / RSC page" finding is frequently OVER-GRADED** — a Server Action
  POSTs to its page route, which the proxy matcher covers (it excludes only `/api/*`), so the action sits
  behind the proxy's auth redirect (§5). Check `proxy.ts` PUBLIC_ROUTES before grading; still add in-file
  `auth()` as cheap defense-in-depth (the proxy is a backstop, not a replacement) → **regrade + fix-and-close**.

**3 · Dead / unfinished / superseded (the keep / delete / build fork).**
- **The owner's lens: "dead-as-superseded or dead-as-unfinished?"** Answer from code by tracing the
  SIBLING half of the feature (live lineage writes / inbound entry points prove intent), not the local
  no-op smell. Then: **superseded → delete; unfinished-but-reusable → keep + re-document as unfinished**
  (⏳ kept-OPEN, NOT decremented) *when the owner is tracking unbuilt work*; **unfinished-but-wrong-scoped
  → delete + roadmap fresh** (keeping wrong-scoped code as "scaffolding" preserves misleading dead code the
  real build won't reuse).
- **keep-as-is is DOMINATED when the broken surface is a LIVE, reachable, erroring entry point** (a button
  that always alerts an error) — the real fork is BUILD vs REMOVE. It's fine to ⏳ keep-open *invisible*
  scaffolding.
- **BUILD-vs-defer turns on COUNTING what already exists.** Data + UI + read-side + entry point all present
  and the only gap is ONE well-patterned handler → BUILD is in-scope (owner picks build, present with a
  lean). A whole new channel/UI + a legal `[DECISION]` (fundamentally multi-file) → DEFER.
- **Dead-code removal has a TAIL — the complete fix prunes it all:** orphaned imports/types/private enums
  (intra-file, same edit or tsc/lint fail) + orphaned npm deps + env vars (grep each repo-wide incl.
  tooling like `.mcp.json`) + co-located tracked `.md`/`.mdx` docs under `src/` + any module the deletion
  drops to zero importers (cross-chapter). Tail shapes: **same-chapter forced pair** (delete both; NARROW
  the higher-grade aggregate finding's scope, don't close it — only the LOW closes); **cross-chapter
  orphaned *reusable* primitive** under `src/components/ui/` (an OWNER_DECISION: delete vs keep+mark-DEAD;
  either way cross-chapter = doc-currency only, count moves in the OWNING chapter); **orphaned graded
  sibling finding** (closes resolved-by-removal in its chapter); **latent bug whose host is dead** (closes
  resolved-by-removal — verify the *live* path never had the bug). The tail is **REMOVE-only** — under KEEP
  it doesn't fire; document it as "would-cascade-if-removed".
- **Gold-standard removal proof:** an adversarial lens physically moves the file(s) aside + runs
  `npx tsc --noEmit` (0 before AND after) — grep proves "no static importer", move-and-compile proves
  build-safety. Also have one lens argue "WIRE it instead of delete" (the strongest keep-case) and confirm
  it collapses. **A worktree-isolated agent's tsc gives an unreliable ABSOLUTE count** (it lacks the
  git-ignored generated Prisma client) — trust the DELTA, then re-run real tsc yourself in the main tree.
- A dead-code finding can be **right in its conclusion (dead) yet wrong in its stated reason/coupling** —
  re-derive the data flow and correct the mis-attribution as part of the resolution.

**4 · Tenancy / RLS-readiness** (the largest cluster; codebase-specific).
- **`withTenant` with RLS OFF is a NO-OP** — it adds NO `organizationId` predicate (`db.ts:106-110`). The
  LIVE boundary today is an explicit `where:{organizationId}` (or relation filter) or an app-layer
  ownership check; `withTenant` is only the RLS-readiness (future) layer.
- **Three-way discriminator (the unifying rule):**
  - **session-scoped caller (route handler / server action) + SINGLE op → MERGED predicate, NO
    `withTenant`** — under RLS-on the per-query extension GUC-scopes each op via
    `getCurrentUserOrg()`→`setRlsContext` (one request = one async context, so the extension sees the ctx).
    Wrapping a lone op in `withTenant` is over-engineering.
  - **ANY caller + MULTI-op ATOMIC write → `withTenant(async tx => …, undefined, {organizationId,userId})`
    on the un-extended `tx`.** **NEVER `db.$transaction([...])` on the extended client** — it nests the
    per-op transactions (`db.ts:113-132`) → "Transaction already closed" / wrong-connection scoping /
    deadlock. Invisible today (RLS off → plain batch, CI green); **detonates only at the cutover** — the
    exact scenario the finding hardens, so tests won't catch it.
  - **session-LESS single op (Inngest / boot) → `withTenant` with explicit ctx** for the GUC
    (`resolveTenant()`→null otherwise; the job distrusts AsyncLocalStorage propagation).
- **Fix shapes:** no predicate today → **LIVE IDOR**, add the explicit predicate + a fail-closed
  `if (!organizationId)` guard (handles the null-org edge + narrows `string|null`→`string`, letting you
  drop now-redundant downstream `!` assertions); a separate post-fetch `row.organizationId !== org` compare
  → **MERGE into the query** (`findUnique`→`findFirst({where:{id, organizationId}})`, returns ≤1 row, then
  `!row → 403`); a correct app-check already present → no live vuln (over-graded on cluster membership) →
  the wrap brings it to the area standard, fix-and-close. **In a route handler with no outer try/catch, a
  bare top-of-body `await assert…()` throws → an unhandled 500; wrap it (`try { … } catch { return 403 }`)
  for a clean denial.**
- **Join-scoped tables** (no direct org column, e.g. `SafetyFlag`, `activity_progress`,
  `course_blocks→courses`) → the predicate is a **RELATION filter** (`where:{student:{organizationId}}`),
  mirroring the table's RLS policy; `findUnique`→`findFirst` forced. **Check the schema for a direct org
  column** (grep migration `…0002_rls_policies`) before writing the predicate.
- **Bootstrap writes stay raw.** An org self-heal `organization.create` can't be stamped to its own org —
  it runs under null context, which the relaxed `organizations` INSERT policy permits
  (`WITH CHECK (… OR app.current_org() IS NULL)`). CONTEXT_FREE models (e.g. `User`) stay raw too. Fold
  only the genuinely org-scoped sibling creates into ONE `withTenant` tx; re-derive the returned entity
  from the closure (a var created inside leaves scope), and keep network/AI calls OUTSIDE the tx (Prisma
  ~5s timeout).
- **SELECT-only-write trap (RLS-cutover gate):** a CONTEXT_FREE *reference* table that app code WRITES but
  whose RLS grant is SELECT-only (e.g. taxonomy `subject/strand/topic.create`) fails **CLOSED** the moment
  RLS flips. Grep the RLS migration for `CREATE POLICY … FOR (SELECT|ALL|INSERT)`. This is **NOT** caught
  by a GRANT-level readiness check (RLS needs both a GRANT and a permitting policy) — track separately +
  cross-link to the Q-001 cutover runbook. Resolution is a migration or design change → deferred.

**5 · AI / schema / prompt.**
- **A Zod schema on `generateObject`/`generateText({schema})` constrains the MODEL's OUTPUT, not the
  user's input** — so "schema enum value ≠ UI option" is by-design translation (the user's answer is
  serialized into the prompt; the model maps it to a schema value). Don't "fix" the contract to match the
  form.
- **Before adding a renderer/parser/tool/index to fix a "missing X" gap, verify three things:** what the
  producers actually EMIT (delimiters/formats — e.g. math as `\(…\)` vs the plugin's default `$…$`), the
  tool's default parsing + its **collateral damage** on existing content (a permissive default mangles
  benign `$5` currency), AND whether the configured **model/SDK already provides it natively** (e.g.
  `gemini-2.5-pro` has native YouTube processing). A plugin can simultaneously under-deliver and over-fire.
- **discriminated-union-vs-permissive-record turns on the CONSUMER signatures** (do per-branch consumers
  demand different value types?), not "does a permissive record accept the input." If yes → discriminated
  union (narrow via the tag; don't destructure — it breaks the union correlation); if uniform → one record.
- **Wiring a written-but-dead schema is a legitimate fix** — but re-derive it against the real producer
  payloads first (a drifted enum would reject valid input), and shape-lock it with the file's first test.
- **Before adding a new shared Zod schema/symbol, grep the repo for the name** — a same-named one may exist
  for a DIFFERENT path with an incompatible contract; name the new one distinctly (e.g. `…ApiSchema`).

**6 · Duplication / drift — converge the SURFACE, not the structure.**
- Converge the shared-concern *surface* via ONE source-of-truth (a constant, a `where`-fragment, a
  predicate); leave genuinely-different machinery (sync vs async I/O, distinct back-ends) separate.
  **Shape-lock with the first unit test** — a `toEqual` on a `where`-fragment, or
  `as const satisfies readonly { id: TheUnion; … }[]` on a hand-synced collection (`as const` is
  MANDATORY or the literals widen and the check passes vacuously; `satisfies` catches a rename/mistype but
  NOT a missing member; type EVERY field with the library's real exported type).
- **Direction × scope discriminator:** converge the lone holdout onto the shared/majority module = **FIX**
  (implement by DELEGATION, verify byte-equivalence); migrate the majority toward a config-declared
  MINORITY = **ACCEPT** (count the *actual* adoption of each side before picking direction — the config
  default may be the drift, not the truth). For LOW cosmetic consistency, accept/leave is usually right.

**7 · Safety pipeline (child-safety) — the highest-stakes domain.**
- **fail-closed in a "never notify the feared party" system = preserve the signal + withhold the
  irreversible action.** On error, store a durable "needs human review" flag routed to a non-notifying
  state; leave the unknown hard-stop axes at their non-escalating defaults (don't fabricate). Pin the ONE
  field the downstream router keys on to a value that routes AWAY from the urgent/notify branch (a neutral
  category) — a drift into an escalating value would email a caregiver on an unclassified message — and
  assert it (+ the resulting resolution) in the shape-lock test.
- **Reuse an existing routed-correctly enum value for an error/edge state — never invent a NOVEL one** (a
  new value silently bypasses sibling allow/deny guards keyed on the known values). Carry the
  distinguishing detail in a plain `reasoning` string.
- **Route safety decisions on MEANINGFUL fields** (category / evidenceLevel / target), not a model-chosen
  LABEL the prompt never defines. A deterministic safety matrix must NOT be coupled to the model's freeform
  output → REMOVE a dead model-suggested-action field over WIRE-ing it (wiring re-introduces a coupling the
  design deliberately avoids).
- **A duplicated safety hard-stop is intentional defense-in-depth:** centralize the *definition* in one
  predicate but PRESERVE the two independent runtime re-checks (over the RAW fields, not the derived value);
  keep the explanatory comment verbatim so a future dev doesn't delete the "redundant" check.

**8 · Common fix shapes.**
- **comment/doc-vs-code drift → COMMENT-ONLY correction** (✅ RESOLVED, no code change).
  `git merge-base --is-ancestor <comment-commit> <codefix-commit>` is the decider: a later commit fixed the
  code under a now-stale comment → RESOLVE (rewrite the comment); a sibling mechanism predates the doc SHA
  so the finding was always mistaken → **DISMISS**. Adversarially verify the claim you BAKE INTO the
  corrected comment (esp. RLS/tenancy assertions). Both DISMISS and RESOLVE close & decrement.
- **A finding can be DISMISSED when its `file:line` is refuted by a SIBLING mechanism** — grep the other
  `/codebase-map` chapters; the contradiction may already be documented there.
- **"make the dishonest thing honest":** hardcoded placeholder UI → wire to already-seeded data (verify
  read-only that the data IS seeded + a query pattern already exists before believing "~15 lines"); dead
  guard over a dishonest default → make the DEFAULT honest (`createContext<T | null>(null)` + move the
  guard above the deref).
- **A derived-total write (grade/score/invoice) → RECOMPUTE server-side from authoritative data** (strip
  the client totals from the schema; clamp each item; derive the sums), NOT bounds-only validation — a
  forged total that's internally consistent with valid items passes bounds. Fall back to the existing
  stored value for items absent from a partial payload.
- **field read-but-not-selected → splits on whether the field has a PRODUCER** (grep `db.*.create/update`
  for a writer): producer exists → select it / fix the read source; **zero writers → delete the dead
  read/UI** (don't add forward-compat wiring for data nothing creates).
- **cache-staleness → identify the Next.js cache LAYER first** (Data Cache via `unstable_cache`/`fetch` →
  `revalidateTag`; client Router Cache via `router.refresh`/`<Link>` prefetch; Full Route Cache via static
  render). `router.refresh()` does NOT bust the Data Cache. Don't trust the finding's parenthetical about
  how the cache "gets bypassed"; match the nearest write-path analog.
- **perf "N+1 → set-based" → turns on whether the per-iteration query is INDEX-served** (READ the
  migrations). No index → the rewrite buys only round-trips, not algorithmic gain → accept for a
  bounded/background path. Grep for PRECEDENT before introducing a novel raw-SQL idiom (esp. one behind a
  swallowing `catch`).
- **PATCH/partial-update validation must validate the MERGED post-update state** (`request ?? existing` per
  field, then fetch the *effective* related row), not the request fields in isolation — coupled fields can
  change independently.
- **Inbound entry-point tracing surfaces SEPARATE real bugs** worth minting in their OWNING chapter
  (born-resolved if a broken feature). For a UI/feature finding, grep the navigators/linkers
  (`href={…?sourceType=`, `<Link href=`), not just the renderer. A `deleteX(id)` bare-string call vs a
  `z.object({id}).parse` action silently breaks a feature → grep the repo for the same shape.
- **A recovery flow for a secret over SHARED auth needs a genuine OUT-OF-BAND factor** (one Google login
  per family → the live session is NOT proof of the protected identity; the only real second factor is the
  owner's email inbox).
- **Don't "harden" a fail-closed / null-return path before confirming null is the DESIGNED safe state** for
  legitimate callers — if it is, the "hardening" is a regression.

**9 · Deferral & the schema/migration boundary.**
- **If EVERY open finding of a cell is schema-only** (fixable only by a Prisma migration) → a
  **deferral-only session**: change NO code, present defer-vs-leave, do NOT manufacture an app-layer
  half-measure (a TS union that leaves the DB unconstrained). Keep ONE running **"Deferred migrations"**
  list in `CHANGELOG.md`; cross-link contributing chapters. **⏳ DEFERRED stays tracked-OPEN — the grade
  count does NOT decrement** (only a *closed* disposition moves it). Still run the CI gates (hand the next
  session a green baseline).
- **Seed-script (`prisma/seed*.ts`) *logic* edits are ordinary code changes** (allowed with approval), NOT
  schema/migration changes — but **never RUN them** against the seeded DB. Two traps: an idempotency guard
  (`if count>0 skip`) means the fix only helps *fresh* builds (the live DB keeps old values until a re-seed
  — say so); for a "value never set" finding, check BOTH whether it's *consumed* AND whether the live DB
  already coincidentally satisfies it (all-`0` `sortOrder` still orders by physical row order).
- **An infra-cutover finding** (env flag + connection-role/secret + the precious DB, no code fix, no
  rollback) → **DEFER-WITH-PREP**: read-only verify the cutover target is ready (`pg_roles`, `pg_policies`,
  `has_*_privilege` via MCP — proving 0 GRANT gaps + policy coverage), write an ordered runbook into ch.24
  + the finding, keep it tracked-OPEN at grade. Do NOT manufacture a code "half-fix" (a throw that crashes
  intentional context-free paths; a lint rule keyed on the no-op `withTenant`).

**10 · Owner decisions & scope expansion.**
- **When the owner answers a scoped question with a large STRATEGIC BRIEF / feature vision, that's a SCOPE
  EXPANSION** (the second face of §9.3) — STOP and re-scope: map each brief item to an existing or new
  finding, do only the **bounded, app-layer, no-schema, no-legal, tested** subset that resolves the
  session's target, **mint the rest as graded findings + a roadmap section** (verify each at its
  `file:line` before recording — code-is-truth, not the brief's say-so), and confirm the split with the
  owner before writing code.
- **When the owner upgrades a defer/owner-decision to "build it now," a resolution session legitimately
  ships a feature.** Five rules: mirror the **NEWEST hardened sibling** (secure-by-default at the current
  bar, don't replicate an older one's gaps); **trace create→display END-TO-END** before claiming "works";
  a net-new session-scoped write route needs caller-context auth + a policy-CLASS check (no `withTenant`,
  but the target table needs a permitting INSERT policy — the SELECT-only trap); completing a feature makes
  its "(coming soon)" copy FALSE → correct it; test the security-critical paths hard.

---

### Canonical prompts (reusable templates)

**Consolidated final pass** — a thin, constant trigger; the pass resumes from the progress memory:

```
Consolidated final pass — resolve ALL remaining OPEN findings (LOW, MED, HIGH) across the remaining
chapters in docs/codebase-map/, sequentially: ch.18 LOW→MED→HIGH, then ch.19, 20, 21, 22, 23 the same
way, then ch.24's own findings.

First, invoke the quillnext-mastery skill and read the findings-resolution-progress memory, then follow
SKILL.md §9 exactly. For EACH (chapter × grade) cell, in that strict order: re-verify each finding at its
cited file:line → recommend (adversarial) → proceed on clear-cut dispositions, ask me only on genuine
forks (build-vs-remove, behavioral, destructive, product/legal decisions) → execute → verify (tsc/lint/
tests green, prisma/ untouched) → update ALL /codebase-map docs current + run the §4 partition/reconcile
check → log a CHANGELOG round. Update the progress memory after each chapter so the pass is resumable, and
keep advancing cell-to-cell without stopping. No schema/migration changes (keep those deferred). Nothing
pushed. When the whole backlog is clear, emit a completion report — not a next prompt.
```

**Per-cell prompt (one-off)** — thin trigger; `<N>`, `<GRADE>` (×2), `<DOC>` (×2) are the only changes:

```
Session <N> — resolve the <GRADE>-grade findings in docs/codebase-map/<DOC>.

First, invoke the quillnext-mastery skill and read the findings-resolution-progress memory, then
follow SKILL.md §9 exactly for this (document, grade).

Target: the OPEN [<GRADE>] findings in <DOC> §7 — re-verify each at its cited file:line before
acting. Recommend (adversarial) → I decide → execute what I approve → verify (tsc/lint/tests green,
prisma/ untouched) → update ALL /codebase-map docs current and run the partition/reconcile check →
update the progress memory → update the skill if you learned anything → emit the next-session prompt.
Nothing pushed.
```

### Cell / pass invariants
- **Every cell** ends with: CI gates green · `prisma/migrations/` untouched (or an approved, documented
  migration; owner-approved `prisma/seed*.ts` edits OK but never *run*) · **all `/codebase-map` docs
  current and partition-reconciled** · progress memory updated. Nothing pushed.
- **One-cell mode** additionally emits the next-cell prompt and ends. **Consolidated pass** instead
  **advances to the next OPEN cell** and only at the very end (backlog clear or owner pause) does a final
  full §4 reconcile + a completion report. Skill updated if anything was learned (either mode).
