# 12 — Child-Safety Subsystem
> Source of truth: the files in §1, read end-to-end. Written against commit b585c1e.

## 1. Scope
| File | Role (one line) |
|------|-----------------|
| `src/lib/safety/guard.ts` | Two-stage content-safety detector: regex fast-path (`SafetyRegexEngine`) + LLM deep-path (`assessMessageSafety`) producing a `SafetyAssessment`. |
| `src/lib/safety/policy.ts` | `decideSafetyResolution()` — deterministic decision matrix mapping a `SafetyAssessment` to a `SafetyResolution` (which action to take). |
| `src/lib/safety/types.ts` | Shared types: `SafetyAssessment` (detector output) and `SafetyResolution` (policy output / action enum). |
| `src/lib/notifications/safety-alert.ts` | `sendSafetyAlert(flagId)` — delivers a caregiver email summary via Resend and flips `SafetyFlag.alertSent` only on confirmed delivery. |

Cross-ref: the **only** consumer of all four files is the Inngest job `src/inngest/functions/safety-scan.ts` (`scanMessage`), owned by chapter **23**. SafetyFlag model details are in **02-data-model.md**. RLS/tenancy machinery (`withTenant`, `setRlsContext`) is in **04-security-auth-tenancy.md**.

## 2. Purpose / intent
Monitor student↔Thinkling chat for self-harm, abuse, bullying, violence, grooming, sexual content, and incest/sibling-boundary signals; classify severity and nuance; then decide a *proportionate* response under a stated "Minimum Social Responsibility" principle: only notify caregivers when notification plausibly reduces harm, and **never** notify when the caregiver is the implicated threat or the child fears disclosure/retaliation. Detected concerns become `SafetyFlag` rows; the highest-severity resolutions email caregivers a content-redacted summary.

## 3. Architecture & key files
Pipeline (detect → decide → escalate → store → act):

1. **Detect** (`guard.ts`). `assessMessageSafety(message)` (guard.ts:128):
   - **Fast path**: `SafetyRegexEngine.scan()` (guard.ts:113). Runs a negation check (guard.ts:117), then an academic-context whitelist applied **per-pattern** (`isWhitelisted` guard.ts:109 / terms :40-44; explicit self-harm + abuse/incest-action patterns are `exemptFromWhitelist` — Q-12-004), a caregiver-implication regex (guard.ts:47/130), and a fear/disclosure regex (guard.ts:48/133), then matches a small pattern table (guard.ts:50-107) covering SELF_HARM, BULLYING/physical-abuse, INCEST (thought vs action), and VIOLENCE. First match returns a hand-built `SafetyAssessment` (guard.ts:143-155).
   - **Deep path**: if no regex match, `generateObject` with `models.flashLite` (Gemini, ai/config.ts:18) against `safetySchema` (guard.ts:6-18) returns the full assessment (guard.ts:193).
2. **Decide** (`policy.ts`). `decideSafetyResolution(assessment)` (policy.ts:24). Precedence: hard-stops (caregiver implicated OR disclosureRisk HIGH → never notify, via the shared `isCaregiverHardStop()` predicate policy.ts:10-14, called policy.ts:27-35) → must-notify DANGER (policy.ts:39-41) → self-harm/violence INTENT/PLAN/ACTION toward self/other-child, now **severity-label-independent** (policy.ts:43-54 — Q-12-003) → sibling/incest boundaries (policy.ts:56-68) → default severity switch (policy.ts:70-84).
3. **Escalate** (in job, not here). The `scanMessage` job (safety-scan.ts:32-78) re-checks the same hard-stop **through the same `isCaregiverHardStop()` predicate** (safety-scan.ts:36; one source of truth — Q-12-006), then upgrades resolution one notch if ≥3 same-category flags in 10 days or a THOUGHT→PLAN/ACTION/INTENT escalation is detected from prior flags' `[EVIDENCE:...]` prefix.
4. **Store** (in job). `SafetyFlag.create` (safety-scan.ts:85) with message truncated to 100 chars (data minimization, safety-scan.ts:91) and `reasoning` prefixed `[EVIDENCE:<level>]` (safety-scan.ts:93) so future runs can parse evidence level.
5. **Act** (`safety-alert.ts`). Only `PARENT_SUMMARY_SAFETY_COACH` / `PARENT_SUMMARY_URGENT` resolutions call `sendSafetyAlert(flag.id, organizationId)` (safety-scan.ts:103-104). All other resolutions only log (safety-scan.ts:109).

`types.ts` is the contract between `guard.ts` (produces `SafetyAssessment`) and `policy.ts` (consumes it, returns `SafetyResolution`).

## 4. Data flow (concrete trace)
- `src/app/api/chat/route.ts:62-84` — on each user chat turn, emits Inngest event `chat/message.sent` with `{ studentId, message, organizationId }`. (Event typed at inngest/types.ts:99.) This is the **sole** entry point; journals/other surfaces do **not** feed safety.
- `safety-scan.ts:15` — worker sets RLS context from the event org (`setRlsContext({ organizationId, userId: null })`); empty/blank messages skip (safety-scan.ts:17-19).
- `safety-scan.ts:22` → `assessMessageSafety` (guard.ts:128) → regex (guard.ts:87) or LLM (guard.ts:137).
- `safety-scan.ts:25` → `decideSafetyResolution` (policy.ts:24).
- `safety-scan.ts:43-54` → `withTenant(... tx.safetyFlag.findMany ...)` reads last-10-day flags (org-scoped via `withTenant`) for pattern escalation.
- `safety-scan.ts:84-100` → `withTenant(... tx.safetyFlag.create ...)` writes the flag (org-scoped).
- `safety-scan.ts:104` → `sendSafetyAlert(flag.id, organizationId)`:
  - `safety-alert.ts:46-62` — `withTenant(... tx.safetyFlag.findFirst ...)` with an explicit `student.organizationId` predicate (Q-12-005 RESOLVED — was raw `db.findUnique`); joins `student → organization → users`. `SafetyFlag` has no org column of its own; the predicate mirrors the RLS policy `student_id IN (… account_id = org)`.
  - `safety-alert.ts:69-81` — **delivery-layer hard-stop** (T1-E): `if (!isAlertDeliverable(flag))` refuse to send (and leave `alertSent=false`) unless `flag.resolution ∈ {PARENT_SUMMARY_URGENT, PARENT_SUMMARY_SAFETY_COACH}` AND `!flag.implicatedCaregiver`. Defense-in-depth so a caller bug can never email an implicated caregiver. (`isAlertDeliverable` safety-alert.ts:13-27.)
  - `safety-alert.ts:84-86` — recipients = org users with email and role OWNER/PARENT/ADMIN.
  - `safety-alert.ts:90` — strips `[EVIDENCE:...]` prefix from `reasoning` for the email body.
  - `safety-alert.ts:118-146` — builds text + HTML (HTML escaped via `esc`, safety-alert.ts:4); explicitly excludes raw message content (safety-alert.ts:132,145).
  - `safety-alert.ts:148-175` — fail-loud guards: missing `RESEND_API_KEY` → return `sent:false`; missing `SAFETY_ALERT_FROM` → warn + fall back to `onboarding@resend.dev`; zero recipients → return `sent:false`.
  - `safety-alert.ts:177-190` — Resend send; only on success does `withTenant(... tx.safetyFlag.update({ alertSent: true }) ...)` (safety-alert.ts:185-189).
- **Alert channel = email only (Resend).** No push/SMS/in-app path exists. SafetyFlag rows have **no UI/dashboard reader** anywhere in the repo (grep: only the job + alert function touch `safetyFlag`).

## 5. Status table
| Unit | Status | Evidence |
|------|--------|----------|
| `assessMessageSafety` (guard.ts) | DONE | Wired via safety-scan.ts:22; regex + LLM both implemented (guard.ts:128-175). |
| `SafetyRegexEngine.scan` (guard.ts) | DONE | Called by assessMessageSafety (guard.ts:165); pattern table populated (guard.ts:50-107). Now `export`ed for unit testing (guard.test.ts). |
| `SafetyRegexEngine` whitelist scoping (guard.ts:113-160) | DONE | Academic whitelist applied **per-pattern**; explicit first-person self-harm + abuse/incest ACTION disclosures carry `exemptFromWhitelist` so an academic word can't cloak them (Q-12-004 resolved 2026-06-20). |
| LLM deep-path error handler (guard.ts:194-209) | PARTIAL | Catch returns `isSafe:true` (fail-open) — model outage silently suppresses detection. See Q-12-001 (brief T1-A: should return a review-needed assessment, never `NO_ACTION`). |
| `decideSafetyResolution` (policy.ts) | DONE | Wired via safety-scan.ts:25; full matrix (policy.ts:24-85). Urgent self-harm/violence routing is now **severity-label-INDEPENDENT** — keyed on (category, evidenceLevel incl. INTENT, target), policy.ts:43-54 (Q-12-003 resolved 2026-06-20). |
| `isCaregiverHardStop` predicate (policy.ts:10-14) | DONE | Single source of truth for the caregiver hard-stop; consumed by `decideSafetyResolution` (policy.ts:27) and the job's escalation guard (safety-scan.ts:36). Q-12-006 resolved the prior policy↔job duplication. |
| `sendSafetyAlert` (safety-alert.ts) | DONE | Wired via safety-scan.ts:104; Resend send + alertSent gating (safety-alert.ts:177-190); org-scoped read+update via `withTenant` (Q-12-005). **Delivery-layer hard-stop** `isAlertDeliverable` (safety-alert.ts:13-27, guard :69-81) refuses to email unless `PARENT_SUMMARY_*` with no implicated caregiver (T1-E, 2026-06-20). |
| `SafetyAssessment` / `SafetyResolution` types (types.ts) | DONE | Imported by guard.ts:4, policy.ts:1, safety-scan.ts:6. (Hand-maintained — drifts from the guard.ts Zod schema; see Q-12-013.) |
| `recommendedResolution` field (was types.ts:23, guard.ts:18-25) | REMOVED | Was DEAD (collected from the model, never read). Deleted from `safetySchema` + `SafetyAssessment` 2026-06-20. See Q-12-002. |
| Severity values `CONCERN`/`DANGER`/`SAFE`/`TIER_3` | PARTIAL | Regex path emits only TIER_1/TIER_2 (guard.ts:56,64,70,77,83,90,98,105); CONCERN/DANGER/SAFE/TIER_3 come only from the LLM (guard.ts:8), and `severity` is a free `String` (schema.prisma:323) so two vocabularies still coexist in storage. The **safety-downgrade hazard is CLOSED** — policy urgency no longer reads the severity label (Q-12-003 resolved). The `String`→enum typing + ontology collapse stays deferred (ch.02 Q-013). |

## 6. Integration points
- **Imports in (guard.ts):** `ai` (`generateObject`), `@/lib/ai/config` (`models.flashLite`, ai/config.ts:18), `zod`, `./types`. (`SafetyRegexEngine` is `export`ed for unit testing.)
- **Imports in (policy.ts):** `./types` only.
- **Imports in (safety-alert.ts):** `@/server/db` (`withTenant`), `resend`.
- **Importers out:** ONLY `src/inngest/functions/safety-scan.ts` (`scanMessage`), registered at `src/app/api/inngest/route.ts:4,29`. Triggered by `chat/message.sent` emitted at `src/app/api/chat/route.ts:71`.
- **Env vars:** `RESEND_API_KEY` (required to send), `SAFETY_ALERT_FROM` (Resend-verified sender; falls back to `onboarding@resend.dev`). Both only read in safety-alert.ts:119,123,132.
- **External APIs:** Google Gemini (`gemini-3.1-flash-lite`) via Vercel AI SDK; Resend email API.
- **Prisma models used:** `SafetyFlag` (read/create/update), via relation `Learner` (`student`) → `Organization` → `User` (safety-alert.ts:34-42). The flag read/update are now org-scoped via `withTenant` + an explicit `student.organizationId` predicate (Q-12-005). See 02-data-model.md.
- **Inngest jobs:** `scanMessage` (chapter 23) is the orchestrator; these files define no jobs themselves.

## 7. Findings

Q-12-001  [HIGH]  LLM deep-path fails OPEN on any error — safety detection silently disabled  — src/lib/safety/guard.ts:159-174  (line refs refreshed 2026-06-20 Session 23; finding OPEN/unchanged)
  Evidence: `catch (error) { ... return { isSafe: true, severity: "SAFE", category: "NONE", ... } }`. Any Gemini outage, rate-limit, timeout, or schema-parse failure returns a fully-safe assessment. The job then logs nothing unsafe and creates no flag (safety-scan.ts:80). The regex fast-path covers only a handful of phrasings, so most messages depend on the LLM.
  Impact: A provider hiccup means genuine self-harm/abuse messages pass undetected with no flag, no alert, and no operator signal beyond a `console.error`. For a child-safety system, fail-open is the dangerous direction; a degraded/queued/retry path or a "needs human review" flag would be safer.
  Status: documented (not fixed)

Q-12-002  [LOW]  ✅ REMOVED 2026-06-20 (Session 23) — `recommendedResolution` was dead (collected from the model, never read)  — was src/lib/safety/guard.ts:18-25, src/lib/safety/types.ts:23
  Evidence: `safetySchema` asked the model for `recommendedResolution` and the type carried it, but grep showed no reader: `policy.ts` derives the resolution deterministically from other fields and `safety-scan.ts` never references `result.recommendedResolution`.
  Impact: Wasted model output/tokens and misleading surface area.
  Resolution: deleted the field from both `safetySchema` (guard.ts) and `SafetyAssessment` (types.ts). REMOVE over WIRE was deliberate — `policy.ts` is an intentionally-deterministic "Minimum Social Responsibility" matrix; wiring the LLM's freeform pick could bypass the caregiver hard-stop. tsc-safe (the regex fast-path + error fallback already built the assessment without the optional field). No prompt edit needed (the prompt never mentioned it). See CHANGELOG.md.

Q-12-003  [MED]  ✅ RESOLVED 2026-06-20 (Session 24) — urgent-notify routing made severity-label-INDEPENDENT (the real safety-downgrade closed); DB enum-typing stays deferred (Q-013)  — src/lib/safety/policy.ts:43-54 (was guard.ts:8,…; policy.ts:27-79; prisma/schema.prisma:323)
  Evidence (re-verified): the finding's LITERAL claim — an LLM severity "falls through the switch `default` policy.ts:77 → INTERNAL_LOG_ONLY → silent downgrade" — does NOT reproduce: `generateObject` constrains the LLM to the 6-value enum (guard.ts:8) and ALL 6 are handled before/at the switch (DANGER returns policy.ts:39; SAFE/TIER_3/CONCERN/TIER_2/TIER_1 each cased), so the switch `default` (now policy.ts:82-83) is unreachable dead code. The SHARPENED, real defect was at policy.ts:44-49: the must-notify self-harm/violence branch gated on `severity ∈ {TIER_1,TIER_2}`, and the classifier prompt (guard.ts:175-191) gives the model NO severity-vocabulary guidance, so a genuine first-time self-harm PLAN the model labels `"CONCERN"` skipped the urgent branch → `STUDENT_OPTIONAL_OUTREACH` → no parent notification (and explicit `"kill myself"` INTENT topped out at SAFETY_COACH, never URGENT).
  Resolution: rewrote the must-notify branch (policy.ts:43-54) to key urgency on `(category ∈ {SELF_HARM,VIOLENCE}, evidenceLevel ∈ {INTENT,PLAN,ACTION,VICTIM_DISCLOSURE}, target ∈ {SELF,OTHER_CHILD})` — dropped the severity-label condition and added INTENT (the structural fix from the owner's safety brief, T1-C app-layer half). Strictly fail-safe: it only ADDS urgent notifications; the caregiver hard-stop at policy.ts:27 still strictly precedes, so a feared/implicated caregiver is never emailed. +`policy.test.ts` shape-locks it (8 cases incl. hard-stop precedence). A 3-lens adversarial Workflow found no regression / correct fail-direction. The stale plain-`//` schema comments at schema.prisma:323/324/329 + the ch.02:72 doc line were corrected to the real vocabularies (code-currency; plain `//`, no migration).
  Deferred (NOT closed by this): the DB `String`→enum typing + ontology collapse (CONCERN/DANGER vs TIER_n) rides the batched enum migration owned by ch.02 **Q-013** (⏳). This session closed the app-layer SAFETY-DOWNGRADE hazard; the typing stays deferred. The literal "switch default" cite was refuted and re-pointed to policy.ts:43-54. See CHANGELOG.md.

Q-12-004  [MED]  ✅ RESOLVED 2026-06-20 (Session 24) — academic whitelist scoped per-pattern; explicit self-harm + incest-action disclosures can no longer be cloaked  — src/lib/safety/guard.ts:113-160 (was :83-95, 36-40, 89)
  Evidence (re-verified): reproduces — `scan()` returned `null` if ANY whitelist term (`class`/`book`/`project`/`homework`/…, guard.ts:40-44) appeared *anywhere*, disabling the whole fast path before the pattern loop, so "for my project, I want to kill myself" matched no fast-path rule and relied entirely on the LLM (which per Q-12-001 **fails open**). The finding's own "span-scope" suggestion was empirically REFUTED by the adversarial pass (a ±char window still leaks — the academic word sits adjacent to the threat), and blanket-exempting the self-harm patterns floods caregivers (bare `suicide` matches "an article about suicide rates").
  Resolution: added `exemptFromWhitelist` to `SafetyPattern` (guard.ts:31-34); split the self-harm patterns so explicit FIRST-PERSON phrases (`kill myself`/`end my life`/`want to die`, `hurt myself`/`cut myself`/`cut my wrists`) and the explicit abuse/incest ACTION disclosure are whitelist-**EXEMPT**, while bare `suicide`/`self-harm`, the violence-threat, and incest-THOUGHT stay whitelist-gated (they legitimately appear in academic/awareness text). The whitelist is now applied **per-pattern** inside the loop (guard.ts:136-139) — was a blanket early-return. Negation (de-escalation) kept whole-message. The INCEST-action exemption was added per the owner's decision ("my brother touched me in class" now flags). +`guard.test.ts` (8 cases: threat-with-academic-word → flags; academic reference → still null; de-escalation → null; incest disclosure → flags; hard-stop → SUPPORTIVE_ONLY). A 3-lens adversarial Workflow confirmed no flood + hard-stop preserved. `SafetyRegexEngine` is now `export`ed for the test.
  Residuals (documented, NOT fixed this session): (a) the negation regex still false-nulls some genuine threats ("I don't want to kill anyone but myself") — narrowing it is a tracked follow-up; (b) bare `suicide` + the violence-threat stay whitelist-gated by design (academic discussion); (c) the dominant residual risk is **Q-12-001**'s LLM fail-open (HIGH). These ride the child-safety hardening roadmap (below / ch.24 §5). See CHANGELOG.md.

Q-12-005  [LOW]  ✅ RESOLVED 2026-06-20 (Session 23) — `sendSafetyAlert` flag read/update moved off raw `db` onto explicit-ctx `withTenant` + an explicit org predicate  — was src/lib/notifications/safety-alert.ts:25-36 (read) + :147 (update)
  Evidence (original): `db.safetyFlag.findUnique({ where: { id: flagId }, include: { student.organization.users } })` ran on the un-tenanted client (RLS is OFF per anchor facts). Recipients are derived from the flag's own student→organization relation, so the join is self-scoping; the only input is a UUID `flagId` produced one step earlier in the same trusted job.
  Impact: No live vuln (sole caller is the trusted Inngest job; self-scoping by the flag's own org relation). The real risk was RLS-readiness: this was the ONE safety-pipeline DB op not using the explicit-ctx `withTenant` pattern the rest of the job uses (safety-scan.ts:43-54/:84-100), so at the future RLS cutover it could silently fail-closed (no caregiver alert) if the extension can't see the job's `setRlsContext` (db.ts:103-105 declares that propagation unreliable in this runtime).
  Resolution: threaded `organizationId` from the job into `sendSafetyAlert(flagId, organizationId)` (safety-scan.ts:104); the read is now `withTenant((tx)=>tx.safetyFlag.findFirst({where:{id, student:{organizationId}}, include:{…}}), undefined, {organizationId, userId:null})` (safety-alert.ts:30-46) and the `alertSent` update is wrapped the same way (safety-alert.ts:157-161); `import {db}`→`import {withTenant}`. The explicit `student.organizationId` predicate is the live boundary today (RLS off; `SafetyFlag` has no org column — it scopes via the student relation, mirroring the RLS policy `student_id IN (… account_id = org)`). `findUnique`→`findFirst` (compound non-unique `where`); behavior-identical for the real caller (flagId is the PK, org always matches the just-created flag). See CHANGELOG.md.

Q-12-006  [LOW]  ✅ RESOLVED 2026-06-20 (Session 23) — caregiver hard-stop centralized into one shared predicate  — was src/lib/safety/policy.ts:14-22, src/inngest/functions/safety-scan.ts:32-37
  Evidence (original): The "never notify when caregiver implicated or disclosureRisk HIGH" invariant was encoded once in `decideSafetyResolution` (policy.ts:14) and again as guards on the escalation block (safety-scan.ts:33-37). The job's comment (safety-scan.ts:28-31) explains the redundancy is intentional (escalation could otherwise upgrade `STUDENT_OPTIONAL_OUTREACH` to a `PARENT_SUMMARY_*`).
  Impact: Correct today, but the safety invariant lived in two files; a change to risk handling in one must be mirrored in the other or a flagged child could be exposed to the caregiver they fear.
  Resolution: extracted `isCaregiverHardStop(Pick<SafetyAssessment, "implicatedCaregiver"|"disclosureRisk">)` in policy.ts (policy.ts:10-14) — the single source of truth — and called it at both sites: `decideSafetyResolution` (policy.ts:27) and the job's escalation guard (`!isCaregiverHardStop(result)`, safety-scan.ts:36). Behavior-identical by De Morgan (`!implicatedCaregiver && disclosureRisk!=="HIGH"` ≡ `!(implicatedCaregiver || disclosureRisk==="HIGH")`). The intentional defense-in-depth survives — there are still TWO independent runtime re-checks on the raw assessment fields (the predicate reads raw fields, not the resolution string); the job's explanatory comment is kept verbatim. Only the literal definition drift is removed. See CHANGELOG.md.

---

**Child-safety hardening brief (owner, 2026-06-20 / Session 24).** The owner provided a Tier-1/2/3 remediation brief that spans far beyond Session 24's two MED findings. The app-layer, no-schema, no-legal subset that resolves Q-12-003/Q-12-004 + the delivery-layer hard-stop (T1-E) was done this session (see those entries + T1-E note in §5). The rest is captured as the findings below (and the ch.24 §5 roadmap). `[DECISION]` = legal/policy item needing the owner's written sign-off; do NOT implement unilaterally. T1-A = existing **Q-12-001** (fail-open, HIGH); the brief refines its fix (return a review-needed assessment, treat scanner error as "needs human review", never `NO_ACTION`). T1-C = **Q-12-003** (done, app-layer). T1-E ✅ done this session (`isAlertDeliverable`, safety-alert.ts:13-27 + guard :69-81; +`safety-alert.test.ts`).

Q-12-007  [HIGH]  No in-the-moment child-facing safety layer; 4 of 6 resolutions are inert (brief T1-D + T1-F)  — src/app/api/chat/route.ts:62-93; src/inngest/functions/safety-scan.ts:108-110; src/lib/safety/policy.ts:1-7
  Evidence: the safety pipeline is post-hoc / async — route.ts enqueues `chat/message.sent` (route.ts:71) then streams Thinkling's reply in parallel (route.ts:86-93) with NO synchronous pre-check and NO output scan of the streamed text. `SUPPORTIVE_ONLY`/`STUDENT_OPTIONAL_OUTREACH`/`INTERNAL_LOG_ONLY`/`NO_ACTION` only `console.log` (safety-scan.ts:108-110); there is no channel from the background job to the chat UI and no `SafetyFlag` UI reader (§4), so none of the "supportive" resolutions surface anything to the child in the moment. The Thinkling prompt also promises "I may need to involve a trusted adult" while policy suppresses notification for caregiver-implicated cases (promise gap — confirm wording in `thinkling.ts`, ch.11).
  Impact: in the moment a child discloses crisis, their experience is governed entirely by the streaming model under a bypassable prompt; the resolution taxonomy assumes a child-facing layer that does not exist, and a persistent crisis affordance (becoming a legal baseline, e.g. CA SB 243) is absent.
  Status: documented (not fixed) — child-safety hardening roadmap (ch.24 §5).

Q-12-008  [MED]  Regex fast-path fabricates structured fields (target / relationshipToTarget / coercion) (brief T1-B)  — src/lib/safety/guard.ts:150-152
  Evidence: every regex match returns `target:"SELF"`, `relationshipToTarget:"OTHER"`, `coercion:"NONE"` (guard.ts:150-152) with a "refined…if needed" comment that never refines. So the VIOLENCE-threat pattern ("shoot…school") is labeled `target:"SELF"`, and any regex-caught sibling abuse is `relationshipToTarget:"OTHER"` → bypasses the sibling/incest routing (policy.ts:56-68). After Q-12-003 the urgent self-harm/violence branch no longer depends on `severity`, but these mislabels still misroute violence-toward-others and sibling cases on the deterministic path.
  Impact: mis-categorized routing on the regex fast-path. (Supersedes the Session-24 completeness-critic candidate "NEW-B".)
  Status: documented (not fixed).

Q-12-009  [MED]  Child disclosure snippet stored in org-readable DB for hard-stop flags (brief T1-G)  — src/inngest/functions/safety-scan.ts:91
  Evidence: the store step writes `message.substring(0,100)` for ALL flags including caregiver-implicated hard-stops (safety-scan.ts:91). `SafetyFlag` is org-scoped; an implicated parent/guardian with org data access could read the child's disclosure. Latent today (no UI/data-export path reads `safety_flags` — §4 — so exposure is via direct DB access only).
  Impact: a child's abuse disclosure naming a caregiver is persisted where that caregiver could later read it. App-layer half = omit the snippet (store category/severity/evidence only) for hard-stop flags; full fix (separate access-restricted store) needs schema.
  Status: documented (not fixed).

Q-12-010  [MED]  A dropped safety-scan enqueue is only logged — the sole safety signal can be permanently lost (brief T1-H)  — src/app/api/chat/route.ts:81-83
  Evidence: a failed `inngest.send` for `chat/message.sent` is caught and `console.error`'d only (route.ts:81-83); there is no durable fallback (pending-scan row / retry queue). Keeping the chat responsive on enqueue failure is correct (do not 500 the student), but a transient Inngest failure permanently drops the only safety signal for that message. route.ts already comments this as a known compromise.
  Impact: silent loss of safety coverage on enqueue failure.
  Status: documented (not fixed).

Q-12-011  [MED]  Safety scanner sees one message, no conversation context (brief T2-A)  — src/app/api/chat/route.ts:75; src/inngest/functions/safety-scan.ts:13,22
  Evidence: route.ts sends only `lastMessage.content` (route.ts:75); the job assesses that single string (safety-scan.ts:22). Multi-turn grooming, coercion, and escalation — which often look benign one message at a time — are invisible to the per-message classifier. The 10-day stored-flag pattern logic (safety-scan.ts:43-66) only sees already-flagged messages, so it cannot substitute for conversation context.
  Impact: multi-turn harm patterns under-detected.
  Status: documented (not fixed).

Q-12-012  [MED]  Prompt-injection: untrusted student text interpolated into safety + Thinkling prompts, unfenced (brief T2-C)  — src/lib/safety/guard.ts:190; src/lib/thinkling.ts (ch.11)
  Evidence: the classifier prompt interpolates `Student Message: "${message}"` directly (guard.ts:190); the Thinkling system prompt likewise interpolates user-supplied name/interests/message (`thinkling.ts`, ch.11 — to confirm). No delimiting/fencing instructs the model to treat the text as data, not instructions. A crafted message could try to talk the safety classifier into `SAFE` (detection evasion) or steer Thinkling. The `esc()` helper in safety-alert.ts:4 is the same instinct, applied only to the email body.
  Impact: safety-scan evasion + Thinkling manipulation by the student.
  Status: documented (not fixed).

Q-12-013  [LOW]  Safety type/contract cleanups — unused fields + schema drift + dual-use reasoning (brief T2-B + T3-A/B/C)  — src/lib/safety/types.ts:9-23; src/lib/safety/guard.ts:6-18,148-152; src/lib/safety/policy.ts:60-61
  Evidence: (a) `ageGap` is extracted (guard.ts:16) but never read by policy.ts; the regex path always sets `coercion:"NONE"` (guard.ts:152) so the policy `coercion` branch (policy.ts:60-61) only works on the LLM path — wire or remove (T2-B). (b) `SafetyAssessment` is hand-maintained in types.ts and drifts from the guard.ts Zod schema — derive via `z.infer` (T3-A). (c) `isSafe` duplicates `severity` and is never read by policy.ts (T3-B). (d) `reasoning` is dual-use: an internal `[Regex Guard]…` debug string (guard.ts:148) AND the parent-facing email body (safety-alert.ts:128/143) — separate the audit field from the parent summary (T3-C). Also the Thinkling "STOP immediately" wording + alert idempotency (`thinkling.ts`/safety-scan.ts — T3-D/E, to confirm).
  Impact: latent correctness/clarity; misleading surface area.
  Status: documented (not fixed).
