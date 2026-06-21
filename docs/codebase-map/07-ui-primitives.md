# 07 — UI Primitives
> Source of truth: the files in §1, read end-to-end. Written against commit b585c1e.

## 1. Scope

Two groups: **Radix-wrapped** shadcn primitives (thin styled re-exports of `@radix-ui/*`) and **custom/hand-rolled** primitives (no Radix). Plus three helpers: `cn()`, `MarkdownContent`, `useZodForm`.

| File | Role |
|---|---|
| `src/lib/utils.ts` | `cn()` (clsx+tailwind-merge) and `getStudentAvatarUrl()` (DiceBear URL builder) |
| `src/components/ui/alert-dialog.tsx` | Radix AlertDialog wrapper; Action/Cancel reuse `buttonVariants` |
| `src/components/ui/avatar.tsx` | Radix Avatar wrapper (Root/Image/Fallback) |
| `src/components/ui/badge.tsx` | Custom span + `badgeVariants` (cva); 9 variants incl. `ai` |
| `src/components/ui/button.tsx` | Custom button + `buttonVariants` (cva); Slot `asChild`; 6 variants/4 sizes |
| `src/components/ui/calendar.tsx` | `react-day-picker` wrapper styled via `buttonVariants` |
| `src/components/ui/card.tsx` | Custom Card family (Card/Header/Title/Description/Content/Footer) |
| `src/components/ui/checkbox.tsx` | Radix Checkbox wrapper; Phosphor `Check` icon |
| `src/components/ui/combobox-with-create.tsx` | Composite: Popover+Command searchable select with create-new affordance |
| `src/components/ui/command.tsx` | `cmdk` wrapper + `CommandDialog` (wraps Dialog) |
| `src/components/ui/dialog.tsx` | Radix Dialog wrapper; `showCloseButton` prop |
| `src/components/ui/dropdown-menu.tsx` | Radix DropdownMenu wrapper (full family incl. sub/radio/checkbox) |
| `src/components/ui/form.tsx` | react-hook-form bindings (Form/FormField/FormItem/FormControl/...); `useFormField` |
| `src/components/ui/input.tsx` | Custom `<input>` |
| `src/components/ui/label.tsx` | Custom `<label>` (NOT Radix Label) |
| `src/components/ui/popover.tsx` | Radix Popover wrapper |
| `src/components/ui/progress.tsx` | Radix Progress wrapper |
| `src/components/ui/radio-group.tsx` | Radix RadioGroup wrapper |
| `src/components/ui/scroll-area.tsx` | Radix ScrollArea wrapper |
| `src/components/ui/select.tsx` | Radix Select wrapper; Phosphor icons |
| ~~`src/components/ui/sheet.tsx`~~ | Radix Dialog (aliased) slide-over. **Deleted 2026-06-19** — orphaned when its sole importer `CreationDrawer` was removed (ch.06 Q-06-001, Session 12). |
| `src/components/ui/slider.tsx` | Radix Slider wrapper |
| `src/components/ui/switch.tsx` | Radix Switch wrapper |
| `src/components/ui/tabs.tsx` | **Custom** Tabs via React Context (NOT Radix) |
| `src/components/ui/textarea.tsx` | Custom `<textarea>` |
| `src/components/ui/tooltip.tsx` | Radix Tooltip wrapper |
| `src/components/resources/MarkdownContent.tsx` | `react-markdown` + remark-gfm + remark-breaks renderer |
| `src/hooks/useZodForm.ts` | `useForm` + `zodResolver` thin wrapper |

## 2. Purpose / intent

The shared design-system layer. Every feature surface (dashboards, library, generators, discipleship, profiles, transcripts) composes these primitives, so visual + a11y behavior is centralized here. Styling is bound to the bespoke `qc-*` Tailwind tokens (qc-primary, qc-charcoal, qc-surface, qc-border-*, rounded-qc-*, shadow-qc-*) — the brand layer. `cn()` is the universal class-merge used by nearly every component repo-wide. `useZodForm`/`form.tsx` are the form stack; `MarkdownContent` is the canonical generated-content renderer.

## 3. Architecture & key files

- **`cn()`** (`utils.ts:4-6`): `twMerge(clsx(inputs))`. Imported by ~all UI files and 100+ feature files. The load-bearing helper of this chapter.
- **Variant system**: `cva` drives `buttonVariants` (`button.tsx:6-31`) and `badgeVariants` (`badge.tsx:5-32`). `buttonVariants` is reused by `alert-dialog.tsx:107,120` and `calendar.tsx:29,41` — the de-facto button-style source of truth.
- **Radix wrappers** (thin, styled, forward props): alert-dialog, avatar, checkbox, dialog, dropdown-menu, popover, progress, radio-group, scroll-area, select, slider, switch, tooltip. ✅ RESOLVED 2026-06-19 — single convention now: ALL primitives are `data-slot` function components; the prior `React.forwardRef` + `displayName` generation has been fully converged (zero forwardRef remains, stray calendar displayName removed). See Q-07-005 / CHANGELOG.md.
- **Custom (non-Radix)**: `card`, `input`, `label`, `textarea`, `badge`, `button`, and notably **`tabs.tsx`** which reimplements tab state with `React.createContext` + controlled/uncontrolled value (`tabs.tsx:6-97`) instead of `@radix-ui/react-tabs`. `TabsContent` returns null when inactive (`tabs.tsx:84`) — unmounts, no keep-alive.
- ~~**`sheet.tsx`**~~ **REMOVED 2026-06-19** — was a `@radix-ui/react-dialog`-based slide-over; its sole importer was `CreationDrawer`, which was deleted in the ch.06 MED session (Q-06-001), leaving `sheet.tsx` with zero importers, so it was removed as the orphan tail. `@radix-ui/react-dialog` survives via `dialog.tsx`; no npm dep was orphaned.
- **Composite**: `combobox-with-create.tsx` wires Popover→Command, surfacing a "Create '<input>'" button in `CommandEmpty` (`combobox-with-create.tsx:85-101`). `command.tsx` wraps `cmdk`; `CommandDialog` (`command.tsx:32-61`) embeds Command in a Dialog.
- **Form stack**: `form.tsx` re-exports RHF `FormProvider` as `Form`, plus `FormField` (Controller + context), `FormItem` (useId), `FormLabel/Control/Description/Message`, and the `useFormField()` hook (`form.tsx:34-55`). `FormFieldContext` defaults to `null` and `useFormField` guards before dereferencing (Q-07-003 ✅ 2026-06-19). `useZodForm` (`useZodForm.ts:5-13`) pairs `useForm` with `zodResolver`.
- **MarkdownContent** (`MarkdownContent.tsx:17-23`): `<ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>` inside a `prose` wrapper. No rehype, no KaTeX — **intentional** (Q-07-001 ✅ accepted 2026-06-19): generated content emits math as `\(...\)`/stripped (never bare `$...$`, the only delimiter remark-math parses by default), single-`$` would mangle currency, and rehype-raw is an XSS risk on AI content; the misleading "matches ThinklingChat" comment was corrected. ThinklingChat *does* add remark-math/rehype-katex for its live chat view.

## 4. Data flow

These are client-side presentational units; no server actions, jobs, or DB. Flow is composition + class merging:

1. Feature file imports a primitive (e.g. `Button` from `@/components/ui/button`).
2. Primitive computes classes: `cn(buttonVariants({ variant, size, className }))` (`button.tsx:44`) → `twMerge(clsx(...))` (`utils.ts:5`) → applied to `Slot` or native element.
3. **Form path**: feature calls `useZodForm(schema)` (`useZodForm.ts`) → spreads result into `<Form {...form}>` (FormProvider). `FormField` (`form.tsx:24-35`) provides field name via `FormFieldContext`; descendant `FormControl`/`FormMessage` read it through `useFormField()` (`form.tsx:37-58`) which combines `FormFieldContext` + `FormItemContext` + RHF `getFieldState`. Validation errors surface in `FormMessage` (`form.tsx:142-143`). Live consumer: `src/app/creation-station/compiler/SpecForm.tsx`.
4. **Combobox path**: `ComboboxWithCreate` holds `open`/`inputValue` state (`combobox-with-create.tsx:51-52`); `CommandInput.onValueChange` updates `inputValue`; `handleCreate` (`combobox-with-create.tsx:56-62`) fires `onCreate(inputValue)`. Consumers: course block/new pages.
5. **CommandPalette**: `src/components/layout/CommandPalette.tsx` uses `CommandDialog` (`command.tsx:32`) as the ⌘K palette.
6. **Tabs path**: controlled-or-uncontrolled value resolved at `tabs.tsx:21`; clicking `TabsTrigger` calls `context.onValueChange` (`tabs.tsx:70`); `TabsContent` renders only when `context.value === value` (`tabs.tsx:82-84`).

## 5. Status table

All remaining primitives have ≥1 importer (grep, §6). (`sheet` was removed 2026-06-19 when its sole importer `CreationDrawer` was deleted in the ch.06 MED session — Q-06-001, Session 12; see its row below.)

| Unit | Status | Evidence |
|---|---|---|
| `cn()` | DONE | `utils.ts:4`; imported repo-wide |
| `getStudentAvatarUrl()` | DONE | `utils.ts:8`; used in 5 files (ProfilePicker, StudentDashboard, AccountMenu, ManageProfiles, StudentCard) |
| `alert-dialog` | DONE | `alert-dialog.tsx`; 8 importers (library lists, ProfileSettingsDialog, StudentCard…) |
| `avatar` | DONE | `avatar.tsx`; via profile/student/nav components |
| `badge` + `badgeVariants` | DONE | `badge.tsx:5,38`; widely imported |
| `button` + `buttonVariants` | DONE | `button.tsx:39`; imported repo-wide + by alert-dialog/calendar |
| `calendar` | DONE | `calendar.tsx:12`; PrayerJournalEditor, PrayerJournalFilters |
| `card` family | DONE | `card.tsx`; imported repo-wide |
| `checkbox` | DONE | `checkbox.tsx:9` |
| `combobox-with-create` | DONE | `combobox-with-create.tsx:40`; 3 course pages |
| `command` family | DONE | `command.tsx`; CommandPalette + combobox |
| `CommandShortcut` (export) | REMOVED ✅ (2026-06-19) | deleted as dead sub-export (was `command.tsx:158`; zero importers); see Q-07-006 / CHANGELOG.md |
| `dialog` family | DONE | `dialog.tsx`; widely imported |
| `dropdown-menu` family | DONE | `dropdown-menu.tsx`; nav/menus |
| `form` family + `useFormField` | DONE (single consumer) | `form.tsx`; **exactly 1 importer**: `src/app/creation-station/compiler/SpecForm.tsx:7-15` consumes Form/FormField/FormControl/FormItem/FormLabel/FormMessage/FormDescription via the `@/components/ui/form` alias (was a relative `../../../` path — fixed, Q-07-009 ✅ 2026-06-19). SpecForm calls bare `useForm` (RHF), not `useZodForm`. Single-consumer is adoption state, not a defect (SpecForm itself renders in CreationStationClient + CourseBuilder). |
| `input` | DONE | `input.tsx:7` |
| `label` (custom) | DONE | `label.tsx:7`; imported via form + feature files |
| `popover` | DONE | `popover.tsx`; combobox + many |
| `PopoverAnchor` (export) | REMOVED ✅ (2026-06-19) | deleted as dead sub-export (was `popover.tsx:42`; zero importers); see Q-07-006 / CHANGELOG.md |
| `progress` | DONE | `progress.tsx:9`; bible-memory dashboards |
| `radio-group` | DONE | `radio-group.tsx:11`; AssessmentWizard |
| `scroll-area` | DONE | `scroll-area.tsx:8`; 5 importers: AvatarCustomizer, missions/page, ChurchNotesClient, PrayerJournalSidebar, MissionsClient (verified `ui/scroll-area`). |
| `select` family | DONE | `select.tsx`; widely imported |
| ~~`sheet` family~~ | ✅ REMOVED (2026-06-19) | deleted — its sole importer `CreationDrawer` was removed in the ch.06 MED session (Q-06-001), leaving zero importers; removed as the orphan tail (driven by Q-06-001, Session 12). No npm dep orphaned (`@radix-ui/react-dialog` shared with `dialog.tsx`). |
| `slider` | DONE | `slider.tsx:8`; AvatarCustomizer |
| `switch` | DONE | `switch.tsx:9`; PrayerJournalEditor |
| `tabs` (custom) | DONE | `tabs.tsx`; 12 importers (ProfileSettingsDialog, TranscriptBuilder, ResourcePicker, BookScanner, BibleMemoryDashboard, …). NOTE: ContextCompleteness does NOT import tabs (it imports tooltip). |
| `textarea` | DONE | `textarea.tsx:4`; 8 importers |
| `tooltip` | DONE | `tooltip.tsx`; sole importer `src/components/context/ContextCompleteness.tsx:24` (verified `ui/tooltip` → 1 file) |
| `MarkdownContent` | DONE | `MarkdownContent.tsx:17`; living-library resource page. GFM + line-breaks only, no math/raw-HTML by design (Q-07-001 ✅). |
| `useZodForm` | DONE | `useZodForm.ts:5`; CreateStudentForm |

## 6. Integration points

- **Imports in**: `clsx`, `tailwind-merge` (utils); `@radix-ui/react-*` (alert-dialog, avatar, checkbox, dialog, dropdown-menu, popover, progress, radio-group, scroll-area, select, slider, switch, tooltip); `cmdk` (command); `react-day-picker` (calendar); `lucide-react` (calendar, command, dialog, dropdown-menu, radio-group, combobox) AND `@phosphor-icons/react` (checkbox, select) — two icon libs coexist (Q-07-002 ✅ accepted 2026-06-19: Phosphor is the house lib at ~56 importer files vs lucide's 8; coexistence kept as intentional, not worth a repo-wide visual-churn migration for a LOW); `react-hook-form` + `@hookform/resolvers/zod` + `zod` (form, useZodForm); `react-markdown` + `remark-gfm` + `remark-breaks` (MarkdownContent); `class-variance-authority` (button, badge).
- **Importers out**: ~118 files / 346 occurrences match `@/components/ui/` (grep aggregate, commit b585c1e). NOTE: this alias grep can MISS consumers that import via single-quoted paths — e.g. the calendar consumers (single-quoted `'@/components/ui/calendar'`). (`form.tsx`'s sole consumer SpecForm was the relative-path outlier — now on the `@/components/ui/form` alias, Q-07-009 ✅ 2026-06-19.) Top consumers: discipleship pages, library lists, students, generators, profiles, dashboards, transcripts.
- **Env vars**: none. **External APIs**: `getStudentAvatarUrl` builds `https://api.dicebear.com/9.x/lorelei/svg` URLs (`utils.ts:9`) — client-side `<img>` fetch only.
- **Prisma models / Inngest jobs**: none (pure presentation layer).
- **Tailwind tokens**: depends on `qc-*` design tokens defined in the Tailwind config (out of chapter scope).

## 7. Findings

Q-07-001  [LOW]  ✅ ACCEPTED 2026-06-19 — KaTeX omission is correct-by-design + corrected the misleading comment (see CHANGELOG.md). MarkdownContent uses NO rehype/KaTeX despite math-rendering expectation  — src/components/resources/MarkdownContent.tsx:20
  Evidence: only `remarkPlugins={[remarkGfm, remarkBreaks]}`; no `rehype-katex`/`remark-math`/`rehype-raw` imported. The chapter brief and the "matching how the app renders markdown elsewhere" comment imply KaTeX/HTML support that is absent.
  Impact: generated resources containing LaTeX math ($…$) or raw HTML will render as literal text, not formatted output. Silent content degradation for math-heavy generated material.
  Re-verify (Session 13): the "silent math degradation" premise does NOT hold — the generation pipeline emits math as `\(...\)`/`\[...\]` (Siyavula `siyavula.ts:126`) or strips it (OpenStax `openstax.ts:227`), and prompt-builder never instructs bare `$...$` (`prompt-builder.ts:136-138`). remark-math 6 parses ONLY `$...$`/`$$...$$` by default, so adding KaTeX would render ~zero real math while its `singleDollarTextMath:true` default would MANGLE bare-`$` currency ("costs $5 and $10") in word-problem/economics resources; rehype-raw is an XSS risk on AI content. So the GFM-only renderer is correct; the only real defect was the comment claiming ThinklingChat parity (ThinklingChat *does* use remark-math/rehype-katex). Adversarially confirmed (Workflow) + spot-verified at source.
  Status: ✅ ACCEPTED (correct-by-design) + comment corrected to state the intentional GFM-only/no-math/no-raw-HTML posture — closes the finding.

Q-07-002  [LOW]  ✅ ACCEPTED 2026-06-19 (won't-fix) — intentional coexistence; a repo-wide/visual standardization is disproportionate churn for a LOW (see CHANGELOG.md). Two icon libraries mixed across primitives (lucide-react + @phosphor-icons/react)  — src/components/ui/checkbox.tsx:5, src/components/ui/select.tsx:5 vs src/components/ui/command.tsx:5, src/components/ui/dropdown-menu.tsx:5
  Evidence: checkbox/select import from `@phosphor-icons/react`; command/dialog/dropdown-menu/calendar/radio-group/combobox import from `lucide-react`.
  Impact: inconsistent iconography (stroke/weight differ), duplicate icon-font/bundle weight, harder design consistency. Drift between two shadcn import generations.
  Re-verify (Session 13): reproduces. Repo-wide counts — **Phosphor = 56 importer files (the de-facto house lib), lucide = 8** (6 ui primitives + TranscriptBuilder + a dead commented line in DevotionalDisplay). `components.json:13` declares `iconLibrary: lucide`, which is itself the misleading artifact. Converting the 2 Phosphor primitives → lucide (the original draft idea) is the WRONG direction (toward the minority lib) and a visible app-wide change to checkbox/select for no functional gain; the only dependency-reducing direction (consolidate ONTO Phosphor, removing lucide) is a separate, larger effort. Owner chose accept-and-close.
  Status: ✅ ACCEPTED (won't-fix) — closes the finding; both libs unchanged, no code change.

Q-07-003  [LOW]  ✅ RESOLVED 2026-06-19 — nullable-context fix (see CHANGELOG.md). `useFormField` dereferences fieldContext before its null guard (dead guard)  — src/components/ui/form.tsx:34-43 (was :42-46)
  Evidence: `getFieldState(fieldContext.name, formState)` runs at line 42, then `if (!fieldContext) throw …` at line 44. If `fieldContext` were ever null/undefined the line-42 access throws first; the guard can never fire (and `fieldContext` is a default `{}` from createContext anyway, so the intended "used outside FormField" error never surfaces).
  Impact: misuse outside `<FormField>` yields a confusing `getFieldState`/`itemContext.id` crash instead of the intended "useFormField should be used within <FormField>" message. Minor DX/error-handling defect.
  Fix (Session 13): `FormFieldContext` default changed `{} as …` → `null` and typed `FormFieldContextValue | null` (`form.tsx:19`); the existing `if (!fieldContext)` guard moved ABOVE the `getFieldState` deref (`form.tsx:39-43`). The guard is now genuinely reachable (default `null` is falsy) AND TS narrows `fieldContext` to non-null so the subsequent `.name` access is type-honest — matching upstream shadcn's intended pattern. Change is fully contained to `form.tsx` (`FormFieldContext` is module-private; `useFormField` is its only `useContext` reader; the Provider always supplies a value). Happy path unchanged. Chose this over the `if (!fieldContext.name)` half-fix, which would have left the dishonest `{}` default.
  Status: ✅ RESOLVED.

Q-07-005  [INFO]  ✅ RESOLVED 2026-06-19 — converged ALL 16 forwardRef primitives → data-slot function components; removed the stray calendar displayName; zero forwardRef remains (single generation) (see CHANGELOG.md). Two divergent shadcn conventions coexist (forwardRef+displayName vs data-slot fns)  — src/components/ui/select.tsx:15 (forwardRef) vs src/components/ui/dialog.tsx:9 (data-slot fn)
  Evidence: older files use `React.forwardRef` + `.displayName`; newer files (avatar, dialog, dropdown-menu, popover, command) are plain function components with `data-slot` attributes and no ref forwarding.
  Impact: inconsistent ref-forwarding (newer components can't take a ref), inconsistent stylable `data-slot` hooks, maintenance friction. Two shadcn CLI generations merged without reconciliation.
  Status: documented (not fixed)

Q-07-006  [INFO]  ✅ RESOLVED 2026-06-19 — deleted dead CommandShortcut + PopoverAnchor (see CHANGELOG.md). Dead/unused sub-exports: CommandShortcut, PopoverAnchor  — src/components/ui/command.tsx:158, src/components/ui/popover.tsx:42
  Evidence: grep across repo (excluding the defining files) returns zero importers for `CommandShortcut` and `PopoverAnchor`. (`CommandDialog`, `CommandSeparator`, etc. ARE used.)
  Impact: trivial dead surface area; harmless but inflates the API. Not whole-file DEAD (the modules are used), so logged as INFO.
  Status: documented (not fixed)

Q-07-007  [INFO]  ✅ RESOLVED 2026-06-19 — removed scaffolding comment; moved "use client" to line 1 in switch/progress (see CHANGELOG.md). Stray "trigger generic file update" comments in committed primitives  — src/components/ui/radio-group.tsx:2, src/components/ui/switch.tsx (leading blank line + comment), src/components/ui/progress.tsx:1
  Evidence: `// Trigger generic file update` left in radio-group; progress/switch begin with an accidental blank first line before `"use client"`.
  Impact: cosmetic; the leading blank line before `"use client"` is harmless in current bundler config but `"use client"` is conventionally required at the very top — low risk of directive being ignored under stricter tooling.
  Status: documented (not fixed)

Q-07-008  [INFO]  ✅ RESOLVED 2026-06-19 — deleted duplicate RadixSlot import (see CHANGELOG.md). Duplicate Slot import in form.tsx  — src/components/ui/form.tsx:4-5
  Evidence: `import { Slot } from "@radix-ui/react-slot"` then `import { Slot as RadixSlot } from "@radix-ui/react-slot"`; `RadixSlot` is never used.
  Impact: dead import; trivial. Indicates copy-paste residue.
  Status: documented (not fixed)

Q-07-009  [LOW]  ✅ RESOLVED 2026-06-19 — SpecForm import swapped to the `@/components/ui/form` alias (see CHANGELOG.md). form.tsx has a single consumer, imported via a brittle relative path (near-dead)  — src/app/creation-station/compiler/SpecForm.tsx:15
  Evidence: grep for `components/ui/form` returns exactly ONE importer (SpecForm), which imports via `../../../components/ui/form` instead of the `@/components/ui/form` alias used everywhere else; the alias-grep `@/components/ui/form` returns ZERO. The whole form stack (Form/FormField/FormControl/FormItem/FormLabel/FormMessage/FormDescription/useFormField) is exercised by this one file only.
  Impact: the form abstraction is barely wired (one feature surface); the relative `../../../` import is fragile under file moves and is invisible to alias-based audits/refactors. Not whole-file DEAD (one live consumer), so logged LOW.
  Fix (Session 13): changed `SpecForm.tsx:15` from `../../../components/ui/form` → `@/components/ui/form`. Verified byte-identical target (tsconfig `@/*` → `./src/*`, bundler resolution; no `jsconfig`/webpack-alias override), no circular import (`form.tsx` imports only `@/lib/utils` + `@/components/ui/label`), zero behavioral change — now visible to alias audits and robust under file moves. The "single consumer" half is adoption state, NOT a defect: `form.tsx` is live (its sole consumer `SpecForm` is rendered in `CreationStationClient.tsx:83` + `CourseBuilder.tsx:778`), so no removal warranted.
  Status: ✅ RESOLVED.
