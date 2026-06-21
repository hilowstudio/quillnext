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

*(`src/lib/types/tools.ts` — ~80 lines of unused "generator/tool" Zod schemas — was **REMOVED** 2026-06-20, Session 21, Q-11-005; zero importers repo-wide.)*

The system prompt + `ThinklingMode` + `getContextForThinkling()` live in `src/lib/thinkling.ts` (owned by **08-ai-core**) — cross-ref, not re-documented here.

## 2. Purpose / intent
"Thinkling" is the student-facing AI tutoring chat ("Inkling, supercharged"). A parent/teacher selects one of their learners and a *mode* (Subject Tutor, Research Assistant, College & Career), then converses with a Gemini-Flash assistant whose system prompt is personalized to that learner via `getContextForThinkling`. Every user turn is mirrored into a background safety-screening pipeline (see 12-/23-safety) so distressing/unsafe messages are detected, logged as `SafetyFlag`s, and (policy-gated) escalated to caregivers.

## 3. Architecture & key files
- **Server entry** `thinkling/page.tsx`: `auth()` → redirect `/login` if no session; `getCurrentUserOrg()` → redirect `/onboarding` if no org; `withTenant` query of `learner.findMany` scoped by `organizationId` (page.tsx:24-33), excluding parent-as-learner rows via `excludeParentLearners` (Q-05-006). Hands `students[]` to `ThinklingClient`.
- **Client shell** `ThinklingClient.tsx`: holds `selectedStudentId` (default first student) + `mode` ("TUTOR" default) in React state. Student `<Select>` and mode are passed down; `<ThinklingChat key={selectedStudentId} … />` is remounted when the student changes (line 74).
- **Chat widget** `ThinklingChat.tsx`: `useChat` from `@ai-sdk/react` (line 27). Posts to the default `/api/chat`. `studentId`+`mode` are passed per-message via `sendMessage({ text }, { body: { studentId, mode } })` (lines 75-78). Renders markdown with `remark-gfm/breaks/math` + `rehype-katex`. Clears messages on mode/student change (lines 58-61). *(The dead `apiUrl` const + stale commented `api`/`body` options were removed 2026-06-20, Q-11-003; the verbose debug `console.log`s were removed, Q-11-002.)*
- **Mode toggle** `ModeSelector.tsx`: hardcoded `MODES` array of 3 entries with icons/colors; emits `onSelectMode(mode.id as ThinklingMode)`. The array is `as const satisfies readonly { id: ThinklingMode; … }[]` (ModeSelector.tsx:38), so a renamed/mistyped mode id fails compilation (Q-11-004).
- **API route** `api/chat/route.ts`: `force-dynamic`, `maxDuration=30`. Auth → tenant guard (explicit `findFirst({ where:{ id, organizationId } })` org predicate, Q-11-001 ✅ 2026-06-20) → build system prompt → emit safety event → `streamText({ model: models.flash, system, messages })` → stream response.
- **Chat tool-calling**: `streamText` (route.ts:86-90) passes NO `tools` — the chat is plain text-in/text-out. *(The dead `tools.ts` schema file, which no feature consumed, was deleted 2026-06-20, Q-11-005.)*

## 4. Data flow
1. **Page load** — `thinkling/page.tsx:13-22` authenticates and resolves org; `:24-33` loads learners via `withTenant(... { organizationId, userId: null })`; `:35` renders `<ThinklingClient students=…/>`.
2. **User selects student/mode** — `ThinklingClient.tsx:23-24` state; mode change via `ModeSelector` → `onModeChange` → `setMode` (`ThinklingChat.tsx:99`, `ThinklingClient.tsx:74`).
3. **User sends a message** — `ThinklingChat.tsx:67-79` `handleFormSubmit` calls `sendMessage({ text: userMessage }, { body:{ studentId, mode } })`, which merges `studentId`/`mode` into the POST body. *(The dead `apiUrl` query-string path was removed 2026-06-20, Q-11-003.)*
4. **POST `/api/chat`** — `route.ts:13-17` auth gate (401). `:19-20` parse body; `:22-28` 400 if `studentId`/`mode` missing (the query-param fallback was removed 2026-06-20, Q-11-003 — they now arrive only via the `sendMessage` body). `:35-45` **tenancy guard**: `getCurrentUserOrg()` → `if (!organizationId) → 403` (`:36-38`, fail-closed) → `db.learner.findFirst({ where:{ id: studentId, organizationId }, select:{ id:true } })` (`:39-42`) → `if (!student) → 403` (`:43-45`); the org predicate is *in the query* (Q-11-001 ✅ 2026-06-20 — was a droppable `findUnique` + `!==` comparison). `:47` `getContextForThinkling(studentId, mode, organizationId)` builds the personalized `systemPrompt` (see 08-ai-core). `:51-60` normalize `messages` (synthesizes `content` from `parts[].text` when absent).
5. **Safety hook** — `route.ts:62-84`: if the last message is from `user`, `inngest.send({ name:"chat/message.sent", data:{ studentId, message, organizationId } })` inside a try/catch (`:70-83` — logs on enqueue failure but still streams a reply, Q-11-007). Awaited before streaming. Consumed by `src/inngest/functions/safety-scan.ts:9-11` (`scanMessage`), which `setRlsContext`, runs `assessMessageSafety`, `decideSafetyResolution`, pattern-escalation over recent `SafetyFlag`s, then stores a flag and optionally `sendSafetyAlert` (see 12-/23-).
6. **Stream** — `route.ts:86-90` `streamText({ model: models.flash, system: systemPrompt, messages: coreMessages })`; `:93` returns `result.toUIMessageStreamResponse()` (the `@ts-ignore` feature-detect was simplified, Q-11-006). Errors → a generic `500 { error: "Internal Server Error" }` (`:94-100`); `error.message`/`error.stack` are logged server-side only, no longer returned to the client (Q-11-002).
7. **Render** — `ThinklingChat.tsx:105-140` maps messages; assistant text taken from `m.content` else joined `m.parts[].text` (lines 130-134). `onFinish` (lines 29-42) defensively appends the final message if the stream didn't already.

## 5. Status table

| Unit | Status | Evidence |
|------|--------|----------|
| `thinkling/page.tsx` (auth+org+learner load) | DONE | page.tsx:13-35; org-scoped `withTenant` query |
| `api/chat/route.ts` POST (stream) | DONE | route.ts:86-93 `streamText` → live stream response; wired to UI |
| Tenancy guard in route | DONE | route.ts:39-45 explicit `organizationId` predicate *in* the query + fail-closed `if(!organizationId)` (Q-11-001 ✅ 2026-06-20 — no longer a droppable `!==` comparison) |
| Safety-scan emission | DONE | route.ts:62-84 → consumed by safety-scan.ts:11 |
| `ThinklingClient` shell | DONE | rendered by page.tsx:35; importer confirmed |
| `ThinklingChat` widget | DONE | useChat → sendMessage body (lines 75-78), markdown+KaTeX render. Debug `console.log`s + dead `apiUrl` removed 2026-06-20 (Q-11-002/003); `@ts-ignore`/`as any` removed earlier (Q-11-006) |
| `ModeSelector` | DONE | 3 modes; `MODES` is `as const satisfies readonly {id: ThinklingMode; …}[]` (Q-11-004 ✅ 2026-06-20) — id drift now fails compilation; unused `Scales` import removed |
| `tools.ts` (all schemas/types) | REMOVED | deleted 2026-06-20 (Session 21, Q-11-005); was dead (zero importers repo-wide) |
| Chat tool-calling | absent (by design) | `streamText` (route.ts:86-90) passes no `tools`; the chat is plain text-in/text-out |

## 6. Integration points
- **Imports in:** `ai` (`streamText`), `@ai-sdk/react` (`useChat`), `@/auth`, `@/lib/auth-helpers` (`getCurrentUserOrg`), `@/server/db` (`db`, `withTenant`), `@/lib/ai/config` (`models.flash` → `google("gemini-3.5-flash")`, config.ts:75), `@/inngest/client` (`inngest`), `@/lib/thinkling` (`getContextForThinkling`, `ThinklingMode`), `@/components/ui/*`, `react-markdown`/`remark-*`/`rehype-katex`/`katex`, `@phosphor-icons/react`.
- **Importers out:** `page.tsx`→`ThinklingClient`→`ThinklingChat`→`ModeSelector`+`thinkling.ts`.
- **Route:** `GET /thinkling` (page), `POST /api/chat` (stream).
- **Inngest:** emits `chat/message.sent` (typed `src/inngest/types.ts:99`), consumed by `scanMessage` in `src/inngest/functions/safety-scan.ts`.
- **Prisma models:** `Learner` (read in page + route guard); `SafetyFlag` (written by the downstream job, not here).
- **External APIs:** Google Gemini (`gemini-3.5-flash`) via Vercel AI SDK.
- **Env vars:** none read directly here (model/keys resolved inside `@/lib/ai/config`).

## 7. Findings

Q-11-001  [MED]  ✅ RESOLVED 2026-06-20 (Session 22) — folded the org filter into the query (owner-approved). Tenancy guard used the raw non-tenant `db` client — relied solely on the app-layer ownership check — `src/app/api/chat/route.ts:34` *(original cite; line refs shifted +8 after the fix grew the guard block — the read is now route.ts:39)*
  Evidence (original): `const student = await db.learner.findUnique({ where: { id: studentId }, select: { organizationId: true } });` used the plain `db` (no `withTenant`/RLS context), then guarded with `student.organizationId !== organizationId` (:35). With RLS_ENABLED OFF (db.ts:9) the explicit comparison was the *only* tenant boundary.
  Impact (original): Correct today because the comparison was present, but if that single `!==` line were ever altered/removed, the query had no fallback isolation — unlike the `withTenant` calls used elsewhere on this page. Brittle pattern.
  Status: ✅ RESOLVED 2026-06-20 — replaced `findUnique({where:{id}})` + the droppable post-fetch `student.organizationId !== organizationId` comparison with `db.learner.findFirst({ where: { id: studentId, organizationId }, select: { id: true } })` + `if (!student) → 403` (route.ts:39-45) — the org filter now lives *inside* the query (the live tenant boundary with RLS off, and RLS-ready), so it can't be silently dropped without breaking the lookup. Also added a fail-closed `if (!organizationId) → 403` guard (route.ts:36-38) the old code lacked (it had 403'd a null-org caller only "by luck" of `Learner.organizationId` being non-nullable), which narrows `organizationId` to `string` so the now-redundant `!` on the safety-event `organizationId` (route.ts:78) was dropped. No `withTenant` — a single-op read takes the explicit predicate (mirrors Q-10-001/`getSourceMetadata`; with RLS off `withTenant` is a no-op that adds no predicate, so it would NOT have closed this finding). Behavior identical on every input (cross-org / missing / null-org all still 403); a 4-lens adversarial pass was unanimous. (see CHANGELOG.md)

Q-11-002  [LOW]  ✅ RESOLVED 2026-06-20 (Session 21) — full cleanup (owner-approved). Verbose request/PII logging in the chat route and widget — `src/app/api/chat/route.ts:13-36`, `src/components/thinkling/ThinklingChat.tsx:34-41,120`
  Evidence: route logs `session.user.email` (:15), the full request JSON incl. messages (`console.log("Thinkling API Request MATCHED:", json)`, :23), and on error returns `error.stack` to the client (:103). Widget logs every assistant message and finish event.
  Impact: Student chat content + caller email land in server logs; raw stack traces leak to the browser. Noise + potential PII/secret exposure in production logs.
  Status: ✅ RESOLVED 2026-06-20 — deleted the debug `console.log`s (route: session email, full request JSON/chat, model ping, "StreamText: Starting"; widget: finish-event, extracted-message, per-render assistant log); the 500 now returns a generic `{ error: "Internal Server Error" }` (removed BOTH `error.stack` AND `details` — `details`=`error.message` could surface DB/tenancy/prompt internals) and the 400 no longer echoes the request — the stack is logged server-side only via the kept `console.error`. Kept both `console.error` handlers (widget onError, route catch). Note: also removed the only diagnostics for the known "blank assistant message" workaround — a conscious trade for the PII finding. (see CHANGELOG.md)

Q-11-003  [LOW]  ✅ RESOLVED 2026-06-20 (Session 21) — widget dead code + route fallback both removed (owner-approved "also delete the route fallback"). Dead `apiUrl` and stale commented options in `ThinklingChat` — `src/components/thinkling/ThinklingChat.tsx:28-33`
  Evidence: `const apiUrl = \`/api/chat?studentId=${studentId}&mode=${mode}\`;` is built (:28) but never passed to `useChat` (the `api:` line is commented out :31). The query-param fallback in the route (:29-33) therefore can never be exercised from this UI; `studentId`/`mode` only arrive via `sendMessage` body.
  Impact: Misleading dead code; the route's query-param fallback branch is unreachable in practice. Maintenance confusion.
  Status: ✅ RESOLVED 2026-06-20 — deleted the dead `apiUrl` const, its rationale comment, and the stale commented `api`/`body` options (incl. the duplicated line) from the widget; also deleted the now-provably-unreachable query-param fallback in `route.ts` (confirmed sole caller is `ThinklingChat`'s `useChat`, which always sends `studentId`/`mode` in the POST body). The route now relies solely on the body; the 400 still fires if they're missing. (see CHANGELOG.md)

Q-11-004  [LOW]  ✅ RESOLVED 2026-06-20 (Session 21) — removed unused `Scales` import + added a compile-time `satisfies` guard (owner-approved). ModeSelector / ThinklingMode drift — "Subject Tutor" label vs prompt, and id casing assumptions — `src/components/thinkling/ModeSelector.tsx:13-38`
  Evidence: `MODES` is hardcoded with ids `TUTOR`/`RESEARCH`/`CAREER` matching `ThinklingMode` ("TUTOR"|"RESEARCH"|"CAREER", thinkling.ts:3) — but an unused `Scales` icon is imported (:5) and a fourth conceptual mode is absent, so the icon import is dead. The set is hand-synced to the union type with no compile-time guarantee they stay aligned.
  Impact: Adding/renaming a `ThinklingMode` won't fail compilation here; mode UI can silently drift from the prompt switch in `thinkling.ts:93-109`. Minor unused import.
  Re-verify (Session 21): the "Subject Tutor label vs prompt" sub-claim does NOT reproduce as a defect — the labels ("Subject Tutor"/"Research Assistant"/"College & Career") align with the prompt switch (`thinkling.ts:91-114`: SUBJECT TUTOR / RESEARCH ASSISTANT / COLLEGE & CAREER). Real defects were the unused `Scales` import + no compile-time alignment.
  Status: ✅ RESOLVED 2026-06-20 — removed unused `Scales` import; added `as const satisfies readonly { id: ThinklingMode; …; icon: Icon; … }[]` to `MODES` so a renamed/mistyped mode id now fails compilation (note: `satisfies` does not enforce exhaustiveness — adding a 4th union member still compiles with 3 entries). The `as ThinklingMode` cast (:46) is now redundant but harmless, left in place. (see CHANGELOG.md)

Q-11-005  [LOW]  ✅ REMOVED 2026-06-20 (Session 21) — `git rm src/lib/types/tools.ts` (owner-approved). `src/lib/types/tools.ts` is entirely dead code — `src/lib/types/tools.ts:12-79`
  Evidence: Grep for `GeneratorConfigSchema|AvailableToolsSchema|OmniGeneratorToolSchema|GeneratorInputSchema|AvailableTools|OmniGeneratorTool` finds matches only inside the file itself; no import statements anywhere. The chat route passes no `tools` to `streamText` (route.ts:88-92).
  Impact: ~80 lines of unused Zod schemas/types presented as "tool definitions" that no feature consumes — drift risk and reader confusion (note: `getAvailableTools` in `server/queries/curriculum.ts:9` is a *different*, unrelated symbol).
  Status: ✅ REMOVED 2026-06-20 — file deleted; zero importers confirmed (static/dynamic/barrel/config/test), no npm dep orphaned (`zod` used repo-wide), no env vars. The KEEP/"wire-it" case collapses (the live generator pipeline uses its own schemas; wiring this would be net-new feature code; git preserves it if ever needed). (see CHANGELOG.md)

Q-11-006  [INFO]  ✅ RESOLVED 2026-06-19 — chat route uses toUIMessageStreamResponse; ThinklingChat uses sendMessage({text}); @ts-ignore/as-any removed (see CHANGELOG.md). Multiple `@ts-ignore`/`as any` around AI-SDK usage signal version-fragility — `src/app/api/chat/route.ts:96`, `src/components/thinkling/ThinklingChat.tsx:40,85,89`
  Evidence: route feature-detects `toDataStreamResponse` vs `toUIMessageStreamResponse` behind `@ts-ignore` (:96); widget casts `sendMessage` payload `as any` and event `as any` (:40,89). Comments reference "this SDK version" repeatedly.
  Impact: The integration is pinned to undocumented runtime shapes of the AI SDK; an SDK bump could silently break streaming/finish handling with no type coverage.
  Status: documented (not fixed)

Q-11-007  [INFO]  ✅ RESOLVED 2026-06-19 — safety-scan enqueue moved into its own try/catch — logs on failure but still streams a reply (see CHANGELOG.md). Safety event is `await`ed before streaming begins — `src/app/api/chat/route.ts:75-85`
  Evidence: comment claims the scan runs "asynchronously … in the background", but `await inngest.send(...)` blocks the request until the event is enqueued before `streamText` (:88).
  Impact: Adds Inngest enqueue latency to every first token; if `inngest.send` throws it falls into the catch → 500 and the user never gets a reply. Mostly a latency/robustness note (the scan *processing* is genuinely async; only the send is awaited).
  Status: documented (not fixed)
