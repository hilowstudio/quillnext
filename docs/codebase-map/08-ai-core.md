# 08 — AI Core (models, guardrails, prompts)
> Source of truth: the files in §1, read end-to-end. Written against commit b585c1e.

## 1. Scope

| File | Role (one line) |
|------|------|
| `src/lib/ai/config.ts` | Gemini model instances, task→model map, complexity tiers, embedding model + provider options, YouTube/video detection, retirement-fallback middleware. |
| `src/lib/ai/generation-guards.ts` | Grounded-generation: quote-grounding prompt fragments, CANONICAL FACTS block builder, best-effort verify/revise passes (markdown + structured object). |
| `src/lib/ai/prompt-builder.ts` | `PromptBuilder` class (Inkling 2.0) — fluent builder injecting Inkling persona + ethical guardrails + student/family/philosophy context. LIVE (used by generate-resource-core). |
| `src/lib/ai/schemas.ts` | Zod schemas for AI-generated interactive content: `QuizSchema`, `WorksheetSchema` (+ item/section/question sub-schemas). |
| `src/lib/utils/prompt-builder.ts` | The function builder `buildMasterPrompt` (Master Context Service) for grading + generate-tool; injects the SAME Inkling persona + ethical guardrails as the class builder (Q-08-001 resolved 2026-06-19). |
| `src/lib/constants/ai-guardrails.ts` | `INKLING_BASE_PERSONALITY` + `INKLING_ETHICAL_GUIDELINES` constants consumed by BOTH prompt builders (`PromptBuilder` + `buildMasterPrompt`, Q-08-001). |
| `src/server/ai/personality.ts` | Personality / learning-style / interest assessment AI: three Zod-constrained `generateObject` profilers. |
| `src/lib/thinkling.ts` | `getContextForThinkling` — builds the Thinkling student-chat system prompt (ethics, safeguarding, Socratic rules) per mode. |

## 2. Purpose / intent
This chapter is the **AI substrate** every generator/chat/assessment feature sits on. It owns (a) **which Gemini model** runs each task (cost/quality tiering + video routing), (b) the **safety persona & guardrails** baked into prompts (Inkling for parent-facing generation, Thinkling for student chat), (c) the **grounded-generation guards** that stop hallucinated quotes/contradictions before content reaches a parent, (d) the **Zod output contracts** for quizzes/worksheets, and (e) the **personality-assessment AI** that converts questionnaire answers into structured learner profiles. Provider is **Gemini-only** at runtime — despite the project anchor noting "Gemini primary + OpenAI", no `@ai-sdk/openai` import exists in any `.ts/.tsx` source (see Finding Q-08-006).

## 3. Architecture & key files

### Model selection (`config.ts`)
- API-key shim: copies `GEMINI_API_KEY` → `GOOGLE_GENERATIVE_AI_API_KEY` (config.ts:4-7) because the AI SDK reads the latter.
- Five model instances (config.ts:72-78): `pro3`/`pro` = same `gemini-2.5-pro` instance; `flash` = `gemini-3.5-flash` (the de-facto default); `flashLite` = `gemini-3.1-flash-lite`; `imageGen` = `gemini-3-pro-image`.
- `AITaskType` enum (config.ts:92-117) + `taskModelMap` (config.ts:122-148) drive `getModelForTask` (config.ts:154). PERSONALITY_PROFILING / LEARNING_STYLE_ANALYSIS are intentionally **downgraded to flash** "for reliability" (config.ts:125-126), so the enum comments claiming "Use Gemini 3 Pro" for highest-complexity tasks are partly stale.
- `getModelForTaskWithVideoCheck` (config.ts:227) force-routes to `pro3` when content contains a YouTube URL (`containsYouTubeUrl`, config.ts:214).
- Embeddings: `gemini-embedding-2` @ 1536 dims (config.ts:197-199) via `embeddingModel` + `embeddingProviderOptions` (asymmetric RETRIEVAL_DOCUMENT/QUERY taskType, config.ts:206).
- Retirement handling: REMOVED 2026-06-19 (Session 14, Q-08-002). `isModelRetiredError` + `withRetirementFallback` (a retire-and-fall-back-to-stable middleware) were dead — zero callers, comment self-admitted "no longer needed for a stable model" — and were deleted along with their `ai` SDK import.

### Guardrails / persona
- `ai-guardrails.ts`: two string constants — Inkling persona (no first-person, parent-led, not a replacement) and ethical guidelines (Nicene-orthodox bounds, no pastoral care, "draft" transparency).
- `prompt-builder.ts` (`PromptBuilder` class) seeds `identity`/`ethicalGuardrails` from those constants (prompt-builder.ts:6-7), then layers student context, family/philosophy context (from `PHILOSOPHY_PROMPTS`), task, source, user instructions, and a fixed OUTPUT GUIDELINES footer (prompt-builder.ts:105-141). This is the **Inkling 2.0 parent-facing generation** prompt.
- `thinkling.ts` builds the **student-facing chat** prompt — a large inline system prompt (thinkling.ts:35-88) with safeguarding protocol, "guidance vs answers" Socratic constraint, and formatting rules — appended with a per-mode block (TUTOR/RESEARCH/CAREER, thinkling.ts:92-115).

### Grounded generation (`generation-guards.ts`)
- Three quote-grounding prompt fragments for three source regimes: no source text (`QUOTE_GROUNDING_RULE`), RAG verified excerpts (`_WITH_SOURCE`), open textbook ground-don't-echo (`_TEXTBOOK`).
- `buildCanonicalFactsBlock` (generation-guards.ts:83) renders a "CANONICAL FACTS" block from source metadata.
- `verifyAndReviseMarkdown` (generation-guards.ts:124) and `verifyAndReviseObject<T>` (generation-guards.ts:188) run a single corrective LLM pass; **both are defensively wrapped and never throw** — on error they return the original draft.

### Output contracts (`schemas.ts`)
- `QuizSchema` / `WorksheetSchema` (+ sub-schemas) — the Zod shapes passed to `generateObject` and the verify-object guard.

### Two prompt-builders (CRITICAL distinction — both LIVE)
- `src/lib/ai/prompt-builder.ts` (class) — imported only by `src/app/actions/generate-resource-core.ts:7` (Inkling resource generation).
- `src/lib/utils/prompt-builder.ts` (functions) — now contains ONLY `buildMasterPrompt` (imported by `grading-actions.ts:4` and `generate-tool.tsx:6`); the deprecated/dead surface (`buildCompletePrompt` + `buildSpineAwarePrompt`/`buildPersonalizedPrompt`/`buildFamilyContextPrompt`/`calculateAge`) was REMOVED 2026-06-19 (Session 14, Q-08-003). The guardrail divergence between this file's `buildMasterPrompt` and the class builder was **CLOSED 2026-06-19 (Session 15, Q-08-001 resolved)**: `buildMasterPrompt` now injects the same `INKLING_BASE_PERSONALITY` + `INKLING_ETHICAL_GUIDELINES` (utils/prompt-builder.ts:3,54,56). The builders stay structurally separate by design (sync Prisma-entity vs async ID→MasterContext) but share ONE guardrail source (`ai-guardrails.ts`).

## 4. Data flow

**Inkling resource generation (class builder + guards):**
`generate-resource-core.ts` imports `PromptBuilder` (line 7), `models` (line 3), `QuizSchema`/`WorksheetSchema` (line 11), and all guards (lines 13-19). It selects a `quoteRule` constant by source regime (generate-resource-core.ts:299/482/491/584/624), builds a facts block (`buildCanonicalFactsBlock`, lines 413/423/670), generates, then verifies — `verifyAndReviseObject(..., QuizSchema, ..., models.pro3, ...)` (line 755), worksheet at 757, markdown via `verifyAndReviseMarkdown(..., models.flash, ...)` (line 760). The verify model differs by content type (pro3 for objects, flash for markdown).

**Master-context generation (function builder):**
`generate-tool.tsx:66` → `buildMasterPrompt(...)` → `getMasterContext` + `serializeMasterContext` (utils/prompt-builder.ts:38/41), which prepends `INKLING_BASE_PERSONALITY` + `INKLING_ETHICAL_GUIDELINES` above the serialized context (utils/prompt-builder.ts:54-56, Q-08-001) → model chosen by `getModelForTaskWithVideoCheck(taskType, userPrompt)` (generate-tool.tsx:84). `grading-actions.ts:49/88` calls `buildMasterPrompt` twice for grading (now also guardrail-framed).

**Personality assessment:**
`src/app/api/students/[id]/assessment/route.ts` — auth (line 17-20), explicit **tenant guard** (lines 39-42: `getCurrentUserOrg()` + verify `student.organizationId === organizationId`, else 404), then by `step` calls `generateStudentProfile` / `generateLearningStyleProfile` / `generateInterestProfile` (route lines 51/56/61 → personality.ts:94/123/148). Each does a `generateObject` with `getModelForTask(...)` → flash (downgraded) and a per-domain Zod schema, returning the parsed object, which the route persists to `LearnerProfile.personalityData` / `learningStyleData` / `interestsData` via `db.learnerProfile.upsert` (route lines 52/57/62, 70). Note: the initial `db.learner.findUnique` (route line 30) is NOT org-scoped — it fetches by id alone and the org check happens after; safe here because the result is gated by the equality check at line 40, but the lookup itself crosses tenants. Consumed later by the Master Context serializer (`context-serializer.ts`, via `buildMasterPrompt`) and `getContextForThinkling` — the dead `buildPersonalizedPrompt` copy was removed (Q-08-003).

**Thinkling chat:**
`src/app/api/chat/route.ts` — auth (line 14), explicit **tenant guard** (lines 50-54: `getCurrentUserOrg()` + verify `student.organizationId === organizationId`, else 403), `getContextForThinkling(studentId, mode, organizationId)` (line 56) builds the system prompt, fires an async Inngest safety scan (`chat/message.sent`, lines 75-85), then `streamText({ model: models.flash, system: systemPrompt, ... })` (lines 88-92). `getContextForThinkling` itself reads the learner via `withTenant(..., { organizationId, userId: null })` (thinkling.ts:11-23).

## 5. Status table

| Unit | Status | Evidence |
|------|--------|----------|
| `models` map / `getModelForTask` / `getModelForTaskWithVideoCheck` | DONE | config.ts:72-78,154,227; imported by 12+ source files (suggest-blocks, grading, generate-tool, bible-study, etc.). |
| `embeddingModel` / `embeddingProviderOptions` / `EMBEDDING_*` | DONE | config.ts:197-208; used by `lib/utils/vector.ts:4`, `lib/textbook-coverage.ts:14`. |
| `containsYouTubeUrl` | DONE | config.ts:214; used internally by `getModelForTaskWithVideoCheck` (live). |
| `getModelByComplexity` / `TaskComplexity` | REMOVED | deleted 2026-06-19 (Session 14, Q-08-002); had 0 code importers (only config.ts + the now-deleted `model-selection.md`). |
| `getDefaultModel` / `getStructuredModel` / `getGenerativeUIModel` | REMOVED | deleted 2026-06-19 (Session 14, Q-08-002); were zero-importer "legacy" helpers. |
| `withRetirementFallback` / `isModelRetiredError` | REMOVED | deleted 2026-06-19 (Session 14, Q-08-002); whole subtree was unreachable (the `ai` import they needed went too). |
| `PromptBuilder` (class) | DONE | prompt-builder.ts:5; imported `generate-resource-core.ts:7`, instantiated line 679. |
| `INKLING_BASE_PERSONALITY` / `INKLING_ETHICAL_GUIDELINES` | DONE | ai-guardrails.ts:9/19; consumed by BOTH builders — class `prompt-builder.ts:6-7` + `utils/prompt-builder.ts:3,54,56` (Q-08-001). |
| `QUOTE_GROUNDING_RULE` / `_WITH_SOURCE` / `_TEXTBOOK` | DONE | generation-guards.ts:21/30/39; used generate-resource-core.ts:299-624. |
| `buildCanonicalFactsBlock` | DONE | generation-guards.ts:83; used generate-resource-core.ts:413/423/670. |
| `verifyAndReviseMarkdown` / `verifyAndReviseObject` | DONE | generation-guards.ts:124/188; used generate-resource-core.ts:755-760. |
| `QuizSchema` / `WorksheetSchema` (+ subs) | DONE | schemas.ts:7-53; imported generate-resource-core.ts:11. |
| `InteractiveContent` type | DONE (type-only) | schemas.ts:53; type alias for the two schemas. |
| `buildMasterPrompt` | DONE | utils/prompt-builder.ts:10; imported grading-actions.ts + generate-tool.tsx; injects Inkling persona + ethical guardrails (Q-08-001). |
| `buildCompletePrompt` | REMOVED | deleted 2026-06-19 (Session 14, Q-08-003); `@deprecated`, zero external importers. |
| `buildSpineAwarePrompt` | REMOVED | deleted 2026-06-19 (Session 14, Q-08-003); only caller was the dead `buildCompletePrompt`. |
| `buildPersonalizedPrompt` / `buildFamilyContextPrompt` | REMOVED | deleted 2026-06-19 (Session 14, Q-08-003); only caller was the dead `buildCompletePrompt`. |
| `calculateAge` (utils/prompt-builder) | REMOVED | deleted 2026-06-19 (Session 14, Q-08-003); never referenced. |
| `generateStudentProfile` / `generateLearningStyleProfile` / `generateInterestProfile` | DONE | personality.ts:94/123/148; used assessment route lines 51/56/61. |
| `getContextForThinkling` | DONE | thinkling.ts:10; used `api/chat/route.ts:47`. |

## 6. Integration points
- **Imports in:** `@ai-sdk/google` (config.ts:1), `ai` SDK (`generateText`/`generateObject`/`streamText` — the `wrapLanguageModel`/`APICallError`/`NoSuchModelError` imports went with the removed retirement code, Q-08-002), `zod`, `@/generated/client` (Prisma types in class builder), `@/lib/constants/educational-philosophies` (`PHILOSOPHY_PROMPTS`), `@/lib/constants/ai-guardrails` (`INKLING_BASE_PERSONALITY`/`INKLING_ETHICAL_GUIDELINES` — now both builders, Q-08-001), `@/lib/context/master-context` + `context-serializer` (utils builder), `@/server/db` (`withTenant`, used by `thinkling.ts`; the dead utils builders' `db` import was removed, Q-08-003).
- **Importers out:** generate-resource-core.ts, generate-tool.tsx, grading-actions.ts, suggest-blocks.ts, bible-study.ts, library/scan/vision route, api/chat route, students assessment route, vector.ts, textbook-coverage.ts, video-extraction.ts, book-extraction.ts, image-generation.ts, safety/guard.ts, compile-curriculum.ts (Inngest), Thinkling UI components (type import only).
- **Env vars:** `GEMINI_API_KEY` (preferred) → shimmed to `GOOGLE_GENERATIVE_AI_API_KEY` (config.ts:4-7).
- **External APIs:** Google Gemini (text, structured, embeddings, image). **No OpenAI** at runtime (grep: no `@ai-sdk/openai` in source).
- **Prisma models used:** `Learner`/`learner`, `LearnerProfile`/`learnerProfile`, `Classroom`, `Objective`, `Organization`, `EducationalPhilosophy` (enum/type). See 02-data-model.md.
- **Inngest jobs:** none defined here; `api/chat/route.ts` *emits* `chat/message.sent` (consumed by the safety scan job — see 20-thinkling-chat-safety). Tenancy machinery (`withTenant`, `getCurrentUserOrg`) is documented in 04-security-auth-tenancy.md.

## 7. Findings

Q-08-001  ✅ RESOLVED 2026-06-19 (Session 15) — injected the shared Inkling persona + ethical guardrails (`INKLING_BASE_PERSONALITY` + `INKLING_ETHICAL_GUIDELINES` from `@/lib/constants/ai-guardrails`) into `buildMasterPrompt` (utils/prompt-builder.ts:3,54,56), replacing the bare "You are an expert educator…" opener and adding a draft-for-parental-review line. Both `buildMasterPrompt` consumers — AI grading feedback (`grading-actions.ts`) and the generate-tool generative-UI path (`generate-tool.tsx`) — now carry the SAME safety bounds as the class `PromptBuilder`, and BOTH builders source the guardrails from ONE place (so a future guardrail change is made once). The two builders stay architecturally separate by design (sync Prisma-entity vs async ID→MasterContext; ch.10 "share almost no code") — NOT merged. Re-verify sharpened the finding: `PHILOSOPHY_PROMPTS` + family/faith context were already present in BOTH paths (context-serializer.ts:107-114), so the only real divergence was the persona + ethical-bounds layer (no-pastoral-care / no-simulacrum / draft-transparency / Nicene bounds), now closed. A 3-lens adversarial pass split 2-1 on grade (MED) / scope (both consumers); owner chose full persona+guardrails (see CHANGELOG.md). [MED]  Two divergent prompt-builders, both live — drift/duplication  — `src/lib/ai/prompt-builder.ts` (class) and `src/lib/utils/prompt-builder.ts` (functions)
  Evidence: Class `PromptBuilder` imported only by generate-resource-core.ts:7; function `buildMasterPrompt` imported by grading-actions.ts:4 + generate-tool.tsx:6. Two separate persona/context schemes (class uses INKLING_* constants + PHILOSOPHY_PROMPTS; functions use Master Context Service). The mastery skill already flags this pair.
  Impact: Persona/guardrail changes must be made in two places; the two paths can (and do) diverge in what context/guardrails they inject, so generation safety/quality differs by entry point.
  Status: ✅ RESOLVED 2026-06-19 (Session 15) — guardrails converged into `buildMasterPrompt`; see CHANGELOG.md

Q-08-002  ✅ REMOVED 2026-06-19 (Session 14) — deleted all the dead helpers (incl. the now-orphaned `TaskComplexity` enum) + the now-unused `ai` import / `GoogleModel` type / stale comments naming them; also deleted the stale git-tracked source-tree doc `src/lib/ai/model-selection.md` (documented the removed helpers + independently stale vs code). Live `models`/`getModelForTask`/`getModelForTaskWithVideoCheck`/embeddings untouched (see CHANGELOG.md). [LOW]  Dead model-selection helpers in config.ts  — `src/lib/ai/config.ts:161,176,180,184,39,16`
  Evidence: `getModelByComplexity`, `getDefaultModel`, `getStructuredModel`, `getGenerativeUIModel`, `withRetirementFallback` have zero importers outside config.ts/docs (grep over `.ts/.tsx`). `isModelRetiredError` is exported and called ONLY inside the dead `withRetirementFallback` (config.ts:47,56), so its entire subtree is unreachable from any live path. config.ts:68 comment self-admits the fallback helper is "no longer needed."
  Impact: Dead surface invites callers to use stale/unused selection logic; the retirement-fallback safety net is no longer wired to any live model despite its stated purpose.
  Status: documented (not fixed)

Q-08-003  ✅ REMOVED 2026-06-19 (Session 14) — deleted `buildCompletePrompt` + its only-callees (`buildSpineAwarePrompt`/`buildPersonalizedPrompt`/`buildFamilyContextPrompt`) + `calculateAge` + the unused `ObjectiveWithHierarchy` type + the now-unused `import { db, withTenant }`; the live `buildMasterPrompt` (the real personality-injection path, via master-context) is kept (see CHANGELOG.md). [LOW]  Dead internal-only prompt builders + unused helper in utils  — `src/lib/utils/prompt-builder.ts:216,40,113,168,305`
  Evidence: `buildCompletePrompt` (`@deprecated`, line 214) is the sole caller of `buildSpineAwarePrompt`/`buildPersonalizedPrompt`/`buildFamilyContextPrompt`, and has no external importer. `calculateAge` (line 305) is never referenced.
  Impact: ~150 lines of dead code; `buildPersonalizedPrompt`'s personality-injection logic is no longer reachable, so any expectation that generation honors `LearnerProfile.personalityData` via this file is false.
  Status: documented (not fixed)

Q-08-004  ✅ RESOLVED 2026-06-19 (Session 14) — deleted the duplicated line 48; the guideline list now numbers 1-2-3-4 correctly. Prompt is passed whole to the model (nothing parses by line), so no behavior change beyond the corrected prompt (see CHANGELOG.md). [LOW]  Duplicated rule block in Thinkling system prompt  — `src/lib/thinkling.ts:47-48`
  Evidence: The "3. DO NOT LEAD WORSHIP" guideline is written twice verbatim (lines 47 and 48), and the numbered list then has two "3." entries (worship duplicated, "4." follows).
  Impact: Wasted prompt tokens and a mis-numbered guideline list; cosmetic but signals copy-paste error in a safety-critical prompt.
  Status: documented (not fixed)

Q-08-005  ✅ RESOLVED 2026-06-19 (Session 14) — corrected the enum value `"Mirco-Learning"` → `"Micro-Learning"`. The wizard's `contentDensity` answer "Overwhelmed" (desc: "Needs micro-learning chunks") is mapped by the model to this structured value; `generateObject` constrains the MODEL output (not the user's free-text answer), and repo-wide grep found no code matching the literal — so the fix is zero-risk and needs no backfill (stored rows keep the old spelling but nothing reads it as a literal) (see CHANGELOG.md). [LOW]  Schema typo baked into AI output contract  — `src/server/ai/personality.ts:47`
  Evidence: `LearningStyleSchema.contentDensity` enum value is `"Mirco-Learning"` (misspelled "Micro", personality.ts:47 — verified by grep, sole occurrence repo-wide). The value is the literal stored/emitted by the model, so downstream code matching `"Micro-Learning"` would never match. (`src/lib/ai/schemas.ts` has NO such typo; the original draft mis-attributed this to schemas.ts.)
  Impact: Any consumer keying off the correct spelling silently misses this branch; the typo is persisted into `LearnerProfile` JSON.
  Status: documented (not fixed)

Q-08-006  ✅ RESOLVED 2026-06-19 — dropped the unused @ai-sdk/openai dependency (see CHANGELOG.md). [INFO]  No OpenAI provider wired despite project "Gemini + OpenAI" claim  — repo-wide
  Evidence: `grep '@ai-sdk/openai|createOpenAI|from "openai"'` over all `.ts/.tsx` returns no files; OpenAI appears only in package-lock/package.json. All model instances in config.ts are `google(...)`.
  Impact: There is no live OpenAI fallback; a Gemini outage has no provider-level failover (the only fallback machinery, `withRetirementFallback`, is itself dead — Q-08-002).
  Status: documented (not fixed)

Q-08-007  ✅ RESOLVED 2026-06-19 — config.ts comments now say gemini-2.5-pro; flash-downgrade reconciled (see CHANGELOG.md). [INFO]  Stale comments / model-tier drift in config.ts  — `src/lib/ai/config.ts:93-99,123-131,180-184`
  Evidence: Enum/map comments say highest-complexity + personality tasks "Use Gemini 3 Pro", but PERSONALITY_PROFILING/LEARNING_STYLE_ANALYSIS map to `models.flash` (lines 125-126) and `pro3`/`pro` are `gemini-2.5-pro` not "Gemini 3 Pro". `getStructuredModel` comment says "Gemini 3 Pro" (line 181) though it returns 2.5-pro.
  Impact: Comments misrepresent which model actually runs each task; readers may make cost/quality decisions on wrong assumptions.
  Status: documented (not fixed)

Q-08-008  [INFO]  ⏳ DEFERRED 2026-06-19 — owner: wait for observability, then add a tagged-warn/metric on the verify/revise fail-open path. Verify/revise guards swallow all errors silently (by design)  — `src/lib/ai/generation-guards.ts:176-179,242-245`
  Evidence: Both `verifyAndReviseMarkdown` and `verifyAndReviseObject` catch every error and return the unverified original draft (console.error only).
  Impact: Intentional fail-open for resilience, but means a persistently failing verify model degrades grounding/quote-safety to zero with no surfaced signal beyond logs; worth a metric/alert.
  Status: documented (not fixed)
