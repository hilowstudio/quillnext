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
