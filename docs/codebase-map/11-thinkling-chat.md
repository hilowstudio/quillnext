# 11 — Thinkling (AI tutoring chat)
> Source of truth: the files in §1, read end-to-end. Written against commit b585c1e.

## 1. Scope

| File | Role |
|------|------|
| `src/app/thinkling/page.tsx` | Server page: auth + org gate, loads org's learners, renders client shell |
| `src/app/api/chat/route.ts` | Streaming chat endpoint (Vercel AI SDK `streamText`, Gemini Flash); fires safety-scan event |
| `src/components/thinkling/ThinklingClient.tsx` | Client shell: student picker + mode state, mounts the chat |
| `src/components/thinkling/ThinklingChat.tsx` | The chat widget: `useChat` hook, message rendering (markdown/KaTeX), input form |
| `src/components/thinkling/ModeSelector.tsx` | Three-button mode toggle (TUTOR / RESEARCH / CAREER) |
| `src/lib/types/tools.ts` | Zod schemas for "generator/tool" config — **DEAD** (zero importers repo-wide) |

The system prompt + `ThinklingMode` + `getContextForThinkling()` live in `src/lib/thinkling.ts` (owned by **08-ai-core**) — cross-ref, not re-documented here.

## 2. Purpose / intent
"Thinkling" is the student-facing AI tutoring chat ("Inkling, supercharged"). A parent/teacher selects one of their learners and a *mode* (Subject Tutor, Research Assistant, College & Career), then converses with a Gemini-Flash assistant whose system prompt is personalized to that learner via `getContextForThinkling`. Every user turn is mirrored into a background safety-screening pipeline (see 12-/23-safety) so distressing/unsafe messages are detected, logged as `SafetyFlag`s, and (policy-gated) escalated to caregivers.

## 3. Architecture & key files
- **Server entry** `thinkling/page.tsx`: `auth()` → redirect `/login` if no session; `getCurrentUserOrg()` → redirect `/onboarding` if no org; `withTenant` query of `learner.findMany` scoped by `organizationId` (page.tsx:24-33). Hands `students[]` to `ThinklingClient`.
- **Client shell** `ThinklingClient.tsx`: holds `selectedStudentId` (default first student) + `mode` ("TUTOR" default) in React state. Student `<Select>` and mode are passed down; `<ThinklingChat key={selectedStudentId} … />` is remounted when the student changes (line 74).
- **Chat widget** `ThinklingChat.tsx`: `useChat` from `@ai-sdk/react` (line 30). Posts to the default `/api/chat` (the `api`/`body` options are commented out as "invalid in this SDK version", lines 31-33). `studentId`+`mode` are passed per-message via `sendMessage(..., { body: { studentId, mode } })` (lines 86-91). Renders markdown with `remark-gfm/breaks/math` + `rehype-katex`. Clears messages on mode/student change (lines 68-71).
- **Mode toggle** `ModeSelector.tsx`: hardcoded `MODES` array of 3 entries with icons/colors; emits `onSelectMode(mode.id as ThinklingMode)`.
- **API route** `api/chat/route.ts`: `force-dynamic`, `maxDuration=30`. Auth → tenant guard → build system prompt → emit safety event → `streamText({ model: models.flash, system, messages })` → stream response.
- **`tools.ts`**: defines `GeneratorConfigSchema`, `AvailableToolsSchema`, `GeneratorInputSchema`, `OmniGeneratorToolSchema`. Despite the "Thinkling tool types" framing, **nothing imports it** and `streamText` passes NO `tools` — the chat is plain text-in/text-out.

## 4. Data flow
1. **Page load** — `thinkling/page.tsx:13-22` authenticates and resolves org; `:24-33` loads learners via `withTenant(... { organizationId, userId: null })`; `:35` renders `<ThinklingClient students=…/>`.
2. **User selects student/mode** — `ThinklingClient.tsx:23-24` state; mode change via `ModeSelector` → `onModeChange` → `setMode` (`ThinklingChat.tsx:99`, `ThinklingClient.tsx:74`).
3. **User sends a message** — `ThinklingChat.tsx:77-92` `handleFormSubmit` calls `sendMessage({ role:"user", content }, { body:{ studentId, mode } })`. The widget also passes `studentId`/`mode` in the query string of `apiUrl` (line 28) — but `apiUrl` is **unused** (the `api:` option is commented out), so it never reaches the request.
4. **POST `/api/chat`** — `route.ts:14-20` auth gate (401). `:22-45` parse body; fall back to query params for `studentId`/`mode`; 400 if still missing. `:50-54` **tenancy guard**: `db.learner.findUnique({ where:{ id: studentId } })` then `if (!student || student.organizationId !== organizationId) → 403`. `:56` `getContextForThinkling(studentId, mode, organizationId)` builds the personalized `systemPrompt` (see 08-ai-core). `:60-69` normalize `messages` (synthesizes `content` from `parts[].text` when absent).
5. **Safety hook** — `route.ts:73-85`: if the last message is from `user`, `inngest.send({ name:"chat/message.sent", data:{ studentId, message, organizationId } })`. This is awaited (not fire-and-forget) before streaming. Consumed by `src/inngest/functions/safety-scan.ts:9-11` (`scanMessage`), which `setRlsContext`, runs `assessMessageSafety`, `decideSafetyResolution`, pattern-escalation over recent `SafetyFlag`s, then stores a flag and optionally `sendSafetyAlert` (see 12-/23-).
6. **Stream** — `route.ts:88-92` `streamText({ model: models.flash, system: systemPrompt, messages: coreMessages })`; `:97` returns `result.toDataStreamResponse?.() ?? result.toUIMessageStreamResponse()` (defensive feature-detect). Errors → 500 JSON with `error.message` + `error.stack` (`:99-107`).
7. **Render** — `ThinklingChat.tsx:118-156` maps messages; assistant text taken from `m.content` else joined `m.parts[].text` (lines 146-150). `onFinish` (lines 35-52) defensively appends the final message if the stream didn't already.

## 5. Status table

| Unit | Status | Evidence |
|------|--------|----------|
| `thinkling/page.tsx` (auth+org+learner load) | DONE | page.tsx:13-35; org-scoped `withTenant` query |
| `api/chat/route.ts` POST (stream) | DONE | route.ts:88-97 `streamText` → live stream response; wired to UI |
| Tenancy guard in route | DONE | route.ts:50-54 explicit `organizationId` ownership check |
| Safety-scan emission | DONE | route.ts:73-85 → consumed by safety-scan.ts:11 |
| `ThinklingClient` shell | DONE | rendered by page.tsx:35; importer confirmed |
| `ThinklingChat` widget | PARTIAL | works, but laden with `console.log` debug + dead `apiUrl` (line 28) + multiple `@ts-ignore`/`as any` (lines 85-89, 96) |
| `ModeSelector` | PARTIAL | renders 3 modes but the displayed set drifts from the type — see Q-11-004 |
| `tools.ts` (all schemas/types) | DEAD | Grep: zero importers of `GeneratorConfigSchema`/`AvailableTools`/`OmniGeneratorTool*`/`GeneratorInput*` outside the file itself |
| Chat tool-calling | DEAD/absent | `streamText` (route.ts:88-92) passes no `tools`; `tools.ts` unused |

## 6. Integration points
- **Imports in:** `ai` (`streamText`), `@ai-sdk/react` (`useChat`), `@/auth`, `@/lib/auth-helpers` (`getCurrentUserOrg`), `@/server/db` (`db`, `withTenant`), `@/lib/ai/config` (`models.flash` → `google("gemini-3.5-flash")`, config.ts:75), `@/inngest/client` (`inngest`), `@/lib/thinkling` (`getContextForThinkling`, `ThinklingMode`), `@/components/ui/*`, `react-markdown`/`remark-*`/`rehype-katex`/`katex`, `@phosphor-icons/react`.
- **Importers out:** `page.tsx`→`ThinklingClient`→`ThinklingChat`→`ModeSelector`+`thinkling.ts`. `tools.ts` → nobody.
- **Route:** `GET /thinkling` (page), `POST /api/chat` (stream).
- **Inngest:** emits `chat/message.sent` (typed `src/inngest/types.ts:99`), consumed by `scanMessage` in `src/inngest/functions/safety-scan.ts`.
- **Prisma models:** `Learner` (read in page + route guard); `SafetyFlag` (written by the downstream job, not here).
- **External APIs:** Google Gemini (`gemini-3.5-flash`) via Vercel AI SDK.
- **Env vars:** none read directly here (model/keys resolved inside `@/lib/ai/config`).

## 7. Findings

Q-11-001  [MED]  Tenancy guard uses the raw non-tenant `db` client — relies solely on the app-layer ownership check — `src/app/api/chat/route.ts:51`
  Evidence: `const student = await db.learner.findUnique({ where: { id: studentId }, select: { organizationId: true } });` uses the plain `db` (no `withTenant`/RLS context), then guards with `student.organizationId !== organizationId` (:52). With RLS_ENABLED OFF (db.ts:9) the explicit comparison is the *only* tenant boundary.
  Impact: Correct today because the comparison is present, but if that single `!==` line is ever altered/removed, the query has no fallback isolation — unlike the `withTenant` calls used elsewhere on this page. Brittle pattern.
  Status: documented (not fixed)

Q-11-002  [LOW]  Verbose request/PII logging in the chat route and widget — `src/app/api/chat/route.ts:13-36`, `src/components/thinkling/ThinklingChat.tsx:34-41,120`
  Evidence: route logs `session.user.email` (:15), the full request JSON incl. messages (`console.log("Thinkling API Request MATCHED:", json)`, :23), and on error returns `error.stack` to the client (:103). Widget logs every assistant message and finish event.
  Impact: Student chat content + caller email land in server logs; raw stack traces leak to the browser. Noise + potential PII/secret exposure in production logs.
  Status: documented (not fixed)

Q-11-003  [LOW]  Dead `apiUrl` and stale commented options in `ThinklingChat` — `src/components/thinkling/ThinklingChat.tsx:28-33`
  Evidence: `const apiUrl = \`/api/chat?studentId=${studentId}&mode=${mode}\`;` is built (:28) but never passed to `useChat` (the `api:` line is commented out :31). The query-param fallback in the route (:29-33) therefore can never be exercised from this UI; `studentId`/`mode` only arrive via `sendMessage` body.
  Impact: Misleading dead code; the route's query-param fallback branch is unreachable in practice. Maintenance confusion.
  Status: documented (not fixed)

Q-11-004  [LOW]  ModeSelector / ThinklingMode drift — "Subject Tutor" label vs prompt, and id casing assumptions — `src/components/thinkling/ModeSelector.tsx:13-38`
  Evidence: `MODES` is hardcoded with ids `TUTOR`/`RESEARCH`/`CAREER` matching `ThinklingMode` ("TUTOR"|"RESEARCH"|"CAREER", thinkling.ts:3) — but an unused `Scales` icon is imported (:5) and a fourth conceptual mode is absent, so the icon import is dead. The set is hand-synced to the union type with no compile-time guarantee they stay aligned.
  Impact: Adding/renaming a `ThinklingMode` won't fail compilation here; mode UI can silently drift from the prompt switch in `thinkling.ts:93-109`. Minor unused import.
  Status: documented (not fixed)

Q-11-005  [LOW]  `src/lib/types/tools.ts` is entirely dead code — `src/lib/types/tools.ts:12-79`
  Evidence: Grep for `GeneratorConfigSchema|AvailableToolsSchema|OmniGeneratorToolSchema|GeneratorInputSchema|AvailableTools|OmniGeneratorTool` finds matches only inside the file itself; no import statements anywhere. The chat route passes no `tools` to `streamText` (route.ts:88-92).
  Impact: ~80 lines of unused Zod schemas/types presented as "tool definitions" that no feature consumes — drift risk and reader confusion (note: `getAvailableTools` in `server/queries/curriculum.ts:9` is a *different*, unrelated symbol).
  Status: documented (not fixed)

Q-11-006  [INFO]  ✅ RESOLVED 2026-06-19 — chat route uses toUIMessageStreamResponse; ThinklingChat uses sendMessage({text}); @ts-ignore/as-any removed (see CHANGELOG.md). Multiple `@ts-ignore`/`as any` around AI-SDK usage signal version-fragility — `src/app/api/chat/route.ts:96`, `src/components/thinkling/ThinklingChat.tsx:40,85,89`
  Evidence: route feature-detects `toDataStreamResponse` vs `toUIMessageStreamResponse` behind `@ts-ignore` (:96); widget casts `sendMessage` payload `as any` and event `as any` (:40,89). Comments reference "this SDK version" repeatedly.
  Impact: The integration is pinned to undocumented runtime shapes of the AI SDK; an SDK bump could silently break streaming/finish handling with no type coverage.
  Status: documented (not fixed)

Q-11-007  [INFO]  ✅ RESOLVED 2026-06-19 — safety-scan enqueue moved into its own try/catch — logs on failure but still streams a reply (see CHANGELOG.md). Safety event is `await`ed before streaming begins — `src/app/api/chat/route.ts:75-85`
  Evidence: comment claims the scan runs "asynchronously … in the background", but `await inngest.send(...)` blocks the request until the event is enqueued before `streamText` (:88).
  Impact: Adds Inngest enqueue latency to every first token; if `inngest.send` throws it falls into the catch → 500 and the user never gets a reply. Mostly a latency/robustness note (the scan *processing* is genuinely async; only the send is awaited).
  Status: documented (not fixed)
