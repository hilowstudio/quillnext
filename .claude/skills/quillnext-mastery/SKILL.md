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
4. **Never push, never deploy.** `main` auto-deploys to Vercel production. Do not commit or push
   unless the owner explicitly asks. Writes are limited to `docs/codebase-map/`,
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
- **Three data/identity stacks coexist:** Prisma/NextAuth (primary), Supabase JS client, Firebase
  Admin. Document what each is *actually* used for (storage? push? auth?) — some are likely partial/legacy.
- **Global vs org-scoped extraction dedup:** the first org to extract a book/video populates the
  global `BookExtraction`/`VideoExtraction`; other orgs link for free. `vector.ts` does pgvector
  RAG over the global chunk tables.
- **Auth edge/node split:** `auth.config.ts` (edge-safe) vs `auth.ts` (node + Prisma adapter, PKCE
  cookie handling). Security-relevant and subtle.
- **Test skew:** ~10 of 12 test files are the profiles subsystem; AI/grading/courses/library/tenancy
  are effectively untested — that absence is itself a finding (ch. 24 test map).
- **`Unsupported("vector")`** columns: pgvector ops happen via raw SQL (`lib/utils/vector.ts`,
  Inngest workers), not the Prisma client.
- **`next/image` is barely used; `images.remotePatterns` governs nothing at runtime.** Only **3** `<Image>`
  usages exist, all local `/assets/branding/*` (`Sidebar.tsx:67`, `MainNav.tsx:49`, `InklingToolkit.tsx:46`).
  Every *remote* image (Google-OAuth + DiceBear avatars, YouTube/Books/OpenLibrary thumbnails, scraped
  article og:images) renders via plain `<img>` / Radix `AvatarImage`, which **bypass the optimizer**.
  `remotePatterns` is `[]` to close the `/_next/image` open proxy (Q-01-002, resolved 2026-06-19) — do not
  assume an image-host config change affects app rendering.

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
- [ ] `git status` shows only `docs/codebase-map/`, `.claude/skills/quillnext-mastery/`, memory dir.
- [ ] `00-INDEX.md` names all chapters + the findings register; every named file exists.

---

## 9. Findings-resolution sessions (per document × grade)

After the mastery pass, findings are worked off in **sessions, one per (chapter document × severity
grade)** — e.g. "Session: `01-platform-build-config.md` — LOW". The owner runs them grade-ascending
within each doc (**LOW → MED → HIGH**), doc-ascending (01 → 24). The owner pastes a prompt to start
each session; **you end each session by leaving every `/codebase-map` doc current and emitting the
next session's prompt** (the next session trusts those docs as truth). This is the proven loop from
the 44-INFO pass — follow it exactly.

**NOTE — this is the one place the "document, don't fix" rule is lifted:** resolution sessions DO
change code, but only for findings the owner approves this session. All other hard rules still hold
(§1): DB read-only / protect seeded data, **never push**, no schema/migration changes without explicit
owner approval (batch migrations and defer), keep the CI gates green.

### Per-session steps
0. **Load this skill** and read the `findings-resolution-progress` memory to get the session target
   `(doc, grade)` + queue position. Work in-skill.
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
3. **Owner decisions (partition).** Present recommendations bucketed: `FIX_NOW` / `BATCH_CLEANUP` /
   `LEAVE_AS_IS` (split: *correct-by-design* vs *not-worth-churn*) / `OWNER_DECISION` / `RE-GRADE` /
   `DISMISS`. **Derive the buckets mechanically from the structured recs and apply the §4 partition &
   reconcile check** (every finding in exactly one bucket; counts sum; cross-artifact counts match).
   Use `AskUserQuestion` only for genuine forks; otherwise present and let the owner reply. Owner
   instruction: **remove** correct-by-design findings; **explain** not-worth-churn ones for the owner
   to decide; never silently drop one.
4. **Execute** the owner-approved changes. Edit by hand for control; fan out with Workflow only for
   large, well-bounded, parallelizable edits (and verify hard after — agents can't catch visual/behavior
   regressions). For files an automation already touched this session, **Read before Edit** (freshness).
5. **Verify (CI gates).** `npx tsc --noEmit` (0 errors), `npm run lint` (0 errors; warnings OK),
   `npm test` (all pass). Confirm `prisma/` is **UNCHANGED** (unless an approved migration). Confirm
   `git status` shows only intended files.
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
9. **Emit the next-session prompt — and ONLY the next session's prompt.** Never name or pre-compute the
   session after it (e.g. don't write "Session 3" or its target into the Session 2 prompt) — picking
   *that* target is the next session's job, done against the then-current docs. Choose the next
   `(doc, grade)` by advancing **grade-ascending within a doc (LOW→MED→HIGH), then doc-ascending
   (01→24), skipping any cell with zero OPEN findings** (confirm emptiness against the candidate doc's
   §7, not just the rough queue hint). Emit the canonical template below **verbatim**, changing ONLY the
   bracketed slots — add nothing else (no findings lists, no extra process clauses; lessons learned go
   in this skill body, **never** in the prompt — that is what keeps the prompt from drifting over dozens
   of runs).

**Canonical next-session prompt template** — the prompt is a thin, constant trigger; `<N>`, `<GRADE>`
(appears twice), and `<DOC>` (appears twice) are the only things that change:

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

### Session invariants (every session)
- Ends with: CI gates green · `prisma/` untouched (or an approved, documented migration) · **all
  `/codebase-map` docs current and partition-reconciled** · memory handoff written · next-session
  prompt emitted · skill updated if anything was learned. Nothing pushed.
