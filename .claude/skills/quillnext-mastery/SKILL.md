---
name: quillnext-mastery
description: Use when reading, documenting, mastering, or onboarding onto the quillnext codebase — and as the standing operating discipline for the codebase-map documentation effort under docs/codebase-map/. Triggers on "master the codebase", "document quillnext", "codebase map", "what does X do / where is X", "is X done or a stub", "audit for bugs/dead code", or any deep-dive into quillnext architecture. Encodes the source-of-truth rules, reading discipline, doc conventions, the verified codebase map + gotchas, and the orchestration recipe.
---

# quillnext Mastery & Documentation

The operating manual for achieving and persisting total mastery of the `quillnext` codebase
(a Next.js 16 / React 19 homeschool-education + AI-generation + family-discipleship platform).
Built solo for ~1 year; mature but unfinished. **Read this skill first, then work in-skill.**

Authored against commit `b585c1e`. Re-verify gotchas if the SHA has moved a lot.

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

### Triage bookkeeping — partition & reconcile (learned 2026-06-19)
When triaging a set of findings into buckets (resolve / remove / defer / owner-decision / leave) and
presenting them to the owner, treat it as a **set partition** and prove it mechanically — the same
"every item in exactly one bucket, 0 unaccounted" discipline used for the file manifest (§6):
- **Derive the presented lists from the structured source** (the workflow's `id → verdict` map), do
  not hand-retype them — hand-transcription is where items get mis-routed or dropped.
- **Assert the partition:** every finding id appears in exactly one presented bucket, and the bucket
  sizes sum to the total. Print the unaccounted count (must be 0).
- **Reconcile counts across artifacts:** if the report, ch.24 register, and CHANGELOG each state a
  count for the same set, they MUST match. A mismatch (e.g. "12" in one place, "13" in another) is a
  bug signal, not a rounding difference — stop and find the missing/duplicated item.
*(Why this rule exists: a finding (`Q-20-010`) was silently dropped from an owner-facing table because
an OWNER_DECISION item (`Q-13-008`) was hand-mis-filed into the LEAVE_AS_IS group, displacing it; the
"12 vs 13" count mismatch between the report and ch.24 went unreconciled.)*
- **When you ADD a new finding mid-session, bump EVERY tally spot in the same edit** — ch.24's top-line
  count, the per-grade section header, and any per-chapter count. (Caught in Session 2: ch.24's MED tally
  had drifted to **35 / 36 / 37** across those three spots precisely because `Q-24-001` and `Q-05-010`
  were added without bumping the counts. The by-theme *list* is the ground truth; reconcile the headers to it.)
- **A grade headline may legitimately EXCLUDE foundational findings (`Q-0NN`) — check the count basis before you
  decrement, and don't "fix" a number by rewriting prior reconciles (learned 2026-06-19, Session 7).** ch.24's
  `HIGH (10)` and `MED (33)` headlines count *feature/synthesis/lockout* findings only; the foundational
  `Q-001`–`Q-014` (ch.02/04) live in their own "Foundational" section and are NOT folded into those headlines
  (so `Q-001` [HIGH] is outside the "10" and `Q-004` [MED] was outside the "33"). LOW is inconsistent — it *does*
  count foundational LOWs (`Q-011`/`Q-013`) — a known artifact; don't propagate it. Practical rule: when closing a
  foundational finding, confirm whether it was in the headline tally; if not, leave the headline and record the
  closure in the Foundational section + a one-line count-basis note (open-foundational-of-that-grade → 0), rather
  than silently bumping a number that never included it.
- **Audit sibling roll-ups for stale tallies left by earlier sessions — a count can drift in a doc you didn't
  touch (learned Session 7).** `00-INDEX.md`'s "Findings at a glance" still read `35 MED · 69 LOW` — Session 5
  (MED→33) and Session 6 (LOW→66) had updated ch.24 but missed the index. Grep the whole `/codebase-map` for the
  grade counts (`MED`, `LOW`, the actual numbers) every session and reconcile *all* spots to ch.24's by-theme
  ground truth; fixing such drift is a **consequential doc-currency fix**, logged (not a new finding).

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
  restamps the active-profile cookie.
- **`RLS_ENABLED` is OFF by default** (`src/server/db.ts:9`). When off, `db` is the bare Prisma
  client (`:114` returns `base`) — **DB row-level security is inert; the app layer is the ONLY live
  tenant boundary.** Therefore every org-scoped query MUST carry an explicit `organizationId`
  predicate; a missing one is a HIGH tenancy finding. Don't read the RLS *.sql migrations and assume
  isolation is enforced.
- **`CONTEXT_FREE_MODELS`** (`src/server/db.ts:37`) = global/shared reference + extraction tables
  that skip the per-query org GUC (academic spine, BookExtraction/VideoExtraction, textbook corpus,
  catechisms, commentary, counties, etc.). Reads are cross-org by design.
- **Canonical tenant gate:** `getCurrentUserOrg()` (`src/lib/auth-helpers.ts:10`) — resolves
  session → user → `organizationId`. Server actions/queries should call it before touching data.
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

## 9. Findings-resolution (per document × grade cell)

After the mastery pass, findings are worked off **cell-by-cell**, where a **cell = one (chapter
document × severity grade)** — e.g. "`18-grading-assessment-runtime.md` — LOW". Cells run
grade-ascending within a doc (**LOW → MED → HIGH**), doc-ascending (01 → 24). The full per-cell
discipline is **the "Per-cell steps" below** (re-verify at `file:line` → adversarial recommend → owner
decision → execute → CI gates → docs current → §4 partition/reconcile); each cell leaves every
`/codebase-map` doc current (the next cell trusts those docs as truth). This is the proven loop from
the 44-INFO pass — follow it exactly.

**Two run modes — SAME per-cell discipline either way; they differ only in batching + how you end:**
- **One-cell sessions (ch.01-17, Sessions 1-35 — history):** the owner pasted a per-cell prompt, you did
  exactly ONE cell and emitted the next cell's prompt. The §9.2 lessons are tagged by those session numbers.
- **Consolidated final pass (ch.18→24 — the ACTIVE forward plan):** the owner triggers ONE pass that clears
  the entire remaining backlog. You walk every remaining OPEN cell in strict order — ch.18 LOW→MED→HIGH,
  ch.19 LOW→MED→HIGH, … ch.23, then ch.24's own findings — applying the Per-cell steps to each, then
  **advance to the next cell instead of stopping/emitting a prompt.** See "Consolidated final-pass mode" below.

**NOTE — this is the one place the "document, don't fix" rule is lifted:** resolution DOES change code,
but only for findings the owner approves. All other hard rules still hold (§1): DB read-only / protect
seeded data, **never push**, no schema/migration changes without explicit owner approval (batch
migrations and defer), keep the CI gates green.

### Consolidated final-pass mode (ch.18→24) — the active forward plan
The remaining backlog is cleared in **one continuous pass**, not ~18 separately-triggered sessions. The
owner has pre-authorized the pass; run it autonomously cell-by-cell, pausing only for genuine decisions.
- **Scope cleared this pass:** every OPEN LOW/MED/HIGH in **ch.18, 19, 20, 21, 22, 23**, then **ch.24's
  own findings** (Q-24-001 + the final register reconcile). Also sweep the one stray reopened
  **ch.13 Q-13-009 [LOW]** at the end so nothing is silently dropped (partition honesty). **NOT cleared
  (stay ⏳ deferred — need a migration / owner infra, untouched here):** the batched-migration findings
  (Q-011, Q-013, Q-23-003, the Q-12-003 enum subset, Q-17-010) and the foundational **Q-001** RLS cutover.
- **Order (strict):** ch.18 LOW → ch.18 MED → ch.18 HIGH → ch.19 LOW → MED → HIGH → … → ch.23 LOW → MED →
  HIGH → ch.24. Within a chapter always LOW→MED→HIGH; **skip any cell with zero OPEN findings** (confirm
  against that doc's §7, not the rough queue hint).
- **Per cell:** apply **Per-cell steps 1-6 in full** (re-verify at `file:line` → adversarial recommend →
  owner-decision partition → execute → CI gates green → ALL docs current + §4 partition/reconcile). Run
  `tsc`/`lint`/`tests` after **each cell's** code changes (localizes breakage) and leave the docs current
  after each cell (so the pass is resumable). Many findings in a cell → use the Workflow reader→verifier
  pipeline (§6); adversarially verify before acting (the lessons in §9.2 apply unchanged).
- **Owner decisions in pass-mode (standing authority + surface the forks):** PROCEED automatically on
  clear-cut, adversarially-defended dispositions — dead-code removal proven build-safe, obvious
  bug/validation fixes, RLS-readiness wraps, accept-by-design, dismiss-on-refutation, re-grade,
  comment-only corrections. **STOP and ask (`AskUserQuestion`) ONLY for genuine forks:** build-vs-remove
  of a real feature (e.g. the Q-17-001 shape), a behavioral/tone change, anything destructive/irreversible,
  or a true product/legal `[DECISION]`. Hard rules unchanged: **no schema/migration changes** (those stay
  ⏳ deferred), **DB read-only**, **never push**. When genuinely in doubt, surface rather than act.
- **Progress cadence (resumable):** update the `findings-resolution-progress` memory after **each chapter**
  (a running per-cell line + the new tallies) so an interrupted pass (context summary, owner pause)
  resumes at the next OPEN cell on reload — no new prompt needed beyond "continue the consolidated pass."
  Append a `CHANGELOG.md` round per cell (or per chapter).
- **End of pass:** when ch.24 + the ch.13 straggler are done (or the owner pauses), do a **final full §4
  reconcile** across all docs, write the pass-completion entry in the memory, update this skill with
  anything learned, and emit a **completion report** (not a next-cell prompt) — every cell's disposition
  + the final register tallies + the remaining ⏳-deferred set.

### Per-cell steps (one (doc × grade) cell — used by BOTH run modes)
0. **Load this skill** and read the `findings-resolution-progress` memory. In one-cell mode this gives the
   session target `(doc, grade)`; in pass-mode it tells you which cell to resume at (the next OPEN cell in
   the strict order). Work in-skill.
1. **Scope & re-verify.** Open the target chapter's §7; collect its **OPEN** findings of the target
   grade (skip ones already ✅ resolved / removed / accepted; ⏳ deferred and 🔻 re-graded stay
   tracked). Per §1, the doc is a *claim* — **re-verify each finding at its cited `file:line` against
   current code** before acting; auto-dismiss any that no longer reproduce (note it). **Also grep the
   *other* `/codebase-map` docs for each finding's file/symbol** — the same file is often filed under
   two angles in two chapters (e.g. `verify-seed.ts` = ch.01 Q-01-005 *and* ch.03 Q-03-002), so one
   fix can close a sibling finding elsewhere; flag it in the recommendation and update all affected
   docs in step 6. If the cell is empty (no open findings of that grade), it's a fast
   confirm-and-advance session.
2. **Recommend (adversarial).** For each finding, draft a code-grounded recommendation (re-read the
   cited code), then run an adversarial pass that challenges it: over-/under-engineering, hidden risk
   (breaks a working flow? touches seeded data?), correct severity, conflict with constraints. A few
   findings → do this inline; many → use the Workflow reader→verifier pipeline (§6). Return a final
   defended recommendation per finding + a change-log of what the adversarial pass overrode.
   **If a finding alleges a *disabled/downgraded check hides debt* (a lint rule set to `warn`, a
   skipped gate), run the check and report real counts before recommending** — e.g. `eslint .` = 688
   warnings / 0 errors made the "intentional ratchet → keep open / remove as by-design" call
   defensible and surfaced the few low-count rules the owner could cheaply ratchet. Evidence beats
   assertion.
   **If a finding concerns a config that *gates a pipeline* (an image-optimizer allowlist, a loader, a CSP,
   a route matcher), first verify what actually *flows through* that pipeline — grep the consumer/renderer,
   not just the data source — before sizing the fix; the answer can flip it.** (Q-01-002: every remote image
   used plain `<img>`, bypassing `images.remotePatterns`, so the safe fix was `remotePatterns: []` — closing
   the `/_next/image` proxy — not a hand-built host allowlist.) And when a Workflow verifier returns a
   recommendation, **re-anchor its verdict to the finding's stated IMPACT** — a verifier optimizes for the
   question you posed and can miss the abuse surface the finding is about (it argued "keep `**`, it's unused,"
   ignoring that `**` keeps the open proxy live).
   **A posture/config finding is often filed against ONE area but is actually repo-wide — grep the same
   anti-pattern across the codebase (especially the production runtime) before sizing the fix; the broader scope
   can flip the disposition (learned 2026-06-19, Session 5 / 03-MED).** Q-03-003 cited `rejectUnauthorized:false`
   only in the seeders, but the runtime client `src/server/db.ts:16` uses the identical setting on every request
   — so "patch just the seeders" was a half-measure, and the right call was *accept the by-design half + note the
   proper (repo-wide, runtime-touching) fix as a future infra task*. **Corollary — split a multi-claim finding:**
   when one `Q-NNN` bundles two claims (here: bypass-RLS = correct-by-design **+** TLS-verify-off = real posture),
   dispose of each claim separately rather than accepting/rejecting the whole as one — it's how you avoid both
   "fix a non-issue" and "miss the real one."
   **If EVERY open finding of the target (doc × grade) is schema-only — fixable only by a Prisma migration —
   it's a *deferral-only* session; recognize it early (learned 2026-06-19, Session 3 / 02-LOW).** §9 forbids
   schema/migration changes without explicit approval, so the session changes NO code: re-verify each at its
   `file:line`, present the defer-vs-leave fork, and do **not** manufacture an app-layer half-measure (e.g. TS
   unions that leave the DB unconstrained — churn for a LOW that doesn't actually fix it). The owner has
   consistently preferred the proper batched migration (Q-23-003 → Q-011 → Q-013 now all ride ONE batch). Keep
   a single running **"Deferred migrations"** list in `CHANGELOG.md`, bump it as findings join, and cross-link
   every contributing chapter to it. **Reconcile rule:** a `⏳ DEFERRED` finding stays **tracked-OPEN** — the
   grade count does **NOT** decrement; only a *closed* disposition moves it — `✅ removed/resolved`,
   `✅ accepted/won't-fix` (a by-design accept closes & decrements, e.g. Q-03-003 Session 5), or `DISMISS`. Still run the CI gates
   on a zero-code session — they confirm you're handing the next session a green baseline (tsc 0 / eslint 0 /
   vitest 58/58 / `prisma/` clean), which the proven loop expects.
   **A seed-script fix is NOT a schema/migration change — it's allowed with owner approval (learned
   2026-06-19, Session 4 / 03-LOW).** The `prisma/` guard protects `prisma/migrations/` + the seeded DB;
   editing `prisma/seed*.ts` *logic* (without running it) is an ordinary code change. Two seed-specific
   traps: **(a) idempotency-guarded data** — if a guard skips the reload on a populated DB (`if (count>0)
   skip`), the fix only helps *fresh* builds; the live DB keeps its old values until a re-seed/backfill the
   owner runs, so say that explicitly in both the recommendation and the resolved-finding note. **(b) a
   "value is never set" finding** — check BOTH whether the value is *consumed* (grep `orderBy`/readers) AND
   whether the live DB already *coincidentally* satisfies it (e.g. all-`0` `sortOrder` still orders correctly
   via physical/insertion row order on a freshly-seeded, never-updated table). That split separates "latent
   fragility → cheap determinism fix" from "visible bug → urgent" and right-sizes the fix (Q-03-004: ~10
   `orderBy:{sortOrder}` consumers, yet coincidentally-ordered in prod today → fixed the seeder for
   determinism + flagged that prod needs a re-seed; did not manufacture an urgent data migration).
   **Some findings are "audit X," not "fix X" — performing the audit and recording the conclusion IS the
   resolution (learned 2026-06-19, Session 6 / 04-LOW).** Q-005's literal ask was "audit direct session-org
   reads"; the sweep found the only direct read of the JWT-stamped org is `proxy.ts:59`, which is **fail-closed**
   (stale-null → redirect) and **edge-bound** — the proxy runs with no DB, so the DB-re-read mitigation
   (`getCurrentUserOrg`) is *structurally unavailable* there, making that one residual read inherently
   un-fixable-without-rearchitecting. Recorded it ✅ RESOLVED / correct-by-design (closes & decrements) rather
   than manufacturing a fix. **A dead-code removal has a tail (learned same session):** a dead client/module
   usually orphans an npm dependency *and* env vars — the complete fix prunes **files + dep + env** (same shape
   as Session 2's `@ai-sdk/openai`), but grep each env var repo-wide for any *other* consumer (incl. tooling like
   `.mcp.json`) before dropping it. And when a removal forces you to edit a descriptive doc line that also carries
   *other* now-stale facts, correct those too (code-is-truth) and log them as **"consequential doc-currency fixes
   (not new findings)"** — here ch.01's services/env lines still listed the already-removed `@ai-sdk/openai`.
   **An "audit X" finding can resolve as a real FIX, not only a recorded conclusion — the same audit cuts both ways
   (learned 2026-06-19, Session 9 / 05-LOW).** Q-005 (Session 6) audited → "correct-by-design, no fix"; Q-05-006
   audited → the parent-as-learner leak was CONFIRMED real (the self-enrolled parent surfaced on the "needs a
   personality assessment" nudge + every student roster), so the resolution was a fix. So "performing the audit IS
   the resolution" means *do the audit and follow where it points* — sometimes that's a fix, sometimes a by-design
   accept. **Validate Workflow agent outputs for degenerate/placeholder content before trusting them (same session).**
   One verifier returned literal junk (`"test reason"/"test risks"/"test guidance"`); a schema validates *shape*, not
   *substance*, so eyeball each agent's result and **re-derive that finding's recommendation by hand** (re-read the
   cited code + its downstream) rather than acting on the placeholder. **Cross-chapter consumer sweep (owner picks
   "fix all consumers"): use ONE shared `where`-fragment, not N hand-edited predicates (same session).** A
   posture/data-model finding's remediation often spans many consumers in *other* chapters; centralize the predicate
   in one file (homed in exactly one chapter's §1 — partition), **shape-lock it with a unit test** (a Prisma `where`
   can't be DB-tested here, but a `toEqual` on the fragment catches a future "simplification" that breaks the subtle
   case — e.g. null-relation rows), name **explicit carve-outs** (here: `data-export.ts` for data-sovereignty and the
   entity's own self-view `getMyLearning`), and remember the finding **stays owned by its chapter** — the other
   chapters get *code-currency cross-refs* (not new/closed findings), so the grade count moves only in the owning
   chapter. A partial sweep is worse than uniform behavior (drift); a single fragment is how you avoid it.
   **Removing a "latent footgun" config is regression-free ONLY after you trace EVERY write path to the thing it
   guards — prove the dangerous state can't arise before deleting the guard (learned 2026-06-19, Session 7 /
   04-MED).** Q-004 (`allowDangerousEmailAccountLinking: true`, `auth.ts:57`) is dangerous only with 2+ auth
   providers, but the real question for *removal* was "does anything today depend on it?" The flag suppresses
   Auth.js's `OAuthAccountNotLinked`, which fires only when an existing same-email `User` has no linked `Account`.
   The disposition turned entirely on proving that orphaned-`User` state is *unreachable*: a repo-wide grep for
   `user.create`/`createUser`/`account.create` (excluding `src/generated/`) returned **zero** app-code writers —
   `User`/`Account` are written ONLY by the NextAuth PrismaAdapter at sign-in (`blueprint`/`students` only
   `user.update`; seeds create no auth users), and the lone provider is Google (`auth.config.ts` is
   `providers:[]`). Only then was "delete it" provably zero-regression on the production auth path **and**
   default-secure. So: a config/posture finding has two separate questions — *is it dangerous?* (the grade) and
   *what depends on it?* (the safe disposition); answer the second by enumerating writers/consumers, not by
   reading the comment. (Both adversarial lenses agreed `breaksSignIn=false` + re-graded LOW, then split
   REMOVE vs ACCEPT_KEEP — re-anchoring to the finding's *future-2nd-provider* impact broke the tie toward
   REMOVE: disarm the footgun for free rather than leave it for the next maintainer to remember.)
   **A finding whose remediation is an INFRA CUTOVER (env flag + connection-role/secret + the precious DB),
   not a code edit, resolves as DEFER-WITH-PREP — neither a code fix nor a bare ⏳ defer (learned 2026-06-19,
   Session 8 / 04-HIGH).** Q-001 (app bypasses DB RLS: `RLS_ENABLED` off + a BYPASSRLS connection role) has
   *no code fix* — the RLS enforcement path is already written and **dormant** (`db.ts:115-131` `$extends`;
   `withTenant` GUC stamping `db.ts:107-110`), so "fixing" it = flipping `RLS_ENABLED=true` + repointing
   `DATABASE_URL` to the non-bypass `app_user` role: env + a DB password + a Vercel secret on the precious prod
   DB, with **no rollback and no staging**, and it would break features the moment RLS enforces (every
   separately-tracked per-query org-filter gap flips from benign-omission to **0-rows / broken-feature**). §9
   forbids executing it. When the owner pushes back ("why not fix it now?"), **lead with *"there is nothing to
   fix in code"*** and re-explain the scope, then offer the safe forward slice: (a) **read-only verify the
   cutover target is ready** via MCP — for an RLS flip that's `pg_roles` (`rolbypassrls`/`rolcanlogin`),
   `has_table_privilege`/`has_function_privilege`/`has_schema_privilege`/`has_sequence_privilege` per object to
   prove **0 GRANT gaps**, and `pg_policies` + `pg_class.relrowsecurity` for policy coverage (this also
   *sharpens inferences* — e.g. only `postgres` has BYPASSRLS+LOGIN, so that's the live connection role;
   `service_role` is `LOGIN=false`); (b) **write an ordered cutover runbook** into ch.24 (roadmap) + the
   finding's §7 entry, **gated on the dependent per-query audit** as an explicit two-workstream split (infra
   flip vs per-query org-filter completeness); (c) keep the finding **tracked-OPEN at its grade** (deferred ≠
   closed) and, if it's a foundational `Q-0NN`, **leave the by-theme HIGH/MED headline untouched** (it was never
   in it). **Do NOT manufacture a code "half-fix":** here both adversarial lenses proposed one
   (throw-instead-of-fail-closed; a custom ESLint rule) and both failed on re-anchoring — the throw would crash
   the *intentional* context-free paths (login/boot/global reads, where `resolveTenant()→null` is the **designed
   safe state**, `rls-context.ts:9-11`), and a lint rule keyed on `withTenant` (a no-op today; the real boundary
   is explicit `where:{organizationId}`) would false-positive across correct code and merely duplicate the
   per-query findings. **General trap: before "hardening" any fail-closed / null-return path, confirm null is the
   *designed* safe state for legitimate callers — if it is, the "hardening" is a regression, and the lens that
   honestly answers "no safe code action" is right for the session's scope.**
   **A finding can be ❌ DISMISSED when its cited `file:line` is REFUTED by a SIBLING mechanism — re-derive, don't
   trust the §7 claim, and use git to decide DISMISS vs RESOLVED (learned 2026-06-19, Session 10 / 05-MED).** Q-05-001
   claimed the PARENT cookie is an *absolute* 15-min cap because "nothing re-signs the cookie on activity" — but the
   proxy re-stamps a fresh `iat` every >5 min of page activity (`proxy.ts:74-89`), a genuine **sliding idle** the §7
   author overlooked. Two tells made the dismissal airtight: (a) **the codebase-map itself already documented the
   refuting mechanism in another chapter** (ch.04 §3.3 "Sliding idle" + §1 "cookie restamp") — the finding
   *internally contradicted* a sibling doc, so **grep the other `/codebase-map` chapters for the finding's
   file/symbol; the contradiction may already be written down**. (b) **`git show <doc-SHA>:<file>` proved the
   mechanism predated the doc's own SHA** (`ef686d9` ⊂ `b585c1e`) → the finding was *always* mistaken (DISMISS /
   never-reproduced), not "resolved by a later fix" (which would be ✅ RESOLVED). DISMISS closes & **decrements** the
   grade count like resolve/remove/accept. Note any residual contrived edge (here: a parent active >15 min via
   `/api/*`-only with zero navigations) but don't manufacture a new finding for a scenario the original didn't describe.
   **A recovery flow for a secret that sits ON TOP of a SHARED primary login needs a genuine OUT-OF-BAND factor — an
   in-session "reset my own thing" path is bypassable by anyone sharing the login (learned 2026-06-19, Session 10 /
   Q-05-010).** quillnext is one Google login per family; the PARENT PIN keeps *students on that same login* out of
   parent features, so a "Forgot PIN" authorizing on `session.user`/`role==="OWNER"` alone is worthless — the
   student-at-the-keyboard *is* that session. The only real second factor is something students don't have: the
   owner's **email inbox**. Built as a Resend email → 15-min single-purpose JWS token (mirror `active-profile-cookie.ts`)
   → an explicit-button confirm route (so an email-prefetch GET can't consume it), nested under `/select-profile/*`
   so the proxy's no-active-profile gate lets a locked-out owner reach it. **When asked to "add recovery" for a
   secondary gate over shared auth, the live session is NOT proof of the protected identity — require an out-of-band
   channel and say so.** (Also: when the owner upgrades a "defer/owner-decision" rec to **"build it now,"** a
   resolution session legitimately includes a real FEATURE build — new files/routes/email — not just a patch; test
   the security-critical paths hard, §9.5.)
   **A LOW dead-code finding can legitimately pull a *higher-grade, SAME-chapter* file into the LOW session as a
   "forced pair" / necessary tail — that is bookkeeping, not scope creep; NARROW the higher finding, don't close it
   (learned 2026-06-19, Session 11 / 06-LOW).** Q-06-003 (drift: dead legacy `UserNav` dropdown) resolved by deleting
   `UserNav.tsx`, but its only importer was the *also-dead* `MainNav.tsx` (zero importers) — deleting `UserNav` alone
   leaves `MainNav` with a broken import (tsc fail), so the pair must go together. `MainNav`+`SidebarClientIslands`
   (Q-06-004) are also enumerated in the **MED** finding `Q-06-001` ("dead 2nd-gen nav surface"). The discipline when a
   LOW removal overlaps a higher-grade aggregate finding **in the same chapter**: (a) delete what the LOW finding needs
   (incl. the forced pair); (b) **narrow** the higher finding's file-list + evidence + impact to what remains and
   annotate it in ch.24's by-theme list so the *next* (MED) session inherits accurate scope; (c) the higher finding
   **stays OPEN at its grade — do NOT decrement its count** (only the LOW findings close). This is the same-chapter,
   higher-grade, *narrow-not-close* cousin of the cross-chapter sibling rule. **And a dead-file deletion has a
   doc-currency tail into enumerated "anchor facts" duplicated across docs + this SKILL** — e.g. the "3 `<Image>`
   usages" anchor lived in ch.01 Q-01-002, CHANGELOG round 5, **and SKILL §5**; deleting `MainNav` (one of the 3) means
   grepping the anchor's signature phrase repo-wide and updating *every* copy to "2" (substance unchanged), logged as a
   consequential doc-currency fix, not a new finding. **Gold-standard refutation for any dead-code removal: have an
   adversarial lens physically move the file(s) aside and run `npx tsc --noEmit` (0 before *and* after) — grep proves
   "no static importer," but move-and-compile proves removal is build-safe empirically; also have one lens argue
   "WIRE it instead of delete" (the strongest keep-case) and confirm it collapses (here: the live `Sidebar.tsx` already
   implements the identical mobile drawer the dead island never wired up).**
   **A dead-code removal's orphan tail can be a *currently-live, finding-less reusable primitive in ANOTHER chapter* —
   that is an OWNER_DECISION (delete vs keep+mark-DEAD), and either way it is cross-chapter doc-currency, NOT a new
   finding, with NO count change in that chapter (learned 2026-06-19, Session 12 / 06-MED).** This is the third shape of
   the "dead-code removal has a tail" rule (Session 6 = dep+env tail; Session 11 = same-chapter forced pair; now =
   cross-chapter newly-orphaned primitive). Deleting `CreationDrawer` (Q-06-001) left `@/components/ui/sheet` (its SOLE
   importer, marked DONE/live in ch.07 §5 with **no Q of its own**) at zero importers. The disciplines: (a) **trace the
   orphan tail** for every dead-file deletion — grep `from "<each imported module>"` and flag any module the deletion
   drops to zero importers (here only `ui/sheet`; `ContextNav` orphaned nothing — its imports all had 75–93 importers);
   (b) an orphaned **app-specific** module → prune it as part of the complete fix (Session 6 shape), but an orphaned
   **reusable design-system primitive** (under `src/components/ui/`) is a *different category* → present it as an owner
   fork, because "keep the kit" is a legitimate stance for a vendored primitive; (c) **whichever way the owner decides,
   the other chapter gets only code-currency edits** (§1 manifest row, §3 architecture, §5 status row → REMOVED *or*
   newly-DEAD, §6 imports lists, and any finding-evidence example list that names the file) — do **NOT** mint-and-close a
   new `Q-07-NNN` (it would distort the register) and do **NOT** change that chapter's finding count; **the grade count
   moves only in the OWNING chapter** (here MED 30→28 via Q-06-001/002). Confirm no **npm dep** is orphaned too (here
   `ui/sheet`'s `@radix-ui/react-dialog` is shared with `dialog.tsx`, so no `package.json` change). **And a latent-bug
   finding whose host is dead resolves automatically as ✅ RESOLVED-by-removal when you delete the dead host — two
   findings, one deletion (same session).** Q-06-002 (hardcoded `organizationId="…placeholder"`) was latent *only*
   because its host `CreationDrawer` was dead; deleting the host for Q-06-001 removed the buggy line, so both close on
   one `git rm` (partition them as 2 closed — 1 removed + 1 resolved). Verify the **live** path never had the bug before
   calling it resolved (the real `/creation-station` route resolves org via `getCurrentUserOrg()`, so nothing live
   regressed).
   **A "missing plugin/feature" finding ("X doesn't support Y") is often REFUTED by tracing the real producer + the
   plugin's parsing defaults — don't reflexively "add the plugin"; the adversarial pass exists to catch this
   action-bias (learned 2026-06-19, Session 13 / 07-LOW).** Q-07-001 ("MarkdownContent has no KaTeX → math degrades")
   drafted as "add remark-math/rehype-katex like ThinklingChat" — and was inverted on two independently-fatal facts:
   (a) **the upstream producers emit a delimiter the plugin doesn't parse by default** — the STEM corpus emits math as
   `\(...\)`/`\[...\]` (Siyavula) or strips it (OpenStax) and the prompt-builder never instructs `$...$`, while
   remark-math 6 parses ONLY `$...$`/`$$...$$` by default → the "fix" renders ~zero real math; (b) **the plugin's
   permissive default over-triggers on benign content** — `singleDollarTextMath:true` would mangle bare-`$` currency
   ("costs $5 and $10") in word-problem/economics resources. So before adding any renderer/parser plugin to "fix"
   missing support, verify *both* what the producers actually emit (format/delimiters) *and* the plugin's default
   parsing + its collateral damage on existing content — a plugin can simultaneously **under-deliver** (wrong delimiter)
   and **over-fire** (currency). The genuine residual defect was a *lying doc-comment* (it claimed parity with
   ThinklingChat, which DOES use KaTeX) → fix the comment (code-is-truth) and close as **accept-by-design**. ("Same
   content domain elsewhere already does X" — here ThinklingChat — is NOT a reason to propagate X; chat is ephemeral,
   a persisted generated artifact isn't.)
   **A "standardize on X / drift between two libs" cleanup finding: grep the ACTUAL adoption count of each before you
   pick the consolidation direction — the declared/config default may be the drift, not the truth (same session).**
   Q-07-002 (two icon libs) drafted as "convert the 2 Phosphor primitives → lucide" because `components.json` declares
   `iconLibrary: lucide` — but the real importer counts (Phosphor **56** files vs lucide **8**) showed Phosphor is the
   de-facto house lib and the *config declaration* is the misleading artifact; the draft's direction was backwards
   (toward the minority lib) and would have repainted two high-traffic primitives app-wide for no functional gain. For
   a LOW cosmetic-consistency finding the right call is usually **accept/leave** (a repo-wide visual migration is
   disproportionate churn), but if a consolidation ever happens the direction is set by file-count reality, not a
   config string. Count both sides before recommending a direction.
   **The canonical fix for a "dead guard over a dishonest default" is to make the DEFAULT honest, not to patch the
   predicate (same session).** Q-07-003: `useFormField` guarded `if (!fieldContext)` but `FormFieldContext` defaulted to
   `{} as T` (always truthy) AND the guard sat *after* the deref. The half-fix (`if (!fieldContext.name)`) keeps the
   `{}` default and leaves the type lying; the clean fix is `createContext<T | null>(null)` + move the guard above the
   deref — now the guard is reachable AND TS narrows to non-null so the later access is type-honest. Safe to do when the
   context is module-private with a single `useContext` reader and the Provider always supplies a value (trace those
   before flipping a context default to `null`).
   **A Zod schema used as the OUTPUT contract for `generateObject`/`generateText({schema})` constrains the MODEL's
   structured output — NOT the user's input — so a "schema enum value ≠ the UI option" is by-design translation, not a
   validation break; don't let a skeptic talk you into "fixing" the contract to match the form (learned 2026-06-19,
   Session 14 / 08-LOW).** Q-08-005 was a one-char enum typo (`"Mirco-Learning"`→`"Micro-Learning"`). A skeptic returned
   `refuted=true` claiming the assessment feature was "broken" because the wizard offers `"Overwhelmed"` while the enum
   value is `"Micro-Learning"`, and wanted the enum renamed to `"Overwhelmed"`. That conflated input with output: the
   user's questionnaire answers are serialized into the *prompt text* (`generateLearningStyleProfile` → `Q:…\nA:…`), and
   `generateObject` forces the model to EMIT one of the schema's enum values — the user's `"Overwhelmed"` answer is never
   validated against the enum; the model maps it (desc: "Needs micro-learning chunks") to the structured value. So the UI
   vocabulary and the schema vocabulary are *deliberately different* and the typo-fix is zero-risk (and a grep proving no
   code matches the literal — it's only JSON-dumped into prompts — seals it; no backfill, stored rows keep the old spelling
   but nothing reads it as a literal). General rule: before acting on any "the schema doesn't match the form / the data"
   claim for a structured-generation contract, confirm whether the schema governs *what the model returns* (validate the
   model, not the human) — this is the AI-domain face of the Session 9/10 "a schema validates shape not substance, re-derive
   the agent's claim by hand" rule.
   **A dead-code removal's "forced tail" extends INTRA-file to now-unused imports / types / private enums, and a tracked
   co-located `.md` doc is part of that tail (learned 2026-06-19, Session 14 / 08-LOW).** Deleting the dead functions left
   their imports orphaned (`import …from "ai"`, `import { db, withTenant }`), their helper types orphaned (`type GoogleModel`,
   `type ObjectiveWithHierarchy`), and a sole-consumer enum orphaned (`TaskComplexity`, used only by the removed
   `getModelByComplexity`) — all must go in the SAME edit or `tsc`/lint fail on unused symbols. **Sweep the tail before
   running the gates:** for each removed symbol, check whether its imports/types/enums now have zero remaining users in the
   file. And **grep tracked `.md`/`.mdx` docs co-located under `src/` (not just `docs/codebase-map/`) for the removed
   symbols** — here `src/lib/ai/model-selection.md` (git-tracked) documented the removed `getModelByComplexity`/`TaskComplexity`
   AND was independently stale vs code ("Gemini 3 Pro" for a `gemini-2.5-pro` instance) — i.e. the same class of stale,
   contradictory doc the owner deletes (README/scorecards). Present such a doc as an OWNER_DECISION (delete vs update);
   deleting it is a consequential doc-currency action of the removal, not a new finding.
   **A "two things diverge / duplication / drift between A and B" finding: re-read BOTH sides from source and enumerate
   what's actually SHARED vs DIVERGENT before sizing the fix — a PRIOR session's partial fix can make the headline stale,
   and the right fix is usually to CONVERGE THE SHARED-CONCERN SURFACE via one source-of-truth constant, NOT to merge the
   structures (learned 2026-06-19, Session 15 / 08-MED).** Q-08-001 ("two divergent prompt-builders") was framed as "two
   separate persona/context schemes," but re-verify found (a) Session 14's Q-08-003 had already deleted the dead half, and
   (b) the philosophy/family/faith CONTEXT layer is present in BOTH paths (the class `setFamilyContext` and
   `buildMasterPrompt`→`serializeMasterContext` both inject `PHILOSOPHY_PROMPTS`, context-serializer.ts:107) — the master-
   context path's student personalization is even *richer*. The ONLY real divergence was the Inkling persona + ethical-
   guardrails layer, **absent** on the `buildMasterPrompt` paths (grading feedback + generate-tool). So the fix was NOT to
   merge the builders (they keep genuinely different I/O — sync Prisma-entity vs async ID→MasterContext — and ch.10
   documents them as intentionally-separate back-ends that "share almost no code") but to inject the shared `INKLING_*`
   constants from the single `ai-guardrails.ts` into `buildMasterPrompt`, so both families carry identical, centrally-
   sourced guardrails (a future change is made once). This is the prompt-constant generalization of the Session 9/10
   "ONE shared `where`-fragment, not N hand-edited predicates" rule: converge the safety-critical *surface*, leave the
   structure-specific machinery separate. **Corollary — a claimed tone/quality REGRESSION from a constraint may be
   PROTECTIVE for the audience; re-anchor to product values, don't reflexively believe the steelman.** The adversarial
   steelman warned that injecting the persona's "professional/objective/no-first-person/avoid 'I think/I feel'" block would
   flatten the warmth grading feedback wants (per-student `toneInstructions`), and pushed re-grade-LOW / inject-only-a-
   draft-line. But the `INKLING_ETHICAL_GUIDELINES` no-simulacrum rule ("not a friend or spiritual mentor") is exactly
   what you WANT for an AI giving evaluative feedback to a child, and the per-student `toneInstructions` still modulate
   voice on top — so the "regression" was a feature aligned with the product's values. For a behavioral AI-prompt change
   with a genuine voice/behavior fork, use **`AskUserQuestion` with concrete prompt-PREVIEW options** (render the actual
   new opener side-by-side) so the owner decides on the real artifact, not a description. **Two doc-currency tails specific
   to this shape:** (a) **stale line-number refs in OTHER chapters left by a prior session's file-shrink** — Q-08-003
   shrank `utils/prompt-builder.ts` ~310→64 lines but ch.09's `prompt-builder.ts:275/278/286-301` refs were never updated;
   when you touch a file whose line numbers other chapters cite, re-derive and fix those cross-chapter refs (the line-number
   cousin of Session 7's "audit sibling roll-ups for stale tallies"). (b) **enumerate ALL prompt-assembly entry points, not
   just the ones the finding names** — a THIRD path may share the gap but sit outside the finding's scope (here
   `suggest-blocks.ts` self-assembles its prompt from `getMasterContext`, so it never got the guardrails); describe it
   accurately for currency and decide *consciously* whether it warrants a new finding — here NO (low-stakes block
   *suggestions*, not student/parent-facing content), so it was flagged for owner awareness in the CHANGELOG rather than
   minted as `Q-08-009` (minting it would add scope creep + a tally bump for a low-value path).
   **When a Workflow agent proposes a CODE REWRITE, re-derive the actual DATA the code operates on (delimiters,
   newlines, encodings, formats) from source before trusting it — a fix can be algorithmically right yet wrong
   against the real input, and agents that "trace a realistic example" often reconstruct the input instead of
   reading it (learned 2026-06-20, Session 16 / 09-LOW).** Q-09-006: both the recommender AND the adversarial
   verifier agreed on rewriting `truncateContext` to `split("\n\n")` to keep the headerless `PHILOSOPHY_PROMPTS`
   blob with its FAMILY header — but the injection at `context-serializer.ts:108` pushes `\n` + a value that *itself*
   begins with `\n`, so the family block actually contains a **triple** newline, and `split("\n\n")` would have
   *fragmented* it (reclassifying philosophy/faith as headerless "other"). Reading the real `PHILOSOPHY_PROMPTS`
   constant + the exact `parts.push`/`join` shape exposed it; the robust fix was a **carry-forward classifier**
   (each headerless line inherits the last header's section, kept sections emit in original order) that doesn't
   depend on the separator at all. This is the CODE-rewrite face of the Session 9 "a schema validates shape not
   substance — re-derive by hand" rule: for an agent's algorithm, verify the *input it assumes*, not just the
   logic. (Two right-sizing corollaries that held: when a fix is a private helper rewrite, **drop a now-unused
   param + its single call site** rather than `void param`; and **add the FIRST unit test** for an untested file
   to shape-lock the new behavior — the cheap regression guard the verifier will ask for.)
   **An "unused field / dead param / no-op surface" finding may be UNFINISHED scaffolding, not dead-or-superseded
   code — distinguish them by tracing the SIBLING half of the feature, and if a live sibling proves intent, the
   disposition is "leave OPEN + re-document as unfinished," NOT remove (learned 2026-06-20, Session 16 / 09-LOW).**
   The owner's exact question — *"is it dead as in superseded or dead as in unfinished?"* — is the right lens and
   you must answer it from code before recommending REMOVE. Q-09-005's 5 `MasterContextParams` media ids
   (`bookId/videoId/...`) are never read by any sub-fetcher, which reads as "dead surface" — but the SIBLING
   lineage writes (`generate-tool.tsx` persists `generatedFrom{Book,Video,...}Id` on every resource) prove they're
   the *unbuilt context-injection half* of a real, half-shipped "generate-grounded-in-this-source" feature; there
   is no superseding path (broad library relevance is a coarser, different thing). So even though removal was
   mechanically safe (~4 tsc-safe files — the verifier corrected the recommender's "too entangled" rationale), the
   owner kept the hook and the right action was to **re-document §7/§5 from "DEAD fields" → "unfinished feature"**
   (lineage live, context-injection not built; `getLibraryContext` does broad relevance only) and leave it OPEN.
   Generalizes Session 6/9's "audit-finding resolves by doing the audit + following where it points" and §9.3's
   "re-explain scope + re-ask": when the owner asks superseded-vs-unfinished, answer by enumerating the sibling
   mechanisms, then let intent (not the local no-op smell) pick remove-vs-keep.
   **A "comment-vs-code drift" finding (a NOTE/comment claims X, the code does Y) often resolves as a COMMENT-ONLY
   correction (✅ RESOLVED, NO code change) — and `git` ancestry is the decider that proves the comment went STALE
   (code was fixed out from under it) rather than the code being broken (learned 2026-06-20, Session 17 / 09-MED).**
   Q-09-001 cited a maintainer NOTE in `dashboard.ts` — *"analyzeContextCompleteness still queries via `db`; not yet
   tenant-threaded, so under RLS it returns empty"* — as evidence of threading drift. Re-verify showed the runtime
   code was already fully tenant-threaded (every reachable org-scoped query uses `withTenant(..., {organizationId})`;
   the only bare-`db` reads are global-spine `Objective` ∈ `CONTEXT_FREE_MODELS`). The decisive move: **`git merge-base
   --is-ancestor <comment-commit> <codefix-commit>`** proved the NOTE commit (`8a79c8c`) is an *ancestor* of the
   threading commit (`5a77836`, "route org/user-scoped reads through withTenant…", ~1.5h later) — i.e. the next commit
   did exactly what the NOTE said it was *waiting for*, then orphaned the comment. So the artifact-in-error is the
   COMMENT, the fix is to rewrite it accurate to current behavior, and there is **no code to change** (a code edit
   would be churn-for-churn's-sake on a correct path). This is the comment-drift sibling of Session 10's "DISMISS when
   a sibling mechanism predates the doc SHA" — but the disposition is **RESOLVE** (correct the wrong comment), not
   DISMISS, because there genuinely *is* a wrong artifact to fix (Session 10's §7 finding was simply mistaken; here a
   live in-repo comment asserts the OPPOSITE of reality, which is itself a maintainer hazard — a future dev may "fix"
   working code or distrust it). **Three corollaries:** (a) **adversarially verify the claim you're about to BAKE INTO
   the corrected comment** — when the comment encodes an RLS/tenancy-correctness assertion (the highest-stakes area;
   memory `[[quillnext-rls-tenancy]]`), task skeptics to *prove the stale claim still TRUE* (find a reachable
   org-scoped bare-`db` query); only rewrite the comment as "RLS-safe" once they fail. Don't replace one wrong comment
   with another. (b) **A MED can be over-graded (really INFO) for pure comment drift — but RESOLVE it, don't merely
   re-grade-and-keep-open** (`shouldRegradeNotResolve=false`): once the comment is corrected there is nothing left to
   track, so a re-grade would leave a phantom finding. (c) **Reconcile-grep hygiene: distinguish HISTORICAL records
   from stale headlines** — after decrementing a tally, a repo-wide grep for the old number (e.g. `27 MED`) will still
   legitimately hit *prior rounds'* reconcile notes that correctly stated the count AT THAT TIME (round 18 ended at 27);
   do NOT "fix" those — only the *current* headlines (ch.24 top-line, the by-theme header, the lineage, 00-INDEX) move.
   **When verifying an "unfinished / dead-end / placeholder UI" finding, enumerate the feature's INBOUND entry points
   (who navigates or deep-links INTO it) before disposing — a broken entry point is often a SEPARATE real bug worth
   minting, and the inbound trace also settles unfinished-vs-superseded (learned 2026-06-20, Session 18 / 10-LOW).**
   Q-10-005 ("`FileUpload` imported-but-unrendered; FILE is a 'coming soon' placeholder") looked like dead code, but
   grepping who links to `?sourceType=FILE` found a LIVE entry point (`DocumentList.tsx:184` "Use in Generator"),
   proving FILE is *unfinished* not *superseded* (kept + re-documented, mirroring Q-09-005). Tracing those inbound
   deep-links then surfaced a separate, real bug outside the finding's scope: `GeneratorsClient` initialized `sourceId`
   from `bookId`/`videoId`/`courseId` only, silently dropping the `?…&sourceId=` param that **5** library lists pass —
   so every "Use in Generator" button pre-selected no source → a new minted-and-resolved finding (Q-10-011), NOT a
   stretch of Q-10-005's scope. This is the UI/deep-link face of Session 15's "enumerate ALL entry points, not just the
   ones the finding names": for a UI-feature finding, grep the navigators/linkers (`href={…?sourceType=`, `<Link
   href=`), not only the renderer. Fix the params the owner approved + zero-risk; **LOG the residual you don't fix**
   (here ParentDashboard's `topicText` needs a `TopicSelector` initial-value prop — beyond a LOW — so a noted remaining
   sub-case, not a silent cap).
   **An "AI grounding/tool not wired → output degrades" finding can be ACCEPT-by-design once you trace the configured
   MODEL's NATIVE capability — check the model before "adding the tool" (same session).** Q-10-006 ("DEEP_VISION
   YouTube grounding is prompt-only; no `google_search_retrieval` wired → silently ungrounded") inverted on the model
   config: the branch sends the playlist URL to `models.pro` ≡ `gemini-2.5-pro`, which the codebase documents as *the
   only Gemini model with native YouTube processing* (`config.ts:26,34,59`), so grounding rides the model's native
   capability and the unwired tool is a noted *future* enhancement, not a defect (the "silently degrades" impact was
   overstated). This is the AI-domain face of Q-07-001's "trace the producer/plugin defaults before adding the plugin"
   (Session 13): before wiring a missing AI tool/plugin to "fix" a capability gap, confirm the configured model/SDK
   doesn't already provide it natively — read the model-config capability notes, don't infer the gap from the absent
   tool call.
   **A multi-claim tenancy finding splits into "FIX the cheap, provably-zero-risk half NOW + RE-GRADE the residual once
   you ADVERSARIALLY DISPROVE its scary impact" — the re-grade is EARNED by the disproof, not asserted (learned
   2026-06-20, Session 19 / 10-MED).** Q-10-010 bundled (1) a plain-`db` write and (2) "trusts caller-supplied context
   ids unverified." Sub-claim 1 was fixed now — wrap the `db.resource.create` in `withTenant(..., {organizationId,
   userId})` (zero behavior change with RLS off — `withTenant` is a no-op with an explicit ctx — and the correct
   RLS-ready path, matching the area). Sub-claim 2's *cross-org READ leak* impact was **refuted** by tracing every id
   through its consumer: `getMasterContext` re-scopes `studentId` (`master-context.ts:450`→null), `objectiveId` is
   global `CONTEXT_FREE` spine, `getLibraryContext` returns only session-org books, and the media ids are **unconsumed**
   ([[Q-09-005]]) — so nothing foreign reaches the prompt; the residual is only a low-value unverified-FK *write* →
   re-graded MED→LOW + ⏳ deferred with the HIGH tenancy cluster (a uniform org-ownership sweep, not a piecemeal patch —
   partial-sweep-worse-than-uniform). Generalizes Session 5's "split a multi-claim finding" + Session 9's "a schema/agent
   verdict validates shape not substance — re-derive by hand": once the scary half is *disproven* down to low value, the
   honest disposition is RE-GRADE the residual (it leaves the higher grade's count), not keep the whole finding at grade.
   **Wiring a written-but-DEAD Zod schema is a legitimate FIX — but re-derive it against the REAL producer payloads
   first, and NEVER make a constraint STRICTER than the consumer requires: a format validator (`.url()`/`.uuid()`) can
   reject input that works TODAY because the field has no client gate and the consumer treats it as free text (learned
   2026-06-20, Session 19 / Q-10-004).** `generateResourceSchema` was dead AND drifted (its `sourceType` enum lacked the
   5 SPINE levels + `additionalData` omitted `sectionNumber`/`subject` — wiring it *unchanged* would have rejected all
   SPINE generation). Then the adversarial regression-skeptic caught that keeping `additionalData.url = z.string().url()`
   would reject scheme-less URLs (`example.com/article`) that work today — the UI has no client URL validation and the
   core embeds the string verbatim into a prompt (`generate-resource-core.ts:626-631`), even tolerating topic phrases —
   so `url` was relaxed to a bounded plain string. Validate at the ONE client-reachable boundary (the `"use server"`
   wrapper `generateResource`), NOT the shared core a trusted background job (Inngest) also calls directly. This is the
   validation-schema face of Q-07-001 (trace the producer + the parser's defaults before adding/strictening it); and the
   value is token-cost bound + fail-fast + repo Zod-at-boundary consistency + killing misleading dead code — NOT
   prompt-injection (single-tenant self-injection crosses no privilege boundary; re-anchor the impact). Shape-lock the
   wired schema with the FIRST unit test (the SPINE-types-parse + non-strict-`url` invariants), the cheap regression guard.
   **Tracing a finding's INBOUND entry points can surface a HIGHER-grade sibling in the SAME chapter — mint it (the owner
   may choose fix-now even in a lower-grade session); and proactively verify each of the chapter's §7 findings of the
   target grade actually APPEARS in ch.24's canonical by-theme tally — an ORIGINAL finding can be silently ABSENT, so the
   headline UNDERCOUNTS (learned 2026-06-20, Session 19).** Tracing Q-10-010's inbound path (`GeneratorForm` ←
   `[id]/page.tsx`) surfaced **Q-10-012 [HIGH]**: the generator page read learner/book/video by URL-param id via
   `withTenant` with **no app-layer org-match guard** (RLS off → a live cross-org **student-PII** read), unrelated to the
   finding being worked — minted-and-fixed in a MED session (owner: fix now; the page-display reads are a separate surface
   from Q-10-010's lineage *write*). This is the page/deep-link face of Session 18's "inbound trace surfaces a separate
   bug." Separately, Q-10-010 itself was **missing entirely** from ch.24's MED by-theme list (the "26" summed
   self-consistently *without* it), so the true open-MED was **27** — the §4 reconcile is **presence + arithmetic**, not
   arithmetic alone: when you open a (chapter × grade) cell, confirm each of that chapter's §7 findings of that grade is
   actually listed in the canonical tally before trusting the headline.
   **A "uses plain `db` / not `withTenant`" tenancy finding SPLITS on one question — *is the app-layer org boundary
   present TODAY?* — and `withTenant` is NOT that boundary; with RLS OFF it is a NO-OP that adds NO `organizationId`
   predicate (db.ts:106-110), so the LIVE boundary is an explicit `where:{organizationId}` predicate or an app-layer
   ownership check, and `withTenant` is only the RLS-readiness (future) layer (learned 2026-06-20, Session 20 / 10-HIGH).**
   So for each such finding: (a) if NO predicate/check exists today → it's a **LIVE IDOR**, and the real fix is to ADD the
   explicit predicate (Q-10-001: `getSourceMetadata` had no auth + no org filter → added `getCurrentUserOrg()` +
   `findFirst({where:{id, organizationId}})`); (b) if a correct app-check/stamp IS already present (Q-10-002 stamps org on
   create; Q-10-003 has `course.organizationId !== organizationId` before the write) → there is **NO live vuln** (it was
   graded HIGH only on cluster-membership; really MED), and the fix is the **`withTenant(..., {organizationId, userId})`
   wrap** that brings it to the area standard (`explode-bundle.ts`). **When the cheap zero-risk wrap CLOSES the finding,
   a re-grade is MOOT — fix-and-close beats re-grade-and-keep-open; record the over-grade in the CHANGELOG (honesty) but
   don't action a re-grade on something you're closing** (contrast Session 19's Q-10-010 sub-claim-2, re-graded *because*
   it was deferred not fixed). Two right-sizing + mechanical corollaries that held: **(i)** for a **single-op read**, prefer
   the explicit predicate over `withTenant` — under RLS the per-query extension wraps a lone op transparently, so
   `withTenant`'s explicit-ctx is only needed for **multi-op `$transaction`/raw** work (wrapping a lone `findFirst` is
   over-engineering; the adversary confirmed). **(ii)** when you wrap creates in a `withTenant` closure, a var created
   INSIDE it (e.g. `spec`) leaves scope for code AFTER the block — re-derive the value from the returned row
   (`bundle.specId`), and keep the **Inngest send + any AI/`generateObject` call OUTSIDE the tx** (a network/AI call must
   not hold the DB connection past Prisma's ~5s tx timeout). And the `withTenant` wrap shifts line numbers that sibling
   chapters cite (here ch.02/09/23) — re-derive those cross-refs (the Session-15 doc-currency line-ref tail).
   **Sub-shape (b-prime): when the existing app-check is a SEPARATE post-fetch `row.organizationId !== organizationId`
   comparison on a SINGLE-OP read, the fix that CLOSES the "brittle/droppable line" framing is to MERGE the org filter
   INTO the query (`findUnique({where:{id}})` + `!==` → `findFirst({where:{id, organizationId}, select:{id:true}})` +
   `if(!row)→403`), NOT a `withTenant` wrap — and `withTenant` would actively FAIL to close it because, RLS off, it
   adds no predicate and leaves the exact `!==` line the finding complains about (learned 2026-06-20, Session 22 /
   11-MED).** Q-11-001 (chat route `db.learner.findUnique` + `student.organizationId !== organizationId`) resolved this
   way, mirroring Q-10-001 exactly. Three mechanical points that recur: **(1)** `findUnique` can't take a non-unique
   `organizationId` in its `where` → switch to `findFirst` (id is still unique, so it returns ≤1 row — zero behavior
   change). **(2)** Add the fail-closed `if (!organizationId) return 403/throw` guard BEFORE the query (the Q-10-001
   shape) — it does double duty: handles the null-org edge that the old `!==` only caught "by luck" of the related FK
   being non-nullable, AND narrows `organizationId` from `string|null` to `string` so the Prisma `where:{organizationId}`
   typechecks. **(3)** That narrowing then lets you DROP any now-redundant downstream non-null `!` on `organizationId`
   (e.g. a later `inngest.send`) — a strict type-safety win, and a clean tell that the guard is real. The disposition is
   **fix-and-close** even when the finding reads MED-bordering-LOW ("correct today"): the merge *materially* removes the
   droppable line (not cosmetic), so don't re-grade-and-keep-open. (This is the single-op-read READ cousin of corollary
   (i) above — same "explicit predicate beats withTenant for a lone op," but here the existing shape is a post-fetch
   compare to *replace*, not a bare unprotected read to *add* to.)
   **A "verbose / PII logging" finding's REAL security item is usually the error-RESPONSE leak, not the log noise —
   and the client-facing error body must drop BOTH the stack AND the message, because `error.message` is itself
   sensitive when the catch wraps DB/tenancy/prompt internals (learned 2026-06-20, Session 21 / 11-LOW).** Q-11-002
   bundled debug `console.log`s (server-side, annoying but low-stakes) with a 500 that returned `error.stack` **and**
   `details`=`error.message` to the browser. The adversary's sharpening (overriding the draft's "stack OR details"):
   remove **both** — for a catch wrapping `getContextForThinkling`/`db`/`inngest`/prompt-assembly, `error.message`
   can surface DB/tenancy/internal-prompt text to a student's screen — return a generic `{ error: "Internal Server
   Error" }` and log the stack server-side only via a kept `console.error`. Also simplify any error body that echoes
   the *request* back (the 400 returned `received: json`, reflecting the student's message). So when triaging a
   logging finding: separate the **server-log PII** (delete the debug logs, keep the legitimate `console.error`
   handlers) from the **client-facing leak** (the higher-value fix — strip stack+message+request-echo from every
   error response). Removing/adding `console.*` is lint-neutral here (no `no-console` rule), so it's tsc/lint-safe;
   and flag any debug log you delete that was the *only* diagnostic for a known open bug (here the "blank assistant
   message" workaround) as a **conscious trade**, not a silent loss.
   **The canonical fix for a "hand-synced collection drifts from a union type" finding is `as const satisfies
   readonly { id: TheUnion; … }[]` — but `as const` is MANDATORY (else the id literals widen to `string` and the
   check passes vacuously), `satisfies` catches a RENAMED/MISTYPED id but NOT a missing member (no exhaustiveness),
   and you must type EVERY element field (excess-property checking on fresh literals), so type a component field with
   the library's actual exported type (learned 2026-06-20, Session 21 / 11-LOW).** Q-11-004's `MODES` array was
   hand-synced to `ThinklingMode` with only a casual `id as ThinklingMode` cast. The fix added `as const satisfies
   readonly { id: ThinklingMode; …; icon: Icon; … }[]` so a mistyped id now fails compilation — note three traps:
   (a) without `as const` the satisfies is useless (literals widen); (b) it does **not** catch *adding* a 4th union
   member with only 3 entries, so scope the impact claim to "rename/mistype fails compilation," not "add"; (c) the
   satisfies type must list ALL fields the literals carry (here `icon`), and the icon type is the phosphor `Icon`
   (the component type), **not** `IconProps` (the repo's other phosphor import) — `grep`/read the `.d.ts` to get the
   exported name right before annotating. The redundant `as` cast can stay (harmless). This is the collection-config
   cousin of the Session-9/10 "one shared `where`-fragment shape-locked by a test" rule: make the drift a compile
   error at the exact sync site.
   **A LOW cleanup that EDITS a file also shifts the line numbers of that SAME chapter's still-OPEN higher-grade
   findings — refresh their own `file:line` cites in the same pass (currency, NOT a disposition) (learned 2026-06-20,
   Session 21).** Removing the debug logs + dead fallback shrank `route.ts` 116→94 lines, so the MED `Q-11-001`'s
   evidence cite (`route.ts:51/:52`) was now wrong even though the finding stays OPEN/untouched. The Session-15/20
   line-ref tail (sibling *chapters*) extends inward: re-derive the open finding's cite in the chapter you're editing
   too, and note it as a refreshed-ref (don't let it read as a re-grade). *(Bookkeeping note: ch.24's **LOW** section
   is a running per-session PROSE log, not a structured by-theme list like MED/HIGH — so the LOW §4 reconcile is the
   running count + each session's closure sentence; a chapter's LOW findings live in its own §7, not a ch.24 LOW
   by-theme entry.)*
   **A "raw `db` / not `withTenant`" tenancy finding on a BACKGROUND-JOB op leans FIX (not accept) even with no live
   vuln, because it is the one op that can silently FAIL-CLOSED at the RLS cutover — and the explicit predicate must
   filter via the RELATION when the model has no org column of its own (learned 2026-06-20, Session 23 / 12-LOW).**
   Q-12-005 (`sendSafetyAlert` reads/updates `SafetyFlag` on raw `db`) had NO live vuln (sole caller is the trusted
   Inngest job; the read self-scopes by the flag's own student→org relation). The reason to FIX (not accept) is
   RLS-readiness: it was the **only** safety-pipeline DB op not using the explicit-ctx `withTenant(..., {organizationId,
   userId:null})` pattern the rest of the job already threads (the job distrusts the extension's AsyncLocalStorage
   propagation, db.ts:103-105) — so at RLS-on, if the `$extends` hook can't see the job's `setRlsContext`,
   `resolveTenant()`→null→the query runs GUC-unset→the org policy fails CLOSED→the flag read returns null→**no caregiver
   alert for a real child-safety concern**. A raw-`db` org-scoped read in a bg job is therefore not "harmless
   defense-in-depth" — it's the single point that breaks (silently, in the dangerous direction) at the cutover; fix it
   by matching the area's explicit-ctx wrap. **Mechanical gotcha that tsc caught:** the model (`SafetyFlag`) had **no
   `organizationId` column** — it scopes through `student` (Learner) — so `where:{ id, organizationId }` is a tsc error
   (`organizationId does not exist in SafetyFlagWhereInput`); the correct explicit predicate is the **relation filter**
   `where:{ id, student:{ organizationId } }`, which mirrors the table's RLS policy (`student_id IN (SELECT id FROM
   students WHERE account_id = current_org)`). **Always check the schema for whether the model HAS a direct org column
   before writing the predicate** — for join-scoped tables (safety_flags, activity_progress, course_blocks→courses,
   etc.; grep migration `00000000000002_rls_policies`) the live boundary is a relation filter, not a scalar one, and
   `findUnique`→`findFirst` is forced (a compound non-unique `where` is invalid on `findUnique`). The withTenant wrap
   (RLS-ready) + the relation predicate (live boundary today) are BOTH required — explicit-predicate-only leaves the
   RLS-on fail-closed; withTenant-only leaves no live boundary today.
   **A "duplication/drift" finding whose duplication is INTENTIONAL + documented: centralize the *definition* into one
   shared predicate but PRESERVE the two independent runtime re-checks — extract a `Pick<>`-typed predicate over the
   RAW fields (not the derived value) and KEEP the explanatory comment verbatim (learned 2026-06-20, Session 23 /
   12-LOW).** Q-12-006 (the caregiver hard-stop `implicatedCaregiver || disclosureRisk==="HIGH"` encoded in both
   `policy.ts` and the job's escalation guard) was deliberate defense-in-depth (the job's comment explains escalation
   could otherwise upgrade `STUDENT_OPTIONAL_OUTREACH`→`PARENT_SUMMARY_*` and email the feared caregiver). The fix is
   NOT to delete one site (that would remove the DiD) but to extract `isCaregiverHardStop(Pick<…,"implicatedCaregiver"
   |"disclosureRisk">)` as the single source of truth and call it at BOTH sites — so there are still two independent
   runtime evaluations on the **raw** fields; only the literal definition drift is removed. De Morgan makes the job's
   negated guard (`!implicatedCaregiver && disclosureRisk!=="HIGH"`) exactly `!isCaregiverHardStop(...)` (verify the
   equivalence; both operands are pure reads). Two guardrails: the predicate must `Pick` the **raw assessment fields**
   (not the resolution string, or you'd couple the re-check to the derived value and break the independence), and the
   explanatory comment stays verbatim (it documents WHY the redundancy exists — a future dev must not delete it as "now
   redundant"). This is the shared-*predicate* cousin of Session 15's shared-*constant* convergence: converge the
   safety-critical definition, keep the deliberately-separate evaluations.
   **A dead field the LLM is asked to emit but nothing reads: REMOVE over WIRE when wiring would couple a deterministic
   safety decision to the model's freeform output (same session).** Q-12-002 (`recommendedResolution` in the safety
   `generateObject` schema, zero readers) — the finding offered "remove or wire," but `policy.ts` is an intentionally
   *deterministic* "Minimum Social Responsibility" matrix, so wiring the model's suggested action could let it bypass
   the caregiver hard-stop → WIRE is actively unsafe, REMOVE is correct. Removing a schema field is tsc-safe when the
   other producers (regex fast-path, error fallback) already build the type without it (optional); and no prompt edit is
   needed when the prompt never names the field. (AI-domain instance of "make the dead surface honest" — but here the
   honest move is deletion, because the alternative re-introduces a safety coupling the design deliberately avoids.)
   **A finding's LITERAL mechanism can be REFUTED (dead-code) while a SHARPENED variant at a DIFFERENT line is the real
   defect — the disposition is RESOLVE-after-sharpen (fix the real path + re-point the cite), NOT dismiss (learned
   2026-06-20, Session 24 / 12-MED).** Q-12-003's literal claim ("an LLM severity falls through the policy switch
   `default` → silent downgrade") was dead code (the 6-value Zod enum is fully cased before/at the switch, so `default`
   is unreachable), but the finding's *spirit* (two severity ontologies → downgrade) reproduced via a different path:
   the urgent self-harm/violence branch gated on `severity ∈ {TIER_1,TIER_2}`, and the classifier prompt defines NO
   severity vocabulary, so a real PLAN labeled "CONCERN" skipped urgent-notify. Contrast Session 10 (DISMISS — the §7
   claim was simply mistaken, no real defect anywhere) and Session 17 (RESOLVE a stale *comment*): here there IS a real
   code defect, just not at the cited line, so you FIX the real path and re-point the evidence cite. **The fix for a
   child-safety decision gate keyed on a model-chosen LABEL the prompt never defines is to route on the MEANINGFUL
   fields (category/evidenceLevel/target), making the ambiguous label non-load-bearing** — the DB-enum/ontology
   reconcile rides the deferred migration ([[Q-013]]); confirm the change only ADDS protection (fail-safe) and the
   caregiver hard-stop still strictly precedes (generalizes Session 15's "converge the safety-critical surface").
   **A regex/whitelist "over-broad suppression" finding: the clean fix is a PER-ITEM exemption flag for the
   unambiguous-high-severity patterns — NOT the finding's own suggested span-window (which LEAKS — the benign word sits
   adjacent to the threat) and NOT a blanket category exemption (which FLOODS — a bare noun like "suicide" matches
   academic/awareness text). SPLIT a mixed pattern into its first-person-explicit sub-pattern (exempt) vs its bare-noun
   sub-pattern (still gated), and empirically test BOTH the leak case and the flood case (learned Session 24 /
   12-MED).** Q-12-004: `exemptFromWhitelist` on the explicit `kill myself`/abuse-ACTION patterns; bare `suicide`/
   violence/incest-THOUGHT stay whitelist-gated; whitelist applied per-pattern (was a blanket early-return).
   **When the owner answers a scoped question with a large STRATEGIC BRIEF (Tier-1/2/3, `[DECISION]` legal gates,
   "get sign-off", multi-file feature builds, schema changes), that is a SCOPE EXPANSION beyond the session's bounds —
   STOP and re-scope (the second face of §9.3), don't execute it (learned Session 24 / 12-MED).** Several brief items
   collided with the session's hard rules (Prisma schema = deferred migration; legal `[DECISION]`; a feature build;
   verified crisis resources). The disciplined response: (a) map each brief item to an EXISTING finding (T1-A = the
   open HIGH Q-12-001; T1-C = the target Q-12-003) or a NEW finding id; (b) do only the **app-layer, no-schema,
   no-legal, bounded-and-tested** subset that resolves the session's target findings (here the structural T1-C policy
   fix the brief itself pointed to); (c) **mint the rest as graded findings + a roadmap section**, but **verify each at
   its `file:line` before recording it** (code-is-truth — read the referenced files, e.g. route.ts, rather than minting
   on the brief's say-so; roadmap-only the items you can't verify this session); (d) confirm the split with the owner
   before writing code. **Mass-mint reconcile:** when one session BOTH closes and mints, the grade count moves both
   ways (24 − 2 closed + 5 minted = 27) — show the net in the lineage, put the new findings in a NEW by-theme entry
   (don't bury them under an existing theme), and bump EVERY tally spot (headline, grade header, by-theme, 00-INDEX,
   LOW running-log total+open) in the same pass.
   **The canonical fix for a "fail-OPEN on error" safety/guard finding is to return the RESTRICTIVE value routed to a
   NON-notifying-but-STORED state — NOT to invent a dedicated new enum value, and NOT to escalate (learned 2026-06-20,
   Session 25 / 12-HIGH).** Q-12-001: the safety LLM catch returned a fully-safe assessment on any error → policy
   `NO_ACTION` → the job stored nothing. The fix flips the catch to `isSafe:false` with field values that route to
   `INTERNAL_LOG_ONLY` (a durable, DB-queryable "needs human review" flag that never emails). Four reusable sub-rules:
   **(a)** "fail closed" in a system with a *"never notify the feared/implicated party"* invariant does NOT mean
   "notify everyone" — on an error the hard-stop axes (here `implicatedCaregiver`/`disclosureRisk`) are genuinely
   UNKNOWN, so closed = **preserve the signal (store a flag) + WITHHOLD the irreversible action (no auto-notify)**; leave
   the unknown axes at their non-escalating defaults rather than fabricating a hard-stop (fabricated data is dishonest
   in a stored row and pointless when you're not acting on it anyway). **(b)** Identify the ONE load-bearing field the
   downstream router keys on and pin it (here `category:"OTHER"` keeps the error-flag out of the urgent
   self-harm/violence branch; a drift to SELF_HARM/VIOLENCE+INTENT/SELF would route to a caregiver email on an
   UNCLASSIFIED message) — the shape-lock test must assert that field AND the resulting resolution. **(c)** Do NOT
   introduce a *novel* enum value to mark the error state: a producer that returns an INPUT type (a `SafetyAssessment`)
   can't synthesize a downstream DECISION type (a `SafetyResolution`) without spilling into the consumer/policy/job
   (out of the owning chapter), AND a novel value silently bypasses sibling allow/deny guards keyed on the known values
   (here the job's escalation skip-list lists only `INTERNAL_LOG_ONLY`/`SUPPORTIVE_ONLY`, so a new `NEEDS_HUMAN_REVIEW`
   would wrongly *enter* pattern-escalation — fragile accidental safety) — reuse an existing routed-correctly value and
   carry the distinguishing detail in a plain `reasoning` string. **(d)** A retry-before-fail-closed refinement
   (let transient errors THROW so the job's runner retries) often touches the *job* chapter and changes failure
   semantics (here the Inngest fn has no `step.run` wrapper → a throw re-runs the whole body → double-flag risk) — defer
   it to the roadmap; fail-closed is the safe terminal baseline regardless.
   **A HIGH finding that is fundamentally a multi-file FEATURE build + a legal `[DECISION]` resolves as ⏳ DEFER-kept-OPEN
   (no re-grade) — and its lone "bounded-looking" sub-item can ITSELF be owner-decision, not a born-resolvable fix, when
   it is unverifiable safety/behavioral text (learned Session 25 / 12-HIGH).** Q-12-007 (no in-the-moment child-facing
   layer): every structural part needs a channel/UI that doesn't exist (a feature) and/or carries a T2-D legal
   `[DECISION]`, so §9.3 defers it; HIGH stays correct because the system fails SAFE (the hard-stop is enforced
   redundantly). The tempting "just reword the bot prompt" slice is NOT a clean bounded fix: it is **unverifiable
   LLM-governed text** (no test can prove the model honors it → fails the "bounded+testable" bar) AND a child-safety +
   legal-adjacent edit where a naive "more honest" reword can be a *regression* (e.g. deterring disclosure) — so present
   it as an OWNER_DECISION (recommend leave-as-is), never edit unilaterally. When a single finding fixes one half and
   leaves another (here Q-12-001 fail-closed CLOSES the "classifier-error → zero post-hoc signal" half of Q-12-007, but
   the "zero in-the-moment signal" half remains), say so explicitly in BOTH findings' notes so the deferred scope stays
   accurate. **Owner-decision sub-items that the owner leaves as-is are still TRACKED (under the parent finding), never
   silently dropped** (here Q-12-007's promise-gap + the "helplines promised at policy.ts:29 but emitted by no code" gap).
   **An observability/logging finding ("X fails silently / is hard to diagnose") resolves by logging at the ACTUAL
   degradation point — the place the whole-UNIT failure manifests AND has no downstream fallback — NOT at the specific
   sub-step the finding (or the owner) names; the adversarial pass exists to catch that a sub-step log (a) FALSE-ALARMS
   on the benign path that is structurally identical to the failure, and (b) MISSES the other causes of the same
   failure (learned 2026-06-21, Session 26 / 13-LOW).** Q-13-005 (LibreTexts deki-token screen-scrape) drafted — and the
   owner literally asked — for a warn inside `libraryToken` on a token-regex-miss; refuted because a regex-miss is
   *benign* for the libraries that serve the deki API anonymously (the design comment says so), so it false-alarms every
   cache-TTL **and** misses the token-valid-but-API-403/expired path. The right place was the book-level
   `assembleLibreTextsSections` `!tree?.page` early-return: it fires once per failed book, captures every cause
   (token/markup/network), and can't false-alarm (a healthy anonymous library returns a tree fine). Three corollaries:
   (a) **prefer the no-fallback unit** — a silent failure is only consequential where nothing masks it; LibreTexts is
   corpus-only (no registry fallthrough), unlike the by-title scrapers whose silent failure the next source covers, so
   it's the one worth logging (and that asymmetry let the SIBLING fragility-cluster finding Q-13-007 close as
   accept-by-design rather than demand a uniform log sweep); (b) **match the file's existing logging level** — grep for
   `console.error`/`.warn` first (this file used `.error` everywhere, zero `.warn`); (c) when the owner's stated remedy
   names a sub-step, say plainly you moved it and why (deviating from the literal ask is correct when the adversarial
   pass earns it). General: for "make the silent failure visible," log at the failure's point-of-no-return, not the
   first sub-step that can go wrong.
   **A "duplication/drift" finding where ONE lone file diverges from an ALREADY-shared house module resolves as FIX
   (converge the holdout onto the shared module) — the OPPOSITE of the Session-13 icon-lib accept; the discriminator is
   direction × scope (learned 2026-06-21, Session 26 / 13-LOW).** Q-13-002: gutenberg.ts carried private copies of the
   shared `matching.ts` helpers (and matching.ts's header even *falsely listed it as a consumer*) while the five other
   adapters imported them. Converging the minority holdout onto the established shared module is low-churn + kills real
   drift → FIX; Q-07-002's accept was right because standardizing there meant migrating **56 files** toward a
   config-declared MINORITY lib (disproportionate). So: *converge-the-lone-holdout-onto-the-majority/shared = fix;
   migrate-the-majority-toward-a-minority = accept.* Implement by **DELEGATION, not reimplementation** — wrap the
   domain-specific extraction (here the Gutendex `{name}` → name-string pull) around the shared function so behavior is
   *provably identical* (adversarially verify byte-equivalence of every score/null path), and keep the genuinely-local
   specialization where it is (the `hasUtf8Text`+`download_count` edition ranking stayed in `findOnGutenberg`, never in
   the shared matcher). Shape-lock the shared function with the layer's first unit test, and fix the now-true/false
   header comment in the shared module (code-is-truth). **And before ACCEPTING a sibling "no schema guard / fragility"
   finding, have the adversarial pass actively look for a genuinely-unguarded JSON/trust-boundary hiding under the
   "it's all by-design fail-safe" framing** — the finding's *title* ("no schema guard") can point at a real Zod-able
   boundary, not just HTML scraping; confirming the JSON endpoints already do conservative `typeof`-guarded extraction
   is what makes the accept honest (Q-13-007).
   **A cache-staleness / "invalidation is inconsistent" finding turns on the Next.js CACHE LAYER — identify which
   cache holds the data before sizing the fix, because the fix differs per layer and the finding's own mitigation
   guess is often WRONG (learned 2026-06-21, Session 27 / 14-LOW).** Q-14-008: a server action wrapped its reads in
   `unstable_cache` (the **Data Cache** — keyed/tagged, TTL'd), but the CREATE routes didn't bust the tag while the
   add-actions + extract routes did. The finding hedged that "`router.refresh()` happens to bypass the cache" —
   **FALSE**, and disproving it *strengthened* the finding: `router.refresh()` clears the client **Router Cache** and
   re-runs the RSC, but the RSC just calls the memoized `unstable_cache` function again, which returns the stale value
   until the **tag is revalidated or the TTL expires** (Data Cache ⊥ Router Cache). So `revalidateTag` is the ONLY
   real fix. This is the caching face of the Q-01-002 "verify what actually flows through the pipeline before sizing"
   rule: pin the exact layer (Data Cache via `unstable_cache`/`fetch`; client Router Cache via
   `router.refresh`/`<Link>` prefetch; Full Route Cache via static render) and match the invalidation to it — don't
   trust the finding's parenthetical about how the cache "gets bypassed." Three right-sizing corollaries: **(a)** match
   the invalidation call to the **closest write-path analogs** — here the sibling add-actions (`addArticle`/
   `addDocuments`) used `revalidateTag` alone, so the CREATE routes do too (consistency + one mental model); **(b)** do
   NOT add `revalidatePath` reflexively — a sibling finding (Q-14-003) had already flagged `revalidatePath("/library")`
   as a **dead no-op** (that route was removed), so adding it would re-introduce dead code; **(c)** trace the *real*
   staleness window per entry path before asserting impact — the BOOK add (redirects to a detail page that reads an
   UNcached query, so the catalog is stale only on back-nav) was the clear case, the VIDEO add was partly **masked**
   because its chained EXTRACTED-extract already revalidates (the create-route fix only closes the stuck-`EXTRACTING`
   tail), and the standalone videos page reads an entirely UNcached DAL — so "stale for 1h" held only for the catalog
   tab, not universally. **And a "dead HANDLER within a LIVE route file" (one dead export beside a live one) resolves
   by deleting just the dead export — distinct from the chapter's higher-grade "whole dead route FILE" findings
   (Q-14-001/002) — and the deletion clears any unused-var the dead handler carried (two issues, one deletion);
   confirm every shared import is still used by the surviving export before deleting (here `db` stayed live via the
   POST's subject/strand lookups, so no import orphaned).**
   **A "trusts client-supplied `organizationId`/`userId`" WRITE finding (server action or route) is fixed by DERIVING
   both server-side via `getCurrentUserOrg()` and DROPPING the client params (a kept-but-ignored param is dead/dishonest
   code) — but `getCurrentUserOrg()` returns `organizationId: string | null` (User.organizationId is NULLABLE), so you
   MUST add the `if (!organizationId) return/throw` guard the API routes already carry, or tsc fails (`string|null` ⊀
   the Prisma `string` field); that guard also narrows the type for the downstream `where`/`data` (learned 2026-06-21,
   Session 28 / 14-MED).** Three corollaries that recur for this shape (Q-14-005; same family as the remaining
   Q-16-002/17-003/004/18-002 write-trust findings): **(a)** such a finding is often a true **HIGH** (authenticated
   cross-tenant WRITE + injection into another tenant's storage namespace e.g. Firebase `documents/{org}/` + Inngest
   job-payload), but **fix-and-CLOSE makes the re-grade moot** (Session-20 rule) — record the true grade in the
   CHANGELOG, decrement the finding's *actual* (MED) grade count. **(b)** Dropping the params ripples to the call-site
   component(s) + their parent props — **trace which props remain load-bearing for OTHER siblings before deleting**
   (Session 28: `organizationId` stayed for `BookList`; only `userId` was fully removable end-to-end incl. `page.tsx` —
   an over-eager removal of a still-used prop is a regression, a kept-but-unused one is a lint warning). **(c)** When
   the same fix should add a THROWING guard (`assertParentProfile()`) to a **route handler** whose POST body has no
   outer try/catch, **WRAP it → a clean 403** (`try { await assertParentProfile() } catch { return …403 }`); a bare
   top-of-body `await assertParentProfile()` throws → an unhandled **500** (still a denial, but messy — the precedent
   `api/courses/[id]/blocks/[blockId]/route.ts:216` wraps it). Verify regression-free by proving no
   lower-privilege flow reaches the route (here `profile-access.test.ts` asserts STUDENT is blocked from the hosting
   pages; the guard works in route handlers — it reads the active-profile cookie via `next/headers`).
   **A dead-code finding whose KEEP-vs-DELETE turns on a PLANNED FEATURE: get the product intent from the owner, then
   verify whether the dead code is the RIGHT SCOPE for that feature before deciding — "unfinished BUT wrong-scoped"
   resolves as DELETE-now + ROADMAP-fresh, NOT keep-as-scaffolding (learned 2026-06-21, Session 29 / 14-HIGH).** Q-14-001
   (dead `GET /api/library/search` → `searchBooks`, an unscoped cross-org pgvector scan reachable by any authed user)
   read as a straight dead-route delete, but the owner flagged that book semantic search is roadmap-real (a community
   "pre-extracted ✓" indicator + cross-edition dedup). The decisive question for keep-vs-delete was NOT "is the feature
   planned?" but **"is THIS code a building block for it?"** — and it wasn't: `searchBooks` searched the per-org `books`
   table, while the planned feature needs the GLOBAL `BookExtraction` corpus (different corpus/key/return-shape). So the
   honest disposition was **delete the wrong-scoped code + capture the feature as a ch.24 §5 roadmap item to build fresh**
   — keeping it "as scaffolding" would preserve misleading dead code the real build won't reuse. This is the third branch
   of Session 16's superseded-vs-unfinished fork: *superseded → delete; unfinished-and-reusable → keep+re-document;
   **unfinished-but-wrong-scoped → delete + roadmap.*** Three companion rules that recur: **(a)** when the owner answers
   a scoped keep-vs-delete question with a FEATURE VISION, treat it like Session 24's strategic brief (§9.3 scope
   expansion): resolve the in-scope findings + roadmap the vision + mint ONLY the code-grounded finding it warrants
   (here **Q-13-009 [LOW]** — the cross-edition dedup-key fragmentation in *existing* `computeDedupKey`, verified at its
   `file:line` before minting), but do NOT build the feature in a resolution session. A missing *feature* is a roadmap
   item; a *limitation in existing code* is the finding. **(b)** the dead route's sole-consumer primitive (`searchBooks`)
   was itself a *separately-filed finding in another chapter* (ch.15 **Q-15-001 [MED]** "no account_id predicate") —
   deleting the route orphaned it, so the deletion **closes Q-15-001 resolved-by-removal** (count moves in the OWNING
   chapter ch.15/ch.24 — the Session-12 cross-chapter orphan-tail rule, here applied to a *graded sibling finding*, not
   just an un-findinged module), and the owner's delete-vs-patch fork on the primitive was decided by the same
   wrong-scope logic; before deleting confirm the file's OTHER exports stay live (here `findSimilarBooks` has its own
   consumer → no further orphan). **(c)** before presenting the keep-vs-delete fork, lead with the *scope mismatch*
   itself — the owner's first instinct ("don't throw away search work") flips once they see the dead code searches the
   wrong corpus for their own vision.
   **A `where: any` built from Next `searchParams` → `Prisma.XWhereInput`: the type and the per-param coercion are
   COUPLED, not two independent fixes (same session).** `searchParams` values are `string | string[] | undefined`; once
   you type the `where`, a raw `searchParams.foo` no longer assigns to a scalar Prisma field (`string | StringFilter`),
   so "type it" FORCES "coerce each param to a single string" (`Array.isArray(v)?v[0]:v`) — and the coercion must cover
   EVERY param, not just the one the finding names (the adversarial verifier caught this). The win is real but modest (a
   duplicate `?foo=a&foo=b` array currently 500s the page via `PrismaClientValidationError`; **no leak** — the
   `organizationId` predicate is unconditional), so a HIGH graded on cluster-membership is over-graded (really MED/LOW
   input-validation) → the input-validation face of the Session-20 fix-and-close-makes-re-grade-moot rule (close it
   cheaply, record the over-grade in the CHANGELOG, decrement the *actual* grade — here HIGH).
   **A perf finding that says "N+1 → replace the per-iteration query with ONE set-based query" turns on whether the
   per-iteration query is INDEX-SERVED — READ THE MIGRATIONS for an index on the scanned column before sizing the fix;
   with no index a set-based rewrite eliminates round-trips but NOT the compute (same scan either way), so there is NO
   algorithmic gain, only round-trip latency, and for a bounded (≤N) best-effort BACKGROUND path that's not worth the
   rewrite risk (learned 2026-06-22, Session 30 / 15-LOW).** Q-15-005 (`crossWalkTextbookTopics` issues ≤`MAX_TOPICS=250`
   sequential cosine queries, one per topic): `textbook_chunks.embedding` has NO ivfflat/hnsw index (migration
   `00000000000008` creates only `subject_idx`+`document_id_idx`), so the per-topic `max(1 - (embedding <=> $vec))` is a
   full sequential scan regardless — a `unnest($1::vector[])` rewrite computes the identical ~250×1500 cosine ops, saving
   only the 249 round-trips. Three checks right-size any "make it set-based / batch this loop" perf finding: **(1)** does
   an index serve the per-iteration query? (no index ⇒ the rewrite buys only round-trips); **(2)** grep for PRECEDENT of
   the SQL/idiom the rewrite would introduce — here `$1::vector[]`+`unnest` has ZERO precedent (every existing query binds
   exactly one `$N::vector`), and a novel raw-SQL idiom **behind a swallowing `catch`→return-0** (`textbook-coverage.ts:96`)
   is its own latent-data-quality regression surface (a casting bug makes the feature SILENTLY stop computing — worse than
   a slow-but-correct loop); **(3)** weigh the path's criticality (request vs background, bounded vs unbounded, idempotent
   /retried). Reading the migration for the index is the cheap load-bearing check that flips the disposition to
   ACCEPT/won't-fix for a LOW. (A bounded-concurrency middle option — `p-limit` instead of full `Promise.all(250)` — is the
   only low-risk speedup, but still not worth it when the function already runs at `concurrency:3` on a shared pool.)
   **Companion (same session): a dead-code finding can be CORRECT in its conclusion (the symbol is dead) yet WRONG in its
   stated REASON/coupling — re-derive the data flow and CORRECT the mis-attribution as part of the resolution.** Q-15-003's
   impact claimed the dead `generateVideoEmbedding`'s sibling `searchVideos` "has no data path" because the summary vector
   was unpopulated — but `searchVideos` read the CHUNK table (`video_extraction_chunks.embedding`, populated by the LIVE
   `embedVideoChunks`), NOT the summary column, so the two were INDEPENDENT deaths, not one coupled pathway. Both were
   still dead (the REMOVE disposition held), but the doc framed them as a coupled family; fixing the wrong evidence
   sentence is part of leaving the doc code-true. (And surface the recent-precedent twin: the video pair was the same
   built-but-unwired family as the S29-deleted `searchBooks`, so the adversarial pass rightly pushed my "balanced fork
   with a keep-lean" to a confident REMOVE recommendation — present the fork, but lead with the evidence-backed lean, not
   a neutral "owner's call.")
   **A "hardcoded placeholder / looks-live-but-static" UI finding can resolve as an in-scope FIX_NOW by WIRING it to
   already-seeded data — but VERIFY read-only that the data is actually seeded AND that a query pattern already exists
   before believing a verifier's "it's just ~15 lines" (learned 2026-06-22, Session 31 / 16-LOW).** Q-16-005 (ParentDashboard
   "Daily Liturgy" hardcoded "Psalm 23") drafted as OWNER_DECISION (remove vs accept, since wiring "felt like" a feature) —
   a skeptic flipped it to FIX_NOW by pointing at the seeded `Devotional` table + the existing `findMany({where:{month,day}})`
   pattern in `devotionals/page.tsx`; I confirmed BOTH read-only (Supabase MCP: 732 rows / 366 days / `time` am|pm, format
   consistent across sampled days) before trusting it. So the discriminator from Session-25's "a multi-file FEATURE build
   defers" is **data + query already exist** → a single bare-`db` read + a prop + a render-with-fallback is a proportionate
   cleanup that makes a dishonest card honest; if the data ISN'T seeded or needs a new query/UI, it's REMOVE/ACCEPT, not a
   build. (Mechanical: put `new Date()` inside the helper, not the RSC render body — Session-10 impure-call lint rule;
   parse messy seeded text in the SERVER helper with fallbacks so the component stays dumb.) This is the
   make-the-dishonest-thing-honest cousin of "wire a written-but-dead schema" (Q-10-004) — but the load-bearing check is
   the read-only DB count, not just reading code.
   **A "field X is read but not selected" finding SPLITS on whether the field has a PRODUCER — grep for a writer before
   choosing "select it" vs "delete the read" (learned 2026-06-22, Session 31 / 16-LOW).** Q-16-004 bundled two reads the
   query didn't select: (a) `assignment.resourceId` → the value WAS available elsewhere (`resource.id` already selected) and
   the broken `/resource/undefined` link was a REAL bug → fix the read to the available source; (b) `assignment.notes` →
   `ResourceAssignment.notes` has **ZERO writers app-wide** (the live assign action never sets it) → the never-rendering
   block is dead UI → **DELETE it, do NOT add `notes:true`**. "Select the field the UI reads" is right ONLY when a producer
   exists; otherwise it's wiring display for data nothing creates (false forward-compat). The skeptic correctly overrode my
   "add `notes:true` for forward-compat" draft on exactly this — grep `model.field` writers (`db.*.create`/`update` data:)
   before believing a field is merely "not yet selected."
   **The discriminated-union-vs-permissive-record call for a step-tagged payload turns on the CONSUMER signatures, not on
   "does a permissive record accept the input" — and the agent's REASON can be wrong while its RECOMMENDATION is right; adopt
   the action for the CORRECT reason and record both (learned 2026-06-22, Session 31 / 16-LOW).** Q-16-007: a skeptic said
   "`z.record(z.string(), z.unknown())` REJECTS the nested interests payload → use a discriminated union." The reason is
   FALSE — `z.unknown()` values accept arrays/nested objects, so the permissive record DOES accept interests (re-derived by
   hand; Session-9 "schema validates shape not substance"). BUT the discriminated union was still the right fix for a
   DIFFERENT reason: the three downstream generators have DIFFERENT answer-type contracts (`Record<string,string>` ×2 vs
   `Record<string,any>` ×1), so a single `Record<string,unknown>` won't typecheck against the string-typed consumers without
   an unchecked `as` cast. So a discriminated union (narrow via `parsed.data.step`, NOT a destructured copy — destructuring
   breaks the union correlation) validates each step to its consumer's exact contract with ZERO answer casts (and is precise,
   not over-strict — it matches the consumer, Q-10-004) — the type-honest tool, not over-engineering. General: when validating
   a discriminated payload, check whether the per-branch consumers demand different value types; if yes → discriminated union;
   if uniform → one permissive record. Don't reject a verifier's recommendation just because its stated reason is wrong, and
   don't accept its reason just because the recommendation is right.
   **When the owner chooses to KEEP a "dead/orphaned" route/feature, the disposition is ⏳ kept-OPEN + re-documented as
   UNFINISHED (Q-09-005 style, NOT decremented) when they're tracking unbuilt work — and the REMOVE alternative's orphan-tail
   only fires UNDER REMOVE, so document it as "would-cascade-if-removed" for the next revisit, with NO cross-chapter change
   today (learned 2026-06-22, Session 31 / 16-LOW).** Q-16-001 (`/student/dashboard`, a complete daily-checklist page with
   only a self-referential link) was re-verified as UNFINISHED-not-superseded (a per-student DAILY view, distinct from the
   live `StudentDashboard` and the WEEKLY `/planner`); owner chose keep + roadmap a wire-up → kept ⏳ OPEN at LOW (mirrors
   Q-09-005's "kept open, re-documented"; contrast Q-10-005's "resolved-by-doc" — the discriminator is whether the owner is
   tracking unbuilt work). The REMOVE path would have cascaded a big orphan tail into ANOTHER chapter (ch.21's
   `getStudentDailySchedule`/`toggleItemStatus` — the dead route was their SOLE consumer — closing INFO Q-21-010
   resolved-by-removal); present the keep-vs-remove fork with that cascade SCOPE explicit, but since the owner KEPT, the
   cascade does NOT fire and there's no ch.21 doc change — just record it in the finding's note + CHANGELOG so the next
   revisit inherits the traced tail. (Companion to the Session-12 cross-chapter orphan-tail rule: the tail is a REMOVE-only
   consequence.)
   **A "wrap the raw-`db` writes in `withTenant`" RLS-readiness tenancy finding (the Session-20 family) can include a genuine
   BOOTSTRAP write that MUST stay raw — check the table's RLS INSERT `WITH CHECK` for a relaxed null-context carve-out AND
   `CONTEXT_FREE_MODELS` BEFORE deciding what to wrap; fold only the genuinely org-scoped writes into ONE atomic tx and
   re-derive the returned entity from the closure (learned 2026-06-22, Session 32 / 16-MED).** Q-16-002 (create-student
   raw-`db` writes, route.ts): the org self-heal `organization.create` CANNOT be stamped to its own org — it must run under
   null org context, which the relaxed `organizations` INSERT policy explicitly permits (`WITH CHECK (id = app.current_org()
   OR app.current_org() IS NULL)`, migration `00000000000002`:64; you can't set a GUC for an org that doesn't exist yet), and
   the sibling `user.update` hits a CONTEXT_FREE model (`User` — auth table, permissive policy) → BOTH stay raw, correctly.
   Only the `learner`/`learnerProfile` creates are org-scoped-and-stampable, so the fix folds them into the EXISTING trailing
   `withTenant({organizationId,userId:null})` block (matching the file's own call + the canonical `blueprint.ts` onboarding
   precedent, which bootstraps the org under null context then re-stamps the GUC) — making all the learner writes atomic +
   RLS-ready in one tx. Bind `const entity = await withTenant(async tx => { …; return created; }, …)` so the post-tx response
   (`{ student }`) + the client redirect are byte-unchanged (the Session-20 "var created inside the closure leaves scope"
   corollary). So for ANY "wrap the writes" tenancy finding: (a) read the table's RLS INSERT `WITH CHECK` for a null-context
   carve-out (bootstrap/first-run rows often have one); (b) check `CONTEXT_FREE_MODELS`; (c) wrap only what's genuinely
   org-scoped; (d) prefer folding sibling creates into ONE tx (atomicity bonus: it eliminates the prior orphaned-row window).
   No live vuln (org connected explicitly, session-derived) → fix-and-close, re-grade moot (Session-20 rule).
   **Before MINTING a skeptic's out-of-scope "schema↔RLS-policy table-name drift" flag, verify it against the RENAME
   migration — a Postgres `ALTER TABLE x RENAME TO y` carries its RLS policies / grants / indexes / FKs AUTOMATICALLY
   (policies are OID-bound), so a later migration referencing the OLD name in HISTORICAL SQL text is NOT live drift (same
   session).** A skeptic flagged `Learner` @@maps `learners` vs the migration-2 policies naming `public.students` as a
   cutover blocker; reading migration `00000000000013` — a metadata-only `ALTER TABLE "students" RENAME TO "learners"` whose
   own comment states "indexes, FK constraints, the app_user_rls RLS policy, and grants all FOLLOW the table automatically on
   RENAME" — confirmed it a FALSE alarm (the live policy follows the table by OID; only the frozen migration-2 SQL text still
   says `students`). No finding minted. This is the Postgres-RENAME face of "a schema/agent verdict validates shape not
   substance — re-derive by hand" (Sessions 9/10): a surface name-mismatch between a model `@@map` and an old migration's
   policy text is not drift until you confirm no RENAME reconciled them. (And `pg_policies` via the read-only MCP gives the
   authoritative live policy text if the migration history is ambiguous.)
   **The gold-standard move-aside+`tsc` dead-code proof, when run by a WORKTREE-isolated agent, gives an unreliable
   ABSOLUTE error count — trust the DELTA, not the number (learned 2026-06-22, Session 33 / 17-LOW).** A fresh git
   worktree lacks the git-ignored generated Prisma client (`src/generated/`) and a primed `node_modules`, so the
   isolated agent's `tsc` reports HUNDREDS of phantom errors (e.g. 457 "before") and even attributes a few to the
   target file itself (an untyped `withTenant` result whose types are missing). The load-bearing signal is the
   **delta**: moving the file out dropped *exactly* its own self-errors and produced **zero** new `Cannot find module`
   orphan errors → nothing imports it. Always re-run the real `tsc` yourself in the MAIN tree (which has the generated
   client + is at the 0-baseline) before claiming build-safety — the worktree proves "no static dependency," the main
   tree proves "still 0 errors." (Cousin of the Session-9 "a schema/agent verdict validates shape not substance — the
   agent optimizes for its sandbox" rule, here for the agent's ENVIRONMENT, not its reasoning.)
   **A "validation enforced client-side only → add it server-side" fix on a PARTIAL-UPDATE (PATCH) endpoint must
   validate the MERGED post-update state, NOT the request fields in isolation — when two COUPLED fields can change
   independently, evaluate the effective `(fieldA, fieldB)` pair (request-value ?? existing-value for each) (learned
   2026-06-22, Session 33 / 17-LOW).** Q-17-006 mirrored the client `getAvailableParentBlocks` kind-nesting rules into a
   shared pure `validateBlockNesting(childKind, parentKind|null)` (homed in `lib/schemas/courses.ts`, shape-locked by the
   file's first test). On the create POST the child kind + the just-fetched parent kind are both in the request, so it's
   direct. But PATCH lets `kind` and `parentBlockId` change independently (`route.ts` builds the update from each
   optionally), so a correct validator computes `effectiveKind = validated.kind ?? existingBlock.kind` and
   `effectiveParentId = validated.parentBlockId !== undefined ? (… || null) : existingBlock.parentBlockId`, then fetches
   the EFFECTIVE parent's kind (reuse the already-fetched parent when the parent changed; else one extra
   `select:{kind:true}` read) — the skeptic's catch, because validating only the request's `kind` against only the
   request's `parentBlockId` would miss "changed kind, kept old parent → now-illegal" and "changed parent, kept old
   kind." No UI regression (the UI never sends an illegal pair); a `findUnique`→`findFirst` is NOT forced here (the
   lookups are by unique `id`). General rule: for any mirror-the-client-validator fix, enumerate which fields the
   partial-update endpoint lets move independently and validate the union, not the delta. **And mind the verification
   gate's WARNING baseline across sessions: a jump (S33 saw 651→1314) can be the owner's intervening commit, NOT your
   change — confirm by linting your touched files directly (0 new warnings) before recording, and note the baseline
   shift transparently; the 0-ERRORS gate is the real bar (§9.5).**
   **The "raw `db` / not `withTenant`" tenancy family (Sessions 20/22/23) has a ROUTE-HANDLER variant where the fix is
   the MERGED PREDICATE and `withTenant` is genuinely NOT needed — the discriminator is *does the caller run in a
   request/session context?* (learned 2026-06-22, Session 34 / 17-MED).** Q-17-004 (6 course-REST handlers did
   `db.course.findUnique({where:{id}})` + droppable `course.organizationId !== organizationId`). Fix = merge the org
   filter into the lookup (`findFirst({where:{id, organizationId}})` + fail-closed `if(!organizationId) 404` guard that
   also narrows `string|null`→`string`), the Q-11-001 shape. **No `withTenant`:** a Next route handler runs the whole
   request in ONE async context, so `getCurrentUserOrg()`→`setRlsContext` (auth-helpers.ts:29) means the per-query
   extension's `getRlsContext()` returns the ctx and GUC-scopes every `db.*` op under RLS-on (db.ts:115-131); this is
   the OPPOSITE of the Session-23 Q-12-005 background-job case (no session → `resolveTenant()`→null → MUST use
   explicit-ctx `withTenant`). So the two prior rules reconcile under one discriminator: **session-scoped caller
   (route handler / server action) → merged predicate is BOTH the live boundary (RLS-off) AND RLS-ready (the extension
   handles per-op GUC); session-less caller (Inngest/boot) → explicit-ctx `withTenant` required.** `withTenant` alone
   never closes a "droppable `!==`" finding (RLS-off it adds no predicate — Q-11-001), and wrapping single/independent
   session-scoped ops in it is over-engineering (Session-20 corollary i). Use `replace_all` for the identical
   course-check blocks, but watch for a handler that interleaves a line (PATCH had `const body = await request.json();`
   between `getCurrentUserOrg()` and the check, so it needs a separate edit). **And before adding a new shared Zod
   schema/symbol, grep the repo for the name — a same-named one may exist for a DIFFERENT path with an INCOMPATIBLE
   contract** (Q-17-003: a `createCourseSchema` already lived in `actions.ts` with `.uuid()`+`gradeLevel` for the
   server-action path and would have rejected the route's `new:`-token taxonomy minting → named the route one
   `createCourseApiSchema`; the skeptic caught it).
   **The Session-34 "session-scoped route handler needs NO `withTenant`" rule holds for SINGLE/independent ops, but a
   MULTI-OP ATOMIC write MUST use `withTenant(async tx => …, undefined, {organizationId,userId})` with the un-extended
   `tx` — `db.$transaction([...])` (batch-array) on the RLS-EXTENDED client NESTS tenant transactions and breaks at the
   RLS cutover; the adversarial pass exists to catch this exact action-bias when YOU (the recommender) propose the batch
   form (learned 2026-06-22, ch.18 MED / consolidated pass).** Q-18-003: my draft used `db.$transaction([update,
   ...updateMany])`; all 3 skeptics independently refuted it. Mechanism (db.ts:113-132): when `RLS_ENABLED`, `db` is
   `base.$extends(...)` whose `$allOperations` wraps EACH model op in its OWN `base.$transaction([setConfigRaw, query])`
   (db.ts:118-127); passing those already-self-transacting promises into an OUTER `db.$transaction([...])` is exactly the
   nesting db.ts:91-97 forbids → "Transaction already closed" / a silent set_config-on-wrong-connection tenant-scoping
   failure / a pool deadlock. It is INVISIBLE today (RLS off → `db===base` → a plain batch, CI green) and **detonates only
   at the RLS cutover — the exact scenario the tenancy finding hardens**, so tests/tsc won't catch it. The ONLY RLS-correct
   multi-write pattern here is `withTenant(async tx => { await tx.X.update(...); for (…) await tx.Y.updateMany(...); }, …)`
   on the un-extended `tx` (precedents: `account-actions.ts`, `suggest-blocks.ts`, the page loader `grading/[id]/page.tsx`).
   So the full discriminator is **THREE-way: session-scoped + SINGLE op → merged predicate, no withTenant (S34); ANY caller
   + MULTI-op atomic → `withTenant(async tx=>…)` with explicit ctx (this lesson); session-LESS single op → `withTenant`
   for the GUC (S23/Q-12-005).** (Companion mechanical win: `updateMany({where:{attemptId,itemId}})` on a `@@unique`
   drops a per-item `findFirst` N+1 and the 0-row case reproduces a prior `if(row)` skip — behavior-equivalent.)
   **A "zero input validation" HIGH on a write that persists a DERIVED TOTAL (a grade, score, invoice, rollup) is fixed by
   RECOMPUTING the total SERVER-SIDE from authoritative data, NOT by bounds-only validation — bounds-only is
   UNDER-engineered because a forged total that is internally consistent with valid per-item inputs still passes (learned
   2026-06-22, ch.18 HIGH / consolidated pass).** Q-18-001: the grading POST wrote client `scorePoints`/`maxPoints`
   verbatim. The fix (adversarially chosen over bounds-only): OMIT the client totals from the Zod schema entirely (Zod
   strip-mode drops them), load the authoritative item points on the SAME tenancy `findFirst`, clamp each submitted item
   score to `[0, item.points]`, and DERIVE `scorePoints = Σ clamped`, `maxPoints = Σ item.points` server-side. Two
   right-sizing details: **(a)** fall back to the EXISTING stored per-item score for items absent from the payload
   (`submitted ?? existing ?? 0`) so a partial re-grade can't zero untouched items; **(b)** validate at the ONE
   client-reachable boundary with `safeParse`→400 (`error.flatten()`), bound the free strings, and constrain enum fields
   (`gradingMethod`) to the Prisma enum (a `z.enum([...])` kept in sync, the house pattern) so a non-enum string can't be
   written. Honest-for-the-real-UI (the client computes the same sums) but unforgeable. Shape-lock the new schema with the
   file's first test (incl. an assertion that client totals are stripped). This is the total-bearing-write face of Q-10-004
   "never make a constraint stricter than the consumer needs, but DO validate at the boundary."
   **An "unauthenticated server action / RSC page" finding is frequently OVER-GRADED — check `src/proxy.ts` (PUBLIC_ROUTES +
   matcher) BEFORE grading, because Next server actions POST to their PAGE route, which the proxy matcher COVERS (it
   excludes only `/api/*`), so a page-route action sits behind the proxy's fail-closed auth redirect just like the page
   (learned 2026-06-22, ch.20 HIGH / consolidated pass).** Q-20-001 was graded HIGH on "unauthenticated content actions +
   JP/ESV quota vector," but `proxy.ts`'s PUBLIC_ROUTES deliberately excludes the whole `/family-discipleship` subtree
   (git-verify the guard predates the doc SHA), and the data is GLOBAL non-tenant content — so for NORMAL invocation there
   is no unauthenticated surface → **REGRADE to LOW.** The only residual is the obscure attacker-crafted server-action POST
   to a PUBLIC route (e.g. `/login`), which leaks only global content + burns a 3rd-party quota. **Still add in-file `auth()`
   (defense-in-depth):** `proxy.ts` documents itself as a "backstop NOT a replacement — pages must still do their own
   getCurrentUserOrg()/ownership checks," and the NEWER sibling actions already self-gate; adding a session check to the
   older content holdouts converges them onto that posture + closes the bypass. So the disposition is **REGRADE→LOW +
   fix-and-close** (the cheap auth() makes the re-grade moot; record the over-grade). NO org filter for global content —
   just require a session. (Mirror image of the Q-19-001 spine-route gate, but here the proxy already covered it.)
   **A string-vs-object schema mismatch silently BREAKS a feature and RECURS across sibling call sites — when you find one
   (`deleteX(entry.id)` bare string vs an action that does `z.object({id}).parse`), grep the repo for the same `deleteY(z.id)`
   shape (learned 2026-06-22, ch.20 HIGH / consolidated pass).** Q-20-002: `deletePrayerEntry(entry.id)` threw a ZodError
   (caught → "failed" toast → row never deleted). The fix is to align the CALL to the object contract (`fn({ id: entry.id })`),
   the house convention (`deleteStudent({id})`/`deleteBlock({id})`), NOT to loosen the action. The same pattern broke course
   delete (`CourseList.tsx` `deleteCourse(course.id)` vs `deleteCourseSchema` object) → minted-and-resolved **Q-14-009** in
   its OWNING chapter (ch.14), born-resolved (a broken FEATURE, not a vuln → MED; the action stays fully auth-guarded). This
   is the delete-action face of the Session-18/19 "inbound/sibling trace surfaces a separate bug → mint-and-fix in the
   owning chapter."
   **A merged-predicate / RLS-readiness tenancy audit can surface a SEPARATE latent RLS-on bug: a CONTEXT_FREE
   reference table that APP CODE WRITES but whose RLS grant is SELECT-only → the write fails-CLOSED under RLS-on; mint
   it as an RLS-cutover-gate finding (learned Session 34 / 17-MED).** Q-17-010 (minted): the `new:` taxonomy minting
   does `db.{subject,strand,topic,subtopic}.create` (app routes), but migration `00000000000002:139-144` grants
   `app_user` only `FOR SELECT … USING(true)` on those reference tables ("writes only via migrations/seeds as
   superuser") — **no INSERT policy → Postgres denies any INSERT with no permitting policy** for the non-bypass role.
   So every such create 500s the moment RLS is flipped. **Two reusable checks:** (a) when auditing any "raw `db`"
   tenancy flow, also note whether a CONTEXT_FREE-model WRITE in that flow hits a SELECT-only RLS table — grep the RLS
   migration for the table's `CREATE POLICY … FOR (SELECT|ALL|INSERT)`; a SELECT-only table that app code writes is an
   RLS-cutover blocker. (b) This is **NOT caught by a GRANT-level cutover-readiness check** (Session 8's "0 GRANT gaps"
   is *row-policy-blind* — RLS needs BOTH a GRANT and a permitting policy), so it must be tracked separately and
   cross-linked to the Q-001 runbook (Workstream B). The resolution is a migration (add scoped INSERT policies) or a
   design change (privileged/org-scoped taxonomy creation) — deferred, not an app-layer session fix.
   **A HIGH "broken / dead feature" finding's disposition is BUILD vs REMOVE (vs park) — "keep exactly as-is" is
   DOMINATED when the broken surface is a LIVE, reachable, erroring entry point (not invisible scaffolding); and BUILD
   is legitimately in-scope for a resolution session when the feature is ~90% scaffolded + the only gap is ONE
   well-patterned handler AND the owner says build-now — this refines the Session-25 "feature build → defer" rule by
   the SIZE of the gap (learned 2026-06-22, Session 35 / 17-HIGH).** Q-17-001 (the activity-authoring page POSTed to a
   nonexistent route; the whole flow erred) re-verified, then a code-truth sweep proved **zero `activity.create`
   anywhere** (only the broken route + an account-cascade `deleteMany`) while the `Activity` model is richly integrated
   + the read/display side already worked → **unfinished, not superseded**. The discriminators that decided it:
   **(a) keep-as-is is dominated, not an option** — for a HIGH whose symptom is a user-facing button that always
   alerts an error, leaving it live is the worst outcome (contrast the *invisible* unfinished scaffolding of Q-09-005 /
   Q-16-001, where ⏳ keep-open + re-document is fine); the real fork is BUILD (finish it) vs REMOVE (delete the broken
   page + entry point + correct the "coming soon" copy, roadmap the feature). **(b) build-vs-defer turns on COUNTING
   what already exists** — Session 25 (Q-12-007) deferred because it needed a whole new channel + UI + a legal
   `[DECISION]` (fundamentally multi-file); here the model + form UI + read/display + the "Add Activity" entry point all
   existed and the ONLY missing piece was a single REST handler with an established sibling pattern (`blocks/route.ts`
   POST) → a *proportionate completion*, the same "data + pattern already exist → build-now" call as Q-05-010 / Q-16-005.
   So a resolution session CAN ship a feature when the owner picks BUILD over remove AND the gap is one bounded,
   well-patterned piece — present it as `OWNER_DECISION` (with a lean), don't unilaterally build. **When you do build,
   five rules held:** **(1) mirror the NEWEST hardened sibling, not an older one with gaps** — net-new code is
   secure-by-default at the *current* bar: the activities route took the Q-17-003 parent-gate (→403) + the Q-17-004
   merged-predicate org check + `safeParse`→400, even though the older `blocks/route.ts` POST lacks the parent gate
   (a pre-existing gap, flagged for owner awareness, NOT replicated). **(2) trace the create→display loop END-TO-END
   before claiming "works"** — confirm the read side renders the new row (here the block GET already `include`d
   `activities`), not just that the POST returns 200. **(3) net-new WRITE route RLS-readiness = caller-context +
   policy-CLASS check:** a session-scoped route handler needs **no `withTenant`** (the per-query extension GUC-scopes
   each op via `getCurrentUserOrg`→`setRlsContext`; Q-17-004), and the target table must have a *permitting INSERT
   policy* — join-scoped ORG tables (activities/activity_objectives) do, SELECT-only reference tables do NOT (the
   Q-17-010 trap); here the client's dropping of `new:` custom objectives meant the route only LINKS an existing global
   Objective, sidestepping Objective-minting entirely. **(4) completing a feature makes its "(coming soon)" / placeholder
   copy + any abandoned dev-comments FALSE → correct them in the same session** (code-is-truth, consequential currency,
   not new findings). **(5) the cross-chapter orphan-tail is REMOVE-only** — the broken page was the sole live caller of
   a *different chapter's* open finding (ch.19 Q-19-002, `getSubtopicObjectives` auth gate); under BUILD the page stays
   and that sibling is **unaffected** (confirm the page is unchanged at the sibling's cited line), but had the owner
   chosen REMOVE the deletion would have orphaned it → a ch.19 update. State which disposition the tail is contingent on.
3. **Owner decisions (partition).** Present recommendations bucketed: `FIX_NOW` / `BATCH_CLEANUP` /
   `LEAVE_AS_IS` (split: *correct-by-design* vs *not-worth-churn*) / `OWNER_DECISION` / `RE-GRADE` /
   `DISMISS`. **Derive the buckets mechanically from the structured recs and apply the §4 partition &
   reconcile check** (every finding in exactly one bucket; counts sum; cross-artifact counts match).
   Use `AskUserQuestion` only for genuine forks; otherwise present and let the owner reply. Owner
   instruction: **remove** correct-by-design findings; **explain** not-worth-churn ones for the owner
   to decide; never silently drop one.
   **If the owner's decision reply reveals they misread the finding's scope, STOP — re-explain the precise
   scope (with the disambiguation) and re-ask; never execute a decision made under a misapprehension (learned
   2026-06-19, Session 6 / 04-LOW).** A "remove the dead Supabase JS clients" recommendation was read as "stop
   using Supabase," because *Supabase* names two unrelated things here — the **live Postgres DB** (reached ONLY
   via Prisma/`DATABASE_URL`) and the **dead `@supabase/supabase-js` JS SDK** (the removed wrappers). Any term
   that denotes both a live system and a dead wrapper invites this; lead the re-ask with the disambiguation, then
   proceed only on the corrected decision.
4. **Execute** the owner-approved changes. Edit by hand for control; fan out with Workflow only for
   large, well-bounded, parallelizable edits (and verify hard after — agents can't catch visual/behavior
   regressions). For files an automation already touched this session, **Read before Edit** (freshness).
5. **Verify (CI gates).** `npx tsc --noEmit` (0 errors), `npm run lint` (0 errors; warnings OK),
   `npm test` (all pass). Confirm `prisma/migrations/` is **UNCHANGED** (no schema/migration change without
   approval); an owner-approved `prisma/seed*.ts` edit is allowed but must **never be run** against the seeded
   DB this session. Confirm `git status` (scoped to your touched paths — the tree is noisy) shows only intended
   files. **Excluded-file gotcha (learned Session 4):** `prisma/seed*.ts` is excluded from `tsc`
   (`tsconfig.json:40`) AND from `npm run lint` (next-lint skips `prisma/`), so edits there pass the green
   gates *unchecked* — run `npx eslint <changed seed file>` directly and hand-review carefully.
   **Deleting a ROUTE file (`git rm src/app/**/route.ts`) makes `tsc` fail with `TS2307: Cannot find module
   '…/route.js'` — a STALE `.next/types` generated route-type, NOT a code error (learned 2026-06-21, Session 28 /
   14-MED).** Next generates `.next/types/app/<route>/route.ts` + a route list in `.next/types/validator.ts` and
   `.next/dev/types/validator.ts`, and `tsconfig` includes `.next/types/**`, so tsc typechecks them; after you delete a
   route those generated files still `import` the now-gone source → TS2307 (the baseline was green only because they
   matched the then-present routes). Fix: **`rm -rf .next/types .next/dev/types && npx tsc --noEmit`** — they regenerate
   on the next `next dev`/`build` and are gitignored, so it's safe (the SAME class as the stale-vite-cache wipe below,
   not a regression in your change). This recurs for **every** session that deletes a dead route — e.g. the very next
   Q-14-001 (`GET /api/library/search`).
   **Vitest "all 12 files fail to collect / `Cannot read properties of undefined (reading 'config')` / `Tests:
   no tests` " is a STALE VITE CACHE, not real flakiness (learned 2026-06-19, Session 8).** The owner knows it
   as "vitest randomly fails then works again"; the deterministic fix is to wipe the regenerable cache —
   `rm -rf node_modules/.vite node_modules/.vitest && npm test` → back to **58/58**. It is safe (cache only; no
   code/deps/DB), so do it instead of re-running blindly 3× — but it's an *environment* artifact, never a signal
   your doc/code change broke tests (a docs-only session cannot break vitest collection). Likely triggered by the
   noisy working tree's `M package.json`/`package-lock.json` drift; clearing the cache sidesteps it.
   **Two gotchas when you ADD a new server-side module or RSC this session (learned 2026-06-19, Session 10):**
   (a) **A new module with `import "server-only"` breaks any *sibling* test suite that transitively imports it but
   doesn't mock server-only.** `server-only` is NOT a top-level package here, so every test touching a server-only
   module must declare `vi.mock("server-only", () => ({}))` (see `active-profile.test.ts`). When you extract shared
   logic into a new server-only helper (e.g. `pin-verify.ts`) and refactor existing actions to call it, the actions'
   *existing* suites now load the helper → add the mock to each, or `npm test` fails at import with "Cannot find
   package 'server-only'" (NOT a logic regression). (b) **`Date.now()` / `Math.random()` / any impure call in a
   Server Component render body is a lint ERROR** (`react-hooks` "Cannot call impure function during render"), which
   trips the 0-errors gate even though `tsc` passes. Move the impure call into a non-component (camelCase) helper the
   component awaits — `eslint .` is the only gate that catches it, so run lint, don't trust tsc + tests alone.
6. **Update ALL affected docs to current** (the next session's source of truth):
   - chapter §7 finding entries → mark `✅ RESOLVED` / `✅ REMOVED` (delete the entry) / `⏳ DEFERRED` /
     `🔻 re-graded` / `✅ ACCEPTED`, each with a one-line note + `(see CHANGELOG.md)`; keep original
     evidence for history.
   - chapter §5 status table rows if a unit's status changed (e.g. DEAD → REMOVED).
   - `24-status-roadmap-findings.md` register + tallies (counts, the dated disposition note).
   - append a dated section to `CHANGELOG.md` (per-finding: what changed, files, owner follow-ups,
     deferred items). Re-stamp a chapter's commit SHA if it was substantively edited.
   - **Update every chapter a change touched, not just the target chapter** — if the fix closed a
     sibling finding in another doc (step 1), mark *that* doc's §7/§5/§1 too and count the sibling in
     the closed-this-session tally.
   - **Re-run the §4 partition check against the updated docs** (every finding accounted exactly once;
     counts reconcile across §7 / ch.24 / CHANGELOG, **including** any out-of-target-chapter sibling).
7. **Handoff.** Update the `findings-resolution-progress` memory: mark this session done, set the next
   target, record any owner follow-ups / new findings raised / deferred items. List remaining sessions.
8. **Update the skill if you learned something** that future sessions need (a new gotcha, a process
   fix, a recurring pattern). Edit this SKILL.md **before the session ends** and state what you added
   and why it helps — that is a standing requirement, not optional.
9. **Advance (pass-mode) or emit the next-cell prompt (one-cell mode).**
   - **Consolidated pass (active):** do NOT emit a prompt or stop — **advance to the next OPEN cell** in
     the strict order (ch.18 LOW→MED→HIGH → ch.19 … → ch.23 → ch.24, + the ch.13 straggler) and repeat
     steps 1-8. Skip empty cells (confirm against the doc's §7). Only when the whole backlog is clear (or
     the owner pauses) do you emit the **pass-completion report** (every cell's disposition + final
     tallies + the remaining ⏳-deferred set), NOT a next-cell prompt.
   - **One-cell mode (history / one-offs):** emit ONLY the next cell's prompt — never name or pre-compute
     the cell after it. Choose the next `(doc, grade)` by advancing **LOW→MED→HIGH then doc-ascending
     (01→24), skipping any cell with zero OPEN findings** (confirm against the candidate doc's §7). Emit
     the per-cell template below **verbatim**, changing ONLY the bracketed slots — no findings lists / no
     extra clauses (lessons live in this skill body, **never** in the prompt, which keeps it from drifting).

**Canonical consolidated-pass prompt (ACTIVE — clears ch.18→24 in one pass):** a thin, constant trigger;
nothing changes between runs (the pass resumes from the progress memory):

```
Consolidated final pass — resolve ALL remaining OPEN findings (LOW, MED, HIGH) across the remaining
chapters in docs/codebase-map/, sequentially: ch.18 LOW→MED→HIGH, then ch.19, 20, 21, 22, 23 the same
way, then ch.24's own findings.

First, invoke the quillnext-mastery skill and read the findings-resolution-progress memory, then follow
SKILL.md §9 "Consolidated final-pass mode" exactly. For EACH (chapter × grade) cell, in that strict
order: re-verify each finding at its cited file:line → recommend (adversarial) → proceed on clear-cut
dispositions, ask me only on genuine forks (build-vs-remove, behavioral, destructive, product/legal
decisions) → execute → verify (tsc/lint/tests green, prisma/ untouched) → update ALL /codebase-map docs
current + run the §4 partition/reconcile check → log a CHANGELOG round. Update the progress memory after
each chapter so the pass is resumable, and keep advancing cell-to-cell without stopping. No
schema/migration changes (keep those deferred). Nothing pushed. When the whole backlog is clear, emit a
completion report — not a next prompt.
```

**Per-cell prompt template (one-off / the form used for ch.01-17)** — thin trigger; `<N>`, `<GRADE>`
(×2), `<DOC>` (×2) are the only things that change:

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
  migration; owner-approved `prisma/seed*.ts` edits are OK but never *run* against the seeded DB) · **all
  `/codebase-map` docs current and partition-reconciled** · progress memory updated. Nothing pushed.
- **One-cell mode** additionally emits the next-cell prompt and ends. **Consolidated pass** instead
  **advances to the next OPEN cell** and only at the very end (backlog clear or owner pause) does a final
  full §4 reconcile + a completion report. Skill updated if anything was learned (either mode).
