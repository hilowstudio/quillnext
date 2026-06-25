# Codebase-Map Changelog & Cleanup Checklist

A running log of findings-driven changes, kept in lockstep with the chapter docs. Each entry: the
finding id, what changed, and any follow-up the owner must do (env/infra).

Legend: ✅ done · ◑ partial · ⏳ deferred · 👤 owner action required

---

## Session 2026-06-19 — INFO findings triage (owner-approved)

Source: the 44 INFO findings (`24-status-roadmap-findings.md §7`). Owner approved the 6 OWNER_DECISION
calls + all BATCH_CLEANUP. **Code changed (not just documented)** and verified: `tsc --noEmit` **0
errors**, `eslint` **0 errors** (691 pre-existing warnings), `vitest` **58/58 tests pass**. Chapter
§7 sections updated to match. **Nothing pushed — owner deploys.**

### 👤 Owner follow-up required (before deploy)
- **Q-13-004 env migration:** in Vercel set a server-only **`GOOGLE_BOOKS_API_KEY`** (and optionally
  **`YOUTUBE_API_KEY`**) to the value currently in `NEXT_PUBLIC_GOOGLE_BOOKS_API_KEY`; restrict the key
  by HTTP-referrer/API in GCP; then **delete `NEXT_PUBLIC_GOOGLE_BOOKS_API_KEY`**. The code no longer
  reads the `NEXT_PUBLIC_` var, so book/video lookups will fail at runtime if the server-only var
  isn't set when this ships.

### Owner decisions
- ✅ **Q-13-004** Removed the `NEXT_PUBLIC_GOOGLE_BOOKS_API_KEY` fallback at all 3 sites — now
  server-only (`YOUTUBE_API_KEY ?? GOOGLE_BOOKS_API_KEY`). Files: `src/lib/api/youtube.ts`,
  `src/app/actions/youtube-actions.ts`, `src/app/actions/library-lookup-actions.ts`. (See 👤 above.)
- ✅ **Q-22-007** Removed `socialSecurityNumber` from the transcript data contract + render/PDF.
  Files: `src/components/transcript/types.ts`, `TranscriptPreview.tsx`, `pdfExport.ts`.
- ✅ **Q-01-007** Dropped `account` from `.mcp.json` features (least-privilege).
- ✅ **Q-08-006** Dropped the unused `@ai-sdk/openai` dependency (`npm uninstall`; package.json −1,
  lock −17). No source imported it; quillnext is Gemini-only.
- ✅ **Q-11-007** Chat safety-scan enqueue wrapped in its own try/catch — a failed enqueue now logs
  loudly but still streams a reply (no 500, no silent drop). File: `src/app/api/chat/route.ts`.
- ⏳ **Q-23-003** Deferred (owner choice): `DocumentResource.extractionStatus` enum → batched migration.
  See "Deferred migrations" below; no code change now.

### Batch cleanup
- ✅ **Q-06-006** Error boundary shows a static message + `error.digest` (no raw `error.message`). `src/app/error.tsx`
- ✅ **Q-07-006** Deleted dead `CommandShortcut` (`command.tsx`) + `PopoverAnchor` (`popover.tsx`).
- ✅ **Q-07-007** Removed scaffolding comment (`radio-group.tsx`); moved `"use client"` to line 1 (`switch.tsx`, `progress.tsx`).
- ✅ **Q-07-008** Deleted duplicate `RadixSlot` import (`form.tsx`).
- ✅ **Q-08-007** Corrected `config.ts` comments (`Gemini 3 Pro` → `gemini-2.5-pro`) + reconciled the flash-downgrade header.
- ✅ **Q-09-007** Renamed the student-scoped `ContextCompleteness` → `PersonalizationContextCard` (file + symbol; importer updated). Collision gone.
- ✅ **Q-10-009** `getSourceMetadata` returns `{success:false}` on a missing row. `src/app/actions/generator-actions.ts`
- ✅ **Q-11-006** Chat route → `toUIMessageStreamResponse()`; `ThinklingChat` → `sendMessage({text}, {body})`; all `@ts-ignore`/`as any` removed.
- ✅ **Q-13-003** `chunkTranscript` now re-exports `chunkText` (single implementation).
- ✅ **Q-13-006** Removed unused `Book` import (`google-books.ts`).
- ◑ **Q-14-010** Typed the dynamic-delete switch in `resource-library-actions.ts` (removed both
  `@ts-ignore` + `withTenant<any>`; runtime org check preserved). **Deferred:** the broad list-prop
  `any[]→typed` sweep across the 7 list components + `LibraryClient` (pure presentation type-hygiene).
- ✅ **Q-15-006** Deleted stale JSDoc example + unused `CacheTTL` (`prisma-cache.ts`).
- ✅ **Q-15-007** `searchBooks` caps the embed query to 1000 chars (returns `[]` on empty). `vector.ts`
- ✅ **Q-17-008** Dropped dead `organizationId/userId` params from all 3 blueprint step actions +
  removed the `/api/auth/user-org` fetches in their callers (route kept). `blueprint.ts` + 3 onboarding steps.
- ✅ **Q-17-009** Removed `as any` in `assignments.ts` (consistent scalar `resourceAssignment.create`).
- ✅ **Q-20-009** Self-hosted the Missions map data: committed `public/world.geojson`; `WorldMap.tsx` fetches `/world.geojson`.
- ✅ **Q-21-007** Verified — all `revalidateTag` sites already pass the required 2nd arg `{}`; no change needed (the single-arg cases were Q-23-007).
- ✅ **Q-21-008** Dropped the unused `classroomId` parameter from `isSchoolDay` + its call site. `scheduling.ts`
- ✅ **Q-23-007** Added the required `, {}` to the 3 worker `revalidateTag` calls; removed the `@ts-ignore` lines. `extract-book.ts`, `extract-video.ts`, `process-document.ts`
- ✅ **Q-23-008** Removed the dead `fileUrl.startsWith('http')` branch + `REFACTOR` comments in `process-document` download.

### Findings removed as correct-by-design / clarification (per owner instruction)
Removed from the register (intentional behavior or clarifications, not defects); underlying facts kept in-chapter:
- ✅ **Q-05-007** the profile org-match IS the intended app-layer tenant gate.
- ✅ **Q-14-009** the book-detail GET-render self-heal is idempotent, tenant-scoped, never-prerendered.
- ✅ **Q-16-006** "two variants" are wrapper+impl, not rival dead duplicates.
- ✅ **Q-19-005** resolves Q-012: spine keys on `id`; the `uuid` column is a seed-written provenance key (kept).
- ✅ **Q-21-006** scheduler intentionally uses DB `ClassroomHoliday` rows; the US-federal helper is onboarding-only.

### Left OPEN for owner to decide (LEAVE_AS_IS — "not worth the churn"; see report)
Q-01-006, Q-03-006, Q-03-007, Q-05-008, Q-06-005, Q-07-004, Q-07-005, Q-08-008, Q-09-008, Q-10-008,
Q-13-005, Q-13-008, Q-20-010. (13 findings — unchanged in the docs, awaiting owner call.)

### Deferred migrations (batch later, on the seeded DB, with care)
- ⏳ **Q-23-003** (now tracked at **LOW**) add `DocumentResource.extractionStatus` enum
  (NOT_EXTRACTED/EXTRACTING/EXTRACTED/FAILED) + set it in `process-document` so failed doc extraction
  is distinguishable from pending.

## Session 2026-06-19 (round 2) — owner decisions on the remaining open INFO findings

Owner triaged the previously-open LEAVE_AS_IS items. Verified: `tsc` 0 errors, `eslint` 0 errors,
`vitest` 58/58. Nothing pushed.

### Resolved (code)
- ✅ **Q-07-005** Converged ALL 16 `forwardRef` UI primitives → the `data-slot` function-component
  pattern (React 19); removed the stray `Calendar.displayName`. **Zero `forwardRef` remains** —
  single generation. 22/25 ui files now carry `data-slot` (badge/calendar/combobox are already
  plain functions, just without the cosmetic `data-slot` attr — optional future polish).
- ✅ **Q-09-008** Added `Array.isArray` defensive guards in `context-serializer.ts` for
  `environment.goals/challenges`. (The write path in `blueprint.ts` already Zod-validates, so this
  only hardens legacy/hand-edited rows.)
- ✅ **Q-10-008** Tidied `handleCompile` — removed the unreachable `if (result.success)` branch.
- ✅ **Q-13-008** Added title guards to the Google Books + OpenLibrary adapters.

### Removed (owner: not defects / not worth tracking)
- ✅ **Q-01-006** (tests later), **Q-03-006** (standards JSON never external), **Q-03-007** (cosmetic),
  **Q-07-004** (full a11y pass deferred; UI not final).

### Re-graded / accepted / deferred / investigated
- 🔻 **Q-13-005** re-graded **INFO → LOW** (kept as a reminder to add a warn-log + harden the
  LibreTexts deki-token scrape later).
- ✅ **Q-05-008** ACCEPTED / won't-fix (owner: 30s same-org lockout is negligible).
- ⏳ **Q-08-008** DEFERRED — add a tagged-warn/metric on the generation verify/revise fail-open path
  once observability exists.
- ✅ **Q-06-005** RESOLVED — owner chose to **delete** `CommandPalette.tsx` (a dead ⌘K palette from the
  superseded shell generation); its stray icon imports go with it. This partially addresses **Q-06-001**
  (the broader dead 2nd-gen nav surface) — `MainNav`/`UserNav`/`SidebarClientIslands` were deleted in Session 11
  (Q-06-003/004, round 14) and `CreationDrawer`/`ContextNav` in Session 12 (Q-06-001, round 15), closing Q-06-001.

### New finding
- 🆕 **Q-05-010** [MED] **No in-app recovery for a forgotten PARENT PIN** — owner lockout risk
  (raised from the Q-05-008 question). Recommend an email-verified reset. Owner to decide.

### Still open
- None. (Q-20-010 was re-graded INFO→LOW on 2026-06-19 — see round 3; cache only if the file grows.)

## Session 2026-06-19 (round 3) — re-grades
- 🔻 **Q-20-010** and **Q-23-003** re-graded **INFO → LOW** (owner). Q-23-003 remains a deferred
  migration (now tracked at LOW). Docs-only — no code change.

### Final disposition of the 44 INFO findings
28 ✅ resolved (code, incl. Q-06-005 — CommandPalette deleted) · 9 ✅ removed (by-design/owner) · 1 ⏳
deferred (Q-08-008 observability) · 1 ◑ partial (Q-14-010) · 1 ✅ verified-no-change (Q-21-007) · 3 🔻
re-graded→LOW (Q-13-005, Q-20-010, Q-23-003) · 1 ✅ accepted/won't-fix (Q-05-008) · 0 open. Plus 1 new
MED (Q-05-010). LOW tier now 74.

## Session 2026-06-19 (round 4) — Session 1: ch.01 LOW findings (owner-approved)

First per-(doc × grade) resolution session (SKILL §9): **`01-platform-build-config.md` — LOW**. Re-verified
each finding at its cited `file:line` before acting. Verified after: `tsc --noEmit` **0 errors**,
`eslint .` **0 errors** (687 pre-existing warnings, was 688), `vitest` **58/58 pass**, `prisma/`
**untouched**. **Nothing pushed — owner deploys.**

### Resolved / removed (code)
- ✅ **Q-01-003** REMOVED — `git rm prisma.config.ts.bak`. The tracked backup had drifted from the live
  `prisma.config.ts` (old `engineType:"binary"` + explicit `provider`; missing the live `migrations`/seed
  block) and had zero consumers (`.bak` → outside tsc/eslint). File: `prisma.config.ts.bak` (deleted).
- ✅ **Q-01-005** RESOLVED — deleted both stray DB-debug scripts and removed their tsconfig excludes:
  `git rm verify-seed.ts` (tracked, broken under Prisma 7 — `new PrismaClient()` no adapter, unwired) and
  `rm debug-connect.ts` (gitignored local scratch — owner chose to delete the local copy too). Removed the
  `"debug-connect.ts"` + `"verify-seed.ts"` lines from `tsconfig.json` `exclude`. Files: `verify-seed.ts`
  (deleted), `debug-connect.ts` (deleted, untracked), `tsconfig.json`.
- ✅ **Q-03-002** REMOVED (consequential) — the same `verify-seed.ts` deletion closes ch.03's finding;
  ch.03 §1/§5/§7 updated to drop the file.

### Reviewed → kept OPEN (owner)
- **Q-01-004** [LOW] lint downgrades — owner chose **keep open**. Evidence gathered this session:
  `eslint .` = **687 warnings / 0 errors**; the 9 downgraded rules back real, pervasive debt
  (no-explicit-any 289, no-unescaped-entities 58, error-boundaries 17; small tail: prefer-const 7,
  no-empty-object-type 3, no-require-imports 2). It is a deliberate, commented lint-adoption ratchet with a
  working guardrail (new violations of *enforced* rules still fail CI) — not a defect. No code change.
  (Owner declined the optional "ratchet the small rules to error now" path as scope creep.)

### Notes
- `.gitignore:42` (`debug-connect.ts` ignore pattern) left in place — it is a forward-looking ignore rule,
  not a tracked-file reference; harmless now that the file is gone, and keeps any future scratch ignored.
- **Register tally:** LOW 74 total → **71 still open** (closed 3: Q-01-003, Q-01-005, Q-03-002; Q-01-004
  kept open). Reconciles with ch.24 §7 and the chapter §7 entries.

## Session 2026-06-19 (round 5) — Session 2: ch.01 MED findings (owner-approved)

Second resolution session (SKILL §9): **`01-platform-build-config.md` — MED**. Re-verified each finding at
its cited `file:line`. A multi-modal Workflow sweep (4 parallel readers → adversarial verifier, then
hand-verified) enumerated every remote image host before recommending. Verified after: `tsc --noEmit`
**0 errors**, `eslint .` **0 errors** (687 warnings, unchanged), `vitest` **58/58 pass**, `prisma/`
**untouched**. **Nothing pushed — owner deploys.**

### Resolved (owner-approved)
- ✅ **Q-01-001** RESOLVED — owner chose "fresh README + `.env.example`; drop QSF".
  - Rewrote `README.md` accurate to the code: webpack production build (not Turbopack), lucide icons
    (shadcn), no churning Gemini model names, points to `design.md` + `docs/codebase-map/`; dropped the
    nonexistent `quill-standards/` dir and the `.cursor/CURSOR_RULES.mdc` (wrong-ext + deleted) references.
  - Added `.env.example` from the verified ch.01 §6 env-key list (placeholders only, no secrets). Confirmed
    trackable — `.gitignore` ignores `.env`/`.env*.local` but not `.env.example`. Fixes the README's
    previously-broken `cp .env.example .env` step.
  - Confirmed the two stale QSF docs stay REMOVED: `QSF-REMEDIATION-PLAN.md`, `qsf-scorecard-quillnext.md`
    (2026-03-30 audit artifacts; the privacy remediation already shipped at `src/app/privacy/page.tsx`;
    re-runnable via the `qsf-audit` skill). Files: `README.md` (rewritten), `.env.example` (new),
    `QSF-REMEDIATION-PLAN.md` + `qsf-scorecard-quillnext.md` (deleted).
- ✅ **Q-01-002** RESOLVED — set `images.remotePatterns: []` in `next.config.js` (with an explanatory
  comment). The sweep (and a hand grep) confirmed the only `next/image` `<Image>` usages are **3 local**
  `/assets/branding/*` (`Sidebar.tsx:67`, `MainNav.tsx:49`, `InklingToolkit.tsx:46`) — **zero remote hosts
  through the optimizer**. *(Update 2026-06-19 round 14: `MainNav.tsx` was deleted as dead code (Q-06-003), so
  there are now **2** such usages — `Sidebar.tsx:67`, `InklingToolkit.tsx:46`; still zero remote hosts.)* Every remote image (Google-OAuth + DiceBear avatars, YouTube `i.ytimg.com` /
  Google-Books / OpenLibrary thumbnails, `placehold.co` fallbacks, scraped article og:images) renders via
  plain `<img>` / Radix `AvatarImage`, which **bypass `remotePatterns`**. So the empty allowlist closes the
  `/_next/image` open-proxy/SSRF surface with **zero functional impact**. File: `next.config.js`.
  - *Adversarial override:* the Workflow verifier recommended *keep `**`* ("harmless, unused") and flagged
    `Article.imageUrl` (arbitrary scraped host) as a narrowing risk. Both overridden — keeping `**` leaves the
    open proxy (the finding's actual impact), and `Article.imageUrl` renders via `<img>`, so it is never
    subject to `remotePatterns`. Owner confirmed the posture: do **not** route 3rd-party images through the
    optimizer; if an app-owned storage image is later migrated to `<Image>`, add that one host then.

### Register reconcile (ch.24)
- Found a pre-existing MED-tally inconsistency: §7 top line read **35**, the "MED" section header read **36**,
  but the by-theme list enumerated **37** distinct ids (Q-24-001 and Q-05-010 were added without bumping the
  counts). True open MED was **37**; this session resolved 2 → **35 open**. Set all three spots to 35 and
  added a dated reconcile note in ch.24 §7.

### Notes
- The repo still carries both `@phosphor-icons/react` and `lucide-react` as deps; the new README states
  lucide (the shadcn/`components.json` default) without claiming Phosphor is unused — accurate and low-risk.
- No sibling findings in other chapters (grepped `/codebase-map` for README/QSF/`remotePatterns`/`next.config`
  — only ch.01 + the ch.24 register reference these).
- **Register tally:** MED **37 → 35 open** (closed Q-01-001, Q-01-002). LOW unchanged (71 open). Reconciles
  across ch.01 §7, ch.24 §7, and this log.

## Session 2026-06-19 (round 6) — Session 3: ch.02 LOW findings (owner-approved)

Third resolution session (SKILL §9): **`02-data-model.md` — LOW**. The two OPEN LOW findings (Q-011, Q-013)
were re-verified at their cited `file:line` against current code — **both reproduce exactly** (no drift
since `b585c1e`). Both are **schema-only** and fixable only via a migration, which §9 forbids without an
approved migration, so the owner deferred both into the batched migration. **No code changed this session.**
Verified anyway (baseline confirmation): `tsc --noEmit` **0 errors**, `eslint .` **0 errors** (687 warnings,
unchanged), `vitest` **58/58 pass**, `prisma/` **untouched**. **Nothing pushed — owner deploys.**

### Deferred (owner choice — both into the batched migration)
- ⏳ **Q-011** org-FK column naming: `organization_id` on `transcripts` (schema.prisma:128) +
  `curriculum_specs` (:1004) vs `account_id` everywhere else. Re-verified: the Prisma/TS layer is already
  uniform (`organizationId`); the drift is DB-column-only. A grep of src/ found only `vector.ts` +
  `api/library/videos/route.ts` referencing these raw columns, both on `account_id` tables — so the rename's
  blast radius is the migration + the RLS-policy SQL (ch.03 §3, lines 53-54), not app code. Fix = a
  column-rename migration → bundled into the batch. Stays tracked-OPEN.
- ⏳ **Q-013** stringly-typed status/category fields (SafetyFlag.severity:323/category:324/resolution:329,
  BookExtraction.stage:703/fullTextStatus:713/sectionsStatus:721/confidence:709, VideoExtraction.stage:929,
  TextbookDocument.status:763, CurriculumBundle.status:1026, PrayerJournalEntry.status:1487/type:1485).
  Impact confirmed real: `CurriculumBundle.status` is written as bare string literals with no shared
  union/enum (`compile-curriculum-action.ts:38,78`, `compile-curriculum.ts:61,420,421`); ditto
  `PrayerJournalEntry.status:'ongoing'` (`prayer-journal.ts:97`). Fix = an enum migration (CREATE TYPE +
  column conversion + backfill) → bundled into the batch. The `SafetyFlag.severity`/`category` subset's
  safety-downgrade hazard is separately tracked at **MED as Q-12-003 (ch.12)** and stays OPEN regardless.
  Owner chose to defer the whole finding (declined the app-layer-TS-union half-measure as churn for a LOW).

### Deferred migrations — running batch (update)
The single batched migration (run later, on the seeded DB, with care) now covers **three** findings:
- ⏳ **Q-23-003** (ch.23) — add `DocumentResource.extractionStatus` enum + set it in `process-document`.
- ⏳ **Q-011** (ch.02) — rename `transcripts.organization_id` + `curriculum_specs.organization_id` →
  `account_id`; update the RLS policies in the same migration to match.
- ⏳ **Q-013** (ch.02) — convert the closed-set stringly-typed fields to enums (the volatile AI-pipeline
  `stage`/`fullTextStatus`/`sectionsStatus`/`confidence` fields can stay String-by-design if the owner
  prefers velocity; the state-machine fields — CurriculumBundle/PrayerJournal status, SafetyFlag
  severity/category — are the high-value ones to enumerate).

### Notes
- Re-verification dismissed nothing — both findings still hold. No new findings raised; no re-grades.
- Cross-doc updates: ch.02 §7 (both → ⏳ DEFERRED), ch.24 (foundational list marks + Session-3 disposition
  note), ch.23 (Q-23-003 batch cross-ref), ch.12 (Q-12-003 ↔ Q-013 cross-ref). Partition reconciles: the 2
  in-scope findings are both DEFERRED, 0 FIX_NOW / 0 DISMISS / 0 REMOVE.
- **Register tally:** LOW **unchanged at 71 open** (deferred ≠ closed — matches the Q-23-003 precedent of a
  tracked-open deferred migration). Reconciles across ch.02 §7, ch.24 §7, and this log.

## Session 2026-06-19 (round 7) — Session 4: ch.03 LOW findings (owner-approved)

Fourth resolution session (SKILL §9): **`03-migrations-seeds.md` — LOW**. The two OPEN LOW findings (Q-03-004,
Q-03-005) were re-verified at their cited `file:line` against current code — **both reproduce exactly**. Both
are **seed-script** fixes (not schema/migration), so they were executed in code this session. Verified after:
`tsc --noEmit` **0 errors**, `npm run lint` **0 errors** (687 warnings, unchanged), `vitest` **58/58 pass**;
`prisma/` change **scoped to the two seed scripts** (no migration — `prisma/migrations/` untouched). Direct
`eslint` of the two changed seed files: **0 errors, 4 pre-existing warnings, none introduced**. (Note: `tsc`
excludes `prisma/seed*.ts` via `tsconfig.json:40`, and `npm run lint`/next-lint does not cover `prisma/`, so
the changed seed files were lint-verified directly.) **Nothing pushed — owner deploys.**

### Resolved (owner-approved)
- ✅ **Q-03-004** RESOLVED — owner chose "fix the seeder now". `prisma/seed.ts` now derives `sortOrder` from
  each unit's **master-JSON array index** at every spine level (Subject/Strand/Topic/Subtopic/Objective),
  set in **both `create` and `update`** (so a partial re-seed re-orders deterministically). Replaced the five
  `for…of` walks with `for…of …entries()` to expose the index; corrected the two false
  `sortOrder: 0 // Will be updated from sequenced data` comments. File: `prisma/seed.ts`.
  - *Re-verify that sized the fix:* `sortOrder` is consumed by ~10 `orderBy:{sortOrder:"asc"}` sites
    (curriculum API routes, `spine-actions.ts`, `course-pacing.ts`, `master-context.ts`, `smart-defaults.ts`),
    and the sequenced JSON carries **no** order field (only `grade`/`complexity`) — so master-JSON array
    position was the only ordering signal and it was being discarded (all `sortOrder=0`).
  - *Scope caveat (documented, not a defect):* this is seed-only and the live DB is already seeded; the
    objective-count idempotency guard (`seed.ts:96-98`) skips the spine block on a populated DB, so the live
    rows keep physical-row ordering (which ≈ insertion order today) until a fresh re-seed or a one-off
    `sortOrder` backfill the owner runs. The fix makes every fresh build (CI ephemeral DBs, recovery, new
    envs) deterministic.
- ✅ **Q-03-005** RESOLVED — owner chose "keep & add a guard". `prisma/seed-generator-content-types.ts` now
  runs a **preflight** (lines 45-56) that counts referencing `Resource` + `BookGeneratedMaterial` rows (both
  `resource_kind_id` is NOT NULL) and `console.error` + `process.exit(1)` aborts with a clear message before
  the destructive `resourceKind.deleteMany({})` (now line 58) — instead of relying on the raw
  `ON DELETE RESTRICT` FK violation (`resources` init:1386, `book_generated_materials` init:1350). The
  destructive re-seed now proceeds only on a DB without generated content; on a populated DB it fails loudly
  and early with a human-readable reason. File: `prisma/seed-generator-content-types.ts`.

### Notes
- Re-verification dismissed nothing — both findings still held. No new findings raised; no re-grades; no
  deferrals. Sibling check: grepped `/codebase-map` for `sortOrder` / `seed.ts` / `seed-generator` /
  `resourceKind.deleteMany` — the only other references are ch.19 (which *consumes* `sortOrder` via the spine
  REST routes; no doc change needed there since behavior for fresh builds is now correct) and the ch.03/ch.24
  register entries updated here. No out-of-chapter sibling finding to close.
- Cross-doc updates: ch.03 §4 (spine + generator seed descriptions), §5 (both seeder rows annotated), §7 (both
  → ✅ RESOLVED, original evidence kept); ch.24 §7 register top-line (**71 → 69 LOW open**), LOW tally
  narrative, + Session-4 disposition note.
- Partition reconciles: the 2 in-scope findings are both **FIX_NOW/RESOLVED**; 0 deferred / 0 dismissed /
  0 removed / 0 left-open.
- **Register tally:** LOW **71 → 69 open** (closed Q-03-004, Q-03-005). Reconciles across ch.03 §7, ch.24 §7,
  and this log.

## Session 2026-06-19 (round 8) — Session 5: ch.03 MED findings (owner-approved)

Fifth resolution session (SKILL §9): **`03-migrations-seeds.md` — MED**. The two OPEN MED findings (Q-03-001,
Q-03-003) were re-verified at their cited `file:line` against current code — **both reproduce exactly**. Both
closed this session (1 removal + 1 accept-by-design). Verified after: `tsc --noEmit` **0 errors**,
`npm run lint` **0 errors** (687 warnings, unchanged), `vitest` **58/58 pass**; `prisma/migrations/`
**untouched** (the only `prisma/` change is the deletion of the dead `prisma/seed-book.ts`). **Nothing pushed —
owner deploys.**

### Closed (owner-approved)
- ✅ **Q-03-001** REMOVED — owner chose "delete it". `git rm prisma/seed-book.ts`. It was dead (zero importers,
  no `db:seed:book` script in package.json — grep confirmed only self-references at `:18`/`:49`) and broken
  under Prisma 7 (`return new PrismaClient()` at line 13 with no driver adapter → throws at client
  construction; every live seeder passes `adapter: new PrismaPg(...)`). It was also excluded from `tsc`
  (`tsconfig.json:40`), so the missing adapter was silently un-typechecked. Same disposition as Session 1's
  `verify-seed.ts` / `debug-connect.ts` removals (dead + broken + un-typechecked scripts). **Zero blast
  radius** — nothing imports or invokes it and the `tsc` surface is unchanged. File: `prisma/seed-book.ts`
  (deleted).
- ✅ **Q-03-003** ACCEPTED (by-design) — owner chose "accept as by-design & close". No code change. The finding
  bundled two claims; the re-verify separated them:
  - **(a) bypass-RLS is required, not a defect.** Seeders write global reference tables (subjects, catechisms,
    counties, devotionals, commentary, generator ResourceKinds, …) whose RLS policies are read-only for
    `app_user` (migration `02:140-144`), so writes *must* come from a non-`app_user`/superuser connection. This
    is the architecture working as intended.
  - **(b) `rejectUnauthorized:false` is the Supabase-standard posture and is repo-wide, not seeder-specific.**
    Re-verify found the production runtime client `src/server/db.ts:16` uses the *identical*
    `ssl: { rejectUnauthorized: false }` on every request — so the TLS-cert-validation gap is not unique to
    seeding (the finding's "MITM exposure during seeding" framing understated the surface). The proper
    remediation is to pin the Supabase CA cert (`ssl: { ca }` / `sslmode=verify-full`) consistently across the
    runtime client *and* the seeders — a deliberate infra change with production blast radius (a wrong cert
    breaks all DB connectivity) that needs the actual CA cert and validation, out of scope for a seed-script
    session. Owner accepted the current posture; the hardening is noted as a future infra task (not added to
    the deferred-migrations batch — it is not a schema change).

### Notes
- Re-verification dismissed nothing — both findings still held. No new findings raised; no re-grades; no
  deferrals. Sibling check: grepped `/codebase-map` for `seed-book` / `rejectUnauthorized` / `TLS` / `SSL` /
  `MITM` — `seed-book` appears only in ch.03 (no sibling); the `rejectUnauthorized:false` posture is *described*
  (not as a separate `Q-`) at ch.04 §3.6 (`db.ts`, line 120) and cross-listed in the ch.24 by-theme MED list
  (line 204). No out-of-chapter sibling finding to close; ch.04's description already notes the runtime SSL
  setting, so no edit needed there.
- Cross-doc updates: ch.03 §1 (seeder table — `seed-book.ts` row removed), §3 ("All seeders … adapter" +
  Supabase-posture note), §5 (status row → ✅ REMOVED), §6 (Prisma-models-written note), §7 (Q-03-001 →
  ✅ REMOVED, Q-03-003 → ✅ ACCEPTED, original evidence kept); ch.24 §7 register top-line (**35 → 33 MED open**),
  MED section header (35 → 33), both by-theme entries struck/annotated, + Session-5 disposition note.
- Partition reconciles: the 2 in-scope findings are **1 REMOVED (Q-03-001) + 1 ACCEPTED (Q-03-003)**;
  0 deferred / 0 dismissed / 0 left-open. Both decrement the MED count.
- **Register tally:** MED **35 → 33 open** (closed Q-03-001, Q-03-003). Reconciles across ch.03 §7, ch.24 §7
  (top-line + header + by-theme list), and this log.
- **ch.03 is now fully done** (LOW resolved in Session 4; MED closed here; HIGH empty).

## Session 2026-06-19 (round 9) — Session 6: ch.04 LOW findings (owner-approved)

Sixth resolution session (SKILL §9): **`04-security-auth-tenancy.md` — LOW**. The three OPEN LOW findings
(Q-002, Q-003, Q-005) were re-verified at their cited `file:line` against current code — **all reproduce**.
All three closed this session (2 removals + 1 resolve-by-audit). Verified after: `tsc --noEmit` **0 errors**,
`npm run lint` **0 errors** (687 warnings, unchanged), `vitest` **58/58 pass**; `prisma/migrations/`
**untouched**. **Nothing pushed — owner deploys.**

### Closed (owner-approved)
- ✅ **Q-002** REMOVED — owner chose "remove files + prune dep/env" (after clarifying that the finding targets
  the unused `@supabase/supabase-js` JS-SDK wrappers, NOT the Supabase Postgres DB, which the app reaches only
  via Prisma/`DATABASE_URL`). Actions: `git rm src/lib/supabase/client.ts src/lib/supabase/server.ts`;
  `npm uninstall @supabase/supabase-js` (removed 8 packages; package.json −1); dropped the 3 JS-client env vars
  (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) from
  `.env.example`. Both files had **zero importers** repo-wide (the only `@supabase/supabase-js` imports were their
  own definition lines), a stale "RLS not configured → PostgREST is public" comment (`client.ts:8`; DB-grounding
  shows RLS now enabled on all 67 tables / 98 policies), and `server.ts:16` defaulted to the BYPASSRLS
  `SUPABASE_SERVICE_ROLE_KEY` (a foot-gun if ever adopted). **Zero blast radius:** the 3 env vars were read
  ONLY by these two files (grepped repo-wide; `.mcp.json` doesn't use them), and `DATABASE_URL` is a separate
  key untouched. Files: `src/lib/supabase/client.ts`, `src/lib/supabase/server.ts` (deleted), `package.json`,
  `package-lock.json`, `.env.example`.
- ✅ **Q-003** REMOVED — owner chose "remove". `git rm src/components/auth/sign-in-button.tsx`. Zero importers
  (grep hit only its own definition); `login`/`signup` pages render inline server-action forms. Dead UI, zero
  blast radius. File: `src/components/auth/sign-in-button.tsx` (deleted).
- ✅ **Q-005** RESOLVED (audit complete; correct-by-design) — owner chose "leave as-is, audit complete". No code
  change. The finding's stated ask was to *audit direct session-org reads*; the audit (grep `\.organizationId`
  repo-wide) found the **only** code reading the JWT-stamped `session.user.organizationId` directly is
  `proxy.ts:59`. It uses that value solely to validate the active-profile cookie binding (`token.org === orgId`);
  a stale-null org there **fails closed** (`activeType=null` → redirect `/select-profile`), never a cross-tenant
  grant, and org only ever transitions null→real once (users never change org). The proxy runs at the **edge with
  no DB**, so `getCurrentUserOrg` (a Prisma read) is structurally unavailable — the JWT value is all the edge has.
  Every other org read (~80 sites) compares a Prisma row against the `getCurrentUserOrg` DB re-read
  (`auth-helpers.ts:18-21`, 77 callers). Behavior is standard NextAuth (JWT stamped at sign-in) + the established
  DB-re-read mitigation; nothing to fix.

### Consequential doc-currency fixes (code-is-truth; not new findings)
- ch.01 §6 external-services line (`:92`) and env-var appendix (`:102`) had listed the now-removed `SUPABASE_*`
  keys and the already-removed `@ai-sdk/openai` (uninstalled in Session 2, Q-08-006). Both lines were corrected
  to match code while editing them for the Supabase change.

### Notes
- Re-verification dismissed nothing — all three findings held. No new findings raised; no re-grades; no deferrals.
  Sibling check: grepped `/codebase-map` for `supabase` / `sign-in-button` / `SignInButton` — the dead clients +
  SignInButton appear only in ch.04 (the env-var/services *descriptions* in ch.01 are not separate `Q-`s, but were
  updated for currency). No out-of-chapter sibling finding to close.
- Cross-doc updates: ch.04 §1 (scope table — both dead-file rows removed), §3.7 (Supabase-clients bullet →
  removed-note), §4 status table (both rows → **REMOVED**), §5 env-var list (3 `SUPABASE_*` keys dropped + note),
  §7 (Q-002/Q-003 → ✅ REMOVED, Q-005 → ✅ RESOLVED with the audit recorded, original evidence kept); ch.01 §6
  (×2, above); ch.24 §7 register top-line (**69 → 66 LOW open**), LOW-section narrative (+Session 6), foundational
  entries (Q-002/3/5 struck/annotated), + Session-6 disposition note.
- Partition reconciles: the 3 in-scope findings are **2 REMOVED (Q-002, Q-003) + 1 RESOLVED (Q-005)**;
  0 deferred / 0 dismissed / 0 left-open / 0 unaccounted. All three decrement the LOW count.
- **Register tally:** LOW **69 → 66 open**. Reconciles across ch.04 §7, ch.24 §7 (top-line + LOW narrative +
  foundational entries), and this log.
- **ch.04 LOW is now fully done.** ch.04 still has Q-004 [MED] + Q-001 [HIGH] open.

## Session 2026-06-19 (round 10) — Session 7: ch.04 MED findings (owner-approved)

Seventh resolution session (SKILL §9): **`04-security-auth-tenancy.md` — MED**. The sole OPEN MED finding
(`Q-004`) was re-verified at its cited `file:line` against current code — **it reproduces** (`auth.ts:57`,
`allowDangerousEmailAccountLinking: true` on the lone Google provider). Closed this session by **removal**.
Verified after: `tsc --noEmit` **0 errors**, `npm run lint` **0 errors** (687 warnings, unchanged), `vitest`
**58/58 pass**; `prisma/migrations/` **untouched** (only `src/auth.ts` changed). **Nothing pushed — owner deploys.**

### Closed (owner-approved)
- ✅ **Q-004** RESOLVED — owner chose "remove the flag". `allowDangerousEmailAccountLinking: true` was deleted
  from `src/auth.ts:57` (the property now defaults to `false`). **Why removal is regression-free** (traced + twice
  independently verified): Auth.js only throws `OAuthAccountNotLinked` (the error this flag suppresses) when an
  existing `User` whose email matches the incoming OAuth identity has **no linked `Account`** for that provider.
  That orphaned-`User` state cannot exist here — (a) the lone provider is Google (`auth.ts:53`; `auth.config.ts:12`
  is `providers:[]`, no dynamic injection, no Email/Credentials provider repo-wide), and (b) `User`/`Account` rows
  are written **only** by the NextAuth `PrismaAdapter` at sign-in, which creates the `User` and its linked Google
  `Account` atomically. Repo-wide grep (excluding `src/generated/`) for `user.create`/`createUser`/`account.create`/
  `user.upsert` returns **zero** app-code hits; `blueprint.ts` (`:59`, `:138`) and `api/students/route.ts` (`:33`)
  only `user.update` an already-adapter-created row; all seed scripts seed reference data, never auth users; Inngest
  writes only domain rows. So removal cannot break any normal sign-in (`breaksSignIn=false` from both adversarial
  lenses). **Why removal is the right call** (not merely accept/document): it makes the auth config **default-secure**
  — if a second provider is ever added, same-email accounts will no longer auto-link silently (the classic
  cross-IdP account-takeover footgun the finding warned of), without relying on a future maintainer remembering to
  flip this flag. Both adversarial lenses re-graded the *latent* risk LOW (single verified-email provider → no live
  exploit surface); removal closes the finding outright rather than carrying it. File: `src/auth.ts` (1 line removed).

### Notes
- Adversarial pass: one Workflow with two verifier lenses (regression-safety + severity/disposition). Both returned
  `breaksSignIn=false`, `foundUserCreationPathOutsideGoogle=false`, `secondProviderAnywhere=false`, grade **LOW**;
  they split REMOVE vs ACCEPT_KEEP. Re-anchored to the finding's stated impact (a *future-second-provider* footgun),
  REMOVE was recommended and owner-approved — it disarms the footgun for free instead of deferring it to diligence.
- Re-verification dismissed nothing; the finding held. No new findings / re-grades / deferrals. Sibling check:
  grepped `/codebase-map` for `allowDangerousEmailAccountLinking` / `account.?link` — Q-004 appears only in ch.04
  (§3.1 description + §7 entry) and the ch.24 register (Foundational + this log). **No out-of-chapter sibling.**
- Cross-doc updates: ch.04 §3.1 (provider bullet → flag-removed note), §7 (Q-004 → ✅ RESOLVED, original evidence
  kept); ch.24 Foundational entry (Q-004 struck/annotated), MED-section count-basis note (foundational/themed split
  made explicit), + Session-7 disposition note. ch.04 §4 status table unchanged (no unit row tracks the flag;
  "Google OAuth login" stays DONE).
- **Consequential doc-currency fix (code-is-truth; not a new finding):** `00-INDEX.md` §"Findings at a glance"
  (`:69`) still read "**35 MED · 69 LOW**" — stale from before Sessions 5–6 (Session 5 closed 2 MED → 33;
  Session 6 closed 3 LOW → 66; the roll-up was never updated). Corrected to "**33 MED · 66 LOW**" so it
  reconciles with ch.24, and the foundational-`Q-0NN` note made precise (Q-001 [HIGH] open; Q-011/Q-013 [LOW]
  deferred; foundational MED now fully closed). My Session-7 change does not alter either headline (Q-004 is
  foundational); this is purely bringing a stale cross-artifact tally current.
- **MED reconcile:** Q-004 is the **only foundational MED**, tracked in ch.24's Foundational section and never part
  of the by-theme **33** (the 37→35→33 lineage counts feature/synthesis/lockout MEDs only — foundational findings
  sit separately, like Q-001 [HIGH] outside the "HIGH 10"). Resolving it does **not** decrement the by-theme 33;
  it takes open foundational MED to **0**, so the by-theme **33** is now the complete open-MED set. Partition: the
  1 in-scope finding = **1 RESOLVED (Q-004)**; 0 deferred / 0 dismissed / 0 left-open / 0 unaccounted. Counts
  reconcile across ch.04 §7, ch.24 (Foundational + MED-header note + this log).
- **ch.04 MED is now done.** ch.04 has only **Q-001 [HIGH]** (the RLS-bypass foundational finding) left open.

---

## Session 2026-06-19 (round 11) — Session 8: ch.04 HIGH findings (owner-approved)

Eighth resolution session (SKILL §9): **`04-security-auth-tenancy.md` — HIGH**. The sole OPEN HIGH finding
(`Q-001`, the app-bypasses-DB-RLS foundational finding) was re-verified at its cited `file:line` against
current code — **it reproduces** (`RLS_ENABLED` default-false `db.ts:9-11`; bare client returned `db.ts:114`
→ no org GUC stamped). **No code changed this session** (the RLS path is already written/dormant — there is
nothing to fix in code); the work was cutover *preparation*. Verified after: `tsc --noEmit` **0 errors**,
`npm run lint` **0 errors** (687 warnings, unchanged), `vitest` **58/58 pass**; `prisma/migrations/`
**untouched**. **Nothing pushed — owner deploys.** *(Env note: vitest first failed to collect all 12 files
with `Cannot read properties of undefined (reading 'config')` — a stale vite cache, not a regression (this
session changed zero code); `rm -rf node_modules/.vite node_modules/.vitest && npm test` restored 58/58. Now
recorded in SKILL §9.5.)*

### Disposition (owner-approved)
- ⏳ **Q-001** stays **OPEN [HIGH]** — **cutover prep done, execution deferred** to a dedicated infra task.
  A 3-lens adversarial Workflow (over-caution / blast-radius / disposition-severity) **unanimously** returned
  `DEFER_INFRA_CUTOVER`, keep OPEN, keep HIGH. There is **no code fix**: the RLS enforcement path is already
  written and dormant (`db.ts:115-131` per-query `$extends`; `withTenant` GUC stamping `db.ts:107-110`), so
  "fixing" Q-001 = an infra cutover (env flag `RLS_ENABLED=true` + repoint `DATABASE_URL` to the non-bypass
  `app_user` role) — out of scope for a code session, risky to flip without staging (no rollback on the
  precious prod DB; would break features until the per-query audit lands), and forbidden by §9 without explicit
  approval. Owner asked "why not fix it now?" → re-explained scope (the fix isn't code) and chose **"prep the
  cutover now."**
- **Read-only DB verification (Supabase MCP, no writes) — `app_user` GRANT/role side is READY:** `app_user`
  is `BYPASSRLS=false` + `LOGIN=true` (login granted out-of-band as the migration intended), holds full
  SELECT/INSERT/UPDATE/DELETE on **all 68 public tables (0 grant gaps)**, EXECUTE on
  `app.current_org()`/`app.current_user_id()`, USAGE on `public`+`app`; **0 sequences** exist (Prisma text
  ids) so 0 sequence-grant gaps; **68/68 tables RLS-enabled, 98 policies** on the 67 app tables
  (`_prisma_migrations` is the only RLS-without-policy table → deny-all for `app_user`, harmless: runtime
  Prisma never reads it; migrations run via the direct/`postgres` URL). **Connection-role inference sharpened:**
  the only `BYPASSRLS` role that can log in is `postgres` (`service_role` is `LOGIN=false`; `supabase_admin` is
  the platform superuser), so the app connects as `postgres` today (was "postgres/service_role — inferred").

### What the adversarial pass overrode (re-anchored to Q-001's impact, SKILL §9.2)
- **Rejected lens-2's "fence `resolveTenant` to throw instead of fail-closed":** the null→fail-CLOSED return is
  *intentional and correct* (login/boot/global reads run context-free by design, `rls-context.ts:9-11`); throwing
  would crash exactly those safe paths and is dead today (RLS off). Regression risk for zero current benefit.
- **Rejected lens-3's "custom ESLint `no-unwrapped-org-mutations` rule":** the *current* valid boundary is
  explicit `where:{organizationId}` **without** `withTenant` (which is a no-op today), so a rule keyed on
  "outside `withTenant`" would false-positive across correct code; it also just duplicates the separately-tracked
  per-query findings (Q-10/14/17/18/20). A reasonable *future* CI guardrail, but a new tool — out of scope.
- **Kept HIGH** unanimously: single-tenant-today is a timing accident, not a mitigation — the moment a 2nd org
  onboards, the ~10 per-query findings become live cross-tenant breaches. Not split (umbrella is correct; the
  per-query findings already form the audit track).

### 👤 Owner follow-up required (the RLS cutover, when ready — gated)
The ordered **RLS-cutover runbook** is in `24-… §5` (roadmap) + recapped in `§8`. Gate: **both** workstreams
must finish first — (A) this infra cutover, and (B) the per-query org-filter audit (Q-10-001/002/003,
Q-14-001/004, Q-17-001, Q-18-001, Q-20-001/002). Key pre-flip steps: finish workstream B → add observability on
the silent fail-closed path (`db.ts:120-121`) → confirm `app_user` has a usable password + add its `DATABASE_URL`
to Vercel as a new secret (keep `postgres` for rollback) → stage/test on a branch-DB clone → flip `RLS_ENABLED=true`
**and** repoint `DATABASE_URL`→`app_user` together → verify → rollback = revert both.

### Notes
- Sibling check (SKILL §9 step 1): Q-001 is cross-filed in **ch.02 §7** (data-model angle) in addition to its
  ch.04 §7 home, and referenced in ch.24 (Foundational + roadmap + §8 Phase C) and `00-INDEX.md`. **All updated
  in lockstep this session.** No new findings / re-grades / dismissals.
- **HIGH reconcile:** Q-001 is **foundational** and sits in ch.24's Foundational section, **outside** the
  "HIGH (10)" by-theme headline (which counts feature findings only — same basis as Q-004 [MED] outside the "33").
  A ⏳ deferral is **not** a closure, so it stays tracked-OPEN at HIGH and the "HIGH 10" headline is **unchanged**.
  Partition: the 1 in-scope finding = **1 DEFERRED-with-prep (Q-001)**; 0 resolved / 0 removed / 0 dismissed /
  0 unaccounted. Counts reconcile across ch.04 §7, ch.02 §7, ch.24 (Foundational + roadmap + §8), `00-INDEX.md`.
- **ch.04 is now fully triaged** (LOW done Session 6, MED done Session 7, HIGH deferred-with-prep Session 8 —
  Q-001 remains the one tracked-OPEN finding, pending the infra cutover).

## Session 2026-06-19 (round 12) — Session 9: ch.05 LOW findings (owner-approved)
Target = the 4 OPEN [LOW] findings in `05-profiles.md §7` (Q-05-003/004/005/006). All re-verified at their
cited `file:line` (reproduce). Adversarial recs via a Workflow (recommend → verify per finding); the Q-05-004
verifier returned junk so that one was re-derived by hand. Owner partition: **3 closed · 1 deferred** (LOW 66 → **63 open**).

### ✅ Q-05-004 RESOLVED — `enterAssessment` learner-existence check (`src/app/select-profile/actions.ts`)
- **Was:** `enterAssessment(studentId,pin?)` charset-validated `studentId` then `redirect(/students/${id}/assessment)`
  with no existence/ownership check. Audit confirmed the destination page does NO check; enforcement is downstream
  at `POST /api/students/[id]/assessment` (route.ts:38-42), so worst case was an empty wizard for a bogus id (no
  cross-tenant exposure).
- **Fix:** before becoming the owner PARENT, resolve the caller's org and `withTenant`-check
  `learner.findFirst({ id: studentId, organizationId })`; a bogus id returns `{ ok:false, "Invalid student." }`
  without setting the parent session. **+3 tests** in `select-profile/actions.test.ts` (charset reject / not-in-org
  reject / happy-path redirect).

### ✅ Q-05-005 ACCEPTED (correct-by-design) — `setProfileAvatar` (`src/server/profiles/avatar-actions.ts`)
- Any org member can overwrite an *unprotected* profile's avatar (PIN-gated only if the target has a PIN). The sole
  caller is the **pre-active-profile picker** (`ProfilePicker.tsx:362`), where a PARENT assertion is structurally
  impossible (same reason `verifyProfilePin` is not parent-gated). In-tenant, cosmetic, reversible; any profile can
  opt into the rate-limited PIN path. **No code change**; entry kept + marked accepted (closes & decrements).
  `avatar-actions.test.ts` already pins the four-case contract.

### ✅ Q-05-006 RESOLVED — parent-as-learner leak, full consumer sweep (owner: "fix all consumers now")
- **Confirmed real:** `enrollSelfInCourse` (`my-learning.ts:36-44`) creates a `Learner` linked to the PARENT
  `Profile`; real students get a STUDENT `Profile` (api/students/route.ts:74-85 + backfill) so the parent-learner is
  distinguishable — yet every org-wide consumer filtered only by `organizationId`. Sharpest symptom: the parent
  surfaced on the picker's "needs a personality assessment" nudge (`listStudentsNeedingAssessment`).
- **New shared fragment:** `src/server/queries/learner-filters.ts` → `excludeParentLearners = { NOT: { profile: { is:
  { type: "PARENT" } } } }` (the `NOT`-of-relation form preserves null-profile legacy/unlinked students; an IS-STUDENT
  predicate would wrongly drop them). Unit-tested in `learner-filters.test.ts` (shape lock).
- **Applied to 12 student-facing roster/count queries** (spread `...excludeParentLearners`): `students.ts`
  (`listStudentsNeedingAssessment`), `dashboard.ts` (`getParentDashboardData`), `students/page.tsx`,
  `context-suggestions.ts`, `blueprint/page.tsx` (×2 counts), `thinkling/page.tsx`, `grading/page.tsx`,
  `living-library/page.tsx`, `transcripts/page.tsx`, `smart-defaults.ts`, `student/dashboard/page.tsx` (orphaned
  route — applied for uniformity).
- **Deliberate carve-outs (NOT filtered):** `data-export.ts` (data-sovereignty — a parent's own learner data must
  export) and `getMyLearning` (the parent's OWN My-Learning view, fetched by `profileId`, not a roster). All
  point-lookups-by-id untouched.

### ⏳ Q-05-003 DEFERRED — PIN-throttle dedup (stays tracked-OPEN)
- The throttle→`bcrypt.compare`→record/clear sequence is copied verbatim in 3 places (`actions.ts:40-51`, `:77-88`,
  `pin-actions.ts:79-87`). Owner: **batch with the ch.05 MED session**, where Q-05-002's `pinSchema` fix lands in the
  same shared `verifyPinWithThrottle(profileId, organizationId, pinHash, pin)` helper (shape (b): reuse the
  already-fetched `pinHash`, no double-fetch) — avoids touching these lines twice. Note for that session: both suites
  mock `pin-throttle` wholesale, so add a direct unit test for the helper.

### Consequential doc-currency fixes (not new findings)
- Cross-referenced the parent-learner exclusion in every chapter that documents an edited consumer: ch.06 (parent
  dashboard), ch.09 (context-suggestions/smart-defaults), ch.11 (thinkling), ch.14 (living-library), ch.16 (query home
  + new file added to §1 scope + §6 note), ch.17 (blueprint counts), ch.18 (grading), ch.21 (scheduling), ch.22
  (transcripts). `excludeParentLearners` (+test) added to ch.16 §1 scope (every tracked file in exactly one chapter).

### Verification
- `npx tsc --noEmit` = **0 errors**; `npm run lint` = **0 errors / 687 warnings** (baseline); `npm test` =
  **62/62** across **13 files** (was 58/12 — +1 file `learner-filters.test.ts`, +1 test there, +3 `enterAssessment`
  tests). `prisma/migrations/` **untouched** (zero `prisma/` changes this session). Nothing pushed.

### Reconcile (SKILL §4 partition)
- 4 in-scope findings → **1 deferred (Q-05-003) · 3 closed (Q-05-004 resolved, Q-05-005 accepted, Q-05-006
  resolved)**; 0 unaccounted. LOW headline **66 → 63 open** (deferred ≠ closed, so Q-05-003 does not decrement).
  Counts reconcile across ch.05 §7, ch.24 register (line 169 + LOW section), and `00-INDEX.md`. No sibling findings
  in other chapters (all 4 were ch.05-only); the cross-chapter changes are code-currency, not new/closed findings.

## Session 2026-06-19 (round 13) — Session 10: ch.05 MED findings (owner-approved)
Target = the 3 OPEN [MED] in `05-profiles.md §7` (Q-05-001, Q-05-002, Q-05-010) + the deferred LOW Q-05-003
(bundled, as Session 9 planned). All re-verified at their cited `file:line`; an adversarial Workflow (3 lenses,
high-confidence) corroborated each disposition and **overrode** the helper's ordering (see Q-05-002). Owner
partition: **1 dismissed · 3 resolved** (MED 33 → **30 open**; LOW 63 → **62 open**).

### ❌ Q-05-001 DISMISSED — PARENT idle is sliding, not an absolute cap (no code change)
- The finding claimed the PARENT cookie is an absolute 15-min cap because "nothing re-signs the cookie on
  activity." **False against current code:** the proxy re-signs the PARENT cookie with a fresh `iat` whenever it
  is older than `RESTAMP_AFTER_SECONDS` (5 min) on any non-API page request (`proxy.ts:74-89`) — a genuine
  **sliding idle**, already documented in ch.04 §3.3:93 + §1:13. Server actions POST to page routes, so normal
  use restamps. `git show b585c1e:src/proxy.ts` confirms the restamp existed at the **doc's own SHA** (added in
  `ef686d9`, an ancestor of `b585c1e`), so the finding overlooked `proxy.ts`. The `active-profile.ts:95` comment
  ("idle is enforced server-side via iat") is therefore accurate. Residual contrived edge (a parent active >15
  min via `/api/*` fetches alone, zero navigations) was noted but **not** raised as a new finding.

### ✅ Q-05-002 RESOLVED + ✅ Q-05-003 RESOLVED — one shared `verifyPinWithThrottle` helper
- **New `src/server/profiles/pin-verify.ts`** exporting `verifyPinWithThrottle(profileId, organizationId,
  pinHash, pin)` — the single source of truth for the throttle→shape→`bcrypt.compare`→record/clear sequence that
  was copied verbatim in three places (Q-05-003). `verifyProfilePin` (`pin-actions.ts`), `selectProfile` +
  `enterAsOwnerParent` (`select-profile/actions.ts`) now all delegate to it (shape (b): reuse the already-fetched
  `pinHash`, no double-fetch).
- **Q-05-002 fix inside the helper:** `pinSchema.safeParse` runs on every attempt. **Adversarial-corrected order**
  is gate → shape → compare (not shape-first): a locked-out caller still gets "Too many attempts", and a malformed
  PIN still **records** a throttle failure (identical accounting to the old `pin ? compare : false`) — but **skips
  `bcrypt.compare`**, closing the per-attempt compare cost the finding flagged. Valid-PIN behavior + error strings
  are byte-for-byte unchanged. (Realized impact was nearer LOW — bcrypt truncates to 72 bytes, throttle caps 5/30s
  — but resolved outright.)
- **Tests:** new `pin-verify.test.ts` (no-PIN, lockout-before-work, malformed-skips-bcrypt-but-records, wrong-PIN,
  correct-PIN). The two existing suites (`actions.test.ts`, `pin-actions.test.ts`) pass unchanged after adding
  `vi.mock("server-only", () => ({}))` — they now transitively import the server-only `pin-verify` module.

### ✅ Q-05-010 RESOLVED — email-verified owner-PIN reset (owner: "build it now, RESEND is configured")
- **New flow:** `ProfilePicker` shows "Forgot your parent PIN?" when `owner.hasPin`. It calls
  `requestOwnerPinReset` (`src/server/profiles/pin-reset.ts`), which loads the org's owner PARENT and — if it has
  a PIN — signs a **15-min, single-purpose JWS** (`src/lib/profile-pin-reset-token.ts`, mirrors
  `active-profile-cookie.ts`) bound to `{uid, org, profileId}` and Resend-emails the link
  `${origin}/select-profile/reset-pin?token=…` to the **session user's own verified Google email** (mirrors
  `safety-alert.ts`: fail-loud, no false success). Returns `ok` even when there's nothing to send (no leak).
- **Reset route** lives at `src/app/select-profile/reset-pin/{page,ResetPinConfirm}.tsx` — nested under
  `/select-profile` precisely so the proxy's no-active-profile gate (`profileGateDecision`/`isSelectProfilePath`)
  lets a **locked-out (profile-less) owner** reach it. The page only **validates** the token; the explicit button
  → `confirmOwnerPinReset(token)` re-checks the token is bound to this login+org, then `withTenant`-clears the
  owner PARENT `pinHash`+`pinFailedCount`+`pinWindowStart` (so an email prefetch/scan GET can't consume it).
- **Security model:** in the shared-family-login model the session alone can't prove owner-vs-student, so the
  **out-of-band factor is inbox possession**. New env `ACCOUNT_EMAIL_FROM` (falls back to Resend's test sender).
- **Tests:** `profile-pin-reset-token.test.ts` (sign/verify roundtrip, wrong-secret, expiry both sides of the
  TTL, malformed) + `pin-reset.test.ts` (token-bound clear; uid/org-mismatch & garbage-token reject without
  writing; non-owner profile reject; Resend send happy/no-leak/no-config paths).

### ➕ Companion capability (same session, owner-requested) — parent resets a locked-out CHILD's PIN
- A child who forgets their PIN should be unblocked by a **parent entering the parent PIN**, not by email (the
  parent is the authority above the child, and is present). Added `resetChildPinWithParentPin(childId, parentPin?)`
  (`pin-reset.ts`): verifies the org's owner PARENT PIN through the shared **`verifyPinWithThrottle`** (rate-limited;
  an owner with no PIN passes through, mirroring the picker's other parent-gated entries), then clears the child's
  `pinHash`+throttle. **STUDENT-only** (`where:{type:"STUDENT"}`) — a parent's own PIN never resets this way.
- **UI:** the child's PIN prompt (`pinFor.type==="STUDENT"`) gains "Forgot PIN? A parent can reset it." →
  `startChildReset` → a parent-PIN dialog → `toast` + `router.refresh()` (the child's lock badge clears, they select
  with no PIN). Owner chose **clear** (vs set-a-new-PIN) — fastest unblock; the parent can re-set a PIN in Manage
  Profiles. (Manage Profiles already did this; this is the picker-level shortcut for the locked-out-at-picker case.)
- **Tests:** +4 in `pin-reset.test.ts` (clears on valid parent PIN; wrong parent PIN → no clear; non-STUDENT/unknown
  target → no clear; no-owner → never checks the PIN). The suite now mocks `@/server/profiles/pin-verify`.

### Verification
- `npx tsc --noEmit` = **0 errors**; `npm run lint` = **0 errors / 687 warnings** (baseline; one new-file fix:
  moved a `Date.now()` out of the reset page's render body to satisfy the react-hooks purity rule); `npm test` =
  **85/85** across **16 files** (was 62/13 — +3 files: `pin-verify`, `profile-pin-reset-token`, `pin-reset`;
  +23 tests, incl. the +4 child-reset). `prisma/migrations/` **untouched** (no `prisma/` change this session).
  Nothing pushed.

### Reconcile (SKILL §4 partition)
- 4 in-scope findings → **1 dismissed (Q-05-001) · 3 resolved (Q-05-002, Q-05-003, Q-05-010)**; 0 unaccounted.
  **MED 33 → 30 open** (all 3 ch.05 MEDs were in the by-theme 33); **LOW 63 → 62 open** (Q-05-003 was a
  tracked-OPEN deferred LOW). Counts reconcile across ch.05 §7, ch.24 (line 169 + MED by-theme header/list + LOW
  narrative + the Session-10 note), and `00-INDEX.md`. No new findings / re-grades; no out-of-chapter sibling
  (all ch.05-only). New files added to ch.05 §1 (every tracked file in exactly one chapter).

## Session 2026-06-19 (round 14) — Session 11: ch.06 LOW findings (owner-approved)
Target = the 2 OPEN [LOW] in `06-app-shell-navigation.md §7` (Q-06-003, Q-06-004). Both re-verified at their
cited `file:line` (reproduce exactly); a **3-lens adversarial Workflow** was **unanimous REMOVE** (one lens
physically moved the files aside and ran `tsc --noEmit` = exit 0 before *and* after, then restored). Owner chose
**Remove all 3 now**. Partition: **2 in-scope → 2 removed**; 0 unaccounted. **LOW 62 → 60 open.**

### ✅ Q-06-003 REMOVED — dead legacy `UserNav` dropdown + its dead sole-importer `MainNav`
- Deleted `src/components/navigation/UserNav.tsx` (the legacy avatar dropdown: Profile Settings / "All About
  Me" / Log out) — it diverged from the live profile-aware `AccountMenu` and was a drift/revival risk.
- **Forced pair:** `UserNav`'s only importer was `MainNav.tsx:11,82`, and `MainNav` itself had **zero importers**
  repo-wide, so deleting `UserNav` alone would leave a broken import (tsc fail). Deleted
  `src/components/navigation/MainNav.tsx` in the same edit (a necessary tail, not scope creep).
- **Nothing orphaned:** `ProfileSettingsDialog` is still imported by `AccountMenu.tsx:15,80`; the branding
  `<Image>` still renders in `Sidebar.tsx:67` + `InklingToolkit.tsx:46`. No npm dep or env var to prune (both
  files used only already-shared deps).

### ✅ Q-06-004 REMOVED — dead `SidebarClientIslands.tsx` (whole file)
- Deleted `src/components/layout/SidebarClientIslands.tsx`. All three exports (`SidebarNavigation`,
  `MobileSidebarToggle`, `SettingsButton`) had **zero importers**; the `MobileSidebarToggle` emitted a
  `.sidebar-mobile-control` CSS class applied to **no element** in the repo (Q-06-004's core evidence).
- The "wire it instead of delete it" counter-argument (strongest keep case) collapses: the live `Sidebar.tsx`
  (`:46-127`) already implements the identical mobile drawer with working state, so wiring this would only
  duplicate live behavior.

### Q-06-001 narrowed (MED, still OPEN — next session)
- Both removals **partially resolve** MED `Q-06-001` (the dead 2nd-gen nav surface). After `CommandPalette`
  (Q-06-005), `MainNav`, `UserNav`, and `SidebarClientIslands` are all gone, Q-06-001 narrows to just
  **`CreationDrawer` + `ContextNav`** (with Q-06-002 covering `CreationDrawer`'s hardcoded org placeholder). The
  ch.06 §7 Q-06-001 entry + ch.24 MED by-theme list were updated; the MED count is unchanged (Q-06-001 stays open).

### Consequential doc-currency (code-is-truth; NOT new findings)
- The "3 `<Image>` usages" anchor (`01` Q-01-002, `CHANGELOG` round 5, `SKILL.md §5`) → **2** — `MainNav.tsx:49`
  was one of the 3 local `/assets/branding/*` sites; the substance of Q-01-002 (`remotePatterns: []`, zero remote
  hosts through the optimizer) is unchanged.
- `05-profiles.md §5/§6` `UserNav` cross-refs pruned: `ProfileSettingsDialog`'s evidence is now `AccountMenu.tsx:80`
  only; the importers-out list drops `/UserNav`.

### Verification
- `npx tsc --noEmit` = **0 errors**; `npm run lint` = **0 errors / 682 warnings** (down from 687 — the 3 deleted
  files carried ~5 `any`/`prefer-const` warnings); `npm test` = **85/85** across **16 files** (unchanged — no test
  referenced the deleted files). `prisma/migrations/` **untouched** (the only code change is the 3 deletions).
  Nothing pushed.

### Reconcile (SKILL §4 partition)
- 2 in-scope findings → **2 removed (Q-06-003, Q-06-004)**; 0 unaccounted. **LOW 62 → 60 open.** Counts reconcile
  across ch.06 §7, ch.24 (line 169 headline + LOW narrative + Session-11 note + the Q-06-001 MED-list annotation),
  and `00-INDEX.md`. No new findings / re-grades / deferrals. No out-of-chapter *finding* moved (the ch.01/05 edits
  are code-currency cross-refs, not closed findings).

## Session 2026-06-19 (round 15) — Session 12: ch.06 MED findings (owner-approved)
Target = the 2 OPEN [MED] in `06-app-shell-navigation.md §7` (Q-06-001 narrowed → `CreationDrawer`+`ContextNav`;
Q-06-002 CreationDrawer's hardcoded org placeholder). Both re-verified at their cited `file:line` (reproduce
exactly); a **3-lens adversarial Workflow** was **unanimous REMOVE** — (1) exhaustive static-reachability proof
(zero importers via named import, dynamic `import()`/`next/dynamic`/`lazy`, string path, barrel re-export — no
`index.ts` in either dir), (2) a steelmanned "wire-it-instead" case that collapsed for both files, (3) an
orphan/tail enumeration. Owner chose **Remove both** + **delete the orphaned `sheet.tsx` too**. Partition:
**2 in-scope → 2 closed** (1 removed, 1 resolved-by-removal); 0 unaccounted. **MED 30 → 28 open.**

### ✅ Q-06-001 REMOVED — last two dead 2nd-gen nav/shell files (`CreationDrawer` + `ContextNav`)
- Deleted `src/components/layout/CreationDrawer.tsx` (a right-side "Quick Create" Sheet embedding
  `GeneratorsClient`) and `src/components/navigation/ContextNav.tsx` (URL-context breadcrumb card +
  `useContextPreservation` hook). Both had **zero importers** repo-wide.
- **"Wire-it-instead" collapses:** Creation Station is already reachable **three** live ways — the Sidebar nav
  item (`Sidebar.tsx:28`), the `InklingToolkit` card (`ParentDashboard`), and `CreationStationClient`'s own
  "Quick Create" tab — all rendering the same `GeneratorsClient`, so the drawer added no capability. `ContextNav`
  had **zero producers** (nothing in the app sets its `studentId`/`courseId`/`objectiveId`/`bookId` URL params),
  so even if rendered it would always `return null`. Wiring either would be an out-of-scope feature build (and
  CreationDrawer carried acknowledged TODOs + the Q-06-002 org bug).

### ✅ Q-06-002 RESOLVED (by removal) — hardcoded org placeholder deleted with its dead host
- `CreationDrawer.tsx:44` passed `<GeneratorsClient organizationId="current-org-id-placeholder" />` — a latent
  tenant-scoping bug (latent only because the component was dead). Deleting `CreationDrawer` removes the line
  entirely. The **live** `/creation-station` route never had the bug: it resolves the real org server-side via
  `getCurrentUserOrg()` (`page.tsx:13`) and passes it through `CreationStationClient` → `GeneratorsClient`.

### ✅ Orphan tail removed — `src/components/ui/sheet.tsx` (ch.07)
- Deleting `CreationDrawer` left `@/components/ui/sheet` (a `@radix-ui/react-dialog`-based slide-over) with
  **zero importers** — `CreationDrawer` was its sole consumer (confirmed by grep + ch.07 §5). Owner approved
  deleting it as the orphan tail. **No npm dep orphaned:** `@radix-ui/react-dialog` is shared with `dialog.tsx`;
  `lucide-react`/`cn` are repo-wide. `ContextNav` orphaned nothing (all its imports have 75–93 importers).
- ch.07 docs updated for currency (NOT a new finding): §1 manifest row, §3 architecture bullet + Radix-wrappers
  list, §5 headline ("None DEAD" → sheet removed) + the `sheet` row (→ ✅ REMOVED) + the stale `scroll-area`
  "NOT CreationDrawer" note, and §6 imports lists (dropped `sheet` from the radix + lucide enumerations and the
  two finding-evidence example lists for Q-07-002/Q-07-005).

### Verification
- `npx tsc --noEmit` = **0 errors**; `npm run lint` = **0 errors / 679 warnings** (down from 682 — the 3 deleted
  files carried ~3 warnings); `npm test` = **85/85** across **16 files** (unchanged — no test referenced the
  deleted files). `prisma/migrations/` **untouched** (the only code change is the 3 deletions). Nothing pushed.

### Reconcile (SKILL §4 partition)
- 2 in-scope findings → **Q-06-001 ✅ removed + Q-06-002 ✅ resolved-by-removal**; 0 unaccounted. **MED 30 → 28
  open.** Counts reconcile across ch.06 §7, ch.07 (§1/§3/§5/§6 currency — no count change, no ch.07 finding
  added/closed), ch.24 (line 169 headline `28 MED`, the MED-by-theme header `28 open` + count basis lineage
  `…→30→28` + the struck Q-06-001/Q-06-002 dead-code entries + the Session-12 disposition note + the app-shell
  status row), and `00-INDEX.md` (`28 MED`). No new findings / re-grades / deferrals. **ch.06 now fully triaged**
  (LOW Session 11 / MED Session 12; no HIGH). The `sheet.tsx` deletion is a consequential cross-chapter cleanup
  driven by Q-06-001 — recorded in ch.07 as code-currency, not a separate Q.

## Session 2026-06-19 (round 16) — Session 13: ch.07 LOW findings (owner-approved)
Target = the 4 OPEN [LOW] in `07-ui-primitives.md §7` (Q-07-001 MarkdownContent no-KaTeX; Q-07-002 two icon libs;
Q-07-003 dead null-guard in `useFormField`; Q-07-009 form.tsx single-consumer via brittle relative path). All four
re-verified at their cited `file:line` (all reproduce; Q-07-003 had a 1-line drift — actual `form.tsx:41-45` vs
cited `:42-46`). A **4-agent adversarial Workflow** (one skeptic per finding, each told to refute the draft + hunt
the hidden risk) **overturned two drafts**, and the load-bearing claims were spot-verified at source before acting.
Partition: **4 in-scope → 4 closed (2 accepted, 2 resolved)**; 0 deferred / 0 unaccounted. **LOW 60 → 56 open.**

### ✅ Q-07-001 ACCEPTED (correct-by-design) + misleading comment corrected
- **Draft "add KaTeX (mirror ThinklingChat)" was REJECTED on evidence.** (1) remark-math 6 defaults
  `singleDollarTextMath:true`, so a generated resource with bare currency ("it costs $5 and another $10") would have
  "$5 and another $10" misparsed as inline math — a real regression on the exact content domain (math word problems,
  economics/budgeting worksheets). (2) The "silent math degradation" premise does not hold: the STEM corpus emits
  math as `\(...\)`/`\[...\]` (Siyavula `src/lib/sources/siyavula.ts:126`) or strips it entirely (OpenStax
  `src/lib/sources/openstax.ts:227`), and the prompt-builder OUTPUT GUIDELINES never instruct `$...$`
  (`src/lib/ai/prompt-builder.ts:136-138`). remark-math 6 parses ONLY `$...$`/`$$...$$` by default, so default-delimiter
  KaTeX would render ~zero real math while exposing the currency footgun; rehype-raw is an XSS risk on AI content.
- **The only genuine defect was the doc-comment**, which claimed parity with "ThinklingChat / HeartCheck" — but
  ThinklingChat (`ThinklingChat.tsx:13-15,129-131`) DOES use remark-math+rehype-katex; MarkdownContent does not.
  Replaced the comment (`MarkdownContent.tsx:7-16`) with an accurate one stating the intentional GFM-only / no-math /
  no-raw-HTML posture and why. **No behavioral change** (`remarkPlugins=[remarkGfm, remarkBreaks]` unchanged).

### ✅ Q-07-002 ACCEPTED (won't-fix) — intentional icon-library coexistence
- Two libs coexist in `src/components/ui/`: checkbox/select use `@phosphor-icons/react`; command/dialog/dropdown-menu/
  calendar/radio-group/combobox use `lucide-react`. **Repo-wide counts: Phosphor = 56 importer files (the de-facto
  house lib) vs lucide = 8** (6 ui primitives + `TranscriptBuilder` + a dead commented line in `DevotionalDisplay`).
  `components.json:13` declares `iconLibrary: lucide`, which is itself the misleading artifact.
- The original "bounded" idea (convert the 2 Phosphor primitives → lucide) was the **wrong direction** (toward the
  minority lib) and a visible app-wide change to two of the highest-traffic primitives for no functional gain; the only
  dependency-reducing direction (consolidate ONTO Phosphor, removing lucide) is a separate larger effort. For a LOW
  cosmetic finding in a doc session, owner chose **accept & close** — no code change; both libs unchanged.

### ✅ Q-07-003 RESOLVED — nullable-context fix to the dead null-guard
- `useFormField` ran `getFieldState(fieldContext.name, formState)` BEFORE `if (!fieldContext) throw …`, and
  `FormFieldContext` defaulted to `{} as FormFieldContextValue`, so `!fieldContext` was never true — the guard was
  doubly dead and the "useFormField should be used within <FormField>" error could never fire.
- Fix (canonical, chosen over the `if (!fieldContext.name)` half-fix which would keep the dishonest `{}` default):
  `FormFieldContext` default `{}` → **`null`**, typed `FormFieldContextValue | null` (`form.tsx:19`); moved the existing
  `if (!fieldContext)` guard **above** the `getFieldState` deref (`form.tsx:39-43`). The guard is now reachable AND TS
  narrows `fieldContext` to non-null so the subsequent `.name` access is type-honest — matching upstream shadcn's intent.
  Fully contained to `form.tsx` (`FormFieldContext` is module-private; `useFormField` is its only `useContext` reader;
  the Provider always supplies a value). Happy path unchanged.

### ✅ Q-07-009 RESOLVED — relative import swapped to the `@/` alias
- `SpecForm.tsx:15` imported the form stack via a relative `../../../components/ui/form` (every other ui import in the
  same file uses `@/…`), making it invisible to `@/components/ui/form` alias audits and fragile under file moves.
- Changed to `@/components/ui/form`. Verified **byte-identical target** (tsconfig `@/*` → `./src/*`, `moduleResolution
  bundler`; no `jsconfig`/webpack-alias override), **no circular import** (`form.tsx` imports only `@/lib/utils` +
  `@/components/ui/label`), zero behavioral change. The "single consumer" half is adoption state, NOT a defect:
  `form.tsx` is live — its sole consumer `SpecForm` renders in `CreationStationClient.tsx:83` + `CourseBuilder.tsx:778`
  — so no removal warranted. SpecForm is owned by ch.10, but the relative-path detail lived only in ch.07; no
  out-of-chapter finding moved.

### Verification
- `npx tsc --noEmit` = **0 errors**; `npm run lint` = **0 errors / 679 warnings** (unchanged from round 15 — the
  edits added no warnings); `npm test` = **85/85** across **16 files** (unchanged). `prisma/migrations/` **untouched**
  (the pre-existing `prisma/seed*.ts` churn is from Sessions 3–5, not this session). The only code changes are
  `MarkdownContent.tsx`, `form.tsx`, `SpecForm.tsx`. Nothing pushed.

### Reconcile (SKILL §4 partition)
- 4 in-scope findings → **Q-07-001 ✅ accepted + Q-07-002 ✅ accepted + Q-07-003 ✅ resolved + Q-07-009 ✅ resolved**;
  0 deferred / 0 unaccounted. **LOW 60 → 56 open.** Counts reconcile across ch.07 §7 (4 marked), ch.24 (line 169
  headline `56 LOW open` + LOW narrative `56 still open` + the Session-13 disposition note), and `00-INDEX.md`
  (`56 LOW open`). No new findings / re-grades / deferrals; no out-of-chapter sibling. **ch.07 now fully triaged**
  (LOW Session 13; ch.07 has no OPEN MED/HIGH).

---

## Session 2026-06-19 (round 17) — Session 14: ch.08 LOW findings (owner-approved)
Target = the 4 OPEN [LOW] in `08-ai-core.md §7` (Q-08-002 dead `config.ts` model-selection helpers; Q-08-003 dead
`utils/prompt-builder.ts` prompt builders + unused helper; Q-08-004 duplicated Thinkling rule line; Q-08-005
schema-enum typo). All four re-verified at their cited `file:line` (all reproduce; the config helpers carried a
+2-line drift, e.g. cited `:161` vs actual `:163`, from prior edits). A **4-skeptic adversarial Workflow** (one per
finding, read-only, told to refute the action + hunt a live consumer) confirmed three and flagged Q-08-005 — whose
"feature is broken / rename the enum to Overwhelmed" verdict was **overridden by hand** (it misread `generateObject`:
the Zod enum constrains the MODEL output, not the user's free-text questionnaire answer). Partition: **4 in-scope →
4 closed (2 removed, 2 resolved)**; 0 deferred / 0 unaccounted. **LOW 56 → 52 open.**

### ✅ Q-08-002 REMOVED — dead model-selection helpers in `config.ts`
- Deleted (all 0 code importers; only references were `config.ts` itself + the co-located doc): `getModelByComplexity`
  + its sole-consumer `TaskComplexity` enum (a forced tail), the three "legacy" helpers `getDefaultModel`/
  `getStructuredModel`/`getGenerativeUIModel`, and the retirement subtree `withRetirementFallback` + `isModelRetiredError`.
- Forced tails removed to keep tsc/lint clean: the `import { wrapLanguageModel, APICallError, NoSuchModelError } from "ai"`
  (used only by the retirement code), the `type GoogleModel` (only the retirement fn's param), the proModel comment's
  stale "withRetirementFallback … no longer needed" sentence, and the `getStructuredModel`/`getDefaultModel()` mentions
  in the `models.pro3`/`models.flash` comments.
- **Doc-currency tail (owner-approved):** `git rm src/lib/ai/model-selection.md` — the git-tracked source-tree doc
  documented the removed `getModelByComplexity`/`TaskComplexity` usage AND was independently stale vs code
  ("Gemini 3 Pro"/"four Gemini models" when `pro3` is `gemini-2.5-pro`). config.ts is self-documenting; same class as the
  README/scorecards the owner has been removing. No npm dep orphaned.
- KEPT (live, untouched): `models`, `AITaskType`, `taskModelMap`, `getModelForTask`, `getModelForTaskWithVideoCheck`,
  `containsYouTubeUrl`, the embedding exports.

### ✅ Q-08-003 REMOVED — dead internal-only prompt builders in `utils/prompt-builder.ts`
- Deleted the `@deprecated buildCompletePrompt` (0 external importers) and the three functions it was the sole caller of
  (`buildSpineAwarePrompt`/`buildPersonalizedPrompt`/`buildFamilyContextPrompt`), plus the never-referenced `calculateAge`
  and the unused local `type ObjectiveWithHierarchy`. The file now contains ONLY the live `buildMasterPrompt`.
- Forced tail: `import { db, withTenant } from "@/server/db"` became unused (it served only the deleted functions;
  `buildMasterPrompt` uses neither) → removed.
- The finding's stated concern — "personality-injection via this file is unreachable" — is moot: the LIVE personality
  injection runs through `buildMasterPrompt` → `getMasterContext` → `serializeMasterContext`/`context-serializer.ts`
  (which reads `personalityData`/`learningStyleData`), so removing the dead copy loses no behavior.

### ✅ Q-08-004 RESOLVED — de-duplicated the Thinkling system prompt
- `thinkling.ts:47-48` had "3. DO NOT LEAD WORSHIP" twice verbatim (the list read 1-2-3-3-4). Deleted the duplicate line;
  the list now reads 1-2-3-4. The system prompt is passed whole to `streamText` (nothing parses it by line/number), so the
  only effect is a correctly-numbered, slightly-shorter safety prompt.

### ✅ Q-08-005 RESOLVED — fixed the `contentDensity` enum typo
- `LearningStyleSchema.contentDensity` enum value `"Mirco-Learning"` → `"Micro-Learning"` (`personality.ts:47`).
- **Zero-risk, verified:** `generateObject` constrains the model's STRUCTURED OUTPUT to the enum; the user's wizard answer
  ("Overwhelmed", desc "Needs micro-learning chunks") is fed as prompt TEXT and the model maps it to this value — it is
  never validated against the enum, so nothing "breaks." Repo-wide grep found NO code matching either spelling as a literal
  (the value is only JSON-dumped into prompts via `thinkling.ts:33` + the master-context serializer; `master-context.ts:78`
  types `contentDensity` as a plain `string`). Already-stored rows keep the old spelling but nothing reads it as a literal,
  so no backfill is needed.
- **Adversarial override (recorded):** the Q-08-005 skeptic returned `refuted=true`, claiming the assessment feature is
  broken and the enum should be renamed to `"Overwhelmed"` to match the UI. That conflated user input with model output
  (see above) and would turn `contentDensity` into an emotional-state label instead of the structured text-density term;
  rejected. (Same class as Session 9/10: a schema validates shape, not substance — re-derive the agent's claim by hand.)

### Verification
- `npx tsc --noEmit` = **0 errors**; `npm run lint` = **0 errors / 677 warnings** (down from 679 — the deleted dead code
  carried ~2 warnings); `npm test` = **85/85** across **16 files** (unchanged). `prisma/migrations/` **untouched**.
  Touched paths (5): `src/lib/ai/config.ts` (M), `src/lib/ai/model-selection.md` (D), `src/lib/utils/prompt-builder.ts` (M),
  `src/lib/thinkling.ts` (M), `src/server/ai/personality.ts` (M). Nothing pushed.

### Reconcile (SKILL §4 partition)
- 4 in-scope findings → **Q-08-002 ✅ removed + Q-08-003 ✅ removed + Q-08-004 ✅ resolved + Q-08-005 ✅ resolved**;
  0 deferred / 0 unaccounted. **LOW 56 → 52 open.** Counts reconcile across ch.08 §7 (4 marked), ch.24 (line 169
  headline `52 LOW open` + LOW narrative `52 still open` + the Session-14 disposition note), and `00-INDEX.md`
  (`52 LOW open`). No new findings / re-grades / deferrals; no out-of-chapter sibling (all symbols were ch.08-local).
  **ch.08 LOW now done** (MED Q-08-001 remains; ch.08 has no HIGH).

---

## Session 2026-06-19 (round 18) — Session 15: ch.08 MED findings (owner-approved)

Source: the sole OPEN MED in `08-ai-core.md §7` — **Q-08-001** (two divergent prompt-builders, both live).
Re-verified at its `file:line` against current code; a **3-lens adversarial Workflow** stress-tested the
recommendation from source. Owner approved the converge fix. **Nothing pushed.**

### ✅ Q-08-001 RESOLVED — converged the guardrail surface of the two prompt-builders (no merge)
- **Re-verify sharpened the finding.** Post-Q-08-003 (Session 14, which deleted the dead utils builders) the
  "duplication/drift" framing was stale: `PHILOSOPHY_PROMPTS` + family/faith context are present in **both**
  paths — the class `PromptBuilder.setFamilyContext` (`prompt-builder.ts:68,80`) and `buildMasterPrompt` →
  `serializeMasterContext` (`context-serializer.ts:107-114`) — and the master-context path's student
  personalization (personality / learning-style / interests) is actually **richer**. The ONLY material
  divergence was that `buildMasterPrompt` opened with a bare `"You are an expert educator…"` and injected
  **no Inkling persona and no ethical guardrails**, while the class builder injects both. Confirmed the
  guardrails are supplied **nowhere downstream** (no `system` message at `grading-actions.ts:65/105` or
  `generate-tool.tsx:87`; `master-context.ts` / `config.ts` contain no persona text).
- **Impact (reproduced):** the two `buildMasterPrompt` consumers — **AI grading feedback** (`grading-actions.ts`,
  child-facing evaluative text) and the **generate-tool** generative-UI quiz/worksheet generator
  (`generate-tool.tsx`) — ran with none of the Inkling safety bounds (no-pastoral-care / no-simulacrum /
  draft-transparency / Nicene-orthodoxy / parent-led authority) that the resource-generation path enforces.
- **Fix (surgical, hand-edited):** in `src/lib/utils/prompt-builder.ts` — imported
  `INKLING_BASE_PERSONALITY` + `INKLING_ETHICAL_GUIDELINES` from `@/lib/constants/ai-guardrails` (line 3),
  replaced the bare opener with both constants **prepended above** the serialized context so the ethical
  bounds frame the family/student data (lines 54,56), and added an `Is presented as a draft for parental
  review` line to the trailing checklist (line 70). Both generation families now carry **identical,
  centrally-sourced** guardrails — a future guardrail change is made once, in `ai-guardrails.ts`.
- **Explicitly NOT a merge.** The two builders keep genuinely different I/O (sync Prisma-entity setters vs
  async ID→MasterContext aggregation) and are documented as two intentionally-separate back-ends that "share
  almost no code" (ch.10 §3). Consolidation would be a large, risky refactor for no behavioral gain; only the
  guardrail *surface* was converged.
- **Adversarial pass (3 lenses, split 2-1).** Two lenses (source-verification + right-sizing) returned
  FIX_NOW / converge / both-consumers / **MED**; both confirmed the gap could not be refuted and that token
  budget / duplicate-guardrail risk are non-issues. The steelman lens argued the persona's
  "professional / objective / **no first-person** / avoid 'I think/I feel'" block could fight the grading
  path's per-student `toneInstructions`/`feedbackStyle` warmth, and recommended re-grade-**LOW** + inject
  only a draft-transparency line (scope grading-OUT). **Owner override → full persona + guardrails on both
  consumers:** the `INKLING_ETHICAL_GUIDELINES` rule 4 (no-simulacrum / "not a friend or spiritual mentor")
  is in fact *protective* for child-facing feedback, the per-student `toneInstructions` still modulate voice,
  and excluding grading (the higher-stakes surface) from the safety bounds is backwards.

### Consequential doc-currency (code-is-truth, NOT new findings)
- **ch.09** — corrected stale `prompt-builder.ts:275 / :278 / :286-301` line refs (a **Session-14 residual**
  left when Q-08-003 shrank the file from ~310 → 64 lines) to the current `:38` (getMasterContext) / `:41`
  (serializeMasterContext) / `:53-71` (the template), and rewrote the "wrapped into the 'You are an expert
  educator…' template" description to reflect the new Inkling-persona+guardrails opener.
- **ch.10 §3** and **ch.18 §3** — noted that `buildMasterPrompt` now injects the shared guardrails (the
  generative-UI path and AI grading feedback carry the same safety bounds).
- **ch.08** — §1 scope rows (utils builder + ai-guardrails), §3 "Two prompt-builders" + persona sections, §4
  data-flow, §5 status rows (INKLING_* / buildMasterPrompt, also fixed stale `:247` → `:10`), §6 imports.

### 👤 Owner awareness (observed, NOT filed as a finding)
- `src/app/actions/suggest-blocks.ts` assembles its **own** prompt from `getMasterContext` /
  `serializeMasterContext` (it does not call `buildMasterPrompt`), so it is outside the two-builder scope and
  did **not** receive the Inkling guardrails. It generates course-**block suggestions** (structural
  scaffolding — not student/parent-facing generated content), so this was judged low-stakes and left as-is
  rather than minted as a new finding. If you want suggestion output guardrail-framed too, say so and it's a
  one-line addition (import the same constants).

### Verification
- `npx tsc --noEmit` = **0 errors**; `npm run lint` = **0 errors / 677 warnings** (unchanged — the edit adds
  no `any`/unused symbols); `npm test` = **85/85** across **16 files** (unchanged). `prisma/migrations/`
  **untouched**. Only source file touched: `src/lib/utils/prompt-builder.ts` (M). Nothing pushed.

### Reconcile (SKILL §4 partition)
- 1 in-scope finding → **Q-08-001 ✅ resolved**; 0 deferred / 0 unaccounted. **MED 28 → 27 open.** Counts
  reconcile across ch.08 §7 (Q-08-001 marked ✅), ch.24 (line 169 headline `27 MED open` + the `MED (27 open)`
  by-theme header + count-basis lineage `…→28→27` + the by-theme strike + the Session-15 disposition note),
  and `00-INDEX.md` (`27 MED`). No new findings / re-grades / deferrals; no out-of-chapter sibling *finding*
  (ch.09/10/18 edits are code-currency cross-refs only). **ch.08 now fully done** (LOW S14 / MED S15; no HIGH).

## Session 2026-06-20 (round 19) — Session 16: ch.09 LOW findings (owner-approved)

Resolved the five OPEN LOW findings in `docs/codebase-map/09-context-engine.md` §7. Re-verified each at its
cited `file:line` (all reproduced). A 10-agent adversarial Workflow (recommend→verify) ran on each; **two of
its outputs were overridden** after hand-verification (see below). Owner partition: **5 in-scope → 1 accepted ·
2 removed · 1 resolved · 1 kept-open**; 0 unaccounted.

### Q-09-002 ✅ ACCEPTED (correct-by-design) — no code change
- The bare `db.objective.findMany` in `getStudentContext` (`master-context.ts:486-505`) is intentional global
  academic-spine access: `Objective` has no `organizationId` (it's in `CONTEXT_FREE_MODELS`, `db.ts:39`) and the
  query is bounded by `courseIds` from a tenant-verified learner (the org guard at `master-context.ts:455`
  returns `null` on mismatch). No live vuln; closed.
- **Override:** the reco proposed adding a clarifying comment. The adversarial verifier refuted it and I agreed —
  the invariant is documented authoritatively at `db.ts:33-55`, and a `courseIds`-based comment would *mislead*
  (the binding is a relevance filter, not the tenant boundary; the sibling reads `master-context.ts:618/:685`
  read `Objective` with no course binding and no org check and are safe for the *same* global-data reason — a
  courseIds-pinned comment would imply they're unsafe). So: accept, no comment.

### Q-09-003 ✅ REMOVED — dead `bookPreferences` field + feeder query + producer
- `src/lib/context/master-context.ts`: deleted the `bookPreferences` field from the `StudentContext` interface,
  the `bookIds` `book.findMany` query that fed it, and the producer that mapped it to `{id, title:"", subject:""}`.
- Verified **zero readers** repo-wide (only the interface decl + the writer matched); the real book channel into
  the prompt is `LibraryContext.relevantBooks`, so no prompt/serializer behavior changed — only the debug
  `/api/context/inspect` JSON loses an always-blank array. Also removes a wasted per-call DB round-trip.

### Q-09-004 ✅ REMOVED — two dead context components
- `git rm src/components/context/ContextInspector.tsx src/components/context/ContextPreview.tsx`. Zero importers
  (the live `ContextInspectorClient` + `AIContextPreview` are different files that supersede them). `ContextInspector`
  also shipped a free-form-orgId anti-pattern (latent only — `inspect/route.ts` derives org from the session and
  ignores the body). Deletion orphaned nothing (their `ui/{card,button,input,label}` primitives are shared across
  100+ files).

### Q-09-005 ⏳ OPEN — re-documented as an unfinished feature (owner: keep the hook)
- No code change. Re-framed §7/§5 from "DEAD fields" to **unfinished feature**: the 5 `MasterContextParams` media
  ids (`courseBlockId/bookId/videoId/articleId/documentId`) are the **unbuilt context-injection half** of
  source-anchored generation. The *lineage* half is live (`generate-tool.tsx:131-134`/`:209-212` write
  `generatedFrom{Book,Video,Article,Document}Id`), but no sub-fetcher fetches the specific source's content into
  `MasterContext` (`getLibraryContext` does broad subject/strand relevance only). Owner is keeping the hook for a
  future/redesigned build (it's safely removable — ~4 mechanical tsc-safe files — but below the value bar for a
  LOW while the feature may be built).
- **Doc-currency:** fixed the stale evidence cite `prompt-builder.ts:268-272` → `:16-20`/`:31-35` (that file was
  shrunk to ~72 lines in Session 14, Q-08-003).

### Q-09-006 ✅ RESOLVED — rewrote `truncateContext` (order-preserving) + first unit tests
- `src/lib/context/context-serializer.ts`: replaced the truncation body with a **carry-forward section
  classifier**. Each headerless line inherits the section it appears under (so detail lines like `- Faith
  Background` and the injected `PHILOSOPHY_PROMPTS` blob stay with their FAMILY section), kept sections are emitted
  in **original document order**, and lowest-priority sections are shed first. Dropped the now-unused `context`
  param (and its single call site arg). The old code classified every headerless line `"other"` →
  `priorities.indexOf("other") === -1` → sorted FIRST, which hoisted detail lines above their headers and
  fragmented sections, *scrambling* the prompt whenever serialized context exceeded `maxTokens` (reachable: several
  live generators pass the 2000 default).
- **Override:** both agents proposed splitting on `"\n\n"` to keep the philosophy blob with its header. Hand-verification
  caught that the injection at `context-serializer.ts:108` pushes `\n` + a value that *itself* begins with `\n`,
  producing a *triple* newline inside the family block — `split("\n\n")` would have **fragmented** the family
  section and reclassified philosophy/faith as headerless `"other"`. The carry-forward approach is robust to this.
- **+3 unit tests** (`src/lib/context/context-serializer.test.ts`, the file's first coverage): under-cap returns
  unchanged & in priority order; truncation preserves order and never hoists a headerless line above its header;
  the lowest-priority section is shed first.

### Cross-chapter doc-currency (not new findings)
- ch.16 §41 NOTE: `_components/ContextCompleteness.tsx` → `_components/PersonalizationContextCard.tsx` (residual of
  the Q-09-007 rename, never propagated to ch.16).

### Verification
- `npx tsc --noEmit` = **0 errors**; `npm run lint` = **0 errors / 672 warnings** (down from 679 — the 2 deleted
  files + the unused vars removed from `truncateContext` shed 7); `npm test` = **88 passed / 17 files** (was 85/16;
  +3 tests / +1 file). `prisma/migrations/` **untouched** (the `prisma/seed*.ts` M/D entries are pre-existing
  Session 4/5 churn; `context-suggestions.ts`/`smart-defaults.ts` M are pre-existing Session 9). Source touched:
  `master-context.ts` (M), `context-serializer.ts` (M), `context-serializer.test.ts` (new), `ContextInspector.tsx`
  + `ContextPreview.tsx` (D). Nothing pushed.

### Reconcile (SKILL §4 partition)
- 5 in-scope → **1 accepted (Q-09-002) · 2 removed (Q-09-003, Q-09-004) · 1 resolved (Q-09-006) · 1 kept-open
  (Q-09-005)**; 0 unaccounted; 4 closed. **LOW 52 → 48 open.** Counts reconcile across ch.09 §7 (all 5 marked),
  ch.24 (line 169 headline `48 LOW open` + the LOW-narrative headline `48 still open` + the Session-16 narrative
  sentence + the Session-16 disposition note + the chapter-summary row), and `00-INDEX.md` (`48 LOW open`). No new
  findings / re-grades / deferrals; no out-of-chapter sibling *finding* (the ch.16 edit is code-currency). **ch.09
  LOW now done** (MED Q-09-001 remains; no HIGH).

## Session 2026-06-20 (round 20) — Session 17: ch.09 MED findings (owner-approved)

Resolved the sole OPEN MED finding in `docs/codebase-map/09-context-engine.md` §7 (**Q-09-001**). Re-verified at
its cited `file:line`. Owner partition: **1 in-scope → 1 resolved**; 0 unaccounted.

### Q-09-001 ✅ RESOLVED — corrected a stale tenant-threading comment; **no code change**
- The finding alleged tenant-threading drift between the maintainer NOTE in `src/server/queries/dashboard.ts`
  (`getParentDashboardData`) — *"analyzeContextCompleteness still queries via `db`; it is not yet tenant-threaded,
  so under RLS it returns empty until the full rollout"* — and the actual `analyzeContextCompleteness` code.
- **Re-verify proved the NOTE is stale, not a real gap.** Git: the NOTE was introduced at `8a79c8c`
  (2026-06-16) and the **next** commit `5a77836` ("route org/user-scoped reads through withTenant for the Next
  runtime", ~1.5h later, and an ancestor-then-descendant of the NOTE) threaded the tenant exactly as the NOTE
  said it was waiting for — but the comment was never updated. At HEAD `context-suggestions.ts` has **zero** bare
  `db.` calls.
- **Trace (hand + 2 independent adversarial RLS skeptics via Workflow, both high-confidence, each tasked to
  *prove the NOTE still true* — both failed):** every org-scoped query reachable from the dashboard's
  `analyzeContextCompleteness(organizationId)` call (no options object) runs via
  `withTenant(..., { organizationId, userId: null })` — `learner.count` (context-suggestions.ts:99),
  `course.count` (:139), `book.count` (:162), plus `organization.findUnique` (master-context.ts:262),
  `classroom.findFirst` (:874), and `videoResource.findMany` (:776) reached through `getMasterContext`. The only
  bare-`db` reads in the subsystem are `db.objective.*` (master-context.ts:481/589/656) — gated behind
  `studentId`/`objectiveId` (absent on this path, so unreachable) **and** `Objective` ∈ `CONTEXT_FREE_MODELS`
  (`db.ts:39`), so correct-by-design even if reached (global academic spine, no `organizationId` column). Calling
  the function *outside* the dashboard's own outer `withTenant` block is irrelevant — each inner `withTenant`
  opens its own GUC-stamped transaction (`db.ts:106-110`).
- **Fix (comment-only):** rewrote the NOTE to accurately state that `analyzeContextCompleteness` threads the
  tenant itself (`withTenant(..., { organizationId })`), is RLS-safe (returns correct org data, not empty), its
  only bare-`db` reads are the global academic spine, and that it sits outside the dashboard's own `withTenant`
  block because it opens its own transactions.
- **Severity:** over-graded MED for what is comment drift (the finding's own *"low real risk / no live vuln"*);
  the disposition skeptic put it at INFO. Resolved (not merely re-graded) — once the comment is corrected there is
  nothing left to track.
- **Cross-chapter:** `src/server/queries/dashboard.ts` is **owned by ch.16** (§1 scope), so this is a
  code-currency edit in a ch.16 file, but the finding stays owned by **ch.09** (MED count moves in ch.09/ch.24,
  not ch.16). ch.16's §5 `getParentDashboardData` row doesn't reference the NOTE, so no ch.16 doc edit was needed;
  no sibling finding exists elsewhere.

### Verification
- `npx tsc --noEmit` = **0 errors**; `npm run lint` = **0 errors / 672 warnings** (unchanged — a comment edit adds
  no warnings); `npm test` = **88 passed / 17 files** (unchanged). `prisma/migrations/` **untouched**. Source
  touched: `src/server/queries/dashboard.ts` (M, comment only). Nothing pushed.

### Reconcile (SKILL §4 partition)
- 1 in-scope → **1 resolved (Q-09-001)**; 0 unaccounted; 1 closed. **MED 27 → 26 open.** Counts reconcile across
  ch.09 §7 (Q-09-001 marked ✅ RESOLVED), ch.24 (line 169 headline `26 MED open` + the MED-by-theme header
  `MED (26 open)` + the lineage `…→27→26` + the new Session-17 count sentence + the struck theme-list entry + the
  Session-17 disposition note + the chapter-summary row), and `00-INDEX.md` (`26 MED`). No new findings / re-grades
  / deferrals; no out-of-chapter sibling *finding* (the `dashboard.ts` edit is code-currency in a ch.16-owned file).
  **ch.09 now fully triaged** (LOW S16 / MED S17; no HIGH).

## Session 2026-06-20 (round 21) — Session 18: ch.10 LOW findings (owner-approved)

Resolved the three OPEN LOW findings in `docs/codebase-map/10-resource-generation-creation-station.md` §7
(**Q-10-005, Q-10-006, Q-10-007**) and minted-and-resolved a new finding (**Q-10-011**) surfaced during
verification. Each finding re-verified at its cited `file:line` (all reproduce); a recommend→adversarial-verify
Workflow (Explore agents) corroborated each, and hand-verification of the verifier's new claims caught the new
bug. Owner partition: **3 in-scope → 2 resolved · 1 accepted**; +1 new minted-and-resolved; 0 unaccounted.

### Q-10-005 ✅ RESOLVED — re-documented as an unfinished feature; **no code change**
- Re-verify showed FILE upload is **unfinished**, not dead/superseded: a live entry point exists
  (`DocumentList.tsx:184` "Use in Generator" → `/creation-station?sourceType=FILE&sourceId={doc.id}`), and the
  `file`→`fileContent` `FileReader` is wired (`GeneratorsClient.tsx:112-120`). FILE dead-ends only because
  `setFile` never fires — the `FileUpload` component (`SimpleInputs.tsx:29`, imported `GeneratorsClient.tsx:19`)
  is never rendered (the FILE branch `:319-323` shows a static "coming soon" placeholder), so `fileContent` stays
  `""` and the `:147` gate blocks generation.
- Disposition: re-documented §5 (`FileUpload` row DEAD → **UNFINISHED**) and §7 (from "dead import + dead UI path"
  → "unfinished feature with a live entry point"). Completing it needs real file-content extraction (PDF/TXT/MD) —
  a backlog feature, not a finding. Mirrors Q-09-005 (Session 16). Owner chose keep + re-document (close), not remove.

### Q-10-006 ✅ ACCEPTED (by-design) — honest-incomplete, not broken; **no code change**
- The DEEP_VISION YouTube-playlist branch (`generate-resource-core.ts:642-651`, reachable when
  `kind.requiresVision` — `:280`, seeded via `needsVision()` `seed-generator-content-types.ts:175`) passes the
  playlist URL to `models.pro`. `models.pro` ≡ `models.pro3` ≡ `google("gemini-2.5-pro")` (`config.ts:11,15-16`),
  which the codebase documents as **the only Gemini model with native YouTube processing** (`config.ts:26,34,59`).
- So grounding relies on the model's native YouTube capability; the unwired `google_search_retrieval`/Vertex tool
  is a **noted future enhancement** (honest comment), not a silent defect. The finding's "silently degrades to
  ungrounded" impact is overstated. Same shape as Q-07-001 (trace the producer/model reality before "adding the
  tool"). Corrected the §5 status-row wording.

### Q-10-007 ✅ RESOLVED — deleted one genuinely-dead `any` variable; accepted the rest
- Deleted `let tools: any = {}` (was `generate-resource-core.ts:289`): assigned `{}`, **never read or reassigned**
  (a grep of `\btools\b` in the file shows only `:289` decl, a `:650` comment, and the `:729` *inline property* of
  the `generateText({ tools: {…} })` call — not this variable). Removing the line dropped **3** ESLint warnings on
  it (no-unused-vars / prefer-const / no-explicit-any): 672 → 669.
- The remaining `any` casts (Prisma nested-where union `:94`, AI-SDK `tool()` typing `:736/:742`, generic
  verify/revise over `jsonContent` `:755/:757`, `Resource.content` JSON `:773`) are real dynamic-boundary casts —
  **accepted** under the owner's `no-explicit-any` warn-ratchet (Q-01-004, ch.01).

### Q-10-011 ✅ RESOLVED (new) — fixed dropped `sourceId`/`url` deep-link params
- Surfaced while verifying Q-10-005. `GeneratorsClient.tsx` initialized `sourceId` from
  `searchParams.get("bookId")||"videoId"||"courseId"` only (`:52`) and `url` from `useState("")` (`:59`) — but
  **five** Living-Library list components deep-link to the generator with `?sourceType=X&sourceId=…` (ArticleList
  also `&url=…`): `BookList.tsx:125`, `VideoList.tsx:99`, `CourseList.tsx:95`, `DocumentList.tsx:184`,
  `ArticleList.tsx:167`. The `sourceId`/`url` params were silently dropped → those "Use in Generator" buttons
  opened the right tab with **no source pre-selected** (and for URL, core mis-used the article id as the URL via
  `generate-resource-core.ts:629` `url = additionalData.url || sourceId`).
- **Fix:** `:52` now also reads `searchParams.get("sourceId")`; `:59` lazy-inits `url` from
  `searchParams.get("url")` (zero-risk lazy initializers, same pattern as `sourceType` `:43` / `sourceId` `:51`).
- **Residual, noted (not fixed — beyond this LOW):** ParentDashboard's `?sourceType=TOPIC&topicText=…` quick-create
  links (`ParentDashboard.tsx:72/77`) still drop `topicText` (needs a `TopicSelector` initial-value prop, a
  moderate change to that component's internal state — flagged for a future session). RecommendedBooks'
  `studentId` (`RecommendedBooks.tsx:46`) has no consumer in the generator but is harmless (its `bookId` still
  pre-selects the book). Graded **LOW** (UX regression; no data/security impact).

### Verification
- `npx tsc --noEmit` = **0 errors**; `npm run lint` = **0 errors / 669 warnings** (was 672 — the dead-var removal
  dropped exactly the 3 expected warnings); `npm test` = **88 passed / 17 files** (unchanged). `prisma/migrations/`
  **untouched**. Source touched: `src/app/actions/generate-resource-core.ts` (M, deleted `:289`) +
  `src/app/creation-station/GeneratorsClient.tsx` (M, `:52`/`:59`). Nothing pushed.

### Reconcile (SKILL §4 partition)
- 3 in-scope → **2 resolved (Q-10-005, Q-10-007) · 1 accepted (Q-10-006)**; +1 new minted-and-resolved (Q-10-011);
  0 unaccounted; 3 pre-existing closed → **LOW 48 → 45 open**, total **74 → 75** (Q-10-011 added). Counts reconcile
  across ch.10 §7 (all four marked ✅) + §5 (FileUpload UNFINISHED, DEEP_VISION by-design rows), ch.24 (line 169
  headline `45 LOW open` + the LOW header `### LOW (75 total)` + the LOW-narrative headline `75 total … 45 still
  open` + the new Session-18 narrative sentence + the Session-18 disposition note + the chapter-summary row), and
  `00-INDEX.md` (`45 LOW open`). No re-grades / deferrals; no out-of-chapter sibling *finding* (the 5 library list
  components were already correct — the bug was in `GeneratorsClient`; no doc edits there). **ch.10 LOW now done**
  (MED Q-10-004/010 + HIGH Q-10-001/002/003 remain).

---

## Session 2026-06-20 (round 22) — Session 19: ch.10 MED findings (owner-approved)

Resolved the two OPEN MED findings in `docs/codebase-map/10-resource-generation-creation-station.md` §7
(**Q-10-004, Q-10-010**) and minted-and-resolved a new HIGH (**Q-10-012**) surfaced while tracing Q-10-010's
inbound path. Each MED finding re-verified at its cited `file:line` (both reproduce); a 4-skeptic
recommend→adversarial-verify Workflow challenged each recommendation — and **caught a regression in the
Q-10-004 draft** (see below). Owner partition: **2 in-scope → 1 resolved (Q-10-004) · 1 split (Q-10-010:
sub-claim 1 resolved, sub-claim 2 re-graded LOW + deferred)**; +1 new minted-and-resolved HIGH (Q-10-012);
0 unaccounted.

### Q-10-004 ✅ RESOLVED — corrected the dead+drifted validation schema and wired it
- Re-verify confirmed `generateResourceSchema` (`src/lib/schemas/actions.ts:109`) was **dead** (zero importers)
  **and drifted** vs `GenerateResourceCoreParams` (`generate-resource-core.ts:205-233`): its `sourceType` enum
  lacked the 5 SPINE levels and `additionalData` omitted `sectionNumber`/`subject`. `generate-resource.ts` did no
  validation.
- **Adversarial catch (high value):** the first-draft fix kept `additionalData.url = z.string().url()` — which
  would **reject scheme-less URLs** like `example.com/article` that work today (the URL field has no client
  validation and the core embeds the string verbatim into a prompt, `generate-resource-core.ts:626-631`). Relaxed
  `url` to a bounded plain string (no `.url()`).
- **Fix:** corrected the schema (full 12-value `sourceType` enum incl. `SUBJECT/STRAND/TOPIC_NODE/SUBTOPIC/OBJECTIVE`;
  `additionalData` gains `sectionNumber` + `subject`; `instructions`≤8000, `fileContent`≤200000, `url`/`topicText`
  bounded; `sourceId` stays `.min(1)` not `.uuid()`) and wired it via **`safeParse`** at the top of the
  browser-facing `generateResource` server action (`generate-resource.ts:32`). The Inngest compiler calls
  `generateResourceCore` directly via a local adapter (`compile-curriculum.ts:76-91`), so trusted background input
  is unaffected.
- **Value (re-anchored):** token-cost bounding + fail-fast on a bad `sourceType` (previously fell through every
  branch into a paid model call + DB write) + repo-wide Zod-at-boundary consistency (~40 other actions validate)
  + killing misleading dead code. The finding's *prompt-injection* impact was **overstated** (single-tenant
  self-injection — auth+org enforced, output returns to the same caller's org; no privilege boundary).
- **Test:** new `src/lib/schemas/actions.test.ts` (7 tests) shape-locks the contract — incl. all 5 SPINE types
  parse, `url` is NOT strict, non-UUID `sourceId` OK, bad `sourceType` rejected, over-cap `instructions` rejected.
- Files: `src/lib/schemas/actions.ts` (M), `src/app/actions/generate-resource.ts` (M), `src/lib/schemas/actions.test.ts` (new).

### Q-10-010 — split: sub-claim 1 ✅ RESOLVED, sub-claim 2 🔻 RE-GRADED LOW + ⏳ DEFERRED
- **Sub-claim 1 (plain-`db` write) ✅ RESOLVED:** wrapped both `db.resource.create` (`generate-tool.tsx:121,199`)
  in `withTenant((tx)=>tx.resource.create(...), undefined, {organizationId, userId})`, matching
  `generate-resource-core.ts:763` and the rest of the area. **Zero behavior change today** (RLS off → `withTenant`
  is a no-op with an explicit ctx) and the correct RLS-ready path. `db` import dropped (now `withTenant`-only).
- **Sub-claim 2 (unverified caller-supplied lineage ids) 🔻 RE-GRADED MED→LOW + ⏳ DEFERRED** with the ch.10 HIGH
  tenancy cluster (Q-10-001/002/003) + the RLS-cutover audit (Q-001). A 3-way adversarial trace (high-confidence)
  **refuted the "cross-org read leak" impact:** `getMasterContext` re-scopes `studentId` (`master-context.ts:450`
  → null cross-org), `objectiveId` is global `CONTEXT_FREE` spine, `getLibraryContext` returns only SESSION-org
  books/videos (a cross-org `courseId`'s name is discarded), and `bookId/videoId/articleId/documentId/courseBlockId`
  are NOT consumed by any sub-fetcher (the unfinished params of **Q-09-005**, ch.09). So **no cross-org data reaches
  the prompt or caller.** The residual is only that the 5 persisted lineage FK columns are written from caller ids
  with no same-org check — a low-value integrity/unverified-FK *write* (no read leak; FK checks bypass RLS even when
  flipped). Proper fix = a uniform org-ownership sweep across the whole ch.10 cluster, not a piecemeal patch
  (partial-sweep-worse-than-uniform). Stays tracked-OPEN at **LOW** (deferred ≠ closed).
- Files: `src/app/actions/generate-tool.tsx` (M).

### Q-10-012 ✅ RESOLVED (new HIGH, minted-and-fixed) — cross-org PII read on the generator page
- Surfaced while tracing Q-10-010's inbound path. `creation-station/[id]/page.tsx` sanitized
  `studentId`/`bookId`/`videoId` from `searchParams` and read `learner`/`book`/`videoResource` via `withTenant`
  `findUnique({where:{id}})` **with no app-layer org-match guard** (it didn't even select `organizationId`), then
  rendered another org's **student name** (`:219`), book title (`:247`), video title (`:257`). With RLS off this is
  a **live cross-org PII read** by URL param (same class as Q-10-001/002/003; the rest of the codebase guards these,
  e.g. `getStudentContext:450`). Owner chose **fix now**.
- **Fix:** each of the 3 reads now selects `organizationId` and nulls the row when
  `row.organizationId !== organizationId` (the codebase's standard app-layer tenant guard). NOTE: the page still
  forwards the raw URL-param ids to `GeneratorForm`→`generateLearningTool` — that lineage-id *write* path is
  Q-10-010 sub-claim 2 (deferred LOW), a separate surface.
- Graded **HIGH** (cross-tenant PII read), born-resolved this session → the "HIGH 10" open headline is **unchanged**.
- Files: `src/app/creation-station/[id]/page.tsx` (M).

### Verification
- `npx tsc --noEmit` = **0 errors**; `npm run lint` = **0 errors / 669 warnings** (unchanged — no new `any`/unused);
  `npm test` = **95 passed / 18 files** (+7 tests / +1 file — the new schema test). `prisma/migrations/`
  **untouched**. Source touched: `src/lib/schemas/actions.ts`, `src/app/actions/generate-resource.ts`,
  `src/app/actions/generate-tool.tsx`, `src/app/creation-station/[id]/page.tsx` (all M) + `src/lib/schemas/actions.test.ts`
  (new). Nothing pushed.

### Reconcile (SKILL §4 partition)
- **Pre-existing partition fix:** Q-10-010 (an original ch.10 MED) was **never folded into ch.24's MED by-theme
  canonical list** — the headline "26" undercounted; true open-MED was **27**. Documented in ch.24's count-basis note.
- 2 in-scope → **1 resolved (Q-10-004) · 1 split (Q-10-010: sub-claim 1 resolved + sub-claim 2 re-graded LOW)**;
  +1 new minted-and-resolved HIGH (Q-10-012); 0 unaccounted.
- **MED 27 → 25** (Q-10-004 resolved; Q-10-010 re-graded out of MED). **LOW 45 → 46 open, total 75 → 76** (Q-10-010
  residual re-graded in). **HIGH 10 open unchanged** (Q-10-012 born-resolved). Counts reconcile across: ch.10 §3/§4/§5/§7,
  ch.24 (MED headline `### MED (25 open)` + the count-basis lineage `…27→26→25` + the Session-19 reconcile note +
  the by-theme strike of Q-10-004 + the new Q-10-010-re-grade line + the HIGH table Q-10-012 row + HIGH header note
  + the LOW header `### LOW (76 total)` + the LOW-narrative `76 total … 46 still open` + the Session-19 LOW sentence +
  the ch.10 chapter-summary row), and `00-INDEX.md` (`25 MED · 46 LOW open`).
- Out-of-chapter: Q-10-010's no-leak conclusion **depends on** Q-09-005 (ch.09, the unconsumed media ids) — a
  code-currency cross-ref, no ch.09 finding moved. **ch.10 now fully triaged** (LOW S18 / MED S19; HIGH
  Q-10-001/002/003 + the deferred Q-10-010-LOW remain for the dedicated ch.10 HIGH/tenancy session).

---

## Session 2026-06-20 (round 23) — Session 20: ch.10 HIGH findings (owner-approved)

Resolved the three OPEN HIGH tenancy/IDOR findings in
`docs/codebase-map/10-resource-generation-creation-station.md` §7 (**Q-10-001, Q-10-002, Q-10-003** — the
ch.10 tenancy cluster). Each re-verified at its cited `file:line` (all three reproduce). A 3-skeptic
adversarial Workflow (one per finding, high-effort, each tasked to **refute** the proposed fix) returned
**FIX_AS_PROPOSED / zero-regression** on all three, and independently flagged that **Q-10-002/003 are not live
vulns** (correct app-layer enforcement already present → really MED, graded HIGH on cluster-membership), while
**Q-10-001 is a genuine live IDOR**. Owner partition: **3 in-scope → 3 FIX_NOW**; 0 unaccounted. Owner chose
*fix all 3 now*. This completes ch.10's slice of **Workstream B** (the per-query org-filter audit gating the
Q-001 RLS cutover, ch.24 §5).

**Key infra fact driving the fixes:** with RLS OFF (today), `withTenant` is a **no-op pass-through
transaction** — it adds **no** `organizationId` predicate (db.ts:106-110). So the only *live* tenant boundary
today is an explicit `where:{organizationId}` predicate or an app-layer ownership check; `withTenant` only
matters once RLS flips (it stamps the GUC the policies read).

### Q-10-001 ✅ RESOLVED — closed the live IDOR (real security fix)
- `getSourceMetadata` (`src/app/actions/generator-actions.ts`) had **no auth check at all** and read
  book/video/course by id on plain `db` with no org predicate → any authenticated user in org A could read org
  B's `subjectId`/`strandId` by guessing a UUID. **Live today** (RLS off → `db` is the bare client, db.ts:114).
- **Fix:** added a `getCurrentUserOrg()` auth+org gate (`:11-15`) and changed the 3
  `findUnique({where:{id}})` → `findFirst({where:{id, organizationId}})` (`:20,29,38`) so a cross-org id
  returns null → `{success:false}`. **No `withTenant`** — a single-op read; the explicit predicate is the live
  boundary with RLS off, and under an RLS flip the per-query extension wraps the op transparently (db.ts:115-131).
- The skeptic noted the payload is trivial (subjectId/strandId are themselves global CONTEXT_FREE reference ids)
  + UUID PKs make enumeration impractical — "informational-grade, not data-exfil-grade" — but a no-boundary,
  no-auth cross-tenant read keeps **HIGH**. Sole caller `GeneratorsClient.tsx:104` passes the user's own library
  id → legit same-org flow unaffected.
- Files: `src/app/actions/generator-actions.ts` (M).

### Q-10-002 ✅ RESOLVED — RLS-readiness hardening (no live vuln; really MED)
- `compileCurriculumAction` stamps `organizationId` on `curriculumSpec.create` from session (correct);
  `patchCurriculumAction` has an explicit `parent.spec.organizationId !== organizationId` check before its write
  (correct). So **no live cross-tenant exposure** today — the finding was over-graded HIGH on cluster-membership.
- **Fix (closes it regardless of grade):** wrapped spec.create + bundle.create in ONE
  `withTenant(..., {organizationId, userId})` tx in `compileCurriculumAction` (`:26-48` — now atomic, no orphan
  spec) and the ownership-check read + patch bundle.create in ONE `withTenant` tx in `patchCurriculumAction`
  (`:76-97`), **keeping the app-layer org check as the LIVE boundary**. `inngest.send` stays OUTSIDE both tx (a
  network call must not hold the DB connection; the worker reads the committed bundle asynchronously). `spec.id`
  → `bundle.specId` for the now-scoped Inngest payload. Zero behavior change today; RLS-ready, matching
  `explode-bundle.ts`/`generate-resource-core.ts:763`/the Q-10-010 fix. `db` import → `withTenant`.
- Files: `src/app/actions/compile-curriculum-action.ts` (M).

### Q-10-003 ✅ RESOLVED — RLS-readiness hardening (no live vuln; really MED)
- `suggestCourseBlocks` already has an explicit `course.organizationId !== organizationId` check before any
  write, and `CourseBlock` is org-scoped only via the verified-owned course → **no live cross-tenant exposure**.
- **Fix:** wrapped the ownership-check course read in `withTenant(..., {organizationId, userId})` (`:39-58`) and
  the CourseBlock create-loop in ONE `withTenant` tx (`:102-129`, now atomic), **keeping the app-check as the
  LIVE boundary** and the `generateObject` AI call OUTSIDE any tx (`:80-100` — must not hold a DB tx past
  Prisma's ~5s timeout). `db` import → `withTenant`; `userId` now destructured from `getCurrentUserOrg`. Zero
  behavior change today; RLS-ready, mirroring `explode-bundle.ts`.
- Files: `src/app/actions/suggest-blocks.ts` (M).

### Verification
- `npx tsc --noEmit` = **0 errors**; `npm run lint` = **0 errors / 669 warnings** (unchanged — no new
  `any`/unused); `npm test` = **95 passed / 18 files** (unchanged — the fixes are Prisma `where`/`withTenant`
  changes on server actions that have no DB in the test harness, so no meaningful unit test is feasible; matches
  the area convention — `generate-tool.tsx`/`explode-bundle.ts` likewise have none). `prisma/migrations/`
  **untouched**. Source touched: `src/app/actions/generator-actions.ts`, `src/app/actions/compile-curriculum-action.ts`,
  `src/app/actions/suggest-blocks.ts` (all M). Nothing pushed.

### Reconcile (SKILL §4 partition)
- 3 in-scope → **3 resolved (Q-10-001, Q-10-002, Q-10-003)**; 0 unaccounted. **HIGH 10 → 7 open** (all three
  were in the "HIGH 10" by-theme tally). MED/LOW unchanged (no re-grade applied — re-grading Q-10-002/003 to MED
  is moot since the fix closes them; the over-grade is recorded, not actioned). Counts reconcile across:
  ch.10 §7 (all three ✅) + §4/§6 line-refs, ch.24 (top-line `7 HIGH`, the `### HIGH (7 open)` header + its
  10→7 note, the by-theme table 3 strikes, the Hardening list strike, the Workstream-B strike, the ch.10
  chapter-summary row), and `00-INDEX.md` (`7 HIGH` headline + the HIGH-cluster line now `Q-14-001/004` only).
- **Consequential doc-currency (code-is-truth, not new findings):** the `withTenant` wraps shifted line numbers
  cited by sibling chapters — ch.02 §7 Q-013 evidence `compile-curriculum-action.ts:38,78` → `:42,91`
  (the `status:"COMPILING"` literals); ch.09 §3/§4/§5 `suggest-blocks.ts:54` → `:61` (the `getMasterContext`
  call, ×3 refs); ch.23 §5 producer `compile-curriculum-action.ts:43,83` → `:51,100`. All updated.
- No re-grades / deferrals / dismissals; no out-of-chapter *finding* moved (the sibling edits are line-ref
  currency only). **ch.10 now FULLY TRIAGED** (LOW S18 / MED S19 / HIGH S20); only the deferred Q-10-010-LOW
  rides with the RLS-cutover sweep (Q-001, ch.24 §5). Nothing pushed.

---

## Session 2026-06-20 (round 24) — Session 21: ch.11 LOW findings (owner-approved)

Resolved the 4 OPEN LOW findings in `docs/codebase-map/11-thinkling-chat.md` §7 (**Q-11-002, Q-11-003,
Q-11-004, Q-11-005**). Each re-verified at its cited `file:line` against current code (all reproduce; line
numbers had shifted from the `b585c1e` doc because Sessions for Q-11-006/007 already edited these files). No
sibling *findings* in other chapters — the 07/08/12 references are descriptive integration cross-refs. A
4-skeptic adversarial Workflow (one per finding, each tasked to refute the draft) confirmed all four
(`reproduces:true / draftSound:true / overEngineered:false / buildSafe:yes`) and sharpened three points
(below). Owner partition: **4 in-scope → 4 FIX_NOW** (3 resolved + 1 removed); 0 unaccounted.

### Q-11-002 ✅ RESOLVED — verbose request/PII logging + error leak (full cleanup, owner-approved)
- **Logging:** deleted the debug `console.log`s in `route.ts` (session email `:15`, full request JSON incl.
  student chat `:23`, model-defined ping `:26`, "StreamText: Starting" `:95`, two startup/unauth pings) and in
  `ThinklingChat.tsx` (finish-event, extracted-message, per-render "Rendering Assistant Message"). Kept both
  legitimate `console.error` handlers (widget `onError`, route `catch`) + a PII-free operational `console.error`
  on the 400 path.
- **Error leak (the real security win):** the 500 now returns a generic `{ error: "Internal Server Error" }` —
  removed **BOTH** `error.stack` AND `details` (`details`=`error.message`, which for this catch wrapping
  `getContextForThinkling`/`db`/`inngest`/prompt-assembly could surface DB/tenancy/internal-prompt text to a
  student's browser). The stack is logged server-side only. The 400 no longer echoes `received: json` + `params`.
- Adversarial refinement (overrode draft's "stack OR details"): remove **both**; and simplify the 400. Conscious
  trade noted: this also removed the only diagnostics for the known "blank assistant message" render workaround —
  acceptable for a PII finding.
- Files: `src/app/api/chat/route.ts` (M), `src/components/thinkling/ThinklingChat.tsx` (M).

### Q-11-003 ✅ RESOLVED — dead `apiUrl` + stale options + unreachable route fallback (owner: "also delete the route fallback")
- Removed the dead `const apiUrl` + its rationale comment + the stale commented-out `api:`/`body:` options
  (including a duplicated line) from `ThinklingChat.tsx`.
- Also removed the route's query-param fallback (`route.ts:29-33` old) — independently confirmed the **sole**
  caller of `POST /api/chat` is `ThinklingChat`'s `useChat` (default endpoint), which always sends
  `studentId`/`mode` in the `sendMessage` body, so the fallback was unreachable. The route now reads them only
  from the body; the 400 still fires if missing. (The adversary recommended keep-and-document; owner chose delete.)
- Files: `src/app/api/chat/route.ts` (M), `src/components/thinkling/ThinklingChat.tsx` (M).

### Q-11-004 ✅ RESOLVED — ModeSelector / ThinklingMode drift (owner-approved)
- Removed the unused `Scales` phosphor import (a live `@typescript-eslint/no-unused-vars` warning) and added
  `as const satisfies readonly { id: ThinklingMode; label: string; description: string; icon: Icon; color: string;
  bg: string }[]` to `MODES`, so a **renamed/mistyped** mode id now fails compilation. (`satisfies` does not
  enforce exhaustiveness — adding a 4th union member still compiles with 3 entries; scoped the claim accordingly.)
  The `mode.id as ThinklingMode` cast is now redundant but harmless; left in place. The "label vs prompt"
  sub-claim does **not** reproduce (labels align with the `thinkling.ts:91-114` prompt switch).
- Files: `src/components/thinkling/ModeSelector.tsx` (M).

### Q-11-005 ✅ REMOVED — `src/lib/types/tools.ts` entirely dead
- `git rm src/lib/types/tools.ts` (~80 lines of unused Zod "generator/tool" schemas). Zero importers confirmed
  (static/dynamic/barrel/config/test); the only repo-wide mentions were the file itself + the docs (the
  `getAvailableTools` in `server/queries/curriculum.ts:9` is an unrelated symbol). No npm dep orphaned (`zod` used
  repo-wide); no env vars. The "wire-it-instead" keep-case collapses (the live generator pipeline uses its own
  schemas; git preserves it if ever needed).
- Files: `src/lib/types/tools.ts` (D).

### Verification
- `npx tsc --noEmit` = **0 errors** (the `as const satisfies … icon: Icon` annotation type-checks); `npm run lint`
  = **0 errors / 666 warnings** (down from 669 — removed the unused `Scales` import + dead code); `npm test` =
  **95 passed / 18 files** (unchanged — these are server-action/RSC + a client widget with no DB/render harness, so
  no meaningful unit test is feasible; matches the area). `prisma/migrations/` **untouched** (the `prisma/seed*.ts`
  entries in `git status` are pre-existing from Sessions 4/5, not this session). Source touched:
  `src/app/api/chat/route.ts` (M), `src/components/thinkling/ThinklingChat.tsx` (M),
  `src/components/thinkling/ModeSelector.tsx` (M), `src/lib/types/tools.ts` (D). Nothing pushed.

### Reconcile (SKILL §4 partition)
- 4 in-scope → **3 resolved (Q-11-002/003/004) + 1 removed (Q-11-005)**; 0 unaccounted. **LOW 46 → 42 open**
  (total still 76 — no new findings). MED Q-11-001 (raw-`db` tenancy guard) stays OPEN — its evidence line-refs
  refreshed `:51/:52` → `:34/:35` for the route cleanup (currency, not a disposition). Counts reconcile across:
  ch.11 §7 (all 4 marked ✅) + §1/§3/§4/§5/§6 currency, ch.24 (top-line `42 LOW open`, the `### LOW (76 total)`
  "42 still open", the LOW prose-log Session-21 closure, the ch.11 chapter-summary row), and `00-INDEX.md`
  (`42 LOW open` headline + the ch.11 chapter-list row de-listing the removed tool schemas).
- **Consequential doc-currency (code-is-truth, not new findings):** the route cleanup shrank `route.ts` 116→94
  lines, shifting line numbers cited by sibling chapters — ch.08 §5 `getContextForThinkling` used `route.ts:56`
  → `:39`; ch.12 §4 safety-event `route.ts:74-85` → `:54-76` and §6 emit-point `route.ts:75` → `:63`. All updated.
- No re-grades / deferrals / dismissals; no out-of-chapter *finding* moved (sibling edits are line-ref currency
  only). **ch.11 now LOW done** (MED Q-11-001 remains; no HIGH). Nothing pushed.

## Session 2026-06-20 (round 25) — Session 22: ch.11 MED findings (owner-approved)

Target: the sole OPEN [MED] in `11-thinkling-chat.md` §7 — **Q-11-001** (the Thinkling chat route's tenancy
guard reads the target learner on the raw `db` client and relies solely on the app-layer `student.organizationId
!== organizationId` comparison; with RLS off that one line is the only live tenant boundary). Re-verified at its
cited `file:line` (`route.ts:34/:35`) — reproduces exactly. No sibling in another chapter; Q-11-001 is correctly
present in ch.24's MED by-theme tally (so closing it moves the headline, not a hidden count).

### Q-11-001 ✅ RESOLVED — folded the org filter into the chat-route learner read
- **Fix** (`src/app/api/chat/route.ts`): replaced `db.learner.findUnique({ where:{ id: studentId }, select:{
  organizationId: true } })` + the droppable post-fetch `if (!student || student.organizationId !== organizationId)`
  with `db.learner.findFirst({ where:{ id: studentId, organizationId }, select:{ id: true } })` + `if (!student) →
  403` (route.ts:39-45). The org predicate now lives **inside** the query — the live tenant boundary with RLS off
  (db.ts:9, `withTenant` is a no-op that adds no predicate, db.ts:106-110) and RLS-ready — so it can't be silently
  dropped without breaking the lookup. Also added a fail-closed `if (!organizationId) → 403` guard (route.ts:36-38)
  the old code lacked (it had 403'd a null-org caller only "by luck" of `Learner.organizationId` being non-nullable,
  schema.prisma:282); that guard narrows `organizationId` to `string`, so the now-redundant `!` on the safety-event
  `organizationId` (route.ts:78) was dropped — a strict type-safety improvement.
- **No `withTenant`** — a single-op read takes the explicit predicate (mirrors Q-10-001/`getSourceMetadata`,
  Session 20; `withTenant` would be over-engineering for a lone read *and* a no-op with RLS off, so it would NOT
  have closed the finding). **Behavior identical** on every input: cross-org → 403, non-existent id → 403, null-org
  caller → 403 (now via the explicit guard instead of the `!==`); 401/400 gates untouched.
- **Adversarial pass:** a 4-lens refute Workflow (behavior-equivalence / downstream-dependency / convention /
  grade-disposition) was **unanimous `fix_now_as_proposed`** — verified `student.organizationId` (:35) was the sole
  field access on `student` (so narrowing `select` to `{id:true}` breaks nothing), the dropped `!` is covered by the
  new guard, `getContextForThinkling(:47)` still typechecks on the narrowed `string`, and the withTenant alternative
  was explicitly refuted (relocates the same vapor-boundary defect).
- **Grade note:** the finding said "correct today," so it leaned MED-bordering-LOW (defense-in-depth) — but the fix
  is cheap, zero-behavior-change, and *materially* resolves the concern (the org filter is no longer a droppable
  line), so **fix-and-close beat re-grade-and-keep-open**; no re-grade actioned.
- Files: `src/app/api/chat/route.ts` (M).

### Verification
- `npx tsc --noEmit` = **0 errors**; `npm run lint` = **0 errors / 666 warnings** (unchanged from Session 21 — the
  `!` removal and `findUnique`→`findFirst` swap are lint-neutral); `npm test` = **95 passed / 18 files** (unchanged —
  this is a server-route Prisma `where` change with no DB in the test harness, so no unit test is feasible; matches
  the area, cf. Session 20). `prisma/migrations/` **untouched** (the `prisma/seed*.ts` entries in `git status` are
  pre-existing from Sessions 4/5). Source touched: `src/app/api/chat/route.ts` (M). Nothing pushed.

### Reconcile (SKILL §4 partition)
- 1 in-scope → **1 resolved (Q-11-001)**; 0 unaccounted. **MED 25 → 24 open** (HIGH 7 / LOW 42 unchanged; total
  76 — no new findings). Counts reconcile across: ch.11 §7 (Q-11-001 ✅) + §3/§4/§5 currency, ch.24 (top-line
  `24 MED open`, the `### MED (24 open)` header, the `…25→24` lineage + Session-22 count sentence, the struck
  theme-list entry, the ch.11 chapter-summary row), and `00-INDEX.md` (`24 MED`).
- **Consequential doc-currency (code-is-truth, not new findings):** the fix grew `route.ts` 94→102 lines (+8),
  shifting line numbers cited by sibling chapters — ch.08 §5 `getContextForThinkling` `route.ts:39` → `:47`; ch.12 §4
  safety-event `route.ts:54-76` → `:62-84` and §6 emit-point `route.ts:63` → `:71`; ch.23 §4 dataflow + §5
  `scanMessage` producer `chat/route.ts:75` → `:71` (both spots; this also fixed a pre-existing staleness — Session
  21 had moved ch.12's cite to `:63` but not ch.23's). Also refreshed ch.11's own §3/§4/§5 cites. All updated.
- No re-grades / deferrals / dismissals; no out-of-chapter *finding* moved (sibling edits are line-ref currency
  only). **ch.11 now FULLY TRIAGED** (LOW S21 / MED S22; no HIGH). Nothing pushed.

---

## Session 2026-06-20 (round 26) — Session 23: ch.12 LOW findings (owner-approved)

Target: the three OPEN [LOW] in `12-safety.md` §7 — **Q-12-002** (dead `recommendedResolution`), **Q-12-005**
(`sendSafetyAlert` raw `db`), **Q-12-006** (hard-stop duplicated policy↔job). All three re-verified at their
cited `file:line` — all reproduce. A 3-skeptic adversarial Workflow (one per finding, each tasked to refute)
returned **FIX_AS_PROPOSED** on all three with no material overrides. Owner approved all 3 as proposed.

### Q-12-002 ✅ REMOVED — dead `recommendedResolution` field
- The LLM was asked for a suggested action (`safetySchema`, guard.ts:18-25) and `SafetyAssessment` carried it
  (types.ts:23), but grep confirmed **zero readers** — `decideSafetyResolution` derives the resolution
  deterministically and `safety-scan.ts` stores/acts only on that derived value.
- **Fix:** deleted the field from both `safetySchema` (guard.ts) and `SafetyAssessment` (types.ts). **REMOVE over
  WIRE was deliberate** — `policy.ts` is an intentionally-deterministic "Minimum Social Responsibility" matrix;
  wiring the model's freeform pick could bypass the caregiver hard-stop and email the feared caregiver. tsc-safe
  (the regex fast-path + error fallback already build the assessment without the optional field). No prompt edit
  needed (the prompt never mentioned it). Files: `src/lib/safety/guard.ts` (M), `src/lib/safety/types.ts` (M).

### Q-12-005 ✅ RESOLVED — `sendSafetyAlert` read/update onto explicit-ctx `withTenant` + explicit org predicate
- **No live vuln** (sole caller is the trusted Inngest job, self-scoping by the flag's own org relation; grep
  confirms `safety-scan.ts:104` is the only call site). The real reason to fix is **RLS-readiness**: this was the
  ONE safety-pipeline DB op not using the explicit-ctx `withTenant` pattern the rest of the job uses
  (safety-scan.ts:43-54 findMany, :84-100 create), so at the future RLS cutover it could **silently fail-closed
  (no caregiver alert)** if the extension can't see the job's `setRlsContext` (db.ts:103-105 declares that
  AsyncLocalStorage propagation unreliable in this runtime → `resolveTenant()` null → query runs GUC-unset →
  RLS policy fails closed → flag read returns null → "Flag not found", no alert).
- **Fix** (`src/lib/notifications/safety-alert.ts`): threaded `organizationId` from the job into
  `sendSafetyAlert(flagId, organizationId)`; the read is now
  `withTenant((tx)=>tx.safetyFlag.findFirst({ where:{ id: flagId, student:{ organizationId } }, include:{…} }),
  undefined, { organizationId, userId: null })` (safety-alert.ts:30-46) and the `alertSent` update is wrapped the
  same way (safety-alert.ts:157-161); `import { db }` → `import { withTenant }` (db had no other use).
- **`SafetyFlag` has no org column** of its own — it scopes via the `student` (Learner) relation. The explicit
  predicate `student:{ organizationId }` is the live boundary today (RLS off) and mirrors the RLS policy
  `student_id IN (SELECT id FROM students WHERE account_id = current_org)` (migration 00000000000002, safety_flags).
  `findUnique`→`findFirst` is mandatory (compound non-unique `where`) and behavior-identical for the real caller
  (flagId is the PK; org always matches the just-created flag). The fail-loud guards + alertSent gating still all
  run before the wrapped update (unchanged control flow).
- **Adversarial pass** confirmed the silent-fail-closed risk is real (not eliminated by `setRlsContext`), that
  both the explicit predicate AND the `withTenant` wrap are required (minimal-correct), and `LOW` is right (no
  live exploit). Files: `src/lib/notifications/safety-alert.ts` (M), `src/inngest/functions/safety-scan.ts` (M, the
  call site).

### Q-12-006 ✅ RESOLVED — caregiver hard-stop centralized into one shared predicate
- The "never notify when caregiver implicated OR disclosureRisk HIGH" invariant was encoded at `policy.ts:14` and
  again (negated) as a guard at `safety-scan.ts:36-37`. The job comment (safety-scan.ts:28-31) documents the
  redundancy as intentional (escalation could otherwise upgrade `STUDENT_OPTIONAL_OUTREACH` → `PARENT_SUMMARY_*`).
- **Fix:** extracted `isCaregiverHardStop(Pick<SafetyAssessment,"implicatedCaregiver"|"disclosureRisk">)` in
  `policy.ts` (policy.ts:10-14) — the single source of truth — and called it at both sites:
  `decideSafetyResolution` (policy.ts:27, `if (isCaregiverHardStop(assessment))`) and the job's escalation guard
  (safety-scan.ts:36, `!isCaregiverHardStop(result)`; extended the existing `policy` import, no new import line).
  Behavior-identical by De Morgan (`!implicatedCaregiver && disclosureRisk!=="HIGH"` ≡ `!(implicatedCaregiver ||
  disclosureRisk==="HIGH")`).
- **Defense-in-depth preserved:** there are still TWO independent runtime re-checks on the **raw assessment
  fields** (the predicate takes raw fields via `Pick`, not the resolution string), so centralizing only the boolean
  *definition* removes literal drift without weakening the independent re-check. The job's explanatory comment is
  kept verbatim. Files: `src/lib/safety/policy.ts` (M), `src/inngest/functions/safety-scan.ts` (M).

### Verification
- `npx tsc --noEmit` = **0 errors** (first pass caught my initial `where:{ id, organizationId }` — `SafetyFlag` has
  no org column — corrected to the `student:{ organizationId }` relation predicate); `npm run lint` = **0 errors /
  666 warnings** (unchanged from Session 22 — removing a dead Zod enum + adding a predicate/withTenant wrap is
  warning-neutral); `npm test` = **95 passed / 18 files** (unchanged — server-side Prisma `where`/`withTenant`
  changes with no DB in the test harness, so no unit test is feasible; matches the area). `prisma/migrations/`
  **untouched** (the `prisma/seed*.ts` entries in `git status` are pre-existing from Sessions 3–5). Source touched
  (5 files, all M): `src/lib/safety/{guard,types,policy}.ts`, `src/lib/notifications/safety-alert.ts`,
  `src/inngest/functions/safety-scan.ts`. Nothing pushed.

### Reconcile (SKILL §4 partition)
- 3 in-scope → **3 closed (Q-12-002 removed · Q-12-005 resolved · Q-12-006 resolved)**; 0 deferred / re-graded /
  dismissed; 0 unaccounted. **LOW 42 → 39 open** (MED 24 / HIGH 7 unchanged; total 76 — no new findings). Counts
  reconcile across: ch.12 §7 (the three dispositions) + §3/§4/§5/§6 currency, ch.24 (top-line `39 LOW open`, the
  `### LOW (76 total)` header `39 still open`, the running LOW prose-log Session-23 sentence), and `00-INDEX.md`
  (`39 LOW open`).
- **Consequential doc-currency (code-is-truth, not new findings):** the three edits shifted line numbers across the
  safety files — `guard.ts` −8 lines (field removal), `policy.ts` +13 (predicate), `safety-scan.ts` −1 (guard
  collapse), `safety-alert.ts` +14 (withTenant wraps). Refreshed every cite in **ch.12 §3/§4/§5/§6** and the
  still-OPEN higher-grade findings' own evidence cites (**Q-12-001** [HIGH] guard.ts:167-182→:159-174; **Q-12-003**
  [MED] guard.ts pattern table + policy.ts:14-66→:27-79; **Q-12-004** [MED] guard.ts:91-103/44-48/97→:83-95/36-40/89)
  — currency, NOT re-grades (findings stay OPEN). Sibling **ch.23 §4** safety-scan trace refreshed (line refs +
  `isCaregiverHardStop` + `sendSafetyAlert(flag.id, organizationId)` + the withTenant note) — code-currency only, NO
  new ch.23 finding, NO ch.23 count change. ch.02's `SafetyFlag` row never listed `recommendedResolution` (not a DB
  column) → no ch.02 edit.
- No new findings / re-grades / deferrals / dismissals. **ch.12 LOW now done** (MED Q-12-003/004 + HIGH Q-12-001
  remain for later grade-ascending sessions). Nothing pushed.

---

## Session 2026-06-20 (round 27) — Session 24: ch.12 MED findings + owner child-safety hardening brief (owner-approved)

Source: the 2 OPEN MED in `12-safety.md §7` (Q-12-003, Q-12-004). Re-verified each at its `file:line`; ran a
6-lens + completeness-critic adversarial Workflow; hand-derived every load-bearing claim. The owner answered the
Q-12-003 scope question with a full **Tier-1/2/3 child-safety remediation brief** — I re-scoped (per SKILL §9.3:
several brief items collide with the session's hard rules — Prisma schema, legal `[DECISION]`, a multi-file feature
build, verified crisis resources) and the owner confirmed: do the **app-layer, no-schema, no-legal subset** now +
mint the rest as findings + a roadmap. **CI green: `tsc --noEmit` 0 errors · `eslint` 0 errors / 666 warnings ·
`vitest` 117/117 (21 files, +3 / +22 tests).** `prisma/migrations/` untouched. Nothing pushed.

### Resolved (2 MED)
- ✅ **Q-12-003** [MED] — **urgent-notify routing made severity-label-INDEPENDENT.** Re-verify REFUTED the
  finding's literal "switch `default` (policy.ts:77) → INTERNAL_LOG_ONLY downgrade" (dead code — the 6-value Zod
  enum is fully cased, default unreachable) and SHARPENED the real defect to **policy.ts:44-49**: the urgent
  self-harm/violence branch gated on `severity ∈ {TIER_1,TIER_2}`, but the classifier prompt gives the model NO
  severity-vocabulary guidance, so a real first-time self-harm PLAN labeled `"CONCERN"` skipped the urgent branch
  → `STUDENT_OPTIONAL_OUTREACH` (no parent notify). **Fix:** rewrote the branch (policy.ts:43-54) to key urgency on
  `(category ∈ {SELF_HARM,VIOLENCE}, evidenceLevel ∈ {INTENT,PLAN,ACTION,VICTIM_DISCLOSURE}, target ∈ {SELF,
  OTHER_CHILD})` — dropped the severity-label condition and added `INTENT` (the brief's T1-C app-layer half).
  Strictly fail-safe (only ADDS urgent notifications; the caregiver hard-stop at policy.ts:27 still strictly
  precedes). +`policy.test.ts` (8 cases incl. hard-stop precedence). The DB `String`→enum typing + ontology collapse
  stays **deferred** with ch.02 **Q-013**. Also corrected the stale plain-`//` comments at schema.prisma:323/324/329
  + the ch.02:72 doc line to the real vocabularies (code-currency; no migration). Files: `src/lib/safety/policy.ts`,
  `prisma/schema.prisma` (comments only), `docs/codebase-map/02-data-model.md`, `+policy.test.ts`.
- ✅ **Q-12-004** [MED] — **academic whitelist scoped per-pattern.** Re-verify confirmed: a single benign academic
  word (`project`/`homework`/`class`/`book`) anywhere nulled the whole regex fast path ("for my project, I want to
  kill myself" → null → relies on the fail-open LLM, Q-12-001). The finding's own span-scope idea was empirically
  refuted (window still leaks); blanket exemption floods (`suicide` matches "article about suicide rates"). **Fix:**
  added `exemptFromWhitelist` to `SafetyPattern`; split the self-harm patterns so explicit FIRST-PERSON phrases
  (`kill myself`/`end my life`/`want to die`, `hurt myself`/`cut myself`/`cut my wrists`) + the explicit abuse/incest
  ACTION disclosure are whitelist-exempt, while bare `suicide`/`self-harm`, the violence-threat, and incest-THOUGHT
  stay gated; whitelist now applied per-pattern in the loop (was a blanket early-return); negation kept whole-message.
  INCEST exemption added per owner. +`guard.test.ts` (8 cases incl. no-flood + hard-stop → SUPPORTIVE_ONLY).
  `SafetyRegexEngine` exported for the test. **Residuals (documented, not fixed):** negation false-null
  ("I don't want to kill anyone but myself"); bare-`suicide`/violence stay academic-gated by design; the dominant
  risk is Q-12-001's fail-open. Files: `src/lib/safety/guard.ts`, `+guard.test.ts`.

### Hardening add (no finding) — T1-E delivery-layer hard-stop
- ✅ **T1-E** — `sendSafetyAlert` now refuses to email unless `isAlertDeliverable(flag)` (resolution ∈
  {PARENT_SUMMARY_URGENT, PARENT_SUMMARY_SAFETY_COACH} AND `!implicatedCaregiver`). Defense-in-depth at the delivery
  boundary so a caller bug can never email an implicated caregiver. `isAlertDeliverable` is a pure exported predicate
  (safety-alert.ts:13-27) + guard (:69-81); +`safety-alert.test.ts` (5 cases). NOTE: `SafetyFlag` doesn't persist
  `disclosureRisk`, so that hard-stop axis can't be re-checked here (rides the storage hardening item). Files:
  `src/lib/notifications/safety-alert.ts`, `+safety-alert.test.ts`.

### Minted from the child-safety hardening brief (owner, 2026-06-20)
The brief spans far beyond this session; mapped each Tier item to existing/new findings + a §5 roadmap. `[DECISION]`
= legal/policy, no code without written sign-off.
- **Q-12-007** [HIGH] (T1-D + T1-F) — no in-the-moment child-facing safety layer; 4 of 6 resolutions inert; no
  output scan / pre-check / persistent crisis affordance; bot-promise gap. Evidence: route.ts:62-93, safety-scan.ts:108-110.
- **Q-12-008** [MED] (T1-B) — regex fast-path fabricates `target:"SELF"`/`relationshipToTarget:"OTHER"`/`coercion:"NONE"`
  (guard.ts:150-152) → misroutes violence-toward-others + sibling abuse. (Supersedes the critic's NEW-B.)
- **Q-12-009** [MED] (T1-G) — child disclosure 100-char snippet stored org-readable for hard-stop flags (safety-scan.ts:91); latent (no UI reader today).
- **Q-12-010** [MED] (T1-H) — a dropped `inngest.send` safety enqueue is only logged (route.ts:81-83); no durable fallback → sole signal lost.
- **Q-12-011** [MED] (T2-A) — scanner gets one message, no conversation context (route.ts:75) → multi-turn grooming/coercion invisible.
- **Q-12-012** [MED] (T2-C) — prompt-injection: untrusted student text interpolated unfenced into the classifier (guard.ts:190) + Thinkling prompts.
- **Q-12-013** [LOW] (T2-B + T3-A/B/C) — type/contract cleanups: unused `ageGap` + always-`NONE` regex `coercion`; `SafetyAssessment` drifts from the Zod schema; unused `isSafe`; dual-use `reasoning`.
- **Roadmap-only:** T1-A = existing **Q-12-001** (fail-open, refine). T1-C = **Q-12-003** ✅. T2-D `[DECISION]` mandated-reporting (legal). T3-F eval harness / second classifier (measurement gap). Resources must be verified/current/non-US-inclusive.

### Reconcile (§4 partition)
- **MED:** 24 − 2 (Q-12-003, Q-12-004 closed) + 5 (Q-12-008/009/010/011/012 minted) = **27 open**.
- **HIGH:** 7 + 1 (Q-12-007) = **8 open**. **LOW:** 39 + 1 (Q-12-013) = **40 open** (76 → **77 total**).
- Updated in lockstep: ch.12 §3/§4/§5/§7, ch.02 (Q-013 note + §72 row), ch.24 (headline, safety status row, §5 roadmap
  brief, HIGH table + header, MED header/lineage/by-theme, LOW log), 00-INDEX glance. Partition: 2 in-scope MED → 2
  resolved; 7 new findings minted; 0 unaccounted; counts reconcile across §7 / ch.24 / 00-INDEX / this log.

## Session 2026-06-20 (round 28) — Session 25: ch.12 HIGH findings (owner-approved)

Source: the 2 OPEN HIGH in `12-safety.md §7` — **Q-12-001** (LLM deep-path fails OPEN) and **Q-12-007** (no
in-the-moment child-facing safety layer). Re-verified each at its `file:line` (both reproduce). Ran a 3-lens
adversarial Workflow per finding (6 agents, each reading the actual files) — **unanimous on both** and it
overrode one part of the Q-12-001 draft. **CI green: `tsc --noEmit` 0 errors · `eslint` 0 errors / 666 warnings ·
`vitest` 118/118 (21 files, +1 test).** `prisma/migrations/` untouched. Only `src/lib/safety/guard.ts` +
`guard.test.ts` changed. Nothing pushed.

### Resolved (1 HIGH)
- ✅ **Q-12-001** [HIGH] — **LLM deep-path now FAILS CLOSED.** The catch (guard.ts:194-225) returned a fully-safe
  assessment (`isSafe:true`/`SAFE`/`NONE`) on ANY error (Gemini outage, rate-limit, timeout, Zod parse failure) →
  policy `NO_ACTION` → the job stored no flag, sent no alert, logged nothing unsafe (safety-scan.ts:80). Since the
  regex fast-path covers only ~8 phrasings, most messages depend on the LLM, so a provider hiccup silently disabled
  detection (fail-OPEN, the dangerous direction). **Fix (Option A):** the catch now returns `isSafe:false`,
  `category:"OTHER"`, `severity:"TIER_3"`, `implicatedCaregiver:false`, `disclosureRisk:"LOW"`, reasoning
  `"Scanner error - needs human review"` (guard.ts:211-224). Traced end-to-end this routes to `INTERNAL_LOG_ONLY`
  (policy.ts:75): the job STORES a durable, DB-queryable flag (safety-scan.ts:84-100) instead of nothing, and it can
  NEVER email a caregiver on an unclassified message — below BOTH the `PARENT_SUMMARY_*` email gate
  (safety-scan.ts:103) and the delivery-layer `isAlertDeliverable` hard-stop, and excluded from pattern-escalation
  (safety-scan.ts:34). `category:"OTHER"` is load-bearing (keeps it out of the urgent self-harm/violence branch,
  policy.ts:50-54); `implicatedCaregiver`/`disclosureRisk` left at non-escalating defaults because they are
  genuinely UNKNOWN on a scan error. +`guard.test.ts` (mock `generateObject` to throw → asserts isSafe:false,
  `decideSafetyResolution`=`INTERNAL_LOG_ONLY`, never `PARENT_SUMMARY_*`). The 3-lens Workflow was unanimous
  FIX_NOW / zero-regression and **overrode the dedicated-`NEEDS_HUMAN_REVIEW`-resolution alternative** (guard
  returns a `SafetyAssessment`, not a `SafetyResolution`, so it would spill into policy.ts/the ch.23 job, AND the
  novel string is absent from the escalation skip-list → would wrongly enter pattern-escalation; fragile).
  `SafetyFlag.severity/category/resolution` are free `String` columns → no migration. Satisfies the brief's T1-A.
  Files: `src/lib/safety/guard.ts`, `+guard.test.ts`.
  - **Deferred refinement (roadmap, NOT this session):** let transient (non-Zod) errors THROW so Inngest retries the
    scan before falling closed — touches the ch.23 job (no `step.run` wrapper → a throw re-runs the whole function →
    double-flag risk) and changes failure semantics; fall-closed stays the terminal behavior. Recorded in ch.24 §5.

### Deferred — kept OPEN/HIGH (1 HIGH)
- ⏳ **Q-12-007** [HIGH] — **no in-the-moment child-facing safety layer.** Re-verified: all four cited sites
  reproduce (async/post-hoc pipeline route.ts:71/:86-93; 4 inert resolutions safety-scan.ts:108-110; **no SafetyFlag
  UI reader anywhere** — re-verified by grep; the only in-the-moment layer is the bypassable Thinkling prompt,
  thinkling.ts:53-63). The 3-lens Workflow was **unanimous DEFER / keep OPEN/HIGH / no re-grade**: every structural
  part (synchronous pre-check, streamed-output scan, child-facing resolution channel + its missing SafetyFlag UI,
  persistent crisis affordance / CA SB 243) is a multi-file FEATURE build and/or carries the legal **T2-D
  `[DECISION]`** (mandated-reporting + verified crisis resources) — beyond a resolution session's bounds (SKILL §9.3).
  HIGH stays correct (the system fails SAFE — the caregiver hard-stop is enforced redundantly in policy.ts:27 +
  safety-scan.ts:36 — so the worst case is under-protection, never mis-notification). **Owner chose LEAVE-AS-IS** on
  the two app-layer sub-items (tracked under Q-12-007, not dropped): (1) bot-promise wording (thinkling.ts:58, hedged
  + home-harm carve-out :59 → acceptable-by-design; a unilateral reword could deter disclosure); (2) undelivered
  helplines (policy.ts:29 promises help lines that no code emits — rests on the bypassable prompt). Both close only
  once a real child-facing channel + verified crisis resources exist (the deferred feature). The "classifier outage →
  zero post-hoc signal" half is now CLOSED by Q-12-001; the "zero in-the-moment signal" half remains. Stays on the
  ch.24 §5 child-safety hardening roadmap.

### Reconcile (§4 partition)
- 2 in-scope HIGH → **1 resolved (Q-12-001) · 1 deferred-kept-open (Q-12-007)**; 0 unaccounted.
- **HIGH:** 8 − 1 (Q-12-001 resolved) = **7 open** (Q-12-007 deferred ≠ closed, stays counted). **MED 27 · LOW 40 ·
  total 77** unchanged. No new findings / re-grades.
- Updated in lockstep: ch.12 §3 (deep-path note) / §5 (status row) / §7 (Q-12-001 resolved + Q-12-007 deferred note +
  Q-12-004 residual ref + brief T1-A line), ch.24 (headline 8→7, HIGH header + lineage, HIGH table both rows, §5
  roadmap "fail closed" + Tier-1 T1-A + MED by-theme companion note, new Session-25 reconcile note), 00-INDEX glance
  (8→7 + child-safety line). Counts reconcile across ch.12 §7 / ch.24 / 00-INDEX / this log.
- **ch.12 now LOW (S23) + MED (S24) + HIGH (S25) all triaged**: Q-12-001 ✅ resolved; Q-12-007 ⏳ deferred/OPEN
  (roadmap); the 5 MED (Q-12-008/009/010/011/012) + LOW Q-12-013 from the Session-24 brief remain for their own
  grade sessions.

---

## Session 2026-06-21 (round 29) — Session 26: ch.13 LOW findings (owner-approved)

Source: the 4 OPEN LOW in `13-oer-sources-corpus.md §7` (Q-13-001/002/005/007). All re-verified at their cited
`file:line` (reproduce). A 4-skeptic adversarial Workflow (one per finding, each tasked to REFUTE the draft)
confirmed 3 and **overrode Q-13-005** (the draft's token-scrape warn would false-alarm + miss the real failure).
Owner approved all 4. These are pure fetch/parse adapters — **no DB queries, no tenancy in scope.** CI green:
`tsc --noEmit` **0**, `eslint` **0 errors / 666 warnings** (unchanged), `vitest` **130/130 across 22 files**
(+1 file / +12 tests — the sources layer's first test). `prisma/migrations/` untouched.

### Removed (1 LOW)
- ✅ **Q-13-001** [LOW] — deleted the dead single-hit convenience wrappers `discoverFullText` + `findFullText`
  (registry.ts) plus the now-orphaned `BookTextResult` interface (its ONLY consumer was `findFullText`; grep
  confirmed zero importers repo-wide — scripts/ + tests clean). **Dead-as-superseded, not unfinished:** the
  all-hits + fetch-fallback design (`discoverAllFullText`/`fetchFirstAvailable`) deliberately replaced the
  single-hit path. Reworded the file header, the `SOURCES`/`discoverAllFullText`/`fetchFullText` comments, and
  ch.13 §3's entry-point list to the live API. The live worker path is untouched (it never used the wrappers).
  Files: `src/lib/sources/registry.ts`.

### Resolved (2 LOW)
- ✅ **Q-13-002** [LOW] — converged `gutenberg.ts` onto the shared `./matching` helpers: deleted its private
  `normalize`/`authorLastName`/`BROWSER_UA` copies + bespoke `scoreMatch`; now imports `normalize`,
  `authorLastName`, `BROWSER_UA`, `scoreTitleAuthor`. `scoreMatch` is a thin adapter that pulls the Gutendex
  title/author strings and delegates to `scoreTitleAuthor` — **logic byte-for-byte identical** (containment
  floor, author-surname reject, score formula all match; adversarially verified). The Gutendex-specific edition
  ranking (`hasUtf8Text` + `download_count`) was never in `scoreMatch` — it stays local in `findOnGutenberg`
  (gutenberg.ts:197), untouched. Added the **sources layer's first unit test** `matching.test.ts` (12 cases)
  shape-locking the shared matcher's invariants. Corrected the false `matching.ts` header that listed gutenberg
  as a consumer (now accurate — all 6 by-title adapters). Files: `src/lib/sources/gutenberg.ts`,
  `src/lib/sources/matching.ts`, `+src/lib/sources/matching.test.ts`.
- ✅ **Q-13-005** [LOW] (re-graded INFO→LOW 2026-06-19) — made the LibreTexts deki-token silent coverage cliff
  diagnosable: a `console.error` at `assembleLibreTextsSections`'s `!tree?.page` early-return, naming the bookID
  and the token/markup/network cause. **The adversarial pass OVERRODE the draft's `libraryToken` warn:** a
  token-scrape regex-miss is *benign* for the libraries that serve the deki API anonymously (libretexts.ts:16-17),
  so warning there false-alarms every cache-TTL AND misses downstream API/expiry 403s; the book-level log captures
  all causes and fires once per failed book. LibreTexts is corpus-only (NO registry fallthrough), so this is the
  consequential cliff. Used `console.error` (the file's logging style). "Harden the deki-token scrape" left as a
  low-value future item (the token is defensive insurance; anonymous calls often succeed). Files:
  `src/lib/sources/libretexts.ts`.

### Accepted — correct-by-design, closes (1 LOW)
- ✅ **Q-13-007** [LOW] — the fail-safe null IS the appropriate guard for HTML/DOM scraping (Zod doesn't apply to
  cheerio parsing; "a wrong full text is worse than none" is the deliberate posture). The adversarial pass checked
  the JSON endpoints (gutendex, libretexts catalog, openstax CMS, deki tree/contents) and confirmed conservative
  `typeof`-guarded extraction — **no unguarded JSON trust-boundary** hiding here. The three by-title scrapers
  (standard-ebooks/siyavula/wikisource) have registry-fallthrough masking their silent failures; the one
  consequential no-fallback cliff (LibreTexts, corpus-only) is now logged via Q-13-005. Nothing actionable beyond
  observability remains → closed. No code change.

### Reconcile (§4 partition)
- 4 in-scope LOW → **1 removed (Q-13-001) · 2 resolved (Q-13-002, Q-13-005) · 1 accepted (Q-13-007)**; 0 unaccounted.
- **LOW:** 40 − 4 = **36 open** (total 77 unchanged — no new findings / re-grades / deferrals). **MED 27 · HIGH 7**
  unchanged. No out-of-chapter sibling (the matching/registry/libretexts symbols appear only in ch.13 among the
  codebase-map docs; the ch.07 grep hit was a Siyavula output-format reference, not a finding).
- Updated in lockstep: ch.13 §3 (entry-points + Matching paragraph) / §4 (line refs registry.ts:142/167/189) / §5
  (status rows: wrappers REMOVED, matching-helpers consumer list) / §6 (no-DEAD note) / §7 (all 4 closed), ch.24
  (OER chapter-status row, LOW header 40→36, LOW prose-log Session-26 sentence), 00-INDEX glance (40→36 LOW). Counts
  reconcile across ch.13 §7 / ch.24 / 00-INDEX / this log.
- **ch.13 fully triaged** (LOW S26; no MED/HIGH).

---

## Session 2026-06-21 (round 30) — Session 27: ch.14 LOW findings (owner-approved)

Source: the 2 OPEN LOW in `14-living-library.md §7` (Q-14-007, Q-14-008). Both re-verified at their cited
`file:line` (reproduce). A 2-skeptic adversarial Workflow (one per finding, each tasked to REFUTE the draft)
returned **reproduces ✓ / recommendation sound ✓ / confidence high** on both, and sharpened the Q-14-008
rationale (the `router.refresh()`-bypasses-the-cache hedge is FALSE). Owner approved both. CI green:
`tsc --noEmit` **0**, `eslint` **0 errors / 665 warnings** (down 1 — the deleted GET handler carried the
unused-`userId` warning), `vitest` **130/130 across 22 files** (unchanged — these are server-route `where`/
cache changes with no DB in the harness, so no unit test is feasible, matching the area). `prisma/migrations/`
untouched. 2 files M (`src/app/api/library/books/route.ts`, `src/app/api/library/videos/route.ts`).

### Resolved (2 LOW)
- ✅ **Q-14-007** [LOW] — deleted the dead `GET /api/library/books` handler. Exhaustive grep (incl.
  template-string / base+path URL forms, tests) found zero callers: the only root-path caller is
  `BookScanner.tsx:209` (method POST), the catalog reads books via the `getLibraryResources` server action,
  and `ExtractBookButton.tsx:34` hits the separate `/[id]/extract` route. Deleting the handler also removed
  the unused GET-scoped `userId`. The live `POST` is untouched; no import orphaned (`db` is still used by
  POST's subject/strand lookups). Deleting the whole handler (vs. trimming just the var) is right-sized — it
  removes an unmaintained list endpoint that would silently drift from the canonical read path. File:
  `src/app/api/library/books/route.ts`.
- ✅ **Q-14-008** [LOW] — the book + video CREATE routes now call `revalidateTag(`library-${organizationId}`, {})`
  immediately after the create (books/route.ts:83, videos/route.ts:132), matching `addArticle`/`addDocuments`/
  delete* and the extract routes; the cached `/living-library` catalog busts on add instead of staying stale to
  the 1h TTL. **revalidateTag-only** (NOT revalidatePath — addArticle/addDocuments use only revalidateTag, and
  Q-14-003 flags `revalidatePath("/library")` as a dead no-op). **Crux (corrected the finding):** the original
  hedge that `router.refresh()` "happens to bypass the cache" is FALSE — `router.refresh()` clears the client
  Router Cache and re-runs the RSC, but `getLibraryResources` returns the still-memoized `unstable_cache` Data
  Cache value until the tag is revalidated or the 1h TTL expires (Data Cache ⊥ Router Cache), so `revalidateTag`
  is the ONLY real fix. Adversarial-pass nuance recorded in §7: the BOOK path is the clear beneficiary
  (`BookScanner` redirects to the detail page, no extract); the VIDEO path was partly masked because an
  EXTRACTED extract already revalidated — the create-route call closes the stuck-`EXTRACTING` gap. The
  standalone `/living-library/videos` page reads uncached `getLibraryVideos`, so only the catalog Videos tab was
  affected. Files: `src/app/api/library/books/route.ts`, `src/app/api/library/videos/route.ts`.

### Reconcile (§4 partition)
- 2 in-scope LOW → **2 resolved (Q-14-007, Q-14-008)**; 0 unaccounted. No new findings / re-grades / deferrals.
- **LOW:** 36 − 2 = **34 open** (total 77 unchanged). **MED 27 · HIGH 7** unchanged.
- No out-of-chapter sibling *finding* closed (ch.17's `ResourcePicker`-passes-courseId-as-orgId bug and ch.23's
  revalidateTag-from-an-Inngest-worker concern touch related symbols but are distinct, still-open findings).
- Consequential doc-currency (code-is-truth, not new findings): the GET deletion (−23 lines) and the two
  `revalidateTag` imports shifted line numbers — refreshed ch.14 §1/§4/§5/§7 (incl. the still-open MED Q-14-006's
  own cites `books/route.ts:31→:9`, `videos/route.ts:32→:33`), ch.15 §5 (`generateBookEmbedding`
  `books/route.ts:112→:95`), and ch.23 §5 (`isYouTubeUrl` usage `videos/route.ts:49→:50`). Updated in lockstep:
  ch.24 (LOW header 36→34, LOW prose-log Session-27 sentence) + 00-INDEX glance (36→34 LOW). Counts reconcile
  across ch.14 §7 / ch.24 / 00-INDEX / this log.
- **ch.14 LOW done** (MED Q-14-002/003/005/006 + HIGH Q-14-001/004 remain — the 2 HIGH are part of the "HIGH 7"
  tenancy/IDOR cluster, do with extra care).

---

## Session 2026-06-21 (round 31) — Session 28: ch.14 MED findings (owner-approved)

Source: the 4 OPEN MED in `14-living-library.md §7` (Q-14-002, Q-14-003, Q-14-005, Q-14-006). All re-verified
at their cited `file:line` (reproduce). A 4-skeptic adversarial Workflow (one per finding, each tasked to REFUTE
the draft) returned **reproduces ✓ / draft sound ✓** on all four, found **zero regressions**, and **sharpened
Q-14-005** (graded it a true HIGH cross-tenant write IDOR). Owner approved all 4 core fixes + (forks) adding the
parent gate to `addArticle`/`addDocuments` and fixing a discovered sibling `/resources` no-op. CI green:
`tsc --noEmit` **0**, `eslint` **0 errors / 664 warnings** (down 1 — the deleted dead scan route), `vitest`
**130/130 across 22 files** (unchanged — server-route/action Prisma+guard changes with no DB in the harness, so
no unit test is feasible, matching the area). `prisma/migrations/` untouched. 11 source paths touched (1 D + 10 M);
also cleared stale `.next/types` generated route-types (gitignored build artifact) that still referenced the
deleted route — same class as the Session-8 stale-cache wipe, not a code issue.

### Removed (1 MED)
- ✅ **Q-14-002** [MED] — `git rm src/app/api/library/scan/route.ts`. Dead route (`POST /api/library/scan`,
  ISBN→Google Books): zero callers across all reference forms — only `/api/library/scan/vision` is used
  (`BookScanner.tsx:178`), ISBN lookup goes through the `lookupBook` server action (which has an OpenLibrary
  fallback the dead route lacked). Orphaned nothing; the sibling `scan/vision/route.ts` + `living-library/scan/page.tsx`
  are unrelated and untouched. Same class as Q-14-007 (S27) / Q-03-001.

### Resolved (3 MED)
- ✅ **Q-14-003** [MED] — broken nav to the removed `/library` route. (a) `ResourceList.tsx:41`
  `/library`→`/living-library` (verified: `?tab=resources` + the **uncached** searchParams-driven
  `resource.findMany` in `page.tsx:48-105` render the filtered Resources tab — the page is dynamic, no stale Data
  Cache masks it). (b) Deleted the 2 dead `revalidatePath("/library")` lines from the extract routes
  (`books/[id]/extract/route.ts`, `videos/[id]/extract/route.ts`) — each already has `revalidateTag` +
  `revalidatePath("/living-library")` directly above, so no real invalidation is lost (consistent with the
  Q-14-008 precedent that `/library` is a dead no-op). (c) The adversarial pass surfaced a sibling dead no-op —
  `deleteResource` (`resource-library-actions.ts:407`) called `revalidatePath("/resources")` but there is no
  `/resources` route → DELETED (owner-approved; consequential cleanup, not a new finding; `deleteResource` still
  revalidates `/living-library` + the tag).
- ✅ **Q-14-005** [MED] — cross-tenant WRITE IDOR. `addArticle(url)`/`addDocuments(formData)` now DERIVE
  `{organizationId,userId}` server-side via `getCurrentUserOrg()` (+ a null-org guard) instead of trusting the
  client-passed args; the `organizationId`/`userId` params were DROPPED from both signatures and the call
  sites + props cleaned up (`ArticleList`/`DocumentList` interfaces+destructures+calls; `LibraryClient` +
  `page.tsx` `userId` prop removed end-to-end; `BookList`'s own `organizationId` prop unaffected). `withTenant`
  still stamps `{organizationId, userId:null}`; `addedByUserId` uses the derived `userId`. **Owner-approved
  add-on:** also added `auth()` + `assertParentProfile()` to both actions (uniform with the 4 API routes +
  `deleteResource`), so a STUDENT profile on the shared family login can't add articles/documents either.
  **Severity:** the adversarial pass graded this a true HIGH (authenticated cross-tenant write — also injected
  into another tenant's Firebase `documents/{org}/` namespace + Inngest job payload); since it is fix-and-CLOSED
  this session the re-grade is **moot** (recorded for honesty; MED count decrements). Files:
  `src/app/actions/resource-library-actions.ts`, `ArticleList.tsx`, `DocumentList.tsx`, `LibraryClient.tsx`, `page.tsx`.
- ✅ **Q-14-006** [MED] — added `assertParentProfile()` to all 4 create/extract API routes
  (`books/route.ts:19`, `videos/route.ts:43`, `books/[id]/extract/route.ts:47`, `videos/[id]/extract/route.ts:46`),
  **wrapped in try/catch → a clean 403** (the POST bodies have no outer try/catch, so a bare throw would 500).
  Verified regression-free: no student-learning flow calls them (`profile-access.test.ts` asserts STUDENT is
  blocked from `/living-library` + `/videos`; the only student-reachable library page is the read-only
  `resource/[id]`); the guard works in route handlers (precedent `blocks/[blockId]/route.ts:216`); the
  book-detail self-heal updates the DB directly in the RSC (`[id]/page.tsx:83-104`), NOT via the extract route.
  Files: the 4 API routes (POST only — the videos `GET` list-read stays open).

### Reconcile (§4 partition)
- 4 in-scope MED → **4 closed (1 removed: Q-14-002; 3 resolved: Q-14-003/005/006)**; 0 unaccounted. No new
  findings / re-grades / deferrals.
- **MED:** 27 − 4 = **23 open**. **HIGH 7 · LOW 34** unchanged. Confirmed (Session-19 presence rule) all 4 ch.14
  MED were in ch.24's by-theme tally before decrementing — Q-14-005/006 under "Tenancy/authz drift",
  Q-14-002/003 under "Dead code / duplication / drift".
- No out-of-chapter sibling *finding* closed. Consequential doc-currency (code-is-truth, not new findings): the
  parent-gate inserts (+9 lines each in books/videos routes & both extract routes) and the `addArticle`/`addDocuments`
  signature edits shifted line numbers cited by other chapters — refreshed **ch.13** §dedup-flow + §5
  (`computeDedupKey` `extract/route.ts:77→:86`), **ch.15** §5 (`generateBookEmbedding` `books/route.ts:95→:104`,
  `extract/route.ts:109→:118`), **ch.23** §4 + §5 (`processDocument` producer `resource-library-actions.ts:295→:327`;
  `extractBook` producer `books/[id]/extract/route.ts:180→:188`; `extractVideo` `videos/[id]/extract/route.ts:153→:161`;
  `isYouTubeUrl`/`extractYouTubeVideoId` `videos/route.ts:7→:8`, `:50→:59`). Updated in lockstep: ch.14 §1/§3/§4/§5/§6/§7,
  ch.24 (headline 27→23, MED by-theme header + lineage + 2 struck entries + Session-28 disposition note + chapter-status
  row + roadmap line), 00-INDEX glance (27→23 MED). Counts reconcile across ch.14 §7 / ch.24 / 00-INDEX / this log.
- **ch.14 now LOW+MED done** (LOW S27 / MED S28). HIGH Q-14-001 (dead cross-org vector-scan route) + Q-14-004
  (untyped `where` from raw searchParams) remain — part of the "HIGH 7" tenancy/IDOR cluster; do with extra care.

---

## Session 2026-06-21 (round 32) — Session 29: ch.14 HIGH findings (owner-approved)

Source: the 2 OPEN HIGH in `14-living-library.md §7` (Q-14-001, Q-14-004). Both re-verified at their cited
`file:line` (reproduce). A 2-finding adversarial Workflow (one skeptic per finding, each tasked to REFUTE the
recommendation) returned **reproduces ✓ / recommendation sound ✓ / high-confidence** on both and sharpened both.
The session also became a short **product-design conversation**: the owner explained the community-extraction-library
vision (book semantic search → "pre-extracted ✓" indicator + cross-edition content dedup), establishing that book
semantic search is roadmap-real but the code under the finding was the WRONG scope for it (per-org `books` cosine, not
the global community corpus). Owner chose to **delete the wrong-scoped code now and build the feature fresh later**, and
to **capture the vision as a roadmap item + mint any warranted finding**. CI green: `tsc --noEmit` **0** (after
`rm -rf .next/types .next/dev/types` to clear the stale generated route-types the deleted route left behind — the
recurring route-deletion gotcha), `eslint` **0 errors / 663 warnings** (down 1 — the removed `where: any`), `vitest`
**130/130 across 22 files** (unchanged — a route deletion + a dead-function deletion + a Prisma `where` typing, no DB in
the harness so no unit test is feasible, matching the area). `prisma/migrations/` untouched. 3 source paths (1 D + 2 M).

### Resolved (2 HIGH)
- ✅ **Q-14-001** [HIGH] — `git rm src/app/api/library/search/route.ts`. The route was DEAD (zero callers —
  exhaustive grep over every `/api/library/*` fetch in `src/`) AND a cross-org abuse surface: reachable by ANY
  authenticated user, each call ran `searchBooks` (an unscoped pgvector cosine scan over ALL orgs' `books` — its raw
  SQL has no `account_id` predicate and `withTenant` is a no-op with RLS off, `db.ts:106-110`) + a per-request
  embedding API call, then post-filtered by org. Deleting eliminated both. The adversarial verifier confirmed HIGH is
  defensible (routable + unscoped scan + paid embedding), the route is genuinely dead, and deletion is tsc-safe
  (nothing imports the route file). **Orphan tail (owner fork → DELETE):** `searchBooks` (`src/lib/utils/vector.ts`)
  was the route's sole consumer, so the deletion orphaned it → **also deleted**, closing the sibling **ch.15 Q-15-001**
  [MED] resolved-by-removal. Owner chose delete-not-patch because the planned community search targets the GLOBAL
  `BookExtraction` corpus, not the per-org `books` table this primitive searched (the parallel video path
  `searchVideos`/`generateVideoEmbedding` is likewise built-but-dead, Q-15-002/003). `findSimilarBooks` (the other
  wired vector fn, live at `living-library/[id]/page.tsx:121`) is unaffected — no other vector.ts import orphaned.
- ✅ **Q-14-004** [HIGH] — typed the generated-resources catalog `where` as `Prisma.ResourceWhereInput` (was
  `where: any`) + coerced all 4 `searchParams` (`studentId`/`courseId`/`bookId`/`toolType`) to a single string via
  `firstParam(v) = Array.isArray(v)?v[0]:v` (`living-library/page.tsx:48-64`), so a crafted `?studentId=a&studentId=b`
  array can no longer flow into a scalar Prisma field and throw a validation error → 500. **No leak ever existed** —
  `organizationId` is unconditionally in the `where`; the adversarial verifier confirmed HIGH was over-graded (really
  MED/LOW input-validation: Prisma parameterizes, `toolType` is value-equality, a cross-org `courseId`/`bookId` just
  ANDs to zero rows), but the cheap fix CLOSES it so the re-grade is **moot** (recorded here for honesty; this
  decrements the HIGH count, not MED/LOW). **Verifier sharpening:** with the typed `where`, coercion is MANDATORY not
  optional (`string|string[]` won't assign to the scalar field types) → type + coerce are coupled and must cover all 4
  params. Both producers (`ResourceList.tsx`, `LibraryClient.tsx`) use single-value `<select>`s via `URLSearchParams.set`,
  so coercion is behavior-preserving.

### Minted (1 LOW) + roadmap
- 🆕 **Q-13-009** [LOW] (ch.13) — **cross-org extraction dedup fragments across editions of the same work.**
  `computeDedupKey` (`book-dedup.ts:150`) prefers ISBN-13, so different printings/editions of the same content (e.g.
  two ISBNs of *1984*) get DISTINCT dedup keys → separate global `BookExtraction` rows → both orgs pay the LLM
  extraction of identical content + the shared corpus fragments (defeats "extract once, everyone benefits"). No
  correctness/tenancy bug; bounded to cross-edition collisions; the proper fix is a content-fingerprint feature → LOW.
  Verified at `book-dedup.ts:150-157` before minting (per §9.3 — read the file, don't mint on say-so).
- 🛣 **Roadmap (ch.24 §5):** added "**Community extraction library — semantic search + cross-edition dedup**" — the
  "pre-extracted ✓" indicator in find-a-book-to-add + the fingerprint dedup (Q-13-009), explicitly noting the deleted
  route/`searchBooks` was the WRONG scope so the real build is fresh against the global corpus, and that the video
  semantic-search path (Q-15-002/003) is the same family. Flagged as a multi-file feature (out of a resolution
  session's scope).

### Reconcile (§4 partition)
- 2 in-scope HIGH → **2 resolved**; 0 unaccounted. **HIGH: 7 − 2 = 5 open.** Out-of-chapter sibling: **ch.15 Q-15-001
  [MED] ✅ resolved-by-removal** (orphan tail of the Q-14-001 deletion) → **MED: 23 − 1 = 22 open** (count moves in the
  owning chapter, ch.15/ch.24). Minted **Q-13-009** [LOW] → **LOW: 34 → 35 open / 77 → 78 total.**
- Counts reconcile across ch.14 §7 / ch.15 §7 / ch.13 §7 / ch.24 (HIGH header + by-theme table + MED header + by-theme
  + lineage + Workstream-B list + both dashboard rows + LOW running log/count) / 00-INDEX glance. `prisma/` untouched.
- Consequential doc-currency (code-is-truth, not new findings): ch.15 §1 vector.ts line count 563→**537** (searchBooks
  removed); ch.15 §2/§3/§4/§5/§6 de-listed `searchBooks` + the dead search route; ch.14 §1/§5/§6 de-listed the route +
  `searchBooks`; ch.13 + ch.14 dashboard rows updated; ch.13 is **no longer "fully triaged"** (1 new OPEN LOW Q-13-009).
- **ch.14 now FULLY TRIAGED** (LOW S27 / MED S28 / HIGH S29).

## Session 2026-06-22 (round 33) — Session 30: ch.15 LOW findings (owner-approved)

Source: the 4 OPEN LOW in `15-vector-rag-caching.md §7` (Q-15-002/003/004/005). All re-verified at their cited
`file:line` against CURRENT code (vector.ts had drifted — the S29 `searchBooks` removal shifted the cited line ranges
up). A 4-skeptic adversarial Workflow (one per finding, each tasked to REFUTE the draft) returned **reproduces ✓ /
high-confidence** on all four and **overrode 2 of my drafts toward REMOVE** (the video pair — I had leaned
present-as-owner-fork-with-a-keep-lean; the skeptics argued it is the same built-but-unwired family as the S29
`searchBooks`). Owner ratified the fork: **delete the video pair, delete cache.ts, accept the N+1.** CI green:
`tsc --noEmit` **0**, `eslint` **0 errors / 661 warnings** (down 2 — the deleted code carried ~2 `any` warnings; no
`.next/types` wipe needed since no ROUTE file was deleted), `vitest` **130/130 across 22 files** (unchanged —
dead-code removals + a won't-fix; the touched code has no DB in the harness). `prisma/migrations/` untouched. 3 source
paths (1 D + 2 M: `git rm src/lib/cache.ts`; `src/lib/utils/vector.ts` lost the two functions + 3 reworded comments).

### Removed (3 LOW)
- ✅ **Q-15-002** [LOW] — deleted `searchVideos` from `src/lib/utils/vector.ts` (was `:150-182`; doc cited stale
  `:176-208`). DEAD: zero importers across 5 vectors (named/dynamic/string/barrel/test), no UI/route/action consumer.
  Per-org video semantic search (cosine over the GLOBAL `video_extraction_chunks`, JOINed back to the org's own
  `video_resources` via `vr.account_id`) — the video twin of the S29 `searchBooks` deletion (same built-but-unwired
  family). Functional-if-wired (the chunk table IS populated by the live `embedVideoChunks`), but nothing wired it and
  no roadmap item names a per-org video search → owner chose delete (mirror S29), not keep-as-unfinished. Build-safe
  (tsc 0 before+after; its only in-file mention was prose in `retrieveBookChunks`'s JSDoc, reworded).
- ✅ **Q-15-003** [LOW] — deleted `generateVideoEmbedding` from `vector.ts` (was `:369-393`; doc cited stale
  `:395-419`). Independently the more-clearly-dead of the pair: zero callers AND its only side effect wrote
  `video_resources.embedding`, a column NOTHING reads (verified — the only `<=>` reads are over the chunk tables; only
  `config.ts:97` even mentions the column, in a comment). **Corrected a wrong doc claim:** Q-15-003's original impact
  said `searchVideos` depended on this summary vector — it did NOT (`searchVideos` read
  `video_extraction_chunks.embedding`), so the summary-vector path was inert at both ends, independent of `searchVideos`.
  Also de-listed `video_resources` from the vector.ts header comment (the file no longer touches that org-scoped table).
- ✅ **Q-15-004** [LOW] — `git rm src/lib/cache.ts` (whole file: `withCache` + `CACHE_TAGS` + `CACHE_REVALIDATE`).
  SUPERSEDED dead scaffold: zero importers repo-wide; the caching path that actually shipped is `cacheQuery`
  (prisma-cache.ts, live on `students`/`courses` pages) + the inline `revalidateTag(\`student-${id}\`)` /
  `revalidateTag(\`library-${org}\`)` pattern that hand-builds the same tag strings WITHOUT ever importing cache.ts's
  taxonomy. Build-safe (only imported `unstable_cache`, a shared dep; no npm dep orphaned).

### Accepted / won't-fix (1 LOW)
- ✅ **Q-15-005** [LOW] — `crossWalkTextbookTopics` issues one cosine query per topic (≤`MAX_TOPICS=250` sequential
  round-trips per textbook ingested, `textbook-coverage.ts:75-88`). **Accepted, no code change.** Proportionate for a
  LOW perf-only finding in a non-request background path: bounded, one-time per book ingest, in a best-effort Inngest
  step that never fails ingestion (catch returns 0). **Verified the load-bearing fact:** there is **no ivfflat/hnsw
  index** on `textbook_chunks.embedding` (migration `00000000000008` creates only `subject_idx` + `document_id_idx`),
  so a set-based UNNEST rewrite would eliminate round-trips but NOT the ~250×1500 cosine ops — zero algorithmic gain —
  while introducing an error-prone `vector[]`/unnest pattern (zero precedent in the repo) behind a silent catch
  (`textbook-coverage.ts:96`), a latent data-quality regression risk. Not worth the churn. (A bounded-concurrency
  middle option was considered and rejected — the function already runs `concurrency:3` on a shared pool.)

### Reconcile (§4 partition)
- 4 in-scope LOW → **4 closed** (3 removed, 1 accepted); 0 unaccounted. **LOW: 35 − 4 = 31 open** (total still **78** —
  nothing minted). HIGH/MED unchanged (5/22). No re-grades, no deferrals, no out-of-chapter sibling FINDING (no other
  chapter owns a Q on these symbols).
- Counts reconcile across ch.15 §7 / ch.24 (top-line headline + LOW running-log count + Session-30 disposition note) /
  00-INDEX glance. `prisma/migrations/` untouched.
- Consequential doc-currency (code-is-truth, not new findings): ch.15 §1 vector.ts line count 537→**453** +
  prisma-cache.ts 49→**16**, cache.ts row removed; ch.15 §2/§3/§4/§5/§6 de-listed the 2 video fns + cache.ts and
  refreshed the drifted vector.ts line cites for the kept functions; ch.24 §5 "Community extraction library" roadmap
  NOTE updated (the video family it flagged is now deleted).
- **ch.15 now FULLY TRIAGED** (LOW S30; MED Q-15-001 ✅ resolved-by-removal S29; no HIGH).

## Session 2026-06-22 (round 34) — Session 31: ch.16 LOW findings (owner-approved)

Source: the 4 OPEN LOW in `16-students-learners.md §7` (Q-16-001/004/005/007). All re-verified at their cited
`file:line` against CURRENT code (all 4 reproduce; Q-16-005's card had drifted to `:46-63`). A 4-skeptic adversarial
Workflow (one per finding, each tasked to REFUTE/SHARPEN the draft) returned **reproduces ✓ / high-confidence** on all
four; I re-derived each verdict by hand — **overrode 1, adopted 2 sharpenings, and verified 1 load-bearing claim
read-only against the DB.** Owner partition: **3 FIX_NOW (closed) · 1 KEEP+re-document (Q-16-001, stays OPEN).** CI
green: `tsc --noEmit` **0**, `eslint` **0 errors / 653 warnings** (down 8 from 661 — the assessment route shed
`updateData: any` + 3 `profile as any` casts), `vitest` **130/130 across 22 files** (unchanged — the touched code is
React components + a server route with no DB in the harness, so no unit test is feasible; matches the area).
`prisma/migrations/` untouched. 5 source paths M.

### Resolved (3 LOW)
- ✅ **Q-16-004** [LOW] — split into two claims. (1) The "Open Resource" link in `StudentDashboard.tsx` read
  `assignment.resourceId` (NOT selected by `getStudentAssignments`) → rendered `/living-library/resource/undefined`
  whenever assignments exist; fixed to the already-selected nested `assignment.resource.id` (zero query change). (2) The
  `notes` block read `assignment.notes`, but `ResourceAssignment.notes` has **NO producer** (the live
  `assignResourceToStudent` writes resourceId/studentId/assignedByUserId only, `assignments.ts:43-49`), so the
  never-rendering block was **deleted** rather than wiring a `select` for an unpopulated column (overrode my own draft's
  "add `notes:true` for forward-compat" per the skeptic — selecting a field nothing writes is false forward-compat).
  Single file (`StudentDashboard.tsx`; `data.assignments` is `any[]`, so the change is invisible to tsc — verified by hand).
- ✅ **Q-16-005** [LOW] — wired the ParentDashboard "Daily Liturgy" card (hardcoded "Psalm 23: The Shepherd" under a
  "Today's family discipleship focus" label) to the **seeded `Devotional` table**. Read-only DB checks confirmed the
  skeptic's "it's real data" claim: **732 rows / 366 distinct days / `time` am|pm** (Spurgeon "Morning & Evening"),
  format consistent across the year (Jan 1 / Mar 15 / Jul 4 / Dec 25 all sampled). Added `getTodayDevotional()`
  (`dashboard.ts`, bare-`db` global read mirroring `family-discipleship/devotionals/page.tsx`) that derives a clean
  reference (first line of `keyverse`, leading-quote stripped) + a prose excerpt (drops the 2-block metadata prefix;
  170-char cap) → `todayDevotional` prop (`app/page.tsx`) → `ParentDashboard.tsx` renders it with the old static text as
  fallback. Honest dynamic content from existing data (~25 lines). `new Date()` lives inside the helper (not an RSC
  render body) to avoid the impure-call-in-render lint error.
- ✅ **Q-16-007** [LOW] — added a per-step `assessmentSchema` **discriminated union** (`route.ts:20-24`) parsed via
  `safeParse` → **400 BEFORE the paid AI call**; typed `updateData` with `Prisma.InputJsonValue` and replaced the 3
  `profile as any` casts (dropped 4 explicit `any`s, lint-clean). The schema is **permissive on VALUES** (the interests
  step sends a nested object `{hookThemes:[],specificEntities:{},expertTopics:[],integrationMode:""}` —
  `z.record(z.string(), z.unknown())` accepts it; **overrode the adversary's** "a single record rejects interests →
  needs a discriminated union", which was a misread of `z.record` semantics) but **precise on SHAPE per step**
  (personality/learning `Record<string,string>` matching the generators' contracts, interests `Record<string,unknown>`)
  — a discriminated union here is the *type-honest* tool that avoids unchecked answer casts (the two string-typed
  generators won't accept `Record<string,unknown>`), NOT over-engineering. The dead "Invalid step" else fell out.
  Authenticated self-only route → no privilege boundary; value is fail-fast + repo Zod-at-boundary consistency.

### Kept OPEN — re-documented as unfinished (1 LOW)
- ⏳ **Q-16-001** [LOW] — `/student/dashboard` re-documented from "orphaned/dead route" to an **unfinished,
  built-but-unlinked single-student daily-schedule view** (mirrors Q-09-005/Q-10-005). Re-verify confirmed it is a
  complete, working page (auth+org gated; `getStudentDailySchedule` → `DailyScheduleList` → `toggleItemStatus`) whose
  ONLY inbound link is self-referential (`page.tsx:58`); it is NOT superseded — a per-student DAILY checklist is a
  different surface from the live `StudentDashboard` (`/`, courses/assignments) and the parent WEEKLY `/planner`. Owner
  chose **keep it + roadmap a wire-up** (24 §5). Stays tracked-OPEN at LOW (deferred ≠ closed). Because the route is
  kept, its cascade-only dependencies — `getStudentDailySchedule`/`toggleItemStatus` (ch.21) + INFO **Q-21-010** —
  remain live; **no ch.21 change.** (Had the owner chosen REMOVE, the cascade would have deleted both ch.21 fns +
  closed Q-21-010 resolved-by-removal; the orphan-tail was traced and is recorded here for any future revisit.)

### Reconcile (§4 partition)
- 4 in-scope LOW → **3 closed (resolved) · 1 kept-OPEN (re-documented)**; 0 unaccounted. **LOW: 31 − 3 = 28 open**
  (total still **78** — nothing minted, no re-grades, no new deferrals). HIGH/MED unchanged (5/22). No out-of-chapter
  sibling FINDING moved (the Q-16-001 ch.21 cascade did not fire — owner kept the route).
- Counts reconcile across ch.16 §7 / ch.24 (§3 chapter-status row + §7 register headline + findings-at-a-glance +
  LOW running-log count) / 00-INDEX glance. Historical S30 reconcile notes that read "31 open" (ch.24 §4 lineage, the
  LOW-log S30 line, CHANGELOG round 33) left AS-IS — they correctly state the count AT THAT TIME (Session-17 hygiene).
- Consequential doc-currency (code-is-truth, not new findings): the Zod insert shifted the assessment route's line
  numbers, so ch.16 §4 (assessment-step flow refs `:13/:18/:30/:39-42/:49-66/:70-77` →
  `:26/:30/:20-24+:39-42/:48/:56-59/:71-87/:91-98`) + §6 tenancy cross-ref (`assessment/route.ts:30` → `:48`) were
  refreshed; §1/§4/§5 reframed the daily-schedule route from "ORPHANED/DEAD" to "UNFINISHED (built, unlinked)".
- **ch.16 LOW done** (MED Q-16-002/003 + INFO Q-16-008 remain; no HIGH).

## Session 2026-06-22 (round 35) — Session 32: ch.16 MED findings (owner-approved)

Both OPEN MED in ch.16 §7 re-verified at their cited `file:line` (reproduce exactly). A 2-skeptic adversarial
Workflow (one per finding, each tasked to refute + hunt regressions) returned **reproduces ✓ / sound ✓ / zero
regressions** on both; I re-derived each by hand and confirmed the one out-of-scope flag a skeptic raised was a
false alarm. Owner partition **2 FIX_NOW → 2 closed**.

### Q-16-002 ✅ RESOLVED — create-student writes now run under one tenant tx
- **No live vuln** (RLS off; the learner is explicitly scoped via `organization.connect`, org derived from the
  session) — pure RLS-readiness, same family as the Session-20 `withTenant` wraps. True grade LOW, carried MED on
  tenancy-cluster convention → **fix-and-close (re-grade moot)**.
- Folded `db.learner.create` + `db.learnerProfile.create` into the existing trailing
  `withTenant({organizationId,userId:null})` block, so all four org-scoped learner writes (learner → learnerProfile
  → STUDENT `Profile` → `profileId` back-link) run in **ONE tenant-stamped, atomic** tx (`route.ts:56-92`). The
  created learner is returned from the closure as `student`, so `NextResponse.json({ student })` + the client
  `student.id` redirect are byte-for-byte unchanged.
- The self-heal `db.organization.create` + `db.user.update` (`:25-41`) deliberately stay on the raw `db` client:
  the org INSERT must run under null org context (the relaxed `organizations` RLS policy
  `id = app.current_org() OR app.current_org() IS NULL` — migration `00000000000002`:64; you can't stamp a GUC for
  an org that doesn't exist yet), and `User` is CONTEXT_FREE. Added a clarifying comment. Matches the blueprint.ts
  onboarding precedent.
- The fold strictly **eliminates the prior orphaned-row window** (a learner with no profile on partial failure);
  no AI/Inngest/network call exists in this path so nothing is wrongly pulled inside the Prisma ~5s tx.
- Skeptic's out-of-scope flag (schema↔RLS table-name "drift": `Learner` @@maps `learners` vs migration-2 policies
  naming `public.students`) **confirmed a false alarm**: migration `00000000000013` is a metadata-only
  `ALTER TABLE "students" RENAME TO "learners"` whose own comment states the RLS policy + grants follow the table
  automatically (Postgres policies are OID-bound). No finding minted.
- Files: `src/app/api/students/route.ts` (M).

### Q-16-003 ✅ RESOLVED — `student as any` replaced by a derived payload type
- Type-DX only (no runtime/security impact; single consumer) — true grade LOW, carried MED → **fix-and-close**.
- Added a dedicated, leaner `studentCardSelect` (`satisfies Prisma.LearnerSelect`) + `export type StudentCardData =
  Prisma.LearnerGetPayload<…>` to the canonical `src/server/queries/students.ts` (NOT a reuse of `studentSelect`,
  which is a superset that would over-fetch activityProgress/courseProgress/personalizedResources/strand for a grid).
- `page.tsx` now selects through `studentCardSelect` (`:17`) and renders `StudentCard` without the cast (`:74`);
  `StudentCard` types its prop `student: StudentCardData` via `import type` (the house pattern — 5 `_components`
  already do this), dropping `student: any`. `cacheQuery` preserves the generic so the `as any` drops cleanly;
  every field access verified safe under the precise type (`avatarConfig`→`getStudentAvatarUrl(config?: any)`;
  nullables only optional-chained/coalesced; `firstName[0]` non-null).
- **−2 lint warnings (653 → 651)** — the two removed `any`s.
- Files: `src/server/queries/students.ts`, `src/app/students/page.tsx`, `src/components/students/StudentCard.tsx` (M).

### Verification
- tsc 0 errors · eslint 0 errors / **651** warnings (down 2 from S31's 653) · vitest **130/130** / 22 files (no DB
  in the harness → no new unit test feasible for `where`/`withTenant`/RSC-type changes, matches the area).
  `prisma/migrations/` untouched; 4 code files M.

### Reconcile (§4 partition)
- 2 in-scope MED → **2 closed (both resolved)**; 0 unaccounted. **MED: 22 − 2 = 20 open** (total still **78**;
  HIGH 5 / LOW 28 unchanged). No new findings, no re-grades, no deferrals. No out-of-chapter sibling FINDING moved.
- Counts reconcile across ch.16 §7 / ch.24 (§3 chapter-status row + §7 MED by-theme headline + count-basis lineage +
  write-path roadmap list + findings-at-a-glance) / 00-INDEX glance (`22 MED → 20 MED`).
- Consequential doc-currency (code-is-truth, not new findings): the `studentCardSelect` insert shifted `students.ts`
  +47, so ch.16 §3/§4/§5 + the still-OPEN INFO **Q-16-008** cites (`:262-279`/`:263-275`/`:333` →
  `:311-328`/`:313-324`/`:382`; getStudentById/ProfileData/Objectives/RelevantBooks/MasterContext/
  listStudentsNeedingAssessment rows) were refreshed, plus ch.04 §3.1 self-heal cite (`route.ts:23` → `:27`).
  Historical changelog round entries naming the old line numbers left AS-IS (Session-17 hygiene).
- **ch.16 now LOW+MED done** (INFO Q-16-008 remains for the INFO pass; no HIGH).

## Session 2026-06-22 (round 36) — Session 33: ch.17 LOW findings (owner-approved)

All 3 OPEN LOW in ch.17 §7 re-verified at their cited `file:line` (all reproduce; Q-17-007 had a ~5-line drift to
`blueprint.ts:351-353`). A 3-skeptic adversarial Workflow (one per finding, each tasked to refute/sharpen + hunt
regressions; the Q-17-005 skeptic ran in an isolated worktree to do the gold-standard move-aside + `tsc` proof)
returned **reproduces ✓ / draft-sound ✓** on all three and **strengthened** the Q-17-006 ACCEPT case. Owner partition
**1 removed · 2 resolved** (one of which became a FIX over the skeptic's leaning-ACCEPT).

### Q-17-005 ✅ REMOVED — dead `course-pacing.ts` deleted
- `git rm src/lib/utils/course-pacing.ts` (~193 lines: `PacingConfig`/`CalculatedPacing` + `calculateCoursePacing`
  :36 / `calculatePacingFromSchedule` :83 / `autoFillCourseSchedule` :153). **Zero source importers** repo-wide
  (independent grep: only the file + docs). It is the importER (imports `db`/`withTenant`/`getCurrentUserOrg`/`Schedule`),
  so deletion orphans nothing.
- **Build-safety proven** (worktree skeptic): moving the file out of the `*.ts` glob changed the `tsc` error count by
  exactly the file's own 5 self-errors with **zero new "Cannot find module" orphan errors** — nothing depends on it.
  *(NB: the worktree's ABSOLUTE tsc count was inflated — a fresh worktree lacks the git-ignored generated Prisma
  client — but the DELTA is the load-bearing signal. The main-tree `tsc` is 0 with the file gone.)*
- **Wire-it-instead steelman collapsed:** the live `distributeCourse` (`scheduling.ts`) already fulfills the
  "automatic pacing" UI promise by *placement* (reads classroom school-year dates + holidays directly) and never
  consulted pacing output; `autoFillCourseSchedule` distributes `Objective` rows (a different data model) — an
  abandoned objective-axis design. Matches the owner's delete-built-but-unwired precedent (searchBooks/searchVideos/
  cache.ts).
- Consequential doc-currency (not new findings): ch.21 §6 cross-ref + the "Pacing vs. distribution" paragraph updated
  to reflect the removal (distributeCourse is now the sole scheduling engine). The frozen Session-4 historical records
  that name `course-pacing.ts` as a past `sortOrder` consumer (ch.03 §7 Q-03-004 evidence, CHANGELOG round 7) left
  AS-IS (Session-17 historical-record hygiene).
- Files: `src/lib/utils/course-pacing.ts` (D).

### Q-17-006 ✅ RESOLVED — block kind-nesting now enforced server-side
- The gap reproduces: POST (`blocks/route.ts:97-109`) + PATCH (`blocks/[blockId]/route.ts:122-141`) validated only
  parent-exists + same-course (+ PATCH self-parent), never the kind hierarchy that `getAvailableParentBlocks`
  (`blocks/new/page.tsx:189-214`) enforces only in the browser.
- The skeptic **strengthened ACCEPT** (single-tenant self-owned data, no security boundary; **no consumer reads the
  kind-nesting relationship at all** — CourseBuilder renders a *flat* list, indent derived from `block.kind` not a
  tree walk; child blocks render single-level; the distributor ignores nesting; pacing is dead) and flagged that a
  naive FIX risks rejecting legit PATCH edits. **Owner chose FIX anyway** (API hygiene / data integrity).
- Added a shared pure `validateBlockNesting(childKind, parentKind|null)` + `BLOCK_KIND_ALLOWED_PARENTS` to
  `src/lib/schemas/courses.ts` (extracted a named `courseBlockKindSchema`/`CourseBlockKind` for reuse), mirroring the
  client rules (UNIT top-level only; MODULE⊂UNIT; SECTION⊂UNIT/MODULE; CHAPTER⊂UNIT/MODULE/SECTION; LESSON⊂anything;
  null parent always allowed). Called from POST (after the parent-fetch) and PATCH.
- **PATCH validates the MERGED post-update `(kind, parentKind)` pair** (the skeptic's catch — `kind` and
  `parentBlockId` change independently): `effectiveKind = validated.kind ?? existingBlock.kind`, `effectiveParentId`
  from the request-or-existing parent, then the effective parent's kind (reusing the just-fetched parent when the
  parent changed, else one extra `select:{kind:true}` read). No UI regression (the UI never sends an illegal
  hierarchy).
- **Shape-locked** by the file's FIRST test `src/lib/schemas/courses.test.ts` (8 cases incl. the allowed-parents map
  ↔ client-rules sync invariant).
- Files: `src/lib/schemas/courses.ts`, `src/app/api/courses/[id]/blocks/route.ts`,
  `src/app/api/courses/[id]/blocks/[blockId]/route.ts` (M); `src/lib/schemas/courses.test.ts` (new).

### Q-17-007 ✅ RESOLVED — stale onboarding "Step 3 removed" comments corrected (comment-only)
- Same shape as the resolved Q-09-001 (comment-vs-code drift). The 3-step wizard is **correct**; the comments lied.
- Re-verify + skeptic confirmed: the **only** reader of `getBlueprintProgress().step` is `onboarding/page.tsx:19`;
  `blueprint/page.tsx` reads `progress.data` only. The wizard clamps `step=3 → currentStepIndex 2 →` the live
  `EnvironmentStep` (wired to `saveEnvironmentStep`), and "Complete Setup" → `/blueprint`. **Nothing treats
  `step===3` as terminal** — the "Done" semantics was encoded by nothing, pure stale narration.
- Corrected the false comments at `blueprint.ts:351-353` ("Step 3 removed" / "3 means Done … only 2 steps") and
  `onboarding.ts:108` ("Removed from wizard") to reflect the real 3-step resume flow. **No behavioral change** — a
  rewrite to match the stale comments was rejected as action-bias (it would delete a working, wired step). The benign
  no-`hasEnvironment`-check quirk (a fully-onboarded user re-lands on the optional Environment step) is out of scope.
- Files: `src/server/actions/blueprint.ts`, `src/lib/schemas/onboarding.ts` (M).

### Verification
- tsc **0 errors** · eslint **0 errors** / 1314 warnings · vitest **138/138** / **23** files (+8 tests/+1 file —
  `courses.test.ts`). `prisma/migrations/` untouched; 7 paths (5 M + 1 D + 1 new test).
- **Warning-baseline note:** the eslint warning count rose from S32's 651 to 1314 due to the owner's intervening
  `58d532e "all"` commit (a large working-tree sync between sessions), **NOT** this session's change — the 6 touched
  source files lint with 0 errors / 0 new warnings (verified directly), and the dead-file deletion only reduces the
  count. The gate that matters (0 errors) is green.

### Reconcile (§4 partition)
- 3 in-scope LOW → **3 closed (1 removed · 2 resolved)**; 0 unaccounted. **LOW: 28 − 3 = 25 open** (total still **78**;
  HIGH 5 / MED 20 unchanged). No new findings, no re-grades, no deferrals. No out-of-chapter sibling FINDING moved
  (ch.21 edits are code-currency cross-refs, not findings; ch.03/CHANGELOG historical records untouched).
- Counts reconcile across ch.17 §7 / ch.24 (§7 LOW running log + headline `28 → 25 open`) / 00-INDEX glance
  (`28 LOW → 25 LOW`).
- **ch.17 LOW done** (MED Q-17-002/003/004 + HIGH Q-17-001 remain).

---

## Session 2026-06-22 (round 37) — Session 34: ch.17 MED findings (owner-approved)

All 3 OPEN MED in ch.17 §7 re-verified at their cited `file:line` (all reproduce). A 3-skeptic adversarial Workflow
(one per finding, each tasked to REFUTE the draft + hunt regressions) returned **reproduces ✓ / FIX** on all three,
high-confidence, with **3 sharpenings adopted and 1 genuine latent bug surfaced** (→ minted Q-17-010). Owner approved
all 3 fixes + minting Q-17-010 [MED] deferred.

### Q-17-002 ✅ RESOLVED — CourseBuilder passed `courseId` as `organizationId` to ResourcePicker
- `CourseBuilder.tsx:683` `<ResourcePicker organizationId={courseId} …/>` (with a comment admitting "Using courseId
  as orgId proxy for now") → `getLibraryResources(organizationId)` filters every read by `where:{organizationId}`, so
  a course id matched nothing and all 6 library tabs (Books/Videos/Articles/Documents/Resources/Bundles) returned zero
  rows; only "Generate New" worked (kinds fetched separately).
- **One-line fix:** `organizationId={courseId}` → `organizationId={organizationId}` + deleted the comment. The real
  `organizationId` was already a prop (`CourseBuilder.tsx:387`), passed by `builder/page.tsx:208` and guaranteed
  non-null (the page redirects at `:30`). Skeptic verified: in scope, non-null, no `onSelect*/onSelectBundle` closure
  relied on the courseId-as-orgId value (they use the separate `courseId` var), no leak (under-fetch → correct-fetch).
  The other 2 ResourcePicker call sites (`PlannerGrid`, `GeneratorsClient`) already pass the real org id.
- Files: `src/components/courses/CourseBuilder.tsx` (M).

### Q-17-003 ✅ RESOLVED — `POST /api/courses` parent-gated + Zod-validated
- Reproduced: only `data.subjectId` presence was checked (no Zod on title/description), no `assertParentProfile()`,
  and the `new:` prefix mints globally-shared `Subject`/`Strand`. The structurally identical twin
  `library/books/route.ts:16-22` already ships the exact gate pattern.
- Added a Zod **`createCourseApiSchema`** to `src/lib/schemas/courses.ts` (`title z.string().trim().min(1).max(200)`,
  `description ≤2000` optional/nullable, `subjectId .min(1).max(255)`, `strandId`/`gradeBandId` bounded optional/nullable)
  parsed via `safeParse` → 400. **NOT `.uuid()`** — the route accepts `new:<name>` tokens, and the bound also caps the
  minted taxonomy-name length. **Skeptic catch:** a *different* `createCourseSchema` already exists at `actions.ts:12`
  (`.uuid()` + `gradeLevel`, for the server-action path) and would reject every `new:` mint — hence the distinct name.
- Added `assertParentProfile()` **wrapped → 403** ("This action requires a parent profile.") right after `auth()`,
  mirroring the twin route (the POST has no outer try/catch, so a bare throw would 500). Course authoring is now
  parent-only (consistent with block DELETE / `deleteCourse` / `addArticle`). Only POST caller is `courses/new/page.tsx`
  — no student flow breaks (grep-verified). Global Subject/Strand minting stays **by-design** (mirrors Topic/Subtopic).
- **+10 `courses.test.ts` cases** shape-lock the schema (minimal/full/`new:`-tokens/null-and-empty accepted;
  missing/whitespace title, missing subjectId, over-long title/subjectId rejected; trim applied).
- Files: `src/lib/schemas/courses.ts`, `src/app/api/courses/route.ts` (M); `src/lib/schemas/courses.test.ts` (M).

### Q-17-004 ✅ RESOLVED — org filter merged into the query predicate in all 6 course-REST handlers
- All 6 handlers (`[id]/route.ts` GET; `blocks/route.ts` GET+POST; `blocks/[blockId]/route.ts` GET+PATCH+DELETE) did
  `db.course.findUnique({where:{id:courseId}})` then a droppable post-fetch `if(!course || course.organizationId !==
  organizationId) 404`. With RLS off that `!==` is the only tenant boundary.
- **Fix (mirrors Q-11-001 / `curriculum-actions.ts:20`):** `db.course.findFirst({where:{id:courseId, organizationId}})`
  + `if(!course) 404`, plus a fail-closed `if(!organizationId) return 404` guard (narrows `string|null`→`string` AND
  closes the null-org case the old `!==` only caught "by luck" of `Course.organizationId` being non-nullable). The
  boundary is now a query predicate that can't be dropped.
- **No `withTenant`** — route handlers run in ONE async context, so `getCurrentUserOrg()`→`setRlsContext` lets the
  per-query extension GUC-scope every op under RLS-on (verified: NOT the background-job case Q-12-005 addressed;
  withTenant alone would leave the droppable `!==`, per Q-11-001). Block/parent-block/topic/subtopic lookups stay
  scoped by `courseId`/`id` (no org column). Skeptic confirmed the RLS-on policy audit (courses/course_blocks are
  independently FOR-ALL-gated) + the typecheck + that POST blocks still has `course.strandId`.
- Files: `src/app/api/courses/[id]/route.ts`, `src/app/api/courses/[id]/blocks/route.ts`,
  `src/app/api/courses/[id]/blocks/[blockId]/route.ts` (M).

### 🆕 Q-17-010 [MED] ⏳ DEFERRED — minted: `new:` taxonomy CREATEs hit SELECT-only RLS tables → fail under RLS-on
- The Q-17-004 adversarial pass surfaced it: the `new:` flow does `db.{subject,strand,topic,subtopic}.create` at 4
  sites (`api/courses/route.ts:35,59`, `api/courses/[id]/blocks/route.ts:132,167`), but migration
  `00000000000002:139-144` grants `app_user` **`FOR SELECT … USING(true)`** only on `subjects/strands/topics/subtopics`
  ("writes only via migrations/seeds as superuser") — **no INSERT policy**. Under RLS-on + the non-bypass `app_user`
  role, a command with no permitting policy is denied → every `new:` taxonomy create 500s.
- Latent (no live vuln; RLS off today). Belongs to the **Q-001 RLS-cutover gate (Workstream B)**: needs scoped INSERT
  policies via the batched migration, OR moving custom-taxonomy creation to a privileged/org-scoped path. **NOT caught
  by Q-001's GRANT-level readiness check (Session 8) — that is row-policy-blind.** Out of scope for an app-layer MED
  session (needs a migration or a design change). Cross-linked in ch.24 §5 (RLS-cutover roadmap + runbook).

### Consequential doc-currency (not new findings)
- ch.04 §3.5 `assertParentProfile` consumer count **11 → 13** (added `api/courses` POST; the count was already stale
  since Session 28 added the 4 `api/library/*` routes) + ch.05 §6 importer list gained `api/courses/route.ts` (POST)
  and the library routes.

### Verification
- tsc **0 errors** · eslint **0 errors** / 1314 warnings (unchanged baseline — no new `any`) · vitest **148/148** /
  **23** files (+10 schema tests in the existing `courses.test.ts`). `prisma/migrations/` untouched; 6 code files M +
  1 test (M).

### Reconcile (§4 partition)
- 3 in-scope MED → **3 resolved**; **+1 minted** (Q-17-010 ⏳ deferred); 0 unaccounted. **MED: 20 − 3 + 1 = 18 open**
  (total 78 → **79**; HIGH 5 / LOW 25 unchanged). No re-grades, no dismissals.
- Counts reconcile across ch.17 §7 / ch.24 (headline `20 → 18 open` + MED by-theme header + count-basis lineage +
  the new Q-17-010 by-theme entry) / 00-INDEX glance (`20 MED → 18 MED`).
- **ch.17 now LOW+MED done; HIGH Q-17-001 (broken activity flow) remains.** No out-of-chapter sibling FINDING moved
  (ch.04/05 edits are code-currency cross-refs).

### 👤 Owner follow-up
- **Nothing pushed — owner deploys.** Q-17-010 to be addressed as part of the Q-001 RLS cutover (add INSERT policies
  for the reference tables, or rework `new:` minting) before flipping `RLS_ENABLED=true`.

---

## Session 2026-06-22 (round 38) — Session 35: ch.17 HIGH findings (owner-approved)

The sole OPEN HIGH in ch.17 §7 — **Q-17-001** — re-verified at its cited `file:line` (reproduces exactly:
`activities/new/page.tsx:86` POSTs to `/api/courses/{id}/blocks/{blockId}/activities`, no route file exists; the
page is live-and-reachable via the block-edit "Add Activity" link for LESSON blocks; lines 79-84 are an abandoned
author's note). A code-truth sweep proved **no path anywhere creates an `Activity`** (zero `activity.create`/`createMany`
repo-wide; only the broken route + an account-cascade `deleteMany`), while the `Activity` model is richly integrated
(objectives/progress/schedule-items/assignments) and the read/display side already works — i.e. **unfinished, not
superseded**: ~90% scaffolded, only the create handler missing. Presented as **OWNER_DECISION** (build vs remove vs
park; "keep as-is" dominated — a live broken button is the worst state for a HIGH). **Owner chose BUILD** (the
Q-05-010/Q-16-005 "build-it-now when data + pattern exist" precedent).

### Q-17-001 ✅ RESOLVED — built the missing activities POST route
- **New file** `src/app/api/courses/[id]/blocks/[blockId]/activities/route.ts` (POST), mirroring `blocks/route.ts`
  POST + the Q-17-003 parent-gate + the Q-17-004 merged-predicate org check: `auth`→401 → `assertParentProfile()`
  **wrapped → 403** → `getCurrentUserOrg()` + `if(!organizationId) 404` guard → `course.findFirst({id, organizationId})`
  →404 → `courseBlock.findFirst({id, courseId})` →404 + **LESSON-only** check →400 → `createActivityApiSchema.safeParse`
  →400 → verify optional `objectiveId` exists (global spine, CONTEXT_FREE) →400 → compute next `position` (max+1 within
  the block; client sends none) → `db.activity.create` (`createdByUserId` from session) **+ optional `ActivityObjective`
  link** (`objective: { connect: { id } }`) → `{activity}`.
- **No `withTenant`** — a route handler is session-scoped, so `getCurrentUserOrg()`→`setRlsContext` lets the per-query
  extension GUC-scope the create under RLS-on (the Q-17-004 reasoning, NOT the Q-12-005 bg-job case). `activities` /
  `activity_objectives` are **join-scoped ORG tables** (scoped via course_block→course→org; migration-2 deeper-join
  chains), NOT SELECT-only reference tables → no new RLS-cutover blocker (contrast Q-17-010).
- **No Objective minting** — the client drops `new:` custom objectives (`activities/new/page.tsx:91` sends `undefined`),
  so the route only LINKS an existing Objective. This sidesteps the SELECT-only-RLS write-failure class (Q-17-010).
- **Shared schema** `createActivityApiSchema` + `activityTypeSchema` added to `src/lib/schemas/courses.ts` (title trimmed
  `.min(1).max(200)`; `description ≤2000` optional/nullable; `activityType` = the 7-value Prisma `ActivityType` enum,
  kept in sync; `objectiveId` bounded optional/nullable — NOT `.uuid()`; `estimatedMinutes` `z.coerce.number().int()
  .positive().max(100000)` optional/nullable since the JSON body may carry a number or numeric string).
- **Create→display loop closes end-to-end:** the block GET (`blocks/[blockId]/route.ts:55`) already includes
  `activities` (id/title/activityType/position), and the form routes back to the block page on success.
- **Currency fixes (part of completing the feature honestly, not new findings):** corrected the now-false "(coming soon)"
  copy at `blocks/[blockId]/page.tsx:443,456`; replaced the abandoned author-comments in `activities/new/page.tsx`'s
  `onSubmit` ("…I should have checked if the API exists…") with an accurate one-liner.
- **Residual (logged, not fixed):** a `new:` custom objective typed in the form is silently dropped client-side —
  existing-objective linking works; minting custom Objectives is the Q-17-010-class privileged-path problem, out of
  scope here.
- **+13 `createActivityApiSchema` tests** in `src/lib/schemas/courses.test.ts` (minimal/full bodies; all 7 enum values;
  unknown/missing type rejected; missing/whitespace title rejected + trimmed; numeric-string coercion; non-positive/
  non-int rejected; null/omitted optionals; over-long title/objectiveId rejected).
- Files: **NEW** `src/app/api/courses/[id]/blocks/[blockId]/activities/route.ts`; M `src/lib/schemas/courses.ts`,
  `src/lib/schemas/courses.test.ts`, `src/app/courses/[id]/blocks/[blockId]/page.tsx`,
  `src/app/courses/[id]/blocks/[blockId]/activities/new/page.tsx`.

### Cross-chapter check (no finding moved)
- **ch.19 Q-19-002** (`getSubtopicObjectives` lacks an auth gate / skips Zod on the string branch): the broken page is
  its sole live caller. BUILD left the page in place (now functional) and **unchanged at the cited line `:65`** (the
  comment cleanup was later in the file, in `onSubmit`), so Q-19-002 **still reproduces — stays OPEN/LOW, no change**.
  (Had the owner chosen REMOVE, deleting the page would have orphaned that caller and required a ch.19 update.)

### Verification
- tsc **0 errors** (the Prisma nested `ActivityObjective` create typechecks) · eslint **0 errors** / **1314 warnings**
  (unchanged baseline — the 5 touched files lint 0/0, confirmed directly) · vitest **161/161** / **23** files
  (148 + 13 new). `prisma/migrations/` (and all of `prisma/`) **untouched**; scoped `git status` shows only the 5
  intended paths.

### Reconcile (§4 partition)
- 1 in-scope HIGH → **1 resolved**; 0 minted / re-graded / deferred / dismissed; 0 unaccounted.
- **HIGH: 5 → 4 open** (MED 18 / LOW 25 unchanged; total 79 → **78** open of the four feature grades… HIGH-by-theme
  now ch.12×1 [Q-12-007 ⏳] + ch.18×1 + ch.20×2 = 4). Foundational `Q-001` [HIGH] still OPEN, outside this headline.
- Counts reconcile across ch.17 §7 (Q-17-001 ✅) / ch.24 (HIGH header `5 → 4`, top-line tally `5 HIGH → 4 HIGH`,
  register row struck, roll-up table, Workstream-B list, "broken/unfinished" bullet removed) / 00-INDEX glance
  (`5 HIGH → 4 HIGH` + the remaining-HIGH prose).
- **ch.17 now FULLY TRIAGED** (LOW S33 / MED S34 / HIGH S35).

### 👤 Owner follow-up
- **Nothing pushed — owner deploys.** Activity authoring now works end-to-end; the only residual is the dropped-`new:`-
  objective UX gap (would need the Q-17-010-class privileged taxonomy path).

## Session 2026-06-22 (round 39) — Consolidated final pass / ch.18 LOW findings (Q-18-004/005/006/007)

**Start of the consolidated final pass (ch.18→24, all grades — owner directive 2026-06-22).** Sessions 1-35 cleared
ch.01-17 one cell at a time; the remaining backlog is now worked in one continuous pass (SKILL §9 "Consolidated
final-pass mode"). Baseline confirmed green before any change: tsc 0 / eslint 0-err·1314-warn / vitest 161 (after the
known stale-vite-cache wipe — §9.5). All 4 ch.18 §7 LOW re-verified at their cited `file:line` (reproduce); a 4-skeptic
adversarial Workflow (one per finding, each tasked to REFUTE) **overrode the Q-18-004 lean** and confirmed the other
three. Owner standing authority (clear-cut dispositions) → **3 closed · 1 deferred**.

### Q-18-007 ✅ RESOLVED — grading save UX → house pattern
- `src/components/grading/GradingInterface.tsx`: replaced the 4 blocking `alert()` calls with sonner
  `toast.success`/`toast.error` and `window.location.reload()` with `router.refresh()` (added `useRouter` +
  `toast` imports + `const router = useRouter()`).
- Matches the established house convention: `NewAttemptForm.tsx` (sonner + `useRouter`) and `PrayerJournalClient.tsx:117-119`
  (does the identical `toast.success(...) + router.refresh()`, with a comment to avoid `window.location.reload()`).
  `<Toaster>` is mounted at `layout.tsx:46`. The attempt page re-fetches on `router.refresh()` so the GRADED status badge +
  persisted scores show, and client state is preserved (the doc's "loses per-item feedback on reload" no longer applies).
- Files: M `src/components/grading/GradingInterface.tsx`.

### Q-18-005 ✅ ACCEPTED — `letterGrade`/`isCorrect` aspirational columns (impact corrected)
- Re-verify CONFIRMED **zero readers** of `AssessmentAttempt.letterGrade` and `AssessmentItemResponse.isCorrect` anywhere
  in `src/` (the only `isCorrect` hits are unrelated catechism-quiz UI state). The transcript subsystem types course grades
  into a `TranscriptData` JSON blob and never queries attempts; master-context only counts GRADED attempts; data-export omits
  attempts. So the finding's original "transcripts/reporting will see nulls" impact was **OVERSTATED** — corrected in ch.18 §7
  to "purely cosmetic schema↔code drift, no live consumer."
- No code change: populating them now is false precision — `letterGrade` needs an attempt-level grading-scale policy that
  doesn't exist (the only scale logic is course-level per-transcript), `isCorrect` is undefined for partial-credit/free-response,
  and both columns are nullable. Aspirational columns; a future attempt-level grading-scale feature is on the §5 roadmap.

### Q-18-006 ✅ ACCEPTED — no student-facing assessment-taking flow (roadmap)
- The only resolution is a multi-file student-facing assessment-taking feature (new routes + UI + response capture),
  explicitly "a separate, larger feature" (`assessment-actions.ts:7-14`) — disproportionate for a LOW and barred by the
  pass constraints. Already on the ch.24 §5 roadmap (lines 99-100) + §3 status dashboard. Q-18-006 is the canonical register
  home (ch.16 documents `createAssessmentAttempt` as PARTIAL but mints no finding). No code change.

### Q-18-004 ⏳ DEFERRED — folded into the Q-18-001 server-side fix (same pass, ch.18 HIGH)
- Grades are always labeled `AI_ASSISTED` (client `GradingInterface.tsx:102` + route default `route.ts:43`); MANUAL is never
  set. The adversarial pass **refuted** a standalone client-only heuristic: `gradingMethod` has **zero readers**, the value
  stays client-spoofable until validated at the trust boundary (the sibling **Q-18-001** [HIGH], same untrusted POST), and a
  client heuristic would mislabel a re-graded AI attempt as MANUAL (local feedback state isn't seeded on mount). Resolving it
  authoritatively **server-side alongside Q-18-001** (the ch.18 HIGH cell, this pass) makes the field honest AND trustworthy in
  one change. Stays tracked-OPEN at LOW (deferred ≠ closed). *(Also noted: the re-grade flow's `scorePoints` sum only counts
  items touched in the current session — a separate latent correctness gap, out of these findings' scope; flagged for owner
  awareness, not minted.)*

### Verification
- tsc **0 errors** · eslint **0 errors / 1314 warnings** (unchanged baseline; the changed `GradingInterface.tsx` lints 0/14,
  all 14 pre-existing — no new warning from the 3 added-and-used symbols) · vitest **161/161** / 23 files (the UX swap is a
  client component with no test harness coverage; matches the area). `prisma/` (all of it) **untouched**; scoped `git status`
  shows only the intended paths (1 code file + the docs).

### Reconcile (§4 partition)
- 4 in-scope LOW → **3 closed** (Q-18-007 resolved · Q-18-005/006 accepted) · **1 deferred** (Q-18-004); 0 minted /
  re-graded / dismissed; 0 unaccounted.
- **LOW: 25 → 22 open** (78 total unchanged — no mint/re-grade). MED 18 / HIGH 4 unchanged.
- Counts reconcile across ch.18 §7 (4 entries marked) / ch.18 §5 (`GradingInterface` row updated) / ch.24 §7 LOW running
  log (`25 → 22 open` + new round) / 00-INDEX glance (`25 LOW → 22 LOW`).

### 👤 Owner follow-up
- **Nothing pushed.** Q-18-004 will close in the ch.18 HIGH cell (this pass) as part of the Q-18-001 grading-API validation fix.

## Session 2026-06-22 (round 40) — Consolidated final pass / ch.18 MED findings (Q-18-002, Q-18-003)

Both OPEN ch.18 MED re-verified at their cited `file:line` (reproduce). A 3-skeptic adversarial Workflow (the 3rd skeptic
also scoped the upcoming Q-18-001 HIGH) **caught a latent RLS regression in my proposed atomicity mechanism** and was
otherwise FIX-as-proposed. Both fixes land in `src/app/api/grading/[id]/route.ts`. CI green throughout.

### Q-18-002 ✅ RESOLVED — grading POST tenant boundary
- Replaced `db.assessmentAttempt.findUnique({where:{id}})` + the post-fetch `course.organizationId !== organizationId`
  with a **merged relation predicate** `db.assessmentAttempt.findFirst({where:{id, assessment:{course:{organizationId}}}, select:{id:true}})`
  (AssessmentAttempt has no direct org column — the relation filter mirrors the RLS policy `assessment_id IN (… courses
  WHERE account_id = current_org)`, migration-2:104). Added a fail-closed `if(!organizationId) → 404` guard (also narrows
  `string|null`→`string`). Dropped the now-unneeded `assessment.course` include.
- No `withTenant` on the single-op lookup — a route handler is session-scoped, so `getCurrentUserOrg()`→`setRlsContext`
  (auth-helpers.ts:29) lets the per-query extension scope it under RLS-on (the Q-17-004 reasoning). No live vuln today
  (the guard preceded the writes) — this is RLS-readiness + refactor-safety (the post-fetch `!==` was the sole, droppable
  tenant boundary with RLS inert).

### Q-18-003 ✅ RESOLVED — atomic persistence, no N+1
- The attempt-header `update` + all per-item writes now run in **one `withTenant(async (tx) => {…}, undefined,
  {organizationId, userId})` transaction** (atomic — a mid-write failure no longer leaves the attempt `GRADED` with
  partially-updated items). The per-item `findFirst`+`update` N+1 is replaced by `tx.assessmentItemResponse.updateMany({where:{attemptId, itemId}})`
  on the `@@unique([attemptId,itemId])` — 0-or-1 rows, and the 0-row case reproduces the old `if (response)` skip.
- **Adversarial-pass override (the load-bearing catch):** my initial recommendation used `db.$transaction([update, ...updateMany])`
  (batch-array form). All three skeptics independently REFUTED it: on the RLS-extended `db` client each batch element
  self-transacts (`$allOperations` → `base.$transaction([setConfigRaw, query])`, db.ts:118-127), so an outer batch **nests
  tenant transactions** — which db.ts:91-97 explicitly forbids. It is invisible today (RLS off → `db===base` → a plain
  batch, CI green) but **detonates at the RLS cutover** (the exact scenario the finding hardens): "Transaction already
  closed", or a silent set_config-on-wrong-connection tenant-scoping failure, or a pool deadlock. `withTenant` runs
  `base.$transaction(async tx => …)` on the un-extended client with the GUC set once — the codebase's only RLS-correct
  multi-write pattern (precedent: `account-actions.ts`, `suggest-blocks.ts`, the page loader `grading/[id]/page.tsx:29-66`).
- Import: `{ db }` → `{ db, withTenant }`. Data-handling is otherwise byte-identical to the prior code (still trusts client
  `scorePoints`/`maxPoints`/`gradingMethod` — that hardening is the Q-18-001 HIGH cell, next).
- Files: M `src/app/api/grading/[id]/route.ts`.

### Verification
- tsc **0 errors** · eslint **0 errors / 1314 warnings** (the route file lints **0 problems** — the `Record<string,unknown>`
  typing avoids `any`) · vitest **161/161** / 23 files (no DB in the harness, so the route `where`/`withTenant` change has no
  unit test — matches the area). `prisma/` **untouched**; scoped `git status` shows only the route file + the docs.

### Reconcile (§4 partition)
- 2 in-scope MED → **2 resolved**; 0 minted / re-graded / deferred / dismissed; 0 unaccounted.
- **MED: 18 → 16 open** (LOW 22 / HIGH 4 unchanged). Counts reconcile across ch.18 §7 (Q-18-002/003 ✅) / ch.18 §5
  (route POST row) / ch.24 MED header (`18 → 16`), lineage note, both by-theme entries (Q-18-002 tenancy, Q-18-003 N+1) /
  00-INDEX glance (`18 MED → 16`).

### 👤 Owner follow-up
- **Nothing pushed.** ch.18 HIGH (Q-18-001 + the folded-in Q-18-004) is next — it will layer Zod validation + server-side
  score recomputation onto this now-atomic, tenant-scoped handler.

## Session 2026-06-22 (round 41) — Consolidated final pass / ch.18 HIGH (Q-18-001) + folded-in Q-18-004

The sole OPEN ch.18 HIGH (Q-18-001) re-verified (reproduces) + the LOW Q-18-004 deferred from the LOW cell, resolved
together (both are about the same untrusted grading POST). Design was the unanimous recommendation of the round-40
3-skeptic Workflow's Q-18-001 reviewer: **recompute server-side, don't merely reject garbage** (a forged total within
per-item bounds would still pass bounds-only validation). CI green throughout.

### Q-18-001 ✅ RESOLVED — grading POST validated + server-authoritative grade
- **New** `src/lib/schemas/grading.ts`: `gradeAttemptApiSchema` (+ `gradingMethodSchema`). Bounds only what the client
  legitimately supplies — `itemScores` (itemId → finite non-negative number, `z.coerce`), `itemFeedback`/`feedback`
  (≤10000 chars), `gradingMethod` (the `GradingMethod` enum). `scorePoints`/`maxPoints` are deliberately NOT in the
  schema (Zod strip-mode drops any the client sends).
- **`src/app/api/grading/[id]/route.ts`:** `safeParse`→400 (`error.flatten()`); the tenancy `findFirst` now also selects
  `assessment.items{id,points}` + existing `itemResponses{itemId,pointsEarned}`; the handler **recomputes** the grade —
  for each assessment item, `clamp(submitted ?? existing ?? 0, 0, item.points)`, summing to `scorePoints` with
  `maxPoints` from the item points. Client totals are ignored; no per-item score can exceed its item's points; unknown
  itemIds in the payload are ignored; the existing-score fallback keeps re-grade totals correct even if the client sends
  only touched items. `gradingMethod` is enum-validated (no arbitrary strings). All writes stay inside the Q-18-003
  `withTenant` tx.
- **+ `src/lib/schemas/grading.test.ts`** (11 cases): enum accept/reject, empty/full body, numeric-string coercion,
  negative + non-finite rejection, over-long-string rejection, null feedback, and that client `scorePoints`/`maxPoints`
  are stripped.

### Q-18-004 ✅ RESOLVED (folded in) — honest, server-validated gradingMethod
- `src/components/grading/GradingInterface.tsx` `handleSave` now sends `gradingMethod: usedAI ? "AI_ASSISTED" : "MANUAL"`
  (`usedAI` = any item/overall Inkling feedback generated this session) and **no longer sends `scorePoints`/`maxPoints`**
  (the server recomputes them) — which also removed the duplicate total computation (and its `any`, −1 lint warning).
  Combined with the server enum-validation, the field is honest (a hand-scored attempt → MANUAL) AND no longer
  client-spoofable. The rare re-grade-without-regenerate case labels the session's action MANUAL — a defensible semantic
  for a zero-reader audit field (and the only realistic UI path is a single grade per attempt).
- Files: M `src/app/api/grading/[id]/route.ts`, M `src/components/grading/GradingInterface.tsx`, NEW
  `src/lib/schemas/grading.ts`, NEW `src/lib/schemas/grading.test.ts`.

### Verification
- tsc **0 errors** · eslint **0 errors / 1313 warnings** (−1 vs the 1314 baseline — the removed duplicate total
  computation in `handleSave` carried one `any`; the route + both new schema files lint 0/0) · vitest **172/172** / **24**
  files (+11 / +1 — `grading.test.ts`). `prisma/` **untouched**; scoped `git status` shows only the grading files + docs.

### Reconcile (§4 partition)
- ch.18 HIGH: 1 in-scope → **1 resolved** (Q-18-001); + folded-in **Q-18-004 ✅ resolved** (was the LOW cell's 1 deferred).
- **HIGH: 4 → 3 open** (remaining: ch.12×1 Q-12-007 ⏳, ch.20×2 Q-20-001/002). **LOW: 22 → 21 open** (Q-18-004 closed).
  MED 16 unchanged.
- Counts reconcile across ch.18 §7 (Q-18-001/004 ✅) / ch.18 §5 (route POST → DONE, GradingInterface row) / ch.24 HIGH
  header (`4 → 3`), lineage, register table (Q-18-001 struck), §3 dashboard line, §5 write-path + Workstream-B lists, LOW
  running log (`22 → 21` + the folded-in note) / 00-INDEX glance (`4 HIGH → 3`, `22 LOW → 21`, remaining-HIGH prose).
- **ch.18 now FULLY TRIAGED** (LOW round 39 / MED round 40 / HIGH round 41).

### 👤 Owner follow-up
- **Nothing pushed.** The grading API is now hardened end-to-end (validated, server-authoritative grade, tenant-scoped,
  atomic). Two known *features* remain on the §5 roadmap (not findings): a real student-facing assessment-taking flow
  (Q-18-006) and attempt-level `letterGrade`/`isCorrect` once a grading-scale exists (Q-18-005). Advancing to ch.19.

## Session 2026-06-22 (round 42) — Consolidated final pass / ch.19 LOW findings (Q-19-002/004/006)

**Doc-only cell — all 3 LOW ✅ ACCEPTED by-design.** A 5-skeptic adversarial Workflow (covering both ch.19 cells)
**refuted my action-bias on all three LOW** and corrected three factual inaccuracies in the finding text. No code changed
this cell; the value is code-is-truth doc corrections. (The MED cell Q-19-001/003 follow next.)

### Q-19-002 ✅ ACCEPTED — ungated global read is correct-by-design
- The lean (add a `getCurrentUserOrg()` gate + always-Zod) was REFUTED: the true functional twin is
  `spine-actions.ts:getObjectives` (same global `Objective` table, same `select`/`take:200`) which is *also* ungated
  (validate-only) — a gate here creates inconsistency, not safety. Objectives are global CONTEXT_FREE data (no
  `organizationId`); the same taxonomy is already served unauthenticated via the REST routes; `getCurrentUserOrg()` throws
  on no session → a gate would be a regression for zero gain. The Zod-skip on the string branch is an **inert footgun**
  (`subtopicId` is a plain Prisma `String`, not crashable/injectable; live caller sends a DB-sourced UUID).
- Doc correction: the finding's "inconsistent with the file's own security comments" is FALSE — the `// SECURITY:` comments
  sit only on the tenant-scoped `getCourseBooks`/`getBookChapters`, none on `getSubtopicObjectives`. §5 row → DONE.

### Q-19-004 ✅ ACCEPTED — two diverged read surfaces; don't merge
- Merging the REST routes and `spine-actions.ts` is disproportionate for a LOW: diverged contracts (REST selects the parent
  FK + `{strands}` envelope + no Zod; actions Zod-validate + `{success}` + take) and different consumption (`fetch` vs
  server-action import). The dead 3rd copy (`queries/curriculum.ts`) is removed by Q-19-003 (MED), leaving two intentional
  surfaces.
- Two doc corrections from the adversarial pass: (1) the spine tables ARE user-extensible at runtime (the `new:` minting in
  `courses/route.ts` + `blocks/route.ts`, no `name` uniqueness) and GLOBAL — so they grow slowly; "small/complete" was
  wrong; (2) the REST routes returning ALL rows is the *correct* complete-dropdown behavior — it's the **actions** capping
  at 100/200 that could silently truncate. A generous `take` ceiling on the REST routes is an optional owner-discretionary
  nicety (NOT done — the unbounded complete read is correct and growth is slow/bounded by the RLS cutover that stops `new:`
  minting, Q-17-010).

### Q-19-006 ✅ ACCEPTED — cosmetic route-hardening drift (evidence corrected)
- Cosmetic: all 6 routes import the pg-adapter Prisma client so all already REQUIRE the Node runtime — which is the Next 16
  App Router default (no `runtime="edge"` in src) — so the 2 pins merely restate the default; propagate-vs-custom-500 is
  functionally equivalent.
- Doc correction: the finding's evidence claimed `resource-kinds` pins `runtime="nodejs"` — it does NOT (verified by grep:
  only `subjects` + `topics` pin it). The runtime-pin normalization folds into the Q-19-001 MED edit (which touches all 6
  routes for auth).

### Verification
- No code changed (markdown-only) → CI baseline unchanged-green from round 41 (tsc 0 / eslint 0-err·1313 / vitest 172/172).
  `prisma/` untouched.

### Reconcile (§4 partition)
- 3 in-scope LOW → **3 accepted-by-design**; 0 fixed/removed/re-graded/deferred; 0 unaccounted.
- **LOW: 21 → 18 open** (MED 16 / HIGH 3 unchanged). Counts reconcile across ch.19 §7 (3 ✅ ACCEPTED) / ch.19 §5
  (`getSubtopicObjectives` → DONE) / ch.24 register top-line (`21 → 18`), LOW running log / 00-INDEX glance (`21 → 18`).

### 👤 Owner follow-up
- **Nothing pushed.** ch.19 MED next: Q-19-001 (add `auth()`→401 + normalize runtime across the 6 spine routes) +
  Q-19-003 (remove the dead `server/queries/curriculum.ts`).

## Session 2026-06-22 (round 43) — Consolidated final pass / ch.19 MED findings (Q-19-001, Q-19-003)

Both OPEN ch.19 MED closed (the 5-skeptic Workflow from round 42 covered these too — both FIX/REMOVE, high-confidence,
with the Q-19-003 skeptic proving build-safety via a move-aside `tsc` delta of 0). CI green.

### Q-19-001 ✅ RESOLVED — session-gate the Academic-Spine REST surface
- Added `const session = await auth(); if (!session?.user) return 401;` to all 6 GET handlers
  (`subjects`/`strands`/`topics`/`subtopics`/`grade-bands`/`resource-kinds`), copying the in-repo `courses/route.ts`
  pattern. **No org filter** — the spine is global reference data (CONTEXT_FREE), so the only behavior change is that an
  unauthenticated caller now gets 401 instead of 200; every live consumer is an authenticated app page (courses/new,
  blocks/*, BookScanner, VideosClient, GeneratorsClient, ResourcePicker), so none is affected. An adversarial census of all
  26 API routes confirmed these were the ONLY data-bearing GETs with no session gate.
- **Folded in Q-19-006** (ch.19-LOW, accepted-cosmetic): normalized `export const runtime = "nodejs"` across all 6 (was
  on only `subjects`+`topics`). Defensive — the pg-adapter Prisma client cannot run on the edge runtime, so the explicit
  pin prevents an accidental edge flip; it also makes the 6 routes uniform. Added `import { auth } from "@/auth"`.
- Files: M all 6 `src/app/api/curriculum/*/route.ts`.

### Q-19-003 ✅ REMOVED — dead curriculum-queries module
- `git rm src/server/queries/curriculum.ts` (218 lines: `getAvailableTools`/`getObjectives`/`getSpineHierarchy`/
  `getObjective`). Build-safety proven: grep = zero importers repo-wide (no barrel/dynamic import); the skeptic's
  move-aside + `npx tsc --noEmit` delta = 0 new orphan errors (and I re-ran the full `tsc` in the main tree = 0). The live
  spine reads use `spine-actions.ts` + the REST routes; the dead `getObjectives` had a divergent signature from the live
  one, so zero accidental-resolution risk. Same playbook as Q-11-005.
- Doc-currency tail (not new findings): annotated the now-dangling `server/queries/curriculum.ts:9` reference in
  ch.11 §7 Q-11-005's Impact note (the disambiguation target is deleted); the duplicate reference in CHANGELOG round 24
  (line ~1387) is left as an append-only historical log entry. Q-19-004's title/evidence updated from "three
  implementations" → "two" (the dead 3rd copy is gone).
- Files: D `src/server/queries/curriculum.ts`.

### Verification
- tsc **0 errors** · eslint **0 errors / 1313 warnings** (unchanged — the dead module had no warnings; the 6 routes lint
  0/0) · vitest **172/172** / 24 files (no DB in harness for the route `auth()` change; no test imported the dead module).
  `prisma/` **untouched**; scoped `git status` = the 6 routes M + the dead module D + docs.

### Reconcile (§4 partition)
- 2 in-scope MED → **1 resolved (Q-19-001) · 1 removed (Q-19-003)**; 0 minted/re-graded/deferred; 0 unaccounted.
- **MED: 16 → 14 open** (LOW 18 / HIGH 3 unchanged). Counts reconcile across ch.19 §7 (Q-19-001 ✅ / Q-19-003 ✅) /
  ch.19 §1/§3/§5/§6 (module REMOVED rows; routes auth-gated; Q-19-004 "two surfaces") / ch.24 MED header (`16 → 14`),
  lineage, both by-theme entries, §3 dashboard, §5 hardening list / register top-line (`16 → 14`) / 00-INDEX glance.
- **ch.19 now FULLY TRIAGED** (LOW round 42 / MED round 43; no HIGH).

### 👤 Owner follow-up
- **Nothing pushed.** Advancing to ch.20 (family-discipleship) — note it carries 2 of the remaining 3 HIGH (Q-20-001/002).

## Session 2026-06-22 (round 44) — Consolidated final pass / ch.20 LOW findings (Q-20-005/007/008/010)

A 9-skeptic adversarial Workflow (all 9 open ch.20 findings) **corrected my action-bias on the LOW cell** — only Q-20-005
warranted code; 007/010 were over-leaned to FIX (the proxy/cold-path realities flip them to ACCEPT) and 007/008/010 had
factually-wrong evidence corrected. **3 dead symbols removed; 1 finding kept-for-wiring; 3 accepted.**

### Q-20-005 ✅ RESOLVED (split) — dead exports
- Removed 3 truly-dead symbols: `searchBible` (`bible-study.ts`, + its orphaned `searchBibleSchema` / `ESVSearchResponse` /
  `ESVSearchResult` / `MAX_SEARCH_RESULTS` tail — the full intra-file dead chain), `fetchUnreachedByCountry`
  (`joshua-project.ts`), and `toggleQuestionMastery` (`student-catechism.ts` — a redundant twin of the live
  `markQuestionAsMastered`). All zero-importer (grep-confirmed).
- **`lib/schemas/bible-memory.ts` is NOT dead-to-delete** — its schemas map 1:1 to the unvalidated bible-memory actions, so
  it is the remediation vehicle for Q-20-006 (ch.20-MED): fix `.cuid()`→`.uuid()` + wire. Kept this cell; wired in the MED cell.
- Files: M `src/server/actions/bible-study.ts`, `src/lib/joshua-project.ts`, `src/app/actions/student-catechism.ts`.

### Q-20-007 ✅ ACCEPTED — student suite pages (defense-in-depth note)
- The lean (add auth + org check) was REFUTED: `src/proxy.ts` fail-closed redirects sessionless `/students/*` to `/login`
  (+ `profile-access.ts` profile gating), so the "renders for unauthenticated callers" impact is FALSE. The only residual —
  a cross-tenant `studentId` in client props — is inert: `DiscipleshipDashboard` uses it only for href suffixes, and
  `InteractiveCatechism`'s `studentId` calls all hit `assertStudentInOrg` (throws). Corrected the impact; kept as a
  defense-in-depth note. No code change.

### Q-20-008 ✅ ACCEPTED (won't-fix) — half-built Public/Private toggle
- Corrected evidence: `isPrivate` is **never persisted** (`createPrayerEntry` hardcodes `false`; schemas omit it; the only
  other writer is dead Q-20-004), and there ARE cosmetic consumers (Lock icon + "Private" badge) that therefore never
  trigger. No leak (all prayer reads are per-user). Wire-vs-remove is a product/UI decision → §5 roadmap. No code/schema change.

### Q-20-010 ✅ ACCEPTED — `mission-stats.json` per-request read
- Corrected scope: only the Missions page calls `getOperationWorldStats` (once/render); Neighbor never does. The 175KB is
  already RSC-serialized to the client, so the server parse is the minor cost; React `cache()` would be a no-op
  (request-scoped). Cold-path micro-opt, disproportionate to fix. No code change.

### Verification
- tsc **0 errors** · eslint **0 errors / 1313 warnings** (unchanged — the removed `fetchUnreachedByCountry` `any` was already
  `eslint-disable`d; no new orphans) · vitest **172/172** / 24 files. `prisma/` untouched; scoped `git status` = the 3 code
  files M + docs.

### Reconcile (§4 partition)
- 4 in-scope LOW → **1 resolved (Q-20-005) · 3 accepted (Q-20-007/008/010)**; 0 re-graded/deferred; 0 unaccounted.
- **LOW: 18 → 14 open** (MED 14 / HIGH 3 unchanged). Counts reconcile across ch.20 §7 (4 marked) / ch.20 §5 (3 REMOVED rows +
  bible-memory.ts PENDING-WIRE) / ch.24 LOW running log (`18 → 14`) + register top-line (`18 → 14`) + §5 roadmap (Q-20-008) /
  00-INDEX glance (`18 → 14`).

### 👤 Owner follow-up
- **Nothing pushed.** ch.20 MED next: Q-20-003 (getBibleText arg-shape one-liner), Q-20-004 (remove 5 dead legacy exports),
  Q-20-006 (fix+wire bible-memory.ts schemas). The Q-20-008 Public/Private toggle awaits your wire-vs-remove call (§5 roadmap).

## Session 2026-06-22 (round 45) — Consolidated final pass / ch.20 MED findings (Q-20-003/004/006)

All 3 OPEN ch.20 MED closed (the round-44 9-skeptic Workflow covered these — all FIX/REMOVE with refinements I applied).
CI green.

### Q-20-003 ✅ RESOLVED — bible-memory add-verse arg shape
- `addVerseToUser` called `getBibleText(data.reference)` (bare string) but `getBibleText` expects `{reference}` (Zod object)
  → threw → caught → text="" on add. Fixed to `getBibleText({ reference: data.reference })`. **Kept** the surrounding
  try/catch→`text=""` (the skeptic's catch: removing it would turn a transient ESV outage / bad reference into a failed
  add; PracticeMode lazy-backfills the text on first practice). File: M `bible-memory/actions.ts`.

### Q-20-004 ✅ REMOVED — dead legacy family-discipleship actions
- Deleted the 5 dead legacy exports (`createPrayerRequest`/`togglePrayerAnswered`/`deletePrayerRequest`/`addMemoryVerse`/
  `deleteMemoryVerse`) from `family-discipleship/actions.ts` — zero importers (grep), raw `db` (no withTenant), duplicating
  the live `prayer-journal.ts` / bible-memory paths. Kept `addChurchNote`/`deleteChurchNote` (the only wired exports,
  ChurchNotesClient). Confirmed PrayerJournalClient's `togglePrayerAnswered` imports from the LIVE `prayer-journal.ts`
  (the naming collision is resolved by removal). Shared imports stay live via the church-note actions. File: M.

### Q-20-006 ✅ RESOLVED — wire bible-memory input validation (+ completes Q-20-005's schema part)
- Fixed `lib/schemas/bible-memory.ts`: `.cuid()`→`.uuid()` (ids are uuid per schema.prisma) + bounded `text`; trimmed to
  the 4 wired schemas. WIRED them into the 4 LIVE actions (`addVerseToUser`/`createFolder`/`renameFolder`/
  `moveVerseToFolder`) — `parse` inside the existing try/catch so a ZodError degrades to `{success:false}` (not a crash);
  `addVerseToUser` now takes `unknown` + parses; the 3 positional actions reconstruct the object (`schema.parse({...})`)
  per the skeptic (4 of 5 are positional, not object-shaped). **`copyFolderToStudent` was DEAD** (zero callers, grep) →
  removed with its `copyFolderSchema` (a consequential Q-20-005-class cleanup surfaced by the adversarial pass; also
  dropped an `any`, −1 lint warning). +`bible-memory.test.ts` (8 cases shape-lock uuid-accept / cuid-reject / max-length /
  nullable folderId). Files: M `bible-memory/actions.ts`, `lib/schemas/bible-memory.ts`, NEW `bible-memory.test.ts`.

### Verification
- tsc **0 errors** · eslint **0 errors / 1312 warnings** (−1 vs 1313 — the removed `copyFolderToStudent` carried an `any`;
  the 9 `catch (e)` warnings in bible-memory/actions.ts are pre-existing) · vitest **180/180** / **25** files (+8 / +1 —
  `bible-memory.test.ts`). `prisma/` untouched; scoped `git status` = 6 ch.20 code files M + the new test + docs.

### Reconcile (§4 partition)
- 3 in-scope MED → **2 resolved (Q-20-003/006) · 1 removed (Q-20-004)**; 0 re-graded/deferred; 0 unaccounted. Q-20-006 also
  completed Q-20-005's (ch.20-LOW) `bible-memory.ts` part (no double-count — Q-20-005 already closed in the LOW cell).
- **MED: 14 → 12 open** (LOW 14 / HIGH 3 unchanged). Counts reconcile across ch.20 §7 (3 marked) / ch.20 §5 (legacy
  exports REMOVED, bible-memory.ts DONE/wired, actions.ts validation note) / ch.24 MED header (`14 → 12`), lineage, both
  by-theme entries, §5 broken-list (Q-20-003) / register top-line (`14 → 12`) / 00-INDEX glance.

### 👤 Owner follow-up
- **Nothing pushed.** ch.20 HIGH next: Q-20-001 (REGRADE→LOW + defense-in-depth `auth()` on the unauth global-content
  actions — the proxy already gates the normal path) and Q-20-002 (the broken prayer-delete client one-liner).

## Session 2026-06-22 (round 46) — Consolidated final pass / ch.20 HIGH findings (Q-20-001, Q-20-002) + sibling Q-14-009

Both OPEN ch.20 HIGH closed (round-44 9-skeptic Workflow). **The feature-chapter HIGH set is now fully worked down — only
the ⏳-deferred Q-12-007 remains.** CI green.

### Q-20-001 ✅ RESOLVED (🔻 over-graded → really LOW defense-in-depth)
- The adversarial pass proved the HIGH premise was wrong: `src/proxy.ts` is a **fail-closed** allowlist — `PUBLIC_ROUTES`
  deliberately excludes the entire `/family-discipleship` subtree, the matcher covers everything except `/api/*`, and Next
  server actions POST to those (matched) page routes — so the pages AND actions are already proxy-gated for normal
  invocation; the data is global non-tenant content (no PII/quota exposure for anonymous callers). git-verified the proxy
  guard predates the doc SHA.
- **Fixed anyway (defense-in-depth):** added an `auth()` session check to the 7 unauthenticated content actions —
  `getUnreachedOfTheDayAction`/`getOperationWorldStats`/`getCountiesForState`/`getAllStates` (missions, via a shared
  `requireSession()`), `getCatechisms`/`getCatechismQuestions` (catechism, `requireSession()`), `getPrayerCategories`
  (prayer-journal). No org filter (global data). Rationale: the proxy's own comment says it is a "backstop NOT a
  replacement" (pages/actions must self-gate), and the newer sibling actions (bible-memory, prayer CRUD) already do — this
  converges the older content holdouts onto that posture + closes the obscure public-route-POST bypass. Pages unchanged
  (proxy-gated). Fix-and-close → re-grade moot (over-grade recorded).
- Files: M `missions/actions.ts`, `catechism/actions.ts`, `prayer-journal.ts`.

### Q-20-002 ✅ RESOLVED (🔻 over-graded → broken feature, not a vuln)
- `deletePrayerEntry(entry.id)` (bare string) → `deletePrayerEntry({ id: entry.id })` (PrayerJournalClient.tsx:138),
  matching the `deletePrayerSchema = z.object({id})` contract + the house `createPrayerEntry`/`deleteStudent({id})`
  convention. The action is fully auth/org/ownership-guarded; the Zod throw merely rejected the malformed input pre-write,
  so this is a broken-feature bug (HIGH over-graded). File: M `PrayerJournalClient.tsx`.

### Q-14-009 ✅ minted-and-RESOLVED (MED, ch.14) — sibling course-delete bug
- The adversarial pass surfaced the identical string-vs-object pattern in course delete: `CourseList.tsx:65`
  `deleteCourse(course.id)` (bare string) vs `deleteCourseSchema = z.object({id})` (lib/schemas/actions.ts:29) → ZodError →
  "An error occurred" toast; course never deleted. **Fixed:** `deleteCourse({ id: course.id })`. Minted in ch.14 (its owning
  chapter) born-resolved (MED — broken feature). File: M `src/components/library/CourseList.tsx`.

### Verification
- tsc **0 errors** · eslint **0 errors / 1312 warnings** (unchanged — the `auth()` additions + one-line delete fixes add no
  warnings) · vitest **180/180** / 25 files (server-action/route `auth()` + client one-liners have no DB-harness test).
  `prisma/` untouched; scoped `git status` = 6 ch.20/14 code files M + docs.

### Reconcile (§4 partition)
- 2 in-scope HIGH → **2 resolved** (Q-20-001 fix-and-close after regrade-moot · Q-20-002 fix-and-close); +1 minted-and-resolved
  sibling (Q-14-009, ch.14 MED — born-resolved, so MED **open** count unchanged at 12); 0 unaccounted.
- **HIGH: 3 → 1 open** (only Q-12-007 ⏳ deferred remains; foundational Q-001 still OPEN, outside the headline). MED 12 /
  LOW 14 unchanged. Counts reconcile across ch.20 §7 (Q-20-001/002 ✅) + §5 (8 rows) / ch.14 §7 (Q-14-009 born-resolved) +
  §5 / ch.24 HIGH header (`3 → 1`), lineage, register table (both struck), §3 dashboard, §5 Workstream-B + roadmap, register
  top-line (`3 → 1`) / 00-INDEX glance (`3 → 1` + remaining-HIGH prose).
- **ch.20 now FULLY TRIAGED** (LOW round 44 / MED round 45 / HIGH round 46).

### 👤 Owner follow-up
- **Nothing pushed.** Major milestone: the only open HIGH is now **Q-12-007** (⏳ deferred — needs the in-the-moment
  child-safety feature + a legal `[DECISION]`). The Q-20-008 prayer Public/Private toggle still awaits your wire-vs-remove
  call (§5 roadmap). Advancing to ch.21 (planner-scheduling).

## Session 2026-06-22 (round 47) — Consolidated final pass / ch.21 LOW findings (Q-21-001/002/004/005/009)

All 5 OPEN ch.21 LOW fixed (a 6-skeptic Workflow confirmed all + sharpened two). CI green.

### Q-21-001 ✅ RESOLVED — honor classroom school days
- `getNextSchoolDays` (scheduling.ts:55) hardcoded `[1,2,3,4,5]`, ignoring `classroom.schoolDaysOfWeek` (a `number[]` 0-6,
  present on the already-included classroom). Now: `const schoolDaysOfWeek = (Array.isArray(configured) && configured.length>0)
  ? configured as number[] : [1,2,3,4,5]`. The **`.length>0` guard is load-bearing** (skeptic): `[]` is the persisted
  "varies/unset" state — passing it raw matches no day and hits the "no school days in a year" throw. So 4-day/Sunday
  schedules now place correctly while unset/varies preserves today's weekday placement. File: M `scheduling.ts`.

### Q-21-002 ✅ RESOLVED — wire the dead distributeCourseSchema
- `distributeCourse` did only an `isNaN(date)` check. Wired `distributeCourseSchema` via `safeParse({courseId, studentId,
  startDate})` → explicit `{success:false, error}` return (skeptic's refinement: safeParse + explicit return, NOT
  parse-into-catch; mirrors `generate-resource.ts`), kept the `isNaN` check. Closes both halves (dead schema + no
  validation). +shape-lock test in `actions.test.ts`. Value = defense-in-depth + dead-code/drift cleanup + boundary-Zod
  consistency (authz already held — not a closed vuln). *(~12 sibling schemas in actions.ts stay dead-by-design — a batch
  wire-or-remove sweep is the owner's call.)* Files: M `scheduling.ts`, `actions.test.ts`.

### Q-21-004 ✅ RESOLVED — await the ad-hoc write before refresh (+ silent-failure fix)
- `handleResourceSelected` fired `toast.promise(addAdHocEvent(...))` then `router.refresh()` synchronously → the refresh
  raced the create+revalidateTag. Rewrote to mirror the sibling `handleDragEnd`: `const result = await addAdHocEvent(...);
  if (result.success){toast.success; router.refresh()} else {toast.error(result.error)}`. **Adversarial-pass bonus:**
  `addAdHocEvent` returns `{success:false}` (never throws), so the old `toast.promise` error branch was DEAD and a real
  failure showed the SUCCESS toast — the new branch fixes that too. File: M `PlannerGrid.tsx`.

### Q-21-005 ✅ RESOLVED — drop dead server-helper import from the client
- Deleted `import { getCurrentUserOrg }` (never called) from the `"use client"` PlannerGrid. Currently tree-shaken
  (auth-helpers is side-effect-free), but a latent server-into-client footgun (the chain imports `node:async_hooks` +
  Prisma) — a build break the moment the symbol is referenced. −1 lint warning. File: M `PlannerGrid.tsx`.

### Q-21-009 ✅ RESOLVED — un-export getHolidays
- Dropped the `export` on `getHolidays` (holidays.ts:43) — it is live (called by `isHoliday`) but has zero external
  importers, so the `export` keyword was dead API surface. Kept the body + the `Holiday` interface (public via
  `isHoliday`'s return type). File: M `holidays.ts`.

### Verification
- tsc **0 errors** · eslint **0 errors / 1311 warnings** (−1 vs 1312 — the removed PlannerGrid dead import; the new
  `catch {}` and casts add no `any`) · vitest **182/182** / 25 files (+2 — distributeCourseSchema shape-lock). `prisma/`
  untouched; scoped `git status` = 4 ch.21 code files M + docs.

### Reconcile (§4 partition)
- 5 in-scope LOW → **5 resolved**; 0 accepted/removed/re-graded; 0 unaccounted.
- **LOW: 14 → 9 open** (MED 12 / HIGH 1 unchanged). Counts reconcile across ch.21 §7 (5 ✅) + §5 (4 rows) / ch.24 LOW
  running log (`14 → 9`) + register top-line (`14 → 9`) / 00-INDEX glance (`14 → 9`).

### 👤 Owner follow-up
- **Nothing pushed.** ch.21 MED next: Q-21-003 (Auto-Reschedule button + `isLocked` reshuffle unimplemented) — a
  build-vs-remove fork I'll surface to you (the button is a visible silent no-op; "keep as-is" is dominated).

## Session 2026-06-22 (round 48) — Consolidated final pass / ch.21 MED finding (Q-21-003)

The sole OPEN ch.21 MED. Presented as an OWNER_DECISION (build-vs-remove); **owner chose REMOVE + roadmap.** CI green.

### Q-21-003 ✅ RESOLVED (removed) — dead Auto-Reschedule button
- Deleted the no-op `<Button>Auto-Reschedule</Button>` from `planner/page.tsx` (it had no onClick/type/form — a silent
  no-op; a prominent button that does nothing dominates "keep as-is", per the Q-17-001 broken-feature lesson). `Button` is
  still used by the week-nav arrows, so no orphaned import.
- **Roadmapped (ch.24 §5):** the bulk reshuffle / Auto-Reschedule feature is a from-scratch multi-file build (a reshuffle
  engine recomputing placement across holidays + school days, reading/writing the currently-dead `StudentScheduleItem.isLocked`
  pin) — beyond a resolution session per §9.3. `isLocked` stays a documented unused schema field (removal = a deferred
  migration; left for that build).
- Owner decision via AskUserQuestion: "Remove button + roadmap" (over Build-now / Leave-as-is). File: M `planner/page.tsx`.

### Verification
- tsc **0 errors** · eslint **0 errors / 1311 warnings** (unchanged — JSX deletion; the 1 planner-page warning is a
  pre-existing unescaped `'`) · vitest **182/182** / 25 files. `prisma/` untouched (the `isLocked` field is left as-is —
  no schema change); scoped `git status` = `planner/page.tsx` M + docs.

### Reconcile (§4 partition)
- 1 in-scope MED → **1 removed** (Q-21-003); 0 unaccounted.
- **MED: 12 → 11 open** (LOW 9 / HIGH 1 unchanged). Counts reconcile across ch.21 §7 (Q-21-003 ✅) + §5 (button REMOVED,
  isLocked DEAD-roadmapped) / ch.24 MED header (`12 → 11`), lineage, by-theme entry, §3 dashboard, §5 roadmap / register
  top-line (`12 → 11`) / 00-INDEX glance.
- **ch.21 now FULLY TRIAGED** (LOW round 47 / MED round 48; no HIGH).

### 👤 Owner follow-up
- **Nothing pushed.** Advancing to ch.22 (transcripts-records). Two product/feature roadmap items now await you: the prayer
  Public/Private toggle (Q-20-008) and the planner bulk-reshuffle feature (Q-21-003) — both in ch.24 §5.

## Session 2026-06-22 (round 49) — Consolidated final pass / ch.22 LOW findings (Q-22-001/004/005/006/008)

All 5 OPEN ch.22 LOW (a 7-skeptic Workflow covered the whole chapter). **2 removed · 2 accepted · 1 resolved.** CI green.

### Q-22-001 ✅ REMOVED — dead PrintLayout
- `git rm src/components/print/PrintLayout.tsx` (PrintLayout/Section/Box/Grid/Title — zero importers; the transcript PDF
  uses raw HTML strings). Doc-currency: §1/§3/§5 references updated. File: D.

### Q-22-004 ✅ REMOVED — 3 dead symbols
- Removed `deleteTranscript` (transcript.ts — **+ its orphaned `assertParentProfile` import**, of which it was the sole
  consumer; git blame showed the parent-guard was a mechanical security-sweep artifact, NOT a planned-feature signal),
  `getDefaultCoursesForGrade` + `validateCourse` (utils.ts). The invalid-row gap is caused by validation being wired
  nowhere (not by `validateCourse` being dead) — re-introduce a validator on a future transcript-editor revival
  (disproportionate now on a 0-row feature). Files: M `transcript.ts`, `utils.ts`.

### Q-22-005 ✅ ACCEPTED — data-export raw-db org reads
- The skeptic VERIFIED the lean: none of data-export's org models are CONTEXT_FREE, so under RLS-on the per-query
  extension's `resolveTenant()` self-resolves org from the session even on this `auth()`-only path → already RLS-ready;
  the explicit `where:{organizationId: orgId}` is the live boundary RLS-off. The finding's "no RLS backstop" framing was
  corrected (the leak window is bounded to the RLS-off period). Wrapping the parallel `Promise.all` in `withTenant` would
  serialize 8 reads for zero gain. No code change.

### Q-22-006 ✅ RESOLVED — PDF empty-card cheap fixes (full merge accepted)
- The skeptic upgraded this from accept to FIX-the-cheap-bits because the empty-year card is the DEFAULT render (grid is
  always 4 cards; generated transcripts start grade-less). Fixed in `pdfExport.ts`: the literal `0.0` → `formatGPA(0)`/
  `formatCredits(0)` (was `0.0` vs `0.00` everywhere else), removed the empty card's duplicate GPA/Cr body line (now
  header-only, matching the on-screen preview), and deleted the 3 dead CSS blocks (`.summary-divider`/`.credits-by-subject`/
  `.subject-credit-item`, never emitted). The full preview↔PDF layout MERGE stays accepted-by-design (two genuine render
  targets; disproportionate refactor for a LOW). File: M `pdfExport.ts`.

### Q-22-008 ✅ ACCEPTED — Transcript.isOfficial orphaned column
- Aspirational orphaned schema column (same profile as Q-18-005's `letterGrade`): removal is a deferred migration
  (off-table) and wiring an official/draft toggle is a multi-target feature (builder UI + persistence + conditional render
  in both the preview AND the PDF — ties into Q-22-006). Accepted as schema-drift + §5 roadmap. No code/schema change.

### Verification
- tsc **0 errors** · eslint **0 errors / 1311 warnings** (unchanged — the removed dead code was lint-clean) · vitest
  **182/182** / 25 files. `prisma/` untouched; scoped `git status` = 3 code files (1 D + transcript.ts/utils.ts/pdfExport.ts
  M) + docs.

### Reconcile (§4 partition)
- 5 in-scope LOW → **2 removed (Q-22-001/004) · 2 accepted (Q-22-005/008) · 1 resolved (Q-22-006)**; 0 unaccounted.
- **LOW: 9 → 4 open** (MED 11 / HIGH 1 unchanged). Counts reconcile across ch.22 §7 (5 marked) + §1/§3/§5 (PrintLayout +
  dead rows) / ch.24 LOW running log (`9 → 4`) + register top-line (`9 → 4`) / 00-INDEX glance (`9 → 4`).

### 👤 Owner follow-up
- **Nothing pushed.** ch.22 MED next: Q-22-002 (generateTranscriptData) + Q-22-003 (builder missing editor fields) — both
  heading to accept/roadmap (the "discarded subject" is a spine-vs-registrar taxonomy mismatch; the missing editor UI is a
  feature).

## Session 2026-06-22 (round 50) — Consolidated final pass / ch.22 MED findings (Q-22-002, Q-22-003)

Doc-only cell — both ACCEPTED. CI baseline unchanged (no code touched). The 7-skeptic Workflow informed both, and I
**overrode the Q-22-002 FIX_NOW lean to ACCEPT** on a re-anchor (see below).

### Q-22-002 ✅ ACCEPTED — generateTranscriptData defaults are correct-by-design (over-graded → LOW)
- The skeptic verified the schema reality: `Course` has NO credits/grade column and `CourseStudent` (enrollment) has only
  status/dates — so grade/credit have **no schema source** (the defaults are correct; the parent enters them, the proper
  transcript workflow). The skeptic recommended FIX_NOW (populate `subject` from `course.subject.name`) but flagged a
  "concrete missed regression": the course's `subject` is the curriculum-SPINE subject (e.g. "Language Arts & Humanities"),
  a **different taxonomy** than the transcript's registrar-subject dropdown (English/Mathematics/...). **Re-anchored to the
  finding's goal** (a correct transcript): injecting the spine subject would render a blank editor Subject cell (no matching
  `<Select>` option) AND place a non-registrar value on the "official" transcript, and would need a spine→registrar mapping
  (doesn't exist) + a dropdown overhaul. So "General" + parent-classification is correct-by-design, not a defect. ACCEPT,
  no code change; finding framing corrected.

### Q-22-003 ✅ ACCEPTED / roadmap — missing editor fields
- SPLIT the 6 fields (skeptic refinement): `tests`/`notes`/`signed`+`signature` are persisted-but-render-only (preview +
  PDF read them) → a deferred multi-field editor FEATURE (§9.3) — the signature gap (an "official" transcript can't be
  signed via the app) is the headline, roadmapped to ch.24 §5. `pre9thCourses` + `template`/'subject-based' are DEAD DATA
  (referenced only in types.ts; no renderer consumes them) — flagged as dead surface, NOT built. No code change.

### Verification
- No code changed (doc-only) → CI baseline unchanged-green (tsc 0 / eslint 0-err·1311 / vitest 182). `prisma/` untouched.

### Reconcile (§4 partition)
- 2 in-scope MED → **2 accepted** (Q-22-002 correct-by-design / over-graded; Q-22-003 roadmap); 0 unaccounted.
- **MED: 11 → 9 open** (LOW 4 / HIGH 1 unchanged). Counts reconcile across ch.22 §7 (2 ✅) + §5 (2 rows) / ch.24 MED header
  (`11 → 9`), lineage, by-theme, §3 dashboard, §5 roadmap / register top-line (`11 → 9`) / 00-INDEX glance.
- **ch.22 now FULLY TRIAGED** (LOW round 49 / MED round 50; no HIGH).

### 👤 Owner follow-up
- **Nothing pushed.** Advancing to ch.23 (background-jobs) — the last feature chapter, then ch.24 + the ch.13 straggler.
  Roadmap items awaiting you: Q-20-008 (prayer toggle), Q-21-003 (planner reshuffle), Q-22-003 (transcript editor fields).

## Session 2026-06-22 (round 51) — Consolidated final pass / ch.23 LOW findings (Q-23-001/003/004/006) + MED & LOW headline reconcile

Mostly accept-by-design (3 LOW closed, 1 stays deferred) — but the cell's §4 reconcile **uncovered count drift in two
grades** and fixed both. A 4-skeptic adversarial Workflow (run `wj2h2fi5q`) informed the dispositions.

### Q-23-001 ✅ ACCEPTED — operator-triggered corpus pipeline is correct PARTIAL
- `ingestTextbookCorpus` / `refreshTextbookCrosswalk` have **no in-app trigger** (grep: zero `inngest.send` outside the
  intra-graph fan-outs) — but they are legitimate operator-fired ops jobs over GLOBAL/context-free tables (no tenancy
  surface), idempotent, and the ONLY entry to the corpus/recrosswalk graph (so REMOVE is wrong). PARTIAL is the right
  resting state. Noted: the in-code "user-triggered" comments (types.ts:69, ingest-textbooks.ts:13) **overstate** the
  wiring. No code change.

### Q-23-004 ✅ ACCEPTED — soft curriculum-verification gate is deliberate outage-tolerance
- The non-blocking QA (`qa = { unavailable: true }` on a Gemini failure → gate still PASS) is **intentional** (comment
  :336-337: a transient model outage must not block every org's compiles); raising `MIN_CHARS=200` would false-fail
  legitimately short artifacts. Gate-tightening (surface `qa.unavailable` in BundleView / soft-warning badge / raise the
  floor) is an owner quality-tuning decision → §5 roadmap. Corrected the finding's stale "0-row / never exercised" claim
  (2 bundles COMPLETED; `explode-bundle.ts:79` gates on COMPLETED, but explosion is teacher-initiated, never auto-published).

### Q-23-006 ✅ REMOVED — orphaned `src/data/heidelberg.json`
- `git rm src/data/heidelberg.json` (2,480 lines). Zero importers (verified 3 ways); the seed uses the self-contained
  `src/data/catechisms/heidelberg.ts`. The two files even have **incompatible shapes** (PascalCase/nested-proofs json vs
  camelCase/flat ts), so the json could not seed even if wired. tsc 0; no test/glob/asset-copy reaches it.

### Q-23-003 ⏳ DEFERRED (unchanged) — `process-document` `onFailure`/retry tuning + `extractionStatus` enum
- Stays bundled with ch.02 Q-011/Q-013 in the batched migration (out of pass scope). No code change.

### 🔢 Count reconcile — drift found in MED (+1) and LOW (−5 net), both fixed (consequential doc-currency fix, not new findings)
- **MED 9 → 8 (corrected base).** The by-theme *list* itemizes exactly 8 open (Q-12-008/009/010/011/012, Q-17-010,
  Q-23-002, Q-24-001) but the lineage said 9. Traced the exact slip: the **ch.20-MED step was miswritten `14 → 12`**
  (14 − 3 closed = **11**); the +1 cascaded through ch.21 (`12→11`) and ch.22 (`11→9`). Corrected the three lineage
  numbers + the MED header + register top-line + 00-INDEX to land on the itemized list = **8**. (HIGH verified correct:
  Q-12-007 + foundational Q-001, headline "1" stands.)
- **LOW "4 → 1" was wrong; true open = 9.** The LOW section was prose-only (no itemized list), and its running tally had
  drifted to **undercount** carried-forward deferred/kept-open/re-graded items. Verified the true set against every
  chapter's §7 `Status:` line and **added an authoritative itemized open-LOW list (9)** as the new ground truth:
  Q-01-004, Q-09-005, Q-10-010, Q-011, Q-013, Q-12-013, Q-13-009, Q-16-001, Q-23-003.
- **⚠️ 2nd stray surfaced — Q-12-013 [LOW].** Like Q-13-009, it was **minted inside a later chapter's MED cell**
  (Session 24, ch.12 MED) *after* its own chapter's LOW cell had passed, so it was never triaged and silently fell out of
  the tally. Partition honesty (the same reason the owner flagged Q-13-009): it is now counted and will be **swept with
  Q-13-009 at the end-of-pass straggler step**.

### Verification
- ch.23 LOW touched code only via `git rm src/data/heidelberg.json` (zero-importer data file) → CI baseline unchanged:
  **tsc 0 / eslint 0-err·1311-warn / vitest 182 passed (25 files)**. `prisma/` untouched.

### Reconcile (§4 partition)
- 4 in-scope ch.23 LOW → **3 closed** (Q-23-001 accept, Q-23-004 accept, Q-23-006 remove) + **1 deferred** (Q-23-003); 0 unaccounted.
- **LOW 4 → 9 (reconciled base; net of this cell's 3 closures the prose tail would read 1, but the true open set is 9).**
  **MED 9 → 8 (reconciled base; unchanged by this LOW cell — corrected the latent +1).** HIGH 1 unchanged.
- Counts reconcile across: ch.23 §7 (Q-23-001/004/006 dispositions) + §5 rows / ch.24 MED header+lineage+by-theme,
  LOW header + authoritative list + running-log, register top-line, 00-INDEX glance.

### 👤 Owner follow-up
- **Nothing pushed.** Next: ch.23 MED (Q-23-002 dead-chain removal) → ch.24 (Q-24-001) → end-of-pass straggler sweep
  (Q-13-009 **+ the newly-found Q-12-013**) → final reconcile + completion report.
- Roadmap items awaiting you (unchanged): Q-20-008 (prayer toggle), Q-21-003 (planner reshuffle), Q-22-003 (transcript
  editor fields), Q-23-001/004 (corpus in-app trigger / QA-gate tightening — both new this round).

## Session 2026-06-22 (round 52) — Consolidated final pass / ch.23 MED finding (Q-23-002)

A clear-cut dead-code removal — the one ch.23 MED. Re-verified the build-safety census independently (a prior skeptic
had already proved it tsc-safe); §9 standing authority covers proven-safe dead-code removal, so no new Workflow run.

### Q-23-002 ✅ REMOVED — dead web-grounded section-producer chain (`src/lib/ai/book-extraction.ts`)
- **Census (re-verified):** `groundBookSections`, `structureBookSections`, `describeTableOfContents`, `describeSectionBook`,
  `SectionMeta`, `SectionGroundMeta` have **zero** importers repo-wide; `groundBookSections`'s only repo hit was a stale
  **comment** in `extract-book.ts:11`. `runBookGrounding`'s `opts.abortMs` arm had exactly one caller — `groundBookSections`
  — so it died with the chain (`groundBook`, the live caller, passes no opts).
- **Removed** all six symbols + stripped `runBookGrounding(prompt, opts?)` → `runBookGrounding(prompt)` (+ the abortSignal
  spread and the stale NOTE comment). **KEPT** `SectionFacts` + `sectionFactsSchema` — both are live via the full-text
  `structureSectionsFromText` (the real per-section path, used by `ingest-book-sections.ts`). Rewrote the file-header +
  Phase-2 doc-comments + scrubbed the `extract-book.ts:11` comment and the `structureSectionsFromText` docstring's stale
  `groundBookSections` reference. **`book-extraction.ts` 603 → 455 lines (−148).**
- Why it was dead (deliberate, not accidental): the grounded `google_search` section pass exceeds Vercel's 60s ceiling
  regardless of batch size (its own former doc-comment said so) → it was superseded by the full-text approach; the chain
  was left behind.

### Verification
- **tsc 0 / eslint 0-err·1311-warn / vitest 182 passed (25 files)** — identical to the round-51 baseline (the removed
  code contributed no lint warnings). `prisma/` untouched. Confirmed zero dangling references to the removed symbols.

### Reconcile (§4 partition)
- 1 in-scope ch.23 MED → **1 removed** (Q-23-002); 0 unaccounted. **MED 8 → 7 open.** (LOW 9 / HIGH 1 unchanged.)
- Counts reconcile across: ch.23 §7 (Q-23-002 ✅ REMOVED) + §5 (the DEAD rows → one REMOVED row; drifted line numbers on
  the kept `groundBook`/`structureSectionsFromText` rows corrected to 214/242/286 + 331/395) / ch.24 MED header (8→7),
  lineage (+ch.23-MED `8→7`), by-theme (Q-23-002 struck) / register top-line (8→7) / 00-INDEX glance (8→7).
- **ch.23 now FULLY TRIAGED** (LOW round 51 / MED round 52; HIGH = none — confirmed against §7). It was the LAST feature chapter.

### 👤 Owner follow-up
- **Nothing pushed.** Next: ch.24 (Q-24-001 `/api/health`) → end-of-pass straggler sweep (Q-13-009 + Q-12-013) → final
  §4 reconcile + completion report. Roadmap items unchanged from round 51.

## Session 2026-06-22 (round 53) — Consolidated final pass / ch.24 own finding (Q-24-001) — OWNER-APPROVED

### Q-24-001 ✅ REMOVED — unauthenticated `/api/health` infra-disclosure
- **Re-verified at source:** `src/app/api/health/route.ts` is an unauthenticated `GET` (the proxy matcher excludes
  `/api/*` — `proxy.ts:96` — and the handler has no `auth()` gate) that returns, on every production request, the DB
  host/port, Supabase **projectRef**, connection **userRole** (`app_user`|`postgres`), `current_database`/`current_user`/
  server IP, `RLS_ENABLED`, `VERCEL_ENV`, the commit SHA, and `book_extractions`/`video_extractions` counts. Its own
  header comment: *"TEMPORARY diagnostic … Remove this route once the env mismatch is resolved."*
- **Census:** ZERO references repo-wide (no code import, no `vercel.json`, no monitoring/Inngest config) — nothing pings
  it for liveness, so removal is fully build-safe.
- **Owner decision (AskUserQuestion):** presented Remove / Gate-behind-auth / Leave-as-is → **owner chose Remove.**
  `git rm src/app/api/health/route.ts` (the empty `health/` dir is gone too). This eliminates the unauthenticated
  infra-disclosure entirely (the owner's stated end-state).

### Verification
- **tsc 0 / eslint 0-err·1311-warn / vitest 182 passed (25 files)** — unchanged baseline (zero-importer route). `prisma/` untouched.

### Reconcile (§4 partition)
- 1 ch.24 own finding → **1 removed** (Q-24-001); 0 unaccounted. **MED 7 → 6 open.** (LOW 9 / HIGH 1 unchanged.)
- Counts reconcile across: ch.24 MED header (7→6), lineage (+ch.24 `7→6`), by-theme (Q-24-001 struck), §5 roadmap item
  (struck → DONE), §9 ops-catch-all table (route row → REMOVED) / register top-line (7→6) / 00-INDEX glance (7→6).
- **ch.24's own findings are now cleared.** The HIGH/MED by-theme lists in ch.24 are cross-references to other chapters
  (handled in those chapters), not re-handled here.

### 👤 Owner follow-up
- **Nothing pushed.** Final steps: end-of-pass straggler sweep (Q-13-009 + Q-12-013 — the two LOWs minted after their
  chapters' LOW cells) → final §4 reconcile + completion report.

## Session 2026-06-22 (round 54) — Consolidated final pass / end-of-pass straggler sweep (Q-13-009 + Q-12-013)

Doc-only — both stragglers are LOWs that were **minted inside a later chapter's MED cell, after their own chapter's LOW
cell had already passed**, so they fell out of the running tally (surfaced during the round-51 LOW reconcile). Swept here
for partition honesty. No code changed.

### Q-13-009 ✅ ACCEPTED — cross-edition extraction dedup fragmentation (ch.13)
- Re-verified at `book-dedup.ts:154`: `dedupKey = isbn13 ? "isbn:"+isbn13 : "slug:"+titleAuthorSlug`. ISBN-first is the
  correct STRONG-identity key; different editions (different ISBN-13s) → distinct keys → separate global `BookExtraction`
  rows. Collapsing editions onto one extraction needs a content-fingerprint / fuzzy-match layer = a **feature** (community
  semantic-search roadmap, §5). System is correct, waste bounded to cross-edition collisions of multi-org-held books →
  ACCEPT (won't-fix-now). Closed.

### Q-12-013 ⏳ OPEN (deferred with the child-safety brief) — finding corrected, substantially overstated (ch.12)
- A census of the cited code **refuted / corrected most sub-claims** (child-safety = extra care, so I verified each at source):
  - **(c) REFUTED** — `isSafe` is NOT "never read": `safety-scan.ts:80` `if (!result.isSafe)` is the gate that decides
    whether to store a `SafetyFlag` at all (plus `:33` escalation, `:113` return). Removing it would break the pipeline.
    The finding's "never read by *policy.ts*" scoping missed safety-scan.ts. → **KEEP isSafe.**
  - **(a) `coercion` by-design** — consumed at `policy.ts:61` (sibling/incest escalation); the regex fast-path hardcoding
    `"NONE"` is correct (only the LLM deep-path can infer coercion). **(a) `ageGap`** is genuinely unused but is a coherent
    reserved companion to `coercion` for future age-gap escalation → keep reserved.
  - **(d) `reasoning` dual-use already handled** — the `[EVIDENCE:]` audit tag is stripped for the parent email at
    `notifications/safety-alert.ts:90` (the finding's cited `safety-alert.ts:128/143` is a **stale path**).
  - **(b)** deriving `SafetyAssessment` via `z.infer<typeof safetySchema>` is a valid drift-prevention nicety (the hand type
    currently matches the schema).
- **Decision:** the genuine residual is just (b) + (d) — two minor *safety-code* refactors. Rather than refactor the app's
  most sensitive code piecemeal in a straggler sweep, they're **deferred WITH the owner's child-safety brief** (companions
  to Q-12-008..012, §5 roadmap). Evidence corrected in ch.12 §7; finding kept OPEN (consistent with its sibling brief items).

### Verification
- No code changed (doc-only). CI baseline unchanged-green from round 53 (tsc 0 / eslint 0-err·1311 / vitest 182·25). `prisma/` untouched.

### Reconcile (§4 partition)
- 2 stragglers → **1 closed** (Q-13-009 accept) + **1 corrected & kept-open-deferred** (Q-12-013); 0 unaccounted. **LOW 9 → 8 open.** (MED 6 / HIGH 1 unchanged.)
- Counts reconcile across: ch.13 §7 (Q-13-009 ✅), ch.12 §7 (Q-12-013 corrected) / ch.24 LOW header (9→8), the authoritative
  open-LOW list (re-itemized to 8 + Q-13-009 struck), the LOW running-log (+sweep entry) / register top-line (9→8) / 00-INDEX glance (9→8).

### 👤 Owner follow-up
- **Nothing pushed.** **The consolidated final pass is COMPLETE** — see the completion report. Remaining open findings are
  all deferred / owner-accepted / kept-open by design (the batched migration, the RLS cutover, the child-safety brief, two
  unfinished features, the lint ratchet). Roadmap items unchanged.

---

## Session 2026-06-23 — RLS cutover + batched migrations (EXECUTED & DEPLOYED) 🚀

**First code actually shipped to production** (every prior round was documented/staged only — "nothing
pushed"). The owner directed the RLS cutover + the batched migration. Two migrations were applied to the
live, seeded prod DB via forward-only `prisma migrate deploy` (never `dev`/`reset`); every column change is
in-place (`ALTER COLUMN … TYPE … USING`) or a `RENAME`, and each was validated by a `BEGIN…ROLLBACK`
dry-run on real data BEFORE applying — so no row was lost and no reseed. CI green throughout (tsc 0 /
eslint 0-err / vitest 188·26). Commits `7b696b3`, `4a0ab98` on `main`.

### Migration 0016 (`00000000000016_batched_enum_org_rename_taxonomy_insert`)
- ✅ **Q-013** (10 of 12 cols) — stringly-typed → DB enums, in place: `SafetyFlag.severity/category/resolution`,
  `CurriculumBundle.status`, `TextbookDocument.status`, `BookExtraction.confidence/fullTextStatus/sectionsStatus`,
  `PrayerJournalEntry.status/type`. Enum member names = the existing literals, so app code needed no value
  changes (only a `book-extraction.ts` interface-type tighten).
- ✅ **Q-011** — org-FK column `organization_id` → `account_id` on `transcripts` + `curriculum_specs`; the 3
  coupled RLS policies (`curriculum_specs`/`transcripts`/`curriculum_bundles`) recreated against `account_id`.
- ✅ **Q-23-003** — `DocumentResource.extraction_status` (`ExtractionStatus` enum) added + `process-document`
  got `onFailure`→FAILED, EXTRACTED-on-success, and `retries: 2`.
- ✅ **Q-17-010** — `app_user` INSERT policies on `subjects/strands/topics/subtopics` so the `new:` custom-taxonomy
  minting keeps working under RLS (was SELECT-only → would have failed closed). The RLS-cutover blocker, cleared.

### Migration 0017 (`00000000000017_stage_enums`) — Q-013 remnant
- ✅ **Q-013** (final 2 cols) — `book_extractions.stage` → `BookStage`, `video_extractions.stage` → `VideoStage`
  (hyphenated `@map` labels; a typed `Record` maps the lib's stage unions to enum members at the 2 write-only
  persist sites). **Q-013 is now FULLY resolved.**

### Q-001 [HIGH, foundational] ✅ RESOLVED — RLS cutover LIVE
- The app now connects as the non-bypass **`app_user`** role with **DB-side RLS ENFORCED** — validated on the
  pooled prod path (fails closed with no org context, scopes to the org with it, globals readable). The app-layer
  `where:{organizationId}` filters are now defense-in-depth, not the only boundary.
- **Mechanism:** `db.ts` DERIVES the `app_user` connection from the Vercel↔Supabase integration's `POSTGRES_URL`
  by swapping only role+password (`withRole`, `src/lib/db-url.ts`), gated on a new `APP_USER_PASSWORD` env var.
  A fail-closed null-org `console.warn` was added (runbook step 2). `app_user` password set out-of-band.

### ⚠️ Incident & fix (post-mortem)
- The **first** flip set Vercel `DATABASE_URL` to a **hand-built `app_user` URL** (derived from local `.env`).
  Because `db.ts` prefers `DATABASE_URL`, that **replaced the integration's `POSTGRES_URL`** and dropped its exact
  pooler host + routing params → prod couldn't reach the DB (`"Can't reach database server at base"`) and the
  Google OAuth callback's `prisma.account.findUnique` failed → **login broke.**
- **Root cause:** hand-crafting the connection URL. **Fix (`4a0ab98`):** never override `DATABASE_URL`; derive
  `app_user` from `POSTGRES_URL` in code (`withRole` + `APP_USER_PASSWORD`). +`src/lib/db-url.test.ts` (6 cases).
  Auth restored, RLS re-enabled cleanly.

### 👤 Owner follow-up / prod env (now in place)
- Vercel Production: **no custom `DATABASE_URL`**, `APP_USER_PASSWORD` = the app_user password, `RLS_ENABLED=true`.
  **Rollback** = set `RLS_ENABLED=false` (or remove `APP_USER_PASSWORD`) → falls back to the postgres `POSTGRES_URL`.
  **Never** reintroduce a hand-built `DATABASE_URL` — that was the failure mode.

### Reconcile (§4 partition)
- **Q-001 [HIGH foundational] ✅ resolved** (cutover live) → open foundational HIGH 1 → **0**.
- **Q-17-010 [MED] ✅ resolved** → MED **6 → 5** (remaining: Q-12-008/009/010/011/012).
- **Q-011, Q-013, Q-23-003 [LOW] ✅ resolved** → LOW **8 → 5** (remaining: Q-01-004, Q-09-005, Q-10-010, Q-12-013, Q-16-001).
- **New open headline: 0 CRITICAL · 1 HIGH (Q-12-007) · 5 MED · 5 LOW · 0 INFO.** Reconciles across 00-INDEX glance,
  ch.24 §7 register, and the owning chapter §7 lines (ch.02 Q-011/Q-013, ch.04 Q-001, ch.17 Q-17-010, ch.23 Q-23-003).
- The "Deferred migrations" bucket is now **empty** (Q-011/Q-013/Q-23-003 shipped). The child-safety brief
  (Q-12-007 + Q-12-008..013) is the main remaining open program.

---

## Session 2026-06-23 (later) — child-safety hardening (Phase 1) + 2 non-safety LOWs (owner-approved)

Kicked off the child-safety hardening program. Owner sign-offs: sequence = bounded hardening first / legal
in parallel; Q-12-007 architecture = **Hybrid** (synchronous regex pre-check → in-the-moment child-facing
affordance + a parent SafetyFlag review UI) — **gated on the owner's written legal sign-off, NOT yet given**;
reporting policy = KEEP "Minimum Social Responsibility" + add verified non-US-inclusive crisis resources +
reconcile the bot-promise wording; non-safety LOWs = DO Q-16-001 + Q-10-010, LEAVE Q-09-005 + Q-01-004.
**TDD throughout; nothing pushed.** CI green at every cell — final: `tsc` 0 / `eslint` 0 errors / `vitest`
**202/202** (28 files; +14 safety tests). Migration **0018** is the only schema change — **dry-run validated
in a BEGIN…ROLLBACK transaction on the real DB (10/10 checks incl. app_user org-isolation), STAGED not
pushed** (applies on the next deploy).

### 👤 Owner follow-up (with deploy)
- **Migration 0018 (`pending_safety_scans`)** ships with this code — `prisma migrate deploy` runs it in the
  Vercel build, so the migration deploys WITH the code (runtime references `db.pendingSafetyScan`). No env
  change; no rollback needed (purely additive table, RLS-scoped).
- **Q-12-007 legal `[DECISION]` still owed:** verified crisis resources + a bot-wording redline + the Hybrid
  design spec are the next deliverable and need written sign-off before any build.

### Resolved — child-safety MED (brief Tier-1/2 app-layer items)
- ✅ **Q-12-008** Per-pattern `target`/`relationshipToTarget` overrides on the regex fast-path (was a
  fabricated `SELF`/`OTHER` on every match): violence-threat → `OTHER_CHILD` (stays in the urgent target set
  {SELF,OTHER_CHILD} — relabeling ADULT/UNKNOWN would have *downgraded* a real threat), incest → `SIBLING`
  (now hits the policy sibling branch). Files: `src/lib/safety/guard.ts` (+`guard.test.ts`, +4). **Behavioral
  note:** a sibling-incest THOUGHT now routes `STUDENT_OPTIONAL_OUTREACH` (policy's do-not-notify-on-thought)
  instead of emailing parents — the fail-safe direction + honors the policy design; abusive parent *actions*
  are still caught by the caregiver hard-stop.
- ✅ **Q-12-009** Data minimization for caregiver hard-stop flags (caregiver implicated OR disclosureRisk
  HIGH): new pure helper `buildStoredFlagContent` redacts BOTH the message snippet and the content-bearing
  reasoning, keeping only category/severity + the load-bearing `[EVIDENCE:]` tag (parsed by future pattern
  escalation). `SafetyFlag` is org-readable, so a child's disclosure naming/fearing a caregiver is no longer
  persisted where that caregiver could read it. Files: new `src/lib/safety/flag-storage.ts`
  (+`flag-storage.test.ts`, +4), `src/inngest/functions/safety-scan.ts`. (App-layer half; a fully separate
  access-restricted store stays a possible future enhancement, not tracked open.)
- ✅ **Q-12-010** Durable dead-letter for a dropped safety-scan enqueue (was console.error only → the sole
  safety signal permanently lost). New `PendingSafetyScan` table (migration 0018, RLS-scoped on `account_id`);
  the chat route persists the scan on `inngest.send` failure; the org's **next chat request drains**
  (re-enqueue + delete) under its own org context — RLS-clean, no privileged/cross-org background read
  (owner-chosen drain strategy). Poison rows (≥10 failed re-enqueues) are left for review, never deleted.
  Files: `prisma/schema.prisma`, `prisma/migrations/00000000000018_pending_safety_scans/`, new
  `src/lib/safety/pending-scan.ts`, `src/app/api/chat/route.ts`.
- ✅ **Q-12-011** Conversation context for the scanner (was single-message → multi-turn grooming invisible):
  the chat route now sends a bounded window (≤10 prior turns) and the LLM deep-path classifies the latest
  message *in that context* (fenced as data). Regex fast-path + the stored snippet stay single-message; the
  window is not persisted. Files: `src/inngest/types.ts`, `src/app/api/chat/route.ts`,
  `src/inngest/functions/safety-scan.ts`, `src/lib/safety/guard.ts` (+`guard.test.ts`, +2).
- ✅ **Q-12-012** Prompt-injection fencing: the classifier prompt encloses the untrusted message in
  delimiters + instructs the model to treat it strictly as DATA (a manipulation attempt → `BYPASS_ATTEMPT`);
  the Thinkling system prompt labels the interpolated profile fields (name/interests/style) as data, not
  instructions. Files: `src/lib/safety/guard.ts`, `src/lib/thinkling.ts` (+`guard.test.ts` +1, new
  `thinkling.test.ts` +1).

### Resolved — child-safety LOW
- ✅ **Q-12-013** (b) `SafetyAssessment` now derived via `z.infer<typeof safetySchema>` (schema moved to
  `types.ts`, kept free of the AI-SDK import so `policy.test.ts` stays hermetic) → the hand type can't drift
  from what `generateObject` validates. (d) The regex `reasoning` is now a clean caregiver-facing per-category
  sentence instead of the internal `[Regex Guard] Matched …` debug string that was leaking into the parent
  email. Files: `src/lib/safety/types.ts`, `guard.ts` (+`guard.test.ts`, +2). (a)/(c) stay refuted in §7
  (coercion by-design; `isSafe` is read at safety-scan.ts:80) — no change.

### Resolved — non-safety LOW (owner-approved DO)
- ✅ **Q-16-001** Wired the built-but-unlinked `/student/dashboard` per-student daily-schedule view into the
  Sidebar nav ("Daily Schedule"). Also removed a pre-existing dead `Users` icon import. File:
  `src/components/layout/Sidebar.tsx`.
- ✅ **Q-10-010** (residual sub-claim 2) The 5 caller-supplied lineage FK ids on `generate-tool.tsx` are now
  validated same-org (RLS-scoped existence check) before being persisted; non-matches are nulled, so a
  crafted call can't write a cross-org/dangling lineage FK. Re-assessed benign under live RLS (read-back is
  RLS-scoped) but closed cleanly per owner. File: `src/app/actions/generate-tool.tsx`.

### Left as-is (owner-accepted, kept OPEN)
- ⏳ **Q-01-004** lint warn-ratchet — deliberate adoption ratchet, new violations still fail CI. Unchanged.
- ⏳ **Q-09-005** unbuilt media-context-injection hook — owner keeping it for a future build. Unchanged.

### Reconcile (§4 partition)
- **MED 5 → 0:** Q-12-008 / 009 / 010 / 011 / 012 all ✅ resolved.
- **LOW 5 → 2:** Q-10-010, Q-12-013, Q-16-001 ✅ resolved; Q-01-004 + Q-09-005 remain (owner-accepted).
- **HIGH unchanged at 1:** Q-12-007 stays ⏳ OPEN (Hybrid feature + legal `[DECISION]`, gated on sign-off).
- **New open headline: 0 CRITICAL · 1 HIGH (Q-12-007) · 0 MED · 2 LOW (Q-01-004, Q-09-005).** Reconciles
  across 00-INDEX glance, ch.24 §7 register, and owning-chapter §7 (ch.12 Q-12-008..013, ch.16 Q-16-001,
  ch.10 Q-10-010).
- **Doc-currency (not new findings):** ch.12 §5 had stale "free `String`" rows for SafetyFlag
  severity/category/resolution → corrected to the enums shipped by migration 0016 (the Q-12-003/Q-013 typing
  is already resolved). ch.12 §1 scope gained `flag-storage.ts` + `pending-scan.ts`; ch.02 model count 67 → 68
  (`PendingSafetyScan`).

---

## Session 2026-06-23 (later) — Q-12-007 in-the-moment child-safety layer BUILT (owner sign-off)

After the owner's written sign-off (verified crisis resources + bot-wording redline + Hybrid architecture +
KEEP the mandated-reporting policy), built the Hybrid layer per `docs/codebase-map/Q-12-007-hybrid-safety-spec.md`.
**TDD; CI green: tsc 0 / eslint 0-err / vitest 212/212 (30 files; +10 tests). Nothing pushed.**

⚠️ **UI smoke-test owed (no browser/component test in CI):** the rendered affordance + parent review page are
tsc/lint/test-verified for LOGIC only — manually exercise the child path (disclosure → affordance shows the
verified resources) and the parent path (flag → `/safety` → mark reviewed) before relying on them. Re-verify the
crisis resources periodically (the shape-lock test guards the core contacts; verify findahelpline.com before ship).

### Resolved
- ✅ **Q-12-007** [HIGH] — built the in-the-moment layer (closes the structural gap; legal `[DECISION]` signed off):
  - **`crisis-resources.ts`** (NEW) — owner-approved verified set (US 988 / Childhelp / Crisis Text Line; Military
    Crisis Line incl. OCONUS; Military OneSource; 911; findahelpline.com) + a category selector. +test.
  - **Synchronous pre-check** — `precheckMessageSafety` (NEW `app/actions/safety-precheck.ts`): runs the pure regex
    fast-path, returns only `{concern, category}` (patterns stay server-side; notifies no one). +test.
  - **Child-facing affordance** — `CrisisHelp.tsx` (NEW): a calm, always-available "Need help now?" panel of the
    verified resources; `ThinklingChat` fires the pre-check in parallel on submit and auto-opens it on a concern.
  - **Bot-wording redline** — `thinkling.ts`: dropped the can't-always-keep "involve a trusted adult" promise
    (points to the app's resources instead) + a HARD rule that the model NEVER invents hotline numbers. +test.
  - **Parent SafetyFlag review UI** (NEW) — `/safety` page + `getSafetyFlags` query (org-scoped via the student
    relation) + `markSafetyFlagReviewed` action (parent-gated, org-scoped `updateMany`, existing
    `isResolved`/`resolvedAt` — NO schema) + `SafetyFlagList` + a Sidebar "Safety" link. Closes the "no SafetyFlag
    UI reader" gap; respects the Q-12-009 write-time redaction.
  - **Fail-safe:** the affordance/pre-check NOTIFY NO ONE (resources only) — cannot mis-notify a feared caregiver;
    the caregiver hard-stop + `isAlertDeliverable` + the async detection pipeline are untouched.
  - Out of scope (roadmap): streamed-OUTPUT scanning; T3-F eval-set / second classifier.

### Reconcile (§4 partition)
- **HIGH 1 → 0:** Q-12-007 ✅ resolved (built; UI smoke-test owed, like a deploy step).
- **New open headline: 0 CRITICAL · 0 HIGH · 0 MED · 2 LOW (Q-01-004, Q-09-005 — owner-accepted).** The entire
  findings program is now closed except those two by-design LOWs. Reconciles across 00-INDEX, ch.24 §7, ch.12 §7.
- Doc-currency: ch.12 §1/§5 gained the crisis-resources / pre-check / affordance / review-UI units; the spec
  `Q-12-007-hybrid-safety-spec.md` is marked BUILT.

---

## Session 2026-06-23 (later) — Q-09-005 RESOLVED by consolidating generators onto generateResourceCore (owner-approved)

The unbuilt "source-specific context-injection" half of source-anchored generation (Q-09-005) is closed by
**consolidating the two generation pathways onto the source-aware one** rather than building a second.
`generateResourceCore` turned out to be a near-superset of the generative-UI path (`generateLearningTool`/
`streamUI`) — it already does source-grounded RAG, student personalization (`additionalData.studentId`),
verify/revise, quote-grounding, and images; the only thing the weak path had was a `streamUI` live-render. The
weak path was shared between the standalone `creation-station/[id]` page AND the course-builder's inline generator
dialog (`CourseBuilder.tsx`), so the chokepoint was the shared `GeneratorForm`.

**TDD; CI green: tsc 0 / eslint 0-err / vitest 218/218 (31 files; +6). Nothing pushed.**
⚠️ **UI smoke-test owed** (no browser/component test in CI): exercise the course-builder inline generator dialog
+ the `/creation-station` generators after this change.

### Changed
- ✅ **Q-09-005** [LOW] RESOLVED (consolidated, not removed):
  - **`GeneratorForm` now calls `generateResource`** (→ `generateResourceCore`) instead of `generateLearningTool`.
    New pure mapper `lib/generators/resolve-source.ts` collapses the multi-dim context to one `(sourceType,
    sourceId)` by precedence (book → video → objective → course → TOPIC-from-prompt), threading `studentId` via
    `additionalData`. +`resolve-source.test.ts` (6). Output is now a saved Resource + a "view in Living Library"
    link (replaces the streamed node), uniform for the (former) page and the course-builder dialog.
  - **Deleted** the standalone `creation-station/[id]` page + its `[id]`-only components (`SmartDefaultsSuggestions`,
    `ContextSuggestionsInline`, `lib/context/smart-defaults.ts`); **redirected** the course-builder tool links
    (`courses/[id]/builder`) to `/creation-station`.
  - **Deleted** `generateLearningTool` (`app/actions/generate-tool.tsx`) and **removed `@ai-sdk/rsc`** (its only
    consumer). `streamUI` is no longer used anywhere.
  - **Kept** `GeneratorForm` (now course-builder-only, on the source-aware backend), `ContextBadges` (shared),
    `getMasterContext`/`serializeMasterContext`/`buildMasterPrompt` (still used by blueprint/students/grading/etc.).
  - Deletion tail verified clean (no orphaned imports; `buildMasterPrompt` still feeds AI grading feedback;
    corrected a stale `prompt-builder.ts` comment that named the removed `generate-tool`).
  - **Known limitation:** `generateResourceCore` has no ARTICLE/DOCUMENT source type → an article/document-only
    context falls back to TOPIC-from-prompt (ungrounded). Adding those source types is future work.

### Reconcile (§4 partition)
- **LOW 2 → 1:** Q-09-005 ✅ resolved; only **Q-01-004** (lint warn-ratchet, owner-accepted) remains.
- **New open headline: 0 CRITICAL · 0 HIGH · 0 MED · 1 LOW (Q-01-004).** The findings backlog is now a single
  owner-accepted LOW. Reconciles across 00-INDEX, ch.24 §7, ch.09 §7, ch.10 §5/§7.

---

## 2026-06-23 (later still) — Q-01-004 lint-debt burndown, pass 1 (Tier A + Tier B + no-unescaped-entities)

Owner-triggered burndown of the lint warn-ratchet (Q-01-004), **smallest-count-first, SAFE-only**. Prime
directive: a *safer* codebase, not a lower count — any warning whose fix would risk behavior or weaken
type-safety is LEFT. **CI green throughout: `tsc --noEmit` 0 · `eslint .` 0 errors · `vitest` 218/218.
`prisma/migrations/` untouched. Nothing pushed.**

### Round 0 — baseline correction (eslint was double-counting)
- **Discovery:** `eslint .` was also scanning a stale leftover **Workflow git-worktree** at
  `.claude/worktrees/wf_a91d8eb3-ad4-1` (branch `worktree-wf_a91d8eb3-ad4-1` @ `58d532e`), so **every warning
  counted twice**. The worktree is git-excluded (`.git/info/exclude`) → **not in CI**, so this was a
  local-measurement artifact — but it would also make a locked rule "error" on the worktree's stale copy.
- **Fix:** added `".claude/worktrees/**"` to the eslint `ignores` (mirrors the git exclude; zero behavior
  impact). **True baseline: 637 warnings / 0 errors.**
- **Surfaced, NOT actioned (not ours to delete):** the stale worktree itself; owner may
  `git worktree remove .claude/worktrees/wf_a91d8eb3-ad4-1`.

### Rules burned to 0 and LOCKED warn→error (genuine, behavior-preserving fixes only)
- **`jsx-a11y/alt-text`** 1→0: added `alt="Book cover preview"` to the camera-preview `<img>` (`BookScanner.tsx:403`). (Next-default → explicit `"error"`.)
- **`@typescript-eslint/no-empty-object-type`** 3→0: `input.tsx`/`label.tsx` empty `interface … extends …{}` → `type … = …` alias (no external consumers/augmentation); removed the empty placeholder `HeartCheckClientProps` interface + simplified the no-props signature (`HeartCheckClient.tsx`).
- **`@typescript-eslint/no-wrapper-object-types`** 6→0: `String`→`string` on `DevotionalEntry` fields + 2 helper params (`DevotionalDisplay.tsx`).
- **`import/no-anonymous-default-export`** 7→0: named the default-exported array in all 7 catechism data files (`const <name>Catechism = […]; export default <name>Catechism;`) — data byte-identical. (Next-default → explicit `"error"`.) **NOTE:** future `src/data/**` files written as `export default [...]` now fail CI — flag if a scoped exception is preferred.
- **`@typescript-eslint/ban-ts-comment`** 10→0: converted real suppressions to `@ts-expect-error` + description (rule-allowed) and **deleted dead directives** (tsc TS2578 adjudicated which were unused). Kept (real): 5× `result.error` toast handlers (`deleteResource` returns `{success:true}` & throws → `error` not on type) + the `pdf2json` PDFParser ctor (typed sig rejects the args). Deleted (suppressed nothing): page-body excess-prop, ArticleList **add** path, DayButton, and the `pdf2json` **import** (pdf2json ships types).
- **`@typescript-eslint/no-require-imports`** 2→0: `check-course-integrity.js` `require`→static `import`; `test-db.ts` `require`→**`await import()`** (dynamic import does NOT hoist → preserves the deliberate db-load-order trace) + `export {}` module marker.
- **`prefer-const`** 4→0: `let`→`const` for `mastered` (push-mutated, never reassigned), `level` (transcript map), `skippedCount` (seed); split the mixed `let {organizationId,userId}` destructure in `api/students/route.ts` so `userId` is `const` (organizationId still reassigned → stays `let`).
- **`react/no-unescaped-entities`** 54→0 (ratchet-9): replaced raw `'`/`"` in JSX **text nodes** with `&apos;`/`&quot;` (renders identically) across 27 files — each edit anchored on `>`/text boundaries so adjacent `className="…"` attribute quotes were never touched (the misplaced-bracket trap). Done first, per the owner's explicit "be careful, knock these out first" directive; tsc re-parsed clean after.
- **unused `eslint-disable` directives** (reported as ruleId `null`) 2→0: removed a misplaced `no-explicit-any` disable (`generate-resource-core.ts` — the real `as any` is one line below, still a Tier-C `no-explicit-any` warning) and a now-complete-deps `exhaustive-deps` disable (`BibleStudyClient.tsx`).

No new `eslint-disable` directives were added. No `as any`/`@ts-ignore`/`@ts-nocheck` introduced.

### Reviewed, intentionally LEFT at warn
- **`@next/next/no-img-element`** 11: all 11 sources are **remote** (Google Books/OpenLibrary covers, YouTube/video thumbnails, article og:images) or **data/blob URLs** (camera preview, base64 signature) → `next/image` would break (`images.remotePatterns: []` by design; data-URLs unsupported). Stays warn (cannot lock).

### Pending owner sign-off (Tier C — STOPPED here per the burndown rules)
Not touched; need a plan + sample before edits: **`react-hooks/exhaustive-deps` (5)**, **`react-hooks/set-state-in-effect` (8)**, **`react-hooks/error-boundaries` (17)**, **`@typescript-eslint/no-unused-vars` (234)**, **`@typescript-eslint/no-explicit-any` (273)**.

### Reconcile (§4 partition)
- **Warnings 637 → 548** (−89). **8 rules locked** warn→error (the 7 above + `react/no-unescaped-entities`).
- **Q-01-004 stays OPEN** [LOW] — 3 ratchet-9 rules remain at warn (no-explicit-any 273, error-boundaries 17, set-state-in-effect 8), plus no-unused-vars 234 + no-img-element 11 (intentionally left). **Headline unchanged: 0 CRITICAL · 0 HIGH · 0 MED · 1 LOW (Q-01-004).** Updated ch.01 §7, ch.24 §7, 00-INDEX, progress memory + the quillnext-mastery skill (worktree-pollution gate gotcha).

---

## 2026-06-23 (later still) — Q-01-004 lint-debt burndown, pass 2 (react-hooks rules)

Per the owner's React-Compiler-era briefing + sequence (**error-boundaries → set-state-in-effect → exhaustive-deps**), with per-occurrence diagnosis (the autofix is the trap; each violation is also a component opting out of compilation). **CI green: tsc 0 · eslint 0 errors (548 → 518) · vitest 218/218.**

### react-hooks/error-boundaries 17 → 0 — LOCKED
Both sites were async Server Components with `try/catch` wrapping (awaited data fetch + JSX return) in the two `transcripts` pages. Diagnosed route-level (not false-neighbors): the inline catch handled the data-fetch errors, which an App-Router `error.tsx` boundary catches identically (server-render errors incl. failed awaits) — plus child-render crashes the inline catch could not, with a `reset()` recovery path.
- **New:** `transcripts/error.tsx` + `transcripts/[studentId]/error.tsx` (client boundaries; console.error logging; "Try Again" → `reset()`).
- **Removed** the inline try/catch from both pages (`git diff -w` = only the wrapper removed; `!organizationId` guard kept as a normal early return; `[studentId]` page no longer leaks `error.message`).

### react-hooks/set-state-in-effect 8 → 0 — LOCKED
- **TopicSelector ×4 — real fix (effect-as-event → handler):** moved the downstream cascade-clears out of the 4 fetch effects into 4 `onValueChange` handlers. Behavior-identical (each handler's clear-set mirrors the old effect; `selectedX` is only set via its own handler). No derived-state deleted → no new referential-identity churn.
- **Scoped suppressions (3, genuine external-sync):** `BibleAudioPlayer` ×2 (reset transport + reload `<audio>` on `audioUrl`; key-remount would drop user `volume`), `ThinklingChat` (clear safety-chat on mode/student; key-remount would reset `useChat` + CrisisHelp/safety-precheck wiring).
- **InteractiveCatechism:** was flagged (reset-on-`title`) but the linter stopped flagging it once the other edits settled (React-Compiler component bail-out interacting with its exhaustive-deps disable) → no disable needed. NOTE: remains a *latent* reset-on-prop-change (compiler opt-out) — left as-is.

### react-hooks/exhaustive-deps 5 → 0 — LOCKED (Next-default → explicit error)
- **courses `blocks/new` — real fix:** `watch("parentBlockId")` was called *in the dep array*; hoisted to a `const` (stable primitive) used in body + deps. Behavior-identical.
- **Scoped suppressions (3, run-frequency footguns):** `GeneratorsClient` (searchParams self-mutation loop), `TopicSelector` propagate (unmemoized parent `onTopicChange` + label-lookup arrays), `InteractiveCatechism` loadProgress (`flattenedData` recreated each render → refetch-per-render).

### Disables added (6, all used, each with a `--` reason)
set-state-in-effect: BibleAudioPlayer (bible-memory + bible-study), ThinklingChat. exhaustive-deps: GeneratorsClient, TopicSelector, InteractiveCatechism. No `as any`/`@ts-ignore`/`startTransition`/`setTimeout` tricks.

### Reconcile (§4 partition)
- **Warnings 548 → 518** (−30). **Locked 3 more rules** (error-boundaries, set-state-in-effect, exhaustive-deps) → **11 rules now error-locked.**
- **Q-01-004 stays OPEN** [LOW] — remaining at warn: `no-explicit-any` 273, `no-unused-vars` 234 (Tier C, owner-paused), `@next/next/no-img-element` 11 (by design). **Headline unchanged: 0 CRITICAL · 0 HIGH · 0 MED · 1 LOW (Q-01-004).** Updated ch.01 §7, ch.24 §7, 00-INDEX, progress memory.
- ⚠️ **UI smoke-test owed** (untested in CI): TopicSelector cascading dropdowns (restructured) + the transcripts error path (error.tsx + Try Again).

---

## 2026-06-23 (later still) — Q-01-004 `as any` cast burn-down (waves 1–2b, IN PROGRESS)

A targeted burn-down of `as any` **casts** (a subset of `no-explicit-any`, which stays at warn) done BEFORE the
no-unused-vars pass — per the owner: `any` is contagious (disables checking in cast-free files via flow), and
no-unused-vars needs honest types to tell used from unused. Verification = the **no-op invariant**: a correct
cast removal is a pure compile-time no-op → tsc green + behavior identical = correct; if behavior moves, the
cast hid a live bug (surfaced) or a throw/assertion was introduced (no benign third case). Full discipline +
5-bucket triage live in the `as-any-burndown-approach` agent memory. **CI green each wave (tsc 0 / eslint 0
errors / vitest 218/218); committed locally, NOT pushed.**

Scope note: of 356 raw `as any` repo matches, only ~109 are real casts in `.ts/.tsx` — the rest are
Matthew-Henry `.HTM` commentary prose ("as any man…") + a README; eslint never lints those.

### Wave 1 — `264bef4` — gratuitous (bucket 1, 28 casts)
- `educational-philosophies.ts` ×17: `(EducationalPhilosophy as any).X` → `.X` (the Prisma enum is a runtime const object — the cast suppressed nothing).
- `scheduling.ts` ×10 + `transcripts/page.tsx` ×1: `(tx as any).model` → `tx.model` (`Prisma.TransactionClient` exposes every delegate; StudentScheduleItem/CustomEvent/Learner all exist in the schema).

### Wave 2a — `9f3f93c` — honest typing (bucket 2, 3 casts)
- New `src/types/next-auth.d.ts`: module augmentation for the custom session/JWT fields (`organizationId` on Session.user + User; id + organizationId on JWT via `@auth/core/jwt`, where Auth.js v5 defines JWT) → removes the 2 `organizationId` casts in `auth.ts`. organizationId is touched only there → nil contagion; fields optional → exact runtime no-op.
- `TopicSelector`: `setMode(v as any)` → `setMode(v as "SPINE"|"FREE"|"STANDARD")` — a precise narrow (Radix Tabs only emits its 3 registered trigger values).

### Wave 2b — `939b8db` — honest typing (bucket 2, 7 casts)
- `BibleMemoryDashboard`: typed `initialUserVerses: BibleMemory[]` (getUserVerses returns exactly that; addVerseToUser returns `{verse: BibleMemory}`), removing 7 verse-field casts (folderId/currentStep in filter/map + the res.verse folderId writes). Also drops one `: any[]` annotation. No contagion (the page already passes typed data).

### Reconcile (§4 partition)
- **no-explicit-any 273 → 234** (38 casts + 1 `: any[]` annotation). **Total warnings 518 → 479.** No rule locked — `no-explicit-any` stays warn until it reaches 0. **Headline unchanged: 0 CRITICAL · 0 HIGH · 0 MED · 1 LOW (Q-01-004).** Updated ch.01 §7, ch.24 §7, 00-INDEX + the as-any-burndown-approach / findings-resolution-progress memories.
- **~71 casts remain** — bucket 2: master-context nested-select 6, component-props 8; bucket 3: Json reads ~16 / writes ~12 / Inngest 7; bucket 4: Zod resolvers 6, webkitSpeech 2, misc ~13, generate-resource ~5. Resume via the `as-any-burndown-approach` memory: one wave at a time, one commit per wave, nothing pushed. **no-unused-vars (234) is the FINAL pass, after the as-any/structural churn.**

---

## 2026-06-24 — Q-01-004 `as any` cast burn-down (waves 3–13, IN PROGRESS)

Continuation of the burn-down above, same discipline (no-op invariant · 5-bucket triage · honesty
ranking · one wave/commit · nothing pushed · CI green each wave: tsc 0 / eslint 0 errors / vitest
**218/218**). **no-explicit-any 234 → 176** (−58); total warnings 479 → 421. **Headline unchanged:
0 CRITICAL · 0 HIGH · 0 MED · 1 LOW (Q-01-004).**

### Wave 3 — `bfc5f82` — master-context nested-select (gratuitous, bucket 1; 6 casts)
- `src/lib/context/master-context.ts`: removed `(obj as any).subtopic…`, `const obj = objective as any`
  (×2), `(resource.resourceKind as any).label`, `const room = classroom as any`. Modern Prisma 7 infers
  the `findUnique`/`findMany` payload from the `satisfies Prisma.*Select`-typed selects. Schema-checked
  the two bucket-5 candidates (`Resource.resourceKind`, the classroom dates) are **non-nullable** — no
  null hidden by the `any`. Typing `room` also dropped a `holidays.map((h: any))`.

### Wave 4 — `c9827ee` — component-prop boundary casts (bucket 1 + 2; 5 casts)
- `living-library/videos/page.tsx` ×2: **gratuitous** (VideosClient's hand-written `Video`/`Subject`
  props already match the DAL payloads).
- `TranscriptBuilder.tsx` ×3: the grading-Scale Select handler — narrowed `val` ONCE via a defensible
  `as GradingScaleType` (the SelectItems are exactly that union), killing `scale: val as any`,
  `} as any`, and `getGradingScaleLegend(val as any)`.

### Wave 5 — `e908235` — LearnerProfile Json reads via Zod-at-boundary (bucket 3; 9 casts)
- New `src/lib/students/learner-profile.ts`: lenient READ schemas (all fields optional, enum-ish fields
  as plain `string`) + `parsePersonalityData`/`parseLearningStyleData`/`parseInterestsData` (`safeParse`
  → `null`). Columns written by the strict `generateObject` schemas in `server/ai/personality.ts`; reads
  must tolerate older rows + never throw into a render. Applied at master-context `:514-516` + the
  `/students/[id]` page → the 3 cards (props typed `…Data | null`). StudentHeader / PersonalizationContextCard
  needed no cast (truthiness only). **Sanctioned boundary behavior change:** corrupt/wrong-typed stored
  data now degrades to the existing "not completed" state instead of rendering garbage (never a throw).

### Wave 6 — `6b59053` — remaining Json reads (bucket 1 + 3; 6 casts) + **a surfaced bug**
- `blueprint/page.tsx` ×4 **gratuitous** (`progress.data.holidays` already typed `Holiday[]` — the query
  `include`s holidays).
- `curriculum-actions.ts` `getBookChapters` ×2 → per-entry `safeParse` of the heterogeneous TOC.
- **⚠️ contagion surfaced a real bug** (the burn-down working as intended): honest typing lit up TS2345
  in the cast-free `courses/[id]/blocks/new/page.tsx:129` — `getBookChapters` could return `id: undefined`
  (extraction-shaped TOC rows have only `title`), feeding `undefined` option values → `bookChapterId:
  undefined` on submit. **Handled** (not masked): `id` now falls back to the resolved `label`. This is a
  **behavior change** for extraction TOCs (submitted id goes undefined → the chapter title); owner reviewed.

### Wave 7 — `d151f08` — Inngest onFailure event payloads (gratuitous, bucket 1; 7 casts)
- `extract-video`/`extract-book`/`process-document`/`compile-curriculum`/`ingest-textbooks`/
  `ingest-book-sections`/`ingest-book-fulltext`: `(event as any)?.data?.event?.data as {Shape}` →
  `event.data?.event?.data`. The client uses typed `EventSchemas` (`inngest/types.ts`), so the SDK already
  types the failure event's nested original payload as each function's trigger data. Removed the
  hand-written inline shapes (drift risk) + 2 now-unused `eslint-disable` directives.

### Wave 8 — `b2f06f3` — Inngest Json-column writes (gratuitous, bucket 1; 9 casts)
- `extract-video` (keyPoints/chapters/extractedKeyPoints), `extract-book` (tableOfContents ×2/sources),
  `ingest-book-sections` (keyPoints/charactersPresent/vocabulary): Prisma 7's `InputJsonValue` accepts the
  typed `string[]` + structured arrays directly (verified tsc 0 with every cast removed). +3 unused
  `eslint-disable` removed.

### Wave 9 — `f1c0afb` — `toJsonInput()` helper + transcript writes (bucket 3 friction; 2 casts)
- New `src/lib/prisma-json.ts` `toJsonInput()` — per the owner's decision framework for the Prisma
  closed-interface → Json friction: (1) `TranscriptData` is **non-null** (so not the `?? Prisma.JsonNull`
  case); (2) **verified JSON-safe** (every nested "date" is typed `string`; no Date/Map/class); (3) → the
  single named helper with the **narrow two-step** `value as Prisma.InputJsonObject as Prisma.InputJsonValue`
  (NOT `as unknown as`, which discards the tripwire; the direct `as InputJsonValue` is rejected TS2352).
  `saveTranscript`'s 2 `data: data as any` → `toJsonInput(data)`. Centralizes the one documented double-cast
  at an auditable chokepoint.

### Wave 10 — `f760bee` — server→client prop pass-throughs (bucket 1 + 2; 5 casts)
- **Gratuitous (4):** devotionals / church / creation-station / dashboard `events`. **Drift fixed (1):**
  dashboard `items` — the DAL returns `courseBlock`/`activity` as `… | null` but `ScheduleItem` declared
  them `?` (`… | undefined`); aligned the type to the DAL (`| null`; runtime already null).

### Wave 11 — `7c358ac` — scheduling `distributeCourse` cluster (bucket 1 + 4; 3 casts)
- One contagion knot rooted at `) as any` on the course query; removing it retyped `course.blocks` and the
  `createMany` array. The only real friction left — `status: 'PENDING'` widening vs the `ScheduleItemStatus`
  enum — pinned with `as const`.

### Wave 12 — `6e8760f` — webkitSpeech Window typing (bucket 4; 4 casts)
- New `src/types/speech-recognition.d.ts`: global `Window` augmentation for `SpeechRecognition` /
  `webkitSpeechRecognition` (not in this project's TS DOM lib — TS2339). `InteractiveCatechism` +
  `PracticeMode` drop `(window as any)`; PracticeMode's `onresult` `event: any` then inferred.
  **Superseded by wave 13.**

### Wave 13 — `7c8c102` — adopt `@types/dom-speech-recognition` (bucket 4; owner-approved dep)
- Replaced the bespoke Web Speech typings with the DefinitelyTyped package (types-only devDependency, zero
  runtime/bundle, auto-wired; `skipLibCheck` keeps it conflict-safe). **Deletes more than it adds:** removed
  wave-12's `.d.ts` + InteractiveCatechism's ~25 lines of local `CatechismSpeechRecognition*` types + the
  `as CatechismSpeechRecognitionAPI` cast; both consumers now use the real `SpeechRecognition` (and
  PracticeMode's `useRef<any>` → typed).

### Reconcile (§4 partition)
- **no-explicit-any 234 → 176** (−58). Total warnings 479 → 421. **Headline unchanged: 0/0/0/1 LOW.**
  New artifacts: `src/lib/students/learner-profile.ts`, `src/lib/prisma-json.ts` (`toJsonInput`),
  `@types/dom-speech-recognition` devDep. (`src/types/speech-recognition.d.ts` created wave 12, deleted
  wave 13.) Two real dispositions beyond pure no-ops: the wave-6 `getBookChapters` bug (handled, behavior
  change) and the wave-5 boundary degradation (sanctioned). Updated ch.01 §7, ch.24 §7, 00-INDEX + the
  as-any-burndown-approach / findings-resolution-progress memories.
- **~24 casts remain — all bucket-4 escape-hatch territory:** generate-resource-core ~5 (AI-SDK `tool()`,
  Prisma nested-`where`, generic verify/revise over `jsonContent`, the `content` Json write — now eligible
  for `toJsonInput`); `zodResolver(...) as any` ×5 (RHF/zod resolver friction); generation-guards
  `model`/`schema` ×2; `auth.ts` `PrismaAdapter(db as any)`; onboarding `setValue`/DayPicker (schedule-step
  ×2, environment-step ×2); course-actions `kind`; the grading `attempt as any` cluster ×2 (`:66` query +
  `:86`, entangled). Several may legitimately STAY as documented friction (`@ts-expect-error` or accepted).
  **no-unused-vars (now ~176-era count) remains the FINAL pass, after the as-any/structural churn.**

---

## 2026-06-24 (later) — Q-01-004 `as any` cast burn-down COMPLETE (waves 14–17 + AI SDK v4→v5)

Same discipline; CI green each wave (tsc 0 / eslint 0-err / vitest **218/218**), committed locally, NOT
pushed. **`as any` casts in src: 0** (grep hits are prose/comments). **no-explicit-any 273 → 153** — the
residual is `: any` ANNOTATIONS + 2 benign generic bounds (`$ZodType<any,any>`), never the cast-burndown's
target; they feed the FINAL no-unused-vars/structural pass. **Headline unchanged: 0 CRITICAL · 0 HIGH ·
0 MED · 1 LOW (Q-01-004).**

### Wave 14 — `fc5e55d` + `4629bca` + `11018b2` — grading attempt cluster (+ a surfaced bug)
- `grading/[id]/page.tsx`: `(assessmentAttempt findUnique) as any` removed (Prisma infers the payload).
- **⚠️ BUG SURFACED:** typing `personalityData` via `parsePersonalityData` lit up that the "Student Context"
  card read `communicationStyle`/`primaryDrivers` — fields ABSENT from the PersonalityProfile schema
  (always undefined). Owner chose (A) wire to ALL real fields → rebuilt the card (Motivational Driver /
  Feedback Style / Scaffolding / Creativity / Frustration / Work Style / Gamification + Tone Instructions +
  Suggested System Prompt). **Behavior change** (the card now shows real personalization). Then dropped the
  redundant `personalityData` prop from `GradingInterface` (verified dead — feedback personalizes
  server-side via `studentId`→`buildMasterPrompt`, not the prop). ⚠️ UI smoke-test owed.

### Wave 15 — `6060b1a` + `8ae1f0a` — zodResolver cluster (RHF↔zod)
- 6 `zodResolver(...) as any` across SpecForm / blocks(new,[blockId],activities) / useZodForm. Root: resolvers
  v5 types `Resolver<z.input, ctx, z.output>` vs the forms' `useForm<z.infer>`. Fixed with the modern RHF
  three-generic `useForm<z.input, unknown, z.output>` (4 of 5, no suppression); blocks/[blockId] (a `.partial()`
  PATCH form) typed `Partial<CourseBlockFormData>`. **useZodForm: owner-diagnosed the "no overload" as a
  CONSTRAINT bug (not a permanent gap)** — `T extends z.ZodTypeAny` gives `_input: unknown` ≠ the overload's
  required `FieldValues`; fixed by `T extends z.core.$ZodType<any, any>` + 3-generic on useForm AND UseFormProps.
  No suppression. Verified (coerce-schema probe): onSubmit gets z.output, defaultValues wants z.input (the old
  single-generic had silently mistyped defaultValues as the post-transform shape).

### Wave 16 — `24b56e0` — generate-resource-core (+ an AI-SDK v4/v5 bug) → triggered the full migration
- `where as any` → `Prisma.ObjectiveWhereInput`; `jsonContent` typed (was `let x = null` evolving-any) with
  runtime-guaranteed `as z.infer<Schema>` narrows; `content` Json write → `toJsonInput`.
- **⚠️ BUG SURFACED:** the `generate_image` `tool()` cast hid that the code used the **v4 `parameters` key on
  AI SDK v5.0.202** (which wants `inputSchema`) → the tool had no runtime schema. Fixed → `execute` args infer.

### AI SDK v4→v5 migration `31999dc` — owner-requested full audit (all 19 ai-sdk files)
- Packages all v5-era. Most usage already v5 (the chat route's `streamText`→`toUIMessageStreamResponse` under
  Q-11-006). v4 remnants were only the suppressed spots: the `generate_image` tool (`parameters`→`inputSchema`,
  wave 16); generation-guards `model: unknown`→`LanguageModel` (drops `model as any` ×2 + `schema as any`);
  restored the disabled `// maxSteps: 3` as v5 `stopWhen: stepCountIs(3)`. **Behavior change:** the image tool
  is now functional + multi-step (markdown resources can embed AI images). NOT issues: every `maxTokens` is our
  `serializeMasterContext` budget (not the AI-SDK option v5 renamed to `maxOutputTokens`); `providerMetadata`
  is correct v5. ⚠️ AI smoke-test owed (markdown resource generation).

### Wave 17 — `46ba043` — final one-offs (0 casts remain)
- CSS-var → `as React.CSSProperties`; DayButton → react-day-picker v9 `DayButtonProps` (typed, was `props: any`);
  environment-step `setValue` → a derived `ArrayField` key type; course-actions `kind` → validate the
  `courseBlockKindSchema` enum at the boundary (loose `z.string()` → enum; **minor behavior change:** invalid
  kind fails fast in Zod, not the DB); `auth.ts PrismaAdapter(db as any)` → documented `@ts-expect-error`
  (genuine two-package PrismaClient friction — @auth/prisma-adapter's `@prisma/client` type vs our custom
  `@/generated/client`; single-site, self-cleaning, passes ban-ts-comment via allow-with-description).

### Reconcile (§4 partition) + new artifacts
- `src/lib/students/learner-profile.ts` (Zod read-helpers, wave 5), `src/lib/prisma-json.ts` `toJsonInput`
  (owner's narrow two-step, wave 9), corrected `useZodForm` (wave 15), `@types/dom-speech-recognition` devDep
  (wave 13). Four real bugs the `any` was eating, now fixed: getBookChapters undefined-id (wave 6), grading
  phantom-field card (wave 14), AI-SDK v4/v5 image tool (wave 16) — plus the generation-guards `model: unknown`.
- **Owed:** (1) smoke-tests — grading personality card, AI-SDK image tool (markdown gen), onboarding off-days
  DayPicker; (2) the FINAL **no-unused-vars** pass — the residual 153 no-explicit-any are `: any` annotations
  to type structurally + the dead vars the honest types now orphan (e.g. the `auth.ts` PrismaClient import, the
  schedule-step `modifiers` rest-exclusion, GradingInterface `attempt: any`). Nothing pushed.

## 2026-06-24/25 — Q-01-004 `: any` ANNOTATION phase COMPLETE → no-explicit-any 153 → 0, LOCKED warn→error 🔒

The phase AFTER the `as any` casts: the residual 153 were `: any` ANNOTATIONS (params/props/state/`any[]`),
mostly the **server→client Prisma-payload boundary** — fixed by typing each client component's props to the
DAL's real return (`Awaited<ReturnType<typeof query>>` / `Prisma.XGetPayload` / a shared `…-types.ts`), so the
inner `.map((x: any))` callbacks auto-infer. **Worked one cluster at a time, CI green (tsc 0 / eslint 0-err /
vitest 244), committed in waves; this phase was PUSHED to `main`** (owner-authorized — first burndown work to
deploy, on top of the 2026-06-23 RLS work). Final: **`@typescript-eslint/no-explicit-any` promoted warn→error**
in `eslint.config.mjs` (12 ratchet rules locked now). **Headline unchanged: 0 CRITICAL · 0 HIGH · 0 MED · 1 LOW
(Q-01-004 — now narrowed to the no-unused-vars final pass).**

### Clusters (selected) + new shared payload-type modules
- catch(e:any)→unknown (8, narrowed by `instanceof Error` / `'data' in e`); Living Library (`library-types.ts`),
  dashboards (`dashboard-types.ts`), GradingInterface (`grading-types.ts`), onboarding (`onboarding-types.ts`),
  TopicSelector, BibleMemoryDashboard, PlannerGrid, TranscriptPreview, master-context, CourseBuilder, etc.
- Server-side: external-API responses (google-books/open-library/youtube/ESV) **Zod-validated at the boundary**;
  errorTaxonomy/prisma-cache → `unknown`/generics; scheduling/auth-helpers/utils/personality typed.
- Library friction: SpecForm RHF `render` props infer from shadcn `FormField` (no `@ts-expect-error`);
  AvatarCustomizer modeled as an index-signature `AvatarConfig` (DiceBear bag); WorldMap/MissionsClient typed
  loose-in-place (GeoJSON/Leaflet types) per owner's client-JSON call. `useZodForm` `$ZodType<any,any>` bound
  accepted via disable-with-reason (the documented Zod-4 constraint).

### ⚠️ Real bugs the `any` was hiding (surfaced + fixed, owner-approved)
- **Living Library:** the resource query never `select`ed `description`/`generationContext` though
  `GeneratedResourceCard` reads both → those UI sections rendered blank. Added to the shared select.
- **Planner smart-slot:** read `resource.url` for videos (it's `youtubeUrl`) and `resource.title` for documents
  (it's `fileName`) → blank description / undefined title. Refactored to per-kind normalized `{title,description}`.
- **Onboarding resume:** schedule-step read `initialData.plannedOffDays` (not a Classroom field → always empty)
  instead of `initialData.holidays` where off-days are saved → saved off-days never repopulated. Fixed (+ dropped
  dead `breaks`/`whatStudentsCall` reads; coerced the `schoolDaysOfWeek` Json; dropped dead Date string-branches).
- **Transcript:** YearCard read `summary.showNarratives` (not a `YearSummary` field → always undefined) → course
  narratives never rendered. Now passed from `transcript.gradingSettings`.
- **ContextLineageDisplay:** `video.title` typed `string` but is nullable; widened (component already handled null).
- ThinklingChat: render v5 `UIMessage` text parts (`p.type === 'text'`) instead of the v5-removed `m.content`.

### ⚠️ Owner-caught laundering slip — corrected (the key process lesson)
A first cut typed external `response.json()` boundaries by ASSERTING a shape (`const data: T = await res.json()`
and a return-only generic `fetchFromESV<T>`). The owner flagged it: `any` satisfies every `T`, so nothing is
checked — it's an unchecked cast relocated to call sites and made invisible. **Fixed per bucket-3: Zod-parse at the
boundary** (concrete return; callers drop redundant annotations). The two-appearance test for a legit generic
(`T` in an argument + the return, validator-backed) is now in the `any-annotation-burndown-approach` memory.

### Owed
- **UI/AI smoke-tests** (no browser tests in CI): the surfaced behavior fixes above — Living Library cards,
  planner smart-slot add, onboarding off-days round-trip, transcript narratives, Thinkling chat render — plus the
  cast-phase items (grading personality card, AI-SDK image tool in markdown gen, onboarding DayPicker).
- **`tsconfig.tsbuildinfo`** is a tracked generated cache that keeps showing modified (swept into the `-a`
  commits) — worth gitignoring.
- **no-unused-vars** is the LAST ratchet pass; Q-01-004 closes when it locks.
