# QSF Audit Scorecard

## Audit Information

| Field | Value |
|---|---|
| **Product** | QuillNext (Quill & Compass) |
| **URL** | quillandcompass.app |
| **Audit Date** | 2026-03-30 |
| **Audit Mode** | Source Code |
| **Auditor** | LLM-assisted (Claude Opus 4.6) |
| **QSF Version** | 1.0 |

---

## Result Summary

| | Result |
|---|---|
| **Must-Pass Gate** | FAIL — 21 of 27 passed |
| **Total Scored Points** | 74 of 143 (+ 13 pending attestation) |
| **Domain Minimums Met** | No — DAT (22%), DEP (33%), GOV (0%) below 40% |
| **Certification Tier** | **Not Certified** |

---

## Domain Summary

| Domain | Must-Pass | Scored | Available | % | Min Met? |
|---|---|---|---|---|---|
| 01 Attention | 6/6 | 24 | 26 | 92% | Y |
| 02 Data Sovereignty | 2/5 | 6 | 27 | 22% | N |
| 03 Honesty | 4/5 | 13 | 22 | 59% | Y |
| 04 Departure | 3/4 | 5 | 15 | 33% | N |
| 05 Respect | 3/3 | 19 | 19 | 100% | Y |
| 06 Durability | 3/3 | 7 | 17 | 41% | Y |
| 07 Governance | 0/1 | 0 | 16 | 0% | N |
| **Total** | **21/27** | **74** | **143** | **52%** | |

---

## Detailed Findings

### Domain 01: Attention

#### 1A. Notification Architecture

**ATT-01** Must-Pass
- **Result:** PASS
- **Confidence:** High
- **Evidence:** No push notification system exists. No service worker, no Firebase Cloud Messaging, no Web Push API. No notification permission requests. No marketing or re-engagement notification code paths. The only notification-related code is a simulated safety alert system in `src/lib/notifications/safety-alert.ts` that logs to console (not delivered to users as push notifications).
- **Notes:** The product sends zero push notifications of any kind.

**ATT-02** Must-Pass
- **Result:** N/A (PASS)
- **Confidence:** High
- **Evidence:** No notification system exists to require a master disable control. No notification settings UI exists because no notifications are sent.
- **Notes:** N/A — no notification system.

**ATT-03** Must-Pass
- **Result:** PASS
- **Confidence:** High
- **Evidence:** No notification preferences in the Prisma schema (`prisma/schema.prisma`). No notification toggle UI components. No default-on notification categories. Fresh accounts have no notification settings because notifications don't exist.
- **Notes:** Trivially passes — nothing to default to.

**ATT-04** 2 pts
- **Result:** N/A (2 pts awarded)
- **Confidence:** Medium
- **Evidence:** No notification system exists, so quiet hours have no applicability.
- **Notes:** Flag for auditor — N/A because no notifications exist, not because the feature was considered and omitted. If notifications are added in future, this must be revisited.

**ATT-05** 2 pts
- **Result:** N/A (2 pts awarded)
- **Confidence:** Medium
- **Evidence:** No notifications sent. The only notification-like code is the safety alert system which is simulated (console.log only, `src/lib/notifications/safety-alert.ts:62`).
- **Notes:** Same as ATT-04 — N/A due to no notification system.

**ATT-06** 2 pts
- **Result:** N/A (2 pts awarded)
- **Confidence:** Medium
- **Evidence:** No notification delivery to batch or digest.
- **Notes:** N/A due to no notification system.

**ATT-07** 1 pt
- **Result:** N/A (1 pt awarded)
- **Confidence:** Medium
- **Evidence:** No notifications sent, so no notification log applicable.
- **Notes:** N/A due to no notification system.

**ATT-08** 1 pt
- **Result:** N/A (1 pt awarded)
- **Confidence:** Medium
- **Evidence:** No push notifications sent, so OS DND respect is moot. Web app runs in browser which inherently respects OS focus modes.
- **Notes:** N/A due to no notification system.

#### 1B. Engagement Pattern Prohibition

**ATT-09** Must-Pass
- **Result:** PASS
- **Confidence:** High
- **Evidence:** No IntersectionObserver patterns for content loading. No infinite-scroll library in `package.json`. Content lists use explicit grids with fixed items: `BookList.tsx` uses `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3`, `VideoList.tsx` same pattern. No scroll-triggered data fetching anywhere in codebase.
- **Notes:** All content feeds terminate with explicit boundaries.

**ATT-10** Must-Pass
- **Result:** PASS
- **Confidence:** High
- **Evidence:** No streak counters, daily login rewards, consecutive-use tracking, or loss-aversion timers. Grep for "streak", "consecutive", "daily_login", "login_bonus", "loss_aversion" returned zero results in application code. No streak-tracking fields in Prisma schema. Progress tracking exists for courses and Bible memory but tracks completion (not consecutive usage).
- **Notes:** Clean pass.

**ATT-11** Must-Pass
- **Result:** PASS
- **Confidence:** High
- **Evidence:** No points/XP system, badges, achievements, leaderboards, or levels. Grep for "badge", "achievement", "leaderboard", "xp", "experience_points", "level_up", "gamif" returned zero results in application code. `src/components/ui/badge.tsx` is a UI styling component (visual label), not a gamification badge. No reward animations.
- **Notes:** The product is not a game. Student avatar customization (`src/components/profile/AvatarCustomizer.tsx`) is cosmetic personalization, not a gamification reward.

**ATT-12** 2 pts
- **Result:** PASS (2 pts)
- **Confidence:** High
- **Evidence:** No `autoplay` attribute on any media element. `BibleAudioPlayer.tsx` creates audio via `useRef<HTMLAudioElement>` with explicit play/pause button controls (lines 58-68). YouTube videos embedded in `VideosClient.tsx` require user click to play. No JavaScript calling `.play()` without user gesture.
- **Notes:** All media requires explicit user initiation.

**ATT-13** 2 pts
- **Result:** PASS (2 pts)
- **Confidence:** High
- **Evidence:** No pull-to-refresh patterns. No random reward systems. No mystery boxes or surprise content reveals. Data fetching is deterministic — user creates content via explicit forms, views via explicit navigation.
- **Notes:** Clean pass.

**ATT-14** 2 pts
- **Result:** FAIL (0 pts)
- **Confidence:** High
- **Evidence:** No session duration tracking, no visible session timer, no break reminders, no "you've been using this for X minutes" check-in. Grep for "session duration", "time-spent", "break reminder" returned zero results.
- **Notes:** This is the only scored failure in the Attention domain.

**ATT-15** 1 pt
- **Result:** PASS (1 pt)
- **Confidence:** High
- **Evidence:** No follower counts, like counts, view counts, or social comparison metrics anywhere in the UI. The product is single-family focused — no social features between users.
- **Notes:** N/A by design — no social features.

#### 1C. Interface Restraint

**ATT-16** 2 pts
- **Result:** PASS (2 pts)
- **Confidence:** High
- **Evidence:** Primary task flow from `src/app/page.tsx`: authenticated user → direct render of `ParentDashboard` or `StudentDashboard` (lines 40-50). No interstitials, no splash screens. Login → Dashboard is 2 screens. Dashboard shows daily schedule, courses, and assignments immediately.
- **Notes:** 2-screen primary flow (login → dashboard).

**ATT-17** 2 pts
- **Result:** PASS (2 pts)
- **Confidence:** High
- **Evidence:** No splash screen component. No loading animation with fixed duration. App renders content as soon as data is available. Loading states use simple spinners (`animate-spin`) that disappear when content loads — no enforced minimum display time.
- **Notes:** Clean pass.

**ATT-18** 2 pts
- **Result:** PASS (2 pts)
- **Confidence:** High
- **Evidence:** Complete modal inventory: 5 Dialog instances (AssignResourceDialog, ResourcePicker, CourseDistributor, CourseBuilder generate, AddVideoDialog), 8 AlertDialog instances (all for delete confirmations in BookList, VideoList, StudentCard, DocumentList, ArticleList, CourseList, GeneratedResourceCard, AvatarCustomizer), 1 Sheet (CreationDrawer). All dialogs serve functional purposes — resource assignment, delete confirmation, content creation. Zero promotional, upsell, or announcement modals.
- **Notes:** Exemplary use of modals — only for destructive action confirmation or functional data entry.

**ATT-19** 2 pts
- **Result:** PASS (2 pts)
- **Confidence:** High
- **Evidence:** `src/app/globals.css:290-298`:
  ```css
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
      scroll-behavior: auto !important;
    }
  }
  ```
  Comprehensive global reduction of all animations. Framer Motion used in onboarding wizard but CSS override applies universally.
- **Notes:** Industry-leading implementation — global catch-all for reduced motion.

**ATT-20** 1 pt
- **Result:** PASS (1 pt)
- **Confidence:** Medium
- **Evidence:** `src/components/ui/button.tsx` defines clear visual hierarchy: `default` variant (primary color, filled) vs `outline`, `ghost`, `link` variants (subordinate). Each screen has one clear primary CTA. Dashboard uses card-based layout with clear action hierarchy.
- **Notes:** Assisted — auditor should confirm visual hierarchy on rendered screens.

**ATT-21** 1 pt
- **Result:** PASS (1 pt)
- **Confidence:** High
- **Evidence:** Empty states use calm, informative language: BookList: "No books yet. Add your first book to get started." VideoList: "No videos yet. Add a YouTube video to get started." StudentDashboard: "You haven't been enrolled in any courses yet." No upselling, cross-promotion, or anxiety language.
- **Notes:** Clean, helpful empty states.

**ATT-22** 1 pt
- **Result:** PASS (1 pt)
- **Confidence:** High
- **Evidence:** Red used only in `badge.tsx` error variant and form validation (`text-destructive` in `FormMessage`). No urgency language ("Act now!", "Limited time!", "Don't miss out!"). No pulsing/bouncing animations on CTAs. Only animations defined are `qc-fade-in` and `qc-shimmer` (loading states).
- **Notes:** Appropriate use of color red for genuine errors only.

**ATT-23** 1 pt
- **Result:** PASS (1 pt)
- **Confidence:** High
- **Evidence:** `src/app/globals.css:303-305`: `.qc-prose { max-width: 70ch; }` — 70 characters is within the 45-80 range. Container constraints: `max-w-4xl` (onboarding), `max-w-6xl` (dashboard), `max-w-7xl` (shell). Body text containers constrained appropriately.
- **Notes:** Clean pass.

---

### Domain 02: Data Sovereignty

#### 2A. Data Portability

**DAT-01** Must-Pass
- **Result:** FAIL
- **Confidence:** High
- **Evidence:** The only export feature is PDF transcript export via browser print (`src/components/transcript/pdfExport.ts`). PDF is not machine-readable. No JSON, CSV, XML, or domain-specific open format export exists. No general "export my data" feature. Grep for "export" in server actions returned only the transcript PDF generator.
- **Notes:** **BLOCKS CERTIFICATION.** Must implement full data export in at least one open, machine-readable format.

**DAT-02** Must-Pass
- **Result:** FAIL
- **Confidence:** High
- **Evidence:** Even the PDF transcript export only covers academic transcript data. Missing from any export: courses, course content, living library books/videos, prayer journal entries, Bible memory progress, devotional reflections, church notes, gratitude journal, student profiles, learning assessments, activity progress, schedule/planner data, family blueprint configuration.
- **Notes:** **BLOCKS CERTIFICATION.** Export must include ALL user-generated content.

**DAT-03** Must-Pass
- **Result:** FAIL
- **Confidence:** High
- **Evidence:** No data export option in settings (`src/components/navigation/ProfileSettingsDialog.tsx` has only Profile and Security tabs). No "Export Data" button anywhere in the application. Transcript PDF export is at `/transcripts/[studentId]` — not a general data export.
- **Notes:** **BLOCKS CERTIFICATION.**

**DAT-04** 3 pts
- **Result:** FAIL (0 pts)
- **Confidence:** High
- **Evidence:** No public API documentation. No webhook configuration. No integration marketplace. The Inngest event system is internal only (background job processing, not user-facing sync).
- **Notes:** No real-time data sync capability.

**DAT-05** 2 pts
- **Result:** FAIL (0 pts)
- **Confidence:** High
- **Evidence:** PDF transcript export has no schema documentation. The format is a rendered HTML-to-PDF with no structured data. No export format documentation exists.
- **Notes:** Dependent on DAT-01 remediation.

**DAT-06** 2 pts
- **Result:** FAIL (0 pts)
- **Confidence:** High
- **Evidence:** No import feature exists. No CSV/JSON import. No migration tool from competing products (other homeschool platforms).
- **Notes:** No import capability.

#### 2B. Data Collection Minimalism

**DAT-07** Must-Pass
- **Result:** PASS
- **Confidence:** Medium
- **Evidence:** No analytics, no tracking pixels, no device fingerprinting, no behavioral tracking beyond feature requirements. Data sent to Google Gemini AI (`src/lib/ai/prompt-builder.ts`) includes student name, grade, age, learning difficulties, educational philosophy, and faith background — all directly tied to the curriculum generation features the user is actively using. No extraneous data collection observed.
- **Notes:** Flag for auditor — the breadth of student data sent to Google Gemini (personality traits, learning difficulties, faith background) is substantial but arguably proportionate to the curriculum personalization feature. The prompt builder at `src/lib/ai/prompt-builder.ts:30-88` constructs context specifically for content generation.

**DAT-08** Must-Pass
- **Result:** PASS
- **Confidence:** High
- **Evidence:** No ad network SDKs in `package.json`. No Google Ads, Facebook Pixel, tracking pixels, or data broker integrations. Third-party services are: Google OAuth (auth), Google Gemini (AI features), Firebase Storage (file storage), Inngest (background jobs), Joshua Project API (missions data), Bible ESV API (scripture), Google Books API (book metadata), Leaflet (maps). All serve direct user-facing features.
- **Notes:** Clean pass — no advertising or data brokerage connections.

**DAT-09** 3 pts
- **Result:** FAIL (0 pts)
- **Confidence:** High
- **Evidence:** No "my data" viewer, no data inventory feature, no "what we know about you" page. Profile settings (`ProfileSettingsDialog.tsx`) shows only name and image editing.
- **Notes:** No self-service data viewer.

**DAT-10** 2 pts
- **Result:** N/A (2 pts awarded)
- **Confidence:** High
- **Evidence:** No analytics or telemetry present in the application. No tracking scripts, no analytics SDKs, no telemetry collection. Nothing to opt into.
- **Notes:** N/A — no analytics exist.

**DAT-11** 2 pts
- **Result:** PASS (2 pts)
- **Confidence:** High
- **Evidence:** No optional data collection to decline. All data collection is tied to core features. Application functions fully without any optional consents (because none are requested).
- **Notes:** Trivially passes.

**DAT-12** 1 pt
- **Result:** FAIL (0 pts)
- **Confidence:** High
- **Evidence:** No privacy policy exists (pages are 404). No stated data retention periods. No automatic purge mechanism. Safety flags stored indefinitely (no cleanup cron). Prayer journal entries, devotional reflections, and other personal data retained without stated limits.
- **Notes:** No retention policy.

#### 2C. Data Security & Deletion

**DAT-13** 3 pts
- **Result:** Pending Attestation
- **Confidence:** N/A
- **Evidence:** Instructor PINs hashed with bcrypt (10 rounds) at `src/server/actions/blueprint.ts:33`. Auth cookies configured with `httpOnly: true`, `secure: true`, `sameSite: "lax"` at `src/auth.ts:21-32`. Database SSL connection attempted but with `rejectUnauthorized: false` at `src/server/db.ts:8`. No evidence of field-level encryption at rest for sensitive data (prayer journals, safety flags, student profiles).
- **Notes:** See attestation questionnaire.

**DAT-14** 3 pts
- **Result:** FAIL (0 pts)
- **Confidence:** High
- **Evidence:** Student deletion exists at `src/app/actions/student-actions.ts:9-45` with cascade deletes. However, no parent/instructor account deletion exists. `ProfileSettingsDialog.tsx` has no delete account option. No "delete my account" endpoint in API routes. No account deletion flow anywhere.
- **Notes:** Student deletion works; user account deletion missing entirely.

**DAT-15** 2 pts
- **Result:** FAIL (0 pts)
- **Confidence:** High
- **Evidence:** Neither deactivation nor deletion offered for user accounts. No UI for either option.
- **Notes:** Dependent on DAT-14.

**DAT-16** 2 pts
- **Result:** Pending Attestation
- **Confidence:** N/A
- **Evidence:** No documented backup retention policy. No backup purge mechanism in code.
- **Notes:** See attestation questionnaire.

**DAT-17** 1 pt
- **Result:** PASS (1 pt)
- **Confidence:** High
- **Evidence:** Google OAuth 2.0 supported as primary (and only) authentication method (`src/auth.config.ts`). Phone number not collected at any point. Email-based authentication via Google provider.
- **Notes:** Clean pass.

**DAT-18** 1 pt
- **Result:** PASS (1 pt)
- **Confidence:** Medium
- **Evidence:** Next.js 16 defaults to HTTPS in production. Auth cookies set `secure: true` (production only). Database connection uses SSL (though with `rejectUnauthorized: false`). No mixed content patterns observed in code.
- **Notes:** Flag for auditor — `rejectUnauthorized: false` on database SSL weakens TLS posture but doesn't violate the criterion (which is about data transmission to users, not internal connections).

---

### Domain 03: Honesty

#### 3A. Dark Pattern Prohibition

**HON-01** Must-Pass
- **Result:** PASS
- **Confidence:** High
- **Evidence:** Reviewed all decline/cancel/opt-out flows. AlertDialog components use neutral language: "Cancel" and "Delete" buttons. Login/signup pages: "Continue with Google" — no guilt language on alternatives. No emotional manipulation on any decline button.
- **Notes:** Clean pass.

**HON-02** Must-Pass
- **Result:** PASS
- **Confidence:** High
- **Evidence:** Signup is 1 click (Google OAuth). No subscription to cancel. Student deletion is accessible in student profile. No artificial complexity in any exit flow. No retention screens, no required chat.
- **Notes:** No roach motel patterns.

**HON-03** Must-Pass
- **Result:** PASS
- **Confidence:** High
- **Evidence:** Free product with no pricing. No hidden fees. Features match what the app provides. No bait-and-switch possible without a commercial offering.
- **Notes:** N/A for a free product without marketing claims.

**HON-04** Must-Pass
- **Result:** N/A (PASS)
- **Confidence:** High
- **Evidence:** No subscription or upgrade flow exists. No downgrade flow needed.
- **Notes:** N/A — no subscription model.

**HON-05** 2 pts
- **Result:** PASS (2 pts)
- **Confidence:** High
- **Evidence:** Signup flow (`src/app/signup/page.tsx`) has no checkboxes. Only action is "Continue with Google." No newsletter signup, no marketing consent boxes, no add-on purchases. Onboarding wizard collects educational preferences but no optional consents.
- **Notes:** Clean pass.

**HON-06** 2 pts
- **Result:** N/A (2 pts awarded)
- **Confidence:** High
- **Evidence:** No pricing page, no checkout flow, no fees. Free product.
- **Notes:** N/A — no pricing to misrepresent.

**HON-07** 2 pts
- **Result:** PASS (2 pts)
- **Confidence:** High
- **Evidence:** No countdown timers, no scarcity indicators, no urgency messaging anywhere in the application. Grep for countdown, timer, "only.*left", "limited" returned zero application code results.
- **Notes:** Clean pass.

**HON-08** 1 pt
- **Result:** PASS (1 pt)
- **Confidence:** High
- **Evidence:** No pricing pages or consent dialogs where visual misdirection could occur. Button variants in `button.tsx` provide clear visual hierarchy but don't manipulate toward company-preferred options.
- **Notes:** N/A by design — no competing-interest dialogs.

#### 3B. Algorithmic Transparency

**HON-09** 3 pts
- **Result:** N/A (3 pts awarded)
- **Confidence:** High
- **Evidence:** No algorithmic curation of content feeds. Content is user-created or AI-generated on demand. Library shows user's own books/videos. No recommendation engine, no feed ranking algorithm.
- **Notes:** N/A — no algorithmic curation.

**HON-10** 2 pts
- **Result:** N/A (2 pts awarded)
- **Confidence:** High
- **Evidence:** No algorithmic content feeds. All content views are user-owned collections displayed in creation order or by explicit structure (course blocks).
- **Notes:** N/A — no algorithmic feed.

**HON-11** 2 pts
- **Result:** FAIL (0 pts)
- **Confidence:** High
- **Evidence:** AI generates curriculum content (lessons, quizzes, worksheets) via Google Gemini throughout the creation station. The prompt builder at `src/lib/ai/prompt-builder.ts:139` instructs Gemini to "ALWAYS label the output as a draft for parental review" — but this is a prompt instruction, not a UI label. The Bible study client has one instance: "This is an AI-generated summary of Matthew Henry's commentary" (`BibleStudyClient.tsx`). However, `GeneratedResourceCard.tsx` shows generation context but no explicit "AI-Generated" badge. Creation station outputs (`src/app/creation-station/[id]/page.tsx`) lack consistent visible labeling.
- **Notes:** Inconsistent AI labeling. The intent is there (prompt instructs labeling) but UI doesn't consistently enforce visible AI-generated indicators.

**HON-12** 1 pt
- **Result:** N/A (1 pt awarded)
- **Confidence:** High
- **Evidence:** No dynamic pricing — no pricing at all. Free product.
- **Notes:** N/A.

#### 3C. Business Model Transparency

**HON-13** Must-Pass
- **Result:** FAIL
- **Confidence:** High
- **Evidence:** No monetization model stated anywhere — not on a marketing site, not in-app, not in settings, not in an about page. No pricing page route. No `/about` page. The product appears to be free but provides no explanation of how it is funded or sustained. Login and signup pages reference `/terms` and `/privacy` but both are 404.
- **Notes:** **BLOCKS CERTIFICATION.** Must clearly state monetization model.

**HON-14** 3 pts
- **Result:** FAIL (0 pts)
- **Confidence:** High
- **Evidence:** Product is free with no explanation of funding source. No VC disclosure, no grant information, no donation model, no cross-subsidy explanation. No about page, no company information visible in the application.
- **Notes:** Free product must explain funding.

**HON-15** 2 pts
- **Result:** Pending Attestation
- **Confidence:** N/A
- **Evidence:** No paid tiers exist currently, so no features could have been moved behind a paywall.
- **Notes:** See attestation questionnaire. Likely N/A.

**HON-16** 2 pts
- **Result:** FAIL (0 pts)
- **Confidence:** High
- **Evidence:** No Terms of Service page exists. Links at `src/app/signup/page.tsx:64-69` and `src/app/login/page.tsx:60-68` point to `/terms` but the route returns 404. No TOS document of any kind, let alone a plain-language summary.
- **Notes:** No TOS exists.

---

### Domain 04: Departure

#### 4A. Session Closure

**DEP-01** 2 pts
- **Result:** PASS (2 pts)
- **Confidence:** High
- **Evidence:** No `beforeunload` event handlers in application code (grep returned zero results outside `qsf-criteria.json`). No exit-intent detection. No retention dialogs. Logout calls `signOut({ callbackUrl: "/login" })` directly. No emotional appeals on exit.
- **Notes:** Clean departure flow.

**DEP-02** 2 pts
- **Result:** FAIL (0 pts)
- **Confidence:** High
- **Evidence:** Limited auto-save. CourseBuilder saves after drag-drop reorder (line 438-458) and displays "Saving..." / "Saved" status (line 627). However, prayer journal requires manual save with page reload (`PrayerJournalClient.tsx:93`). Form-based content (SpecForm, student creation, assessments) uses standard form submission with no draft persistence. No debounce auto-save patterns found. No localStorage/sessionStorage draft storage.
- **Notes:** Partial implementation — course builder has save-on-change but most forms don't auto-save.

**DEP-03** 1 pt
- **Result:** Pending Attestation
- **Confidence:** N/A
- **Evidence:** No email sending system is implemented (safety alerts are console.log only per `src/lib/notifications/safety-alert.ts:62`). No re-engagement email code exists. However, this is currently because email isn't implemented at all, not by design choice.
- **Notes:** See attestation questionnaire. Currently passes by default (no emails sent), but should be verified as intentional.

**DEP-04** 1 pt
- **Result:** PASS (1 pt)
- **Confidence:** High
- **Evidence:** Logout flow (`signOut()`) redirects to `/login` with no interstitial. No ads, surveys, NPS prompts, or promotional content at logout.
- **Notes:** Clean pass.

#### 4B. Account Offboarding

**DEP-05** Must-Pass
- **Result:** N/A (PASS)
- **Confidence:** High
- **Evidence:** No subscription system exists. No payment integration. Product is entirely free.
- **Notes:** N/A — no subscription to cancel.

**DEP-06** Must-Pass
- **Result:** N/A (PASS)
- **Confidence:** High
- **Evidence:** No subscription or paid data. No cancellation flow.
- **Notes:** N/A.

**DEP-07** Must-Pass
- **Result:** N/A (PASS)
- **Confidence:** High
- **Evidence:** No cancellation flow exists.
- **Notes:** N/A.

**DEP-08** 2 pts
- **Result:** FAIL (0 pts)
- **Confidence:** High
- **Evidence:** The application has organizations with multiple users (OWNER, PARENT, ADMIN, STUDENT roles per `prisma/schema.prisma`). No ownership transfer capability found. If the OWNER departs, no mechanism exists to transfer organization ownership to another user.
- **Notes:** Organization ownership transfer needed.

#### 4C. Graceful Degradation

**DEP-09** Must-Pass
- **Result:** FAIL
- **Confidence:** High
- **Evidence:** The application requires internet for all functionality (server-rendered Next.js, all data in PostgreSQL, AI features via Google Gemini). This requirement is not stated on the signup page (`src/app/signup/page.tsx`), login page, or anywhere before account creation. No marketing site was audited (source code audit), but no in-app disclosure found.
- **Notes:** **BLOCKS CERTIFICATION.** Internet requirement must be disclosed before signup.

**DEP-10** 3 pts
- **Result:** FAIL (0 pts)
- **Confidence:** High
- **Evidence:** No service worker, no offline cache strategy, no next-pwa, no Workbox configuration. Application shows browser error when offline. No previously loaded content accessible offline. No local data caching.
- **Notes:** Zero offline functionality.

**DEP-11** 2 pts
- **Result:** FAIL (0 pts)
- **Confidence:** High
- **Evidence:** No Terms of Service exists (404). No documented shutdown plan. No data return policy. No mention of user data fate on discontinuation.
- **Notes:** Dependent on TOS creation.

**DEP-12** 2 pts
- **Result:** Pending Attestation
- **Confidence:** N/A
- **Evidence:** Web application — updates are server-side and automatic. No app store distribution. No explicit update mechanism that users opt into.
- **Notes:** See attestation questionnaire.

---

### Domain 05: Respect

#### 5A. Temporal Respect

**RES-01** 3 pts
- **Result:** N/A (3 pts awarded)
- **Confidence:** High
- **Evidence:** No notifications, no background sync, no scheduled background activities that the user would need to control.
- **Notes:** N/A — no applicable activities.

**RES-02** 2 pts
- **Result:** N/A (2 pts awarded)
- **Confidence:** High
- **Evidence:** No notification delivery system exists.
- **Notes:** N/A.

**RES-03** 2 pts
- **Result:** PASS (2 pts)
- **Confidence:** High
- **Evidence:** No time-based urgency messaging. No "Weekend sale", "tonight only", or day-of-week triggered copy. Grep for "sale", "tonight", "limited time", "hurry" returned zero results in application code.
- **Notes:** Clean pass.

**RES-04** 1 pt
- **Result:** N/A (1 pt awarded)
- **Confidence:** High
- **Evidence:** No recurring scheduled actions sent to users (no email digests, no reminders, no automated reports).
- **Notes:** N/A.

**RES-05** 1 pt
- **Result:** N/A (1 pt awarded)
- **Confidence:** High
- **Evidence:** No anniversary, milestone, or commemorative notifications. No date-triggered notification logic.
- **Notes:** N/A.

#### 5B. Contextual Intelligence

**RES-06** Must-Pass
- **Result:** PASS
- **Confidence:** High
- **Evidence:** Camera access only via HTML `<input type="file" accept="image/*" capture="environment">` in `BookScanner.tsx:304`. This triggers the camera only when the user explicitly taps the "Take Photo / Upload" label. No camera permission requested at launch. No `navigator.mediaDevices.getUserMedia()` calls at initialization. No location, contacts, or health data access. The app handles permission denial gracefully (file input simply doesn't produce data).
- **Notes:** Just-in-time camera access via HTML5 input — best practice.

**RES-07** Must-Pass
- **Result:** PASS
- **Confidence:** High
- **Evidence:** The only sensor access is camera for book scanning (`BookScanner.tsx`). Camera maps directly to the "scan a book cover" feature. No sensor access for non-stated purposes. No background sensor usage.
- **Notes:** Clean sensor-to-feature mapping.

**RES-08** 2 pts
- **Result:** N/A (2 pts awarded)
- **Confidence:** High
- **Evidence:** Web application running in browser — inherently respects OS Focus/DND states for notifications (since it sends none). No background activity to suppress.
- **Notes:** N/A for a web app with no notifications.

**RES-09** 2 pts
- **Result:** N/A (2 pts awarded)
- **Confidence:** High
- **Evidence:** No location data used. Leaflet maps in missions feature display static data (unreached people groups) without requesting user location. `CountyIssuesLookup.tsx` uses Leaflet for visualization but no `navigator.geolocation` calls found.
- **Notes:** N/A — no location access.

**RES-10** 1 pt
- **Result:** PASS (1 pt)
- **Confidence:** High
- **Evidence:** Camera permission triggered only by user action (tapping "Take Photo" in BookScanner). No permissions requested at first launch. No permission requests during onboarding.
- **Notes:** Just-in-time permission model.

#### 5C. Resource Respect

**RES-11** Must-Pass
- **Result:** PASS
- **Confidence:** High
- **Evidence:** No cryptocurrency mining code, no WebAssembly crypto modules, no distributed computing SDKs. Grep for "mine", "wasm", "WebAssembly" returned zero suspicious results. No connections to mining pools. All CPU/network usage attributable to application features.
- **Notes:** Clean pass.

**RES-12** 2 pts
- **Result:** PASS (2 pts)
- **Confidence:** Medium
- **Evidence:** Standard Next.js web application. No persistent background processes. Server-side rendering with standard React hydration. Inngest background jobs run server-side only (not on user devices). No client-side polling or continuous computation at idle.
- **Notes:** Assisted — actual CPU/memory measurement requires live testing. Code analysis shows no disproportionate resource usage patterns.

**RES-13** 2 pts
- **Result:** PASS (2 pts)
- **Confidence:** High
- **Evidence:** No WebSocket connections, no Server-Sent Events, no long-polling, no wake lock API usage. No persistent background connections. All data fetched via standard HTTP requests triggered by navigation/user action.
- **Notes:** Clean pass.

**RES-14** 1 pt
- **Result:** N/A (1 pt awarded)
- **Confidence:** High
- **Evidence:** Web application — no installation size. Runs in browser. No local storage growth concerns in code review.
- **Notes:** N/A for web app.

---

### Domain 06: Durability

#### 6A. Accessibility

**DUR-01** Must-Pass
- **Result:** PASS
- **Confidence:** Medium
- **Evidence:** Uses Radix UI primitives throughout (inherently accessible — focus management, keyboard navigation, ARIA roles built in). Form components in `src/components/ui/form.tsx` implement `aria-invalid`, `aria-describedby` with linked error/description IDs. Dialog components include `<span className="sr-only">Close</span>` for screen readers. Images have alt attributes (e.g., MainNav logo, student avatars). Color contrast: charcoal (#1C1E23) on parchment background meets AA ratios. Heading hierarchy present (h1, h2, h3).
- **Notes:** Flag for auditor — code review shows compliance but automated Lighthouse testing not performed. Medium confidence without runtime validation.

**DUR-02** Must-Pass
- **Result:** PASS
- **Confidence:** High
- **Evidence:** `src/components/ui/button.tsx`: default size `h-11` (44px height), icon size `h-11 w-11` (44x44px square). Input component `h-10` (40px — slightly under for standalone but typical within labeled form context). All buttons have focus states: `focus-visible:ring-2 focus-visible:ring-qc-primary focus-visible:ring-offset-2`.
- **Notes:** Buttons meet 44px minimum. Inputs at 40px are within acceptable range when paired with labels.

**DUR-03** 3 pts
- **Result:** PASS (3 pts)
- **Confidence:** Medium
- **Evidence:** Drag-and-drop in CourseBuilder uses `@dnd-kit` with `KeyboardSensor` and `sortableKeyboardCoordinates` (`CourseBuilder.tsx:1-22`) — provides keyboard alternative for drag-drop. Radix UI dialogs include built-in focus trapping. All buttons and links are standard HTML elements (keyboard-focusable by default). No mouse-only hover menus found.
- **Notes:** Assisted — keyboard-only testing not performed at runtime. Code analysis shows keyboard support implemented.

**DUR-04** 2 pts
- **Result:** FAIL (0 pts)
- **Confidence:** Medium
- **Evidence:** Form components have `aria-invalid` and `aria-describedby` for error states (`form.tsx:108-117`). Dialog close buttons have `sr-only` text. However, no explicit `aria-live` regions for dynamic content updates. Toast notifications via sonner library may handle announcements internally but no custom aria-live regions for loading states, form submission results, or content updates.
- **Notes:** Partial screen reader support — static content accessible but dynamic updates may not be announced.

**DUR-05** 2 pts
- **Result:** PASS (2 pts)
- **Confidence:** High
- **Evidence:** Form validation uses text error messages alongside color: `FormMessage` component renders error text `"text-[0.8rem] font-medium text-destructive"` (`form.tsx:138-160`). Error inputs get `aria-invalid={!!error}` in addition to visual styling. Badge component variants (success, warning, error, info) use distinct labels not just color.
- **Notes:** Color supplemented with text in all error/status states.

**DUR-06** 1 pt
- **Result:** PASS (1 pt)
- **Confidence:** Medium
- **Evidence:** Responsive Tailwind design throughout — `grid-cols-1 md:grid-cols-2 lg:grid-cols-3` patterns. No fixed pixel widths on primary layout containers. Content uses relative units and responsive breakpoints. `min-h-[220px]` patterns allow content expansion at zoom.
- **Notes:** Assisted — 200% zoom testing not performed. Code analysis shows responsive design patterns.

#### 6B. Standards & Interoperability

**DUR-07** Must-Pass
- **Result:** PASS
- **Confidence:** High
- **Evidence:** Standard Next.js 16 application using open web standards (HTML, CSS, JavaScript). No proprietary plugins (no Flash, Silverlight, ActiveX). No browser-specific APIs without fallbacks. React/Radix UI components render standard HTML. No "Works best in Chrome" messaging.
- **Notes:** Clean pass.

**DUR-08** 2 pts
- **Result:** FAIL (0 pts)
- **Confidence:** High
- **Evidence:** Homeschool curriculum platform — relevant open protocols would be iCal (for schedule/planner), RSS (for content updates), or CSV/JSON for academic records. No iCal export for the planner. No RSS feed. No standardized academic transcript format (only proprietary PDF). No CalDAV, no OPML.
- **Notes:** Should implement iCal export for planner data and standard transcript formats.

**DUR-09** 2 pts
- **Result:** FAIL (0 pts)
- **Confidence:** High
- **Evidence:** No public documentation of data export format. The PDF transcript format is not documented. No developer docs, no API docs, no schema documentation accessible to users.
- **Notes:** Dependent on DAT-01 remediation.

#### 6C. Longevity

**DUR-10** 2 pts
- **Result:** FAIL (0 pts)
- **Confidence:** High
- **Evidence:** No public changelog found in the application, website, or repository root. Git commit history exists but is not exposed publicly. No CHANGELOG.md file. No "What's New" page.
- **Notes:** Should publish a public changelog.

**DUR-11** 2 pts
- **Result:** FAIL (0 pts)
- **Confidence:** High
- **Evidence:** No support policy, no security update commitment, no end-of-life policy. No SLA documentation. No stated support window.
- **Notes:** Should publish support/update policy.

**DUR-12** 1 pt
- **Result:** PASS (1 pt)
- **Confidence:** High
- **Evidence:** Web application — runs in any modern browser. No minimum OS version requirement (works on any OS with a modern browser). Next.js 16 targets current web standards with broad compatibility.
- **Notes:** Web apps inherently meet this criterion.

---

### Domain 07: Governance

#### 7A. Privacy & Legal Clarity

**GOV-01** Must-Pass
- **Result:** FAIL
- **Confidence:** High
- **Evidence:** Privacy policy pages do not exist. `src/app/signup/page.tsx:64-69` and `src/app/login/page.tsx:60-68` link to `/privacy` and `/terms`, but no route handlers exist for these paths. No `/src/app/privacy/` or `/src/app/terms/` directories. Both URLs return 404. No privacy policy accessible anywhere in the application.
- **Notes:** **BLOCKS CERTIFICATION.** Must create and publish a privacy policy accessible in-app.

**GOV-02** 3 pts
- **Result:** FAIL (0 pts)
- **Confidence:** High
- **Evidence:** No privacy policy exists to contain a plain-language summary.
- **Notes:** Dependent on GOV-01.

**GOV-03** 2 pts
- **Result:** Pending Attestation
- **Confidence:** N/A
- **Evidence:** No privacy policy or TOS exists to have material changes to.
- **Notes:** See attestation questionnaire. Currently N/A but will apply once policies are created.

**GOV-04** 2 pts
- **Result:** FAIL (0 pts)
- **Confidence:** High
- **Evidence:** Third-party services identified: Google OAuth, Google Gemini AI, Firebase Storage, Inngest, Joshua Project API, Bible ESV API, Google Books API, Leaflet. None disclosed in any privacy documentation (because none exists). No privacy policy lists these services or their data practices.
- **Notes:** Must disclose all third-party services and their data practices.

#### 7B. User Communication

**GOV-05** 2 pts
- **Result:** FAIL (0 pts)
- **Confidence:** High
- **Evidence:** No public bug reporting mechanism, no feedback form, no contact email visible in the application, no support ticket system, no public issue tracker. No "Contact Us" or "Report a Bug" feature found.
- **Notes:** Must provide feedback channel.

**GOV-06** 2 pts
- **Result:** FAIL (0 pts)
- **Confidence:** High
- **Evidence:** No user documentation, no help center, no knowledge base, no FAQ page, no user guide. No in-app help system beyond contextual UI labels.
- **Notes:** Must create user documentation.

**GOV-07** 1 pt
- **Result:** Pending Attestation
- **Confidence:** N/A
- **Evidence:** No stated support response time. No support page. No SLA.
- **Notes:** See attestation questionnaire.

#### 7C. Ethical Commitments

**GOV-08** 2 pts
- **Result:** FAIL (0 pts)
- **Confidence:** High
- **Evidence:** No funding disclosure on any page. No about page. No investors page. No mention of funding model (bootstrapped, VC, grants, etc.). Company appears to be Hi-Low Studio LLC based on QSF kit but no disclosure in the QuillNext application itself.
- **Notes:** Must disclose funding sources.

**GOV-09** 2 pts
- **Result:** FAIL (0 pts)
- **Confidence:** High
- **Evidence:** No published design principles, no ethical commitments statement, no values page, no manifesto. No "Our Philosophy" or "Our Mission" page accessible in the application.
- **Notes:** Must publish design principles.

---

## Attestation Questionnaire

*For criteria with automationLevel: "manual". To be completed by the product team.*

| # | Criterion | Question | Response |
|---|---|---|---|
| 1 | DAT-13 | Is sensitive user data (prayer journals, safety flags, student learning profiles, faith background data) encrypted at rest? What algorithm and key length? How are encryption keys managed? Note: database SSL uses `rejectUnauthorized: false`. | [Pending] |
| 2 | DAT-16 | What is your backup retention policy after user deletion? How long are backups containing deleted student data retained? Is purge from backups automated or manual? Maximum days from deletion request to complete purge from all systems? | [Pending] |
| 3 | DEP-03 | Does the application send re-engagement or "we miss you" emails? (Currently email sending is not implemented — `src/lib/notifications/safety-alert.ts` uses console.log only.) When email is implemented, what will be the minimum delay after last activity before any re-engagement email? | [Pending] |
| 4 | DEP-12 | Have any updates in the last 12 months removed features, substantially changed the interface, or reset user preferences? As a web app with server-side updates, how are breaking changes communicated to users? | [Pending] |
| 5 | GOV-03 | How will users be notified of material changes to the privacy policy or terms of service (once created)? Will notification be sent before changes take effect? Will a change summary be included? | [Pending] |
| 6 | GOV-07 | What is the stated support response time? What percentage of support requests meet that target? Where is this commitment published? | [Pending] |
| 7 | HON-15 | Have any previously free features been moved behind a paywall in the last 24 months? (Currently no paid tier exists.) | [Pending] |

*False attestation voids certification. Answers are cross-referenced against observable evidence.*

---

## Attestation Cross-Reference

| Attestation | Observable Evidence | Consistent? | Notes |
|---|---|---|---|
| DAT-13 | DB SSL with `rejectUnauthorized: false`; bcrypt for PINs; no field-level encryption observed | Unable to verify | Server-side encryption not verifiable from code alone |
| DAT-16 | No backup purge code found | Unable to verify | Infrastructure-level concern |
| DEP-03 | No email system implemented | Consistent (currently) | No emails can be sent — passes by default |
| DEP-12 | Git history shows feature additions, not removals | Consistent | No evidence of removed features |
| GOV-03 | No policies exist yet | N/A | Will apply once policies are created |
| GOV-07 | No support system found | Unable to verify | No support infrastructure observed |
| HON-15 | No paid tier exists | Consistent | All features are free |

---

## Flagged for Auditor Review

| Criterion | Finding | Confidence | Reason for Flag |
|---|---|---|---|
| ATT-04 through ATT-08 | N/A (full pts) | Medium | N/A awarded because no notification system exists — auditor should confirm N/A vs. "feature not implemented" |
| DAT-07 | PASS | Medium | Student personality data, learning difficulties, and faith background sent to Google Gemini. Arguably proportionate for curriculum personalization, but breadth of sensitive data shared with third-party AI warrants review |
| DUR-01 | PASS | Medium | WCAG compliance assessed from code only — no Lighthouse/axe-core automated test run. Radix UI provides good foundation but runtime testing recommended |
| DUR-03 | PASS | Medium | Keyboard navigation assessed from code (dnd-kit KeyboardSensor, Radix focus management). Runtime keyboard testing not performed |
| RES-12 | PASS | Medium | Resource usage assessed from code patterns. No live CPU/memory measurement performed |
| HON-11 | FAIL | High | AI content is generated throughout the app via Gemini. Labeling is inconsistent — prompt instructs labeling but UI doesn't enforce it uniformly |

---

## Recommendations

### Must-Fix (Blocks Certification)

1. **DAT-01/02/03 — Data Export**: Implement full data export in JSON format covering all user data: students, courses, library resources, prayer journals, Bible memory progress, devotional reflections, church notes, gratitude journals, assessments, transcripts, planner data, and family blueprint configuration. Make accessible within 3 clicks from settings. *Estimated effort: 2-3 days.*

2. **GOV-01 — Privacy Policy**: Create and publish a privacy policy at `/privacy`, accessible in-app. Must disclose: what data is collected (extensive student/family data), why (curriculum personalization, AI-powered generation), who sees it (Google Gemini, Firebase, Inngest), retention periods, and how to delete. Update within last 12 months. *Estimated effort: 1-2 days.*

3. **HON-13 — Monetization Disclosure**: Add a clear statement of how the product is funded/sustained. If free, explain why (bootstrapped, pre-revenue, grant-funded, etc.). Add to about page or footer. *Estimated effort: 1 hour.*

4. **DEP-09 — Internet Requirement Disclosure**: Add a note on the signup page and/or marketing site that the application requires internet connectivity for all features. *Estimated effort: 30 minutes.*

5. **HON-16 — Terms of Service**: Create and publish Terms of Service at `/terms` with a plain-language summary at 8th-grade reading level covering data rights, service changes, and cancellation. *Estimated effort: 1-2 days.*

6. **DAT-14 — Account Deletion**: Implement user account deletion accessible in-app (ProfileSettingsDialog). Must be permanent, in-app, and not require contacting support. Include cascade deletion of all user data. *Estimated effort: 1-2 days.*

### High Priority (High-Value Points)

7. **HON-11 — AI Content Labeling** (2 pts): Add visible "AI-Generated" badge/label to all content created via Gemini — creation station outputs, generated curriculum, Bible study summaries. *Estimated effort: 4 hours.*

8. **GOV-02 — Privacy Policy Summary** (3 pts): Add a plain-language summary (≤500 words, ≤8th-grade reading level) covering the five required topics. *Estimated effort: 2 hours (alongside GOV-01).*

9. **HON-14 — Funding Explanation** (3 pts): Explain how the free product is funded. Add to about/footer. *Estimated effort: 30 minutes (alongside HON-13).*

10. **GOV-04 — Third-Party Disclosure** (2 pts): List all third-party services (Google OAuth, Gemini AI, Firebase, Inngest, Joshua Project, Bible ESV, Google Books) in the privacy policy with their data practices. *Estimated effort: 2 hours (alongside GOV-01).*

11. **DEP-02 — Auto-Save** (2 pts): Implement auto-save/draft persistence for prayer journal, content creation forms, and other editors. Use debounced save or localStorage drafts. *Estimated effort: 1-2 days.*

12. **DUR-10 — Changelog** (2 pts): Publish a public changelog page documenting recent changes, additions, and removals. *Estimated effort: 2 hours.*

### Quick Wins (Low Effort)

13. **ATT-14 — Session Timer** (2 pts): Add a subtle session duration indicator or periodic "you've been here for X minutes" check-in. *Estimated effort: 2-3 hours.*

14. **GOV-05 — Feedback Channel** (2 pts): Add a "Report a Bug" or "Contact Us" link with email or form. *Estimated effort: 1 hour.*

15. **GOV-09 — Design Principles** (2 pts): Publish a design philosophy or ethical commitments statement. *Estimated effort: 1-2 hours.*

16. **GOV-08 — Funding Disclosure** (2 pts): Disclose funding sources publicly. *Estimated effort: 30 minutes.*

17. **DUR-04 — Aria-Live Regions** (2 pts): Add `aria-live="polite"` regions for dynamic content updates (form submissions, loading states, toast alternatives). *Estimated effort: 3-4 hours.*

18. **DEP-08 — Ownership Transfer** (2 pts): Add organization ownership transfer capability in settings. *Estimated effort: 4-6 hours.*

---

## Score Projection After Remediation

If all must-fix and high-priority items are addressed:

| Metric | Current | After Remediation |
|---|---|---|
| Must-Pass Gate | 21/27 FAIL | 27/27 PASS |
| Scored Points | 74/143 (52%) | ~107/143 (75%) |
| Lowest Domain | GOV 0% | GOV ~56% |
| Tier | Not Certified | **QSF Certified** (86+ pts + domain mins) |

With quick wins additionally addressed: ~119/143 (83%) → **QSF Exemplary** territory.

---

*Audit conducted using the Quiet Standards Framework v1.0, published by Hi-Low Studio LLC.*
*Full specification: https://hilowstudio.dev/standards/spec*
