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
  (the broader dead 2nd-gen nav surface) — `CreationDrawer`/`ContextNav`/`MainNav`/`UserNav`/
  `SidebarClientIslands` remain dead pending a separate decision.

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
  through the optimizer**. Every remote image (Google-OAuth + DiceBear avatars, YouTube `i.ytimg.com` /
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
