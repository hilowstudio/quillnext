# QSF Remediation Plan

**Goal:** Address all 18 audit recommendations to move from **Not Certified** → **QSF Certified** (and potentially Exemplary).

**Current state:** 21/27 must-pass, 74/143 scored points
**Target state:** 27/27 must-pass, ~107-119/143 scored points

---

## Phase 1: Must-Fix (Blocks Certification) — ~5 days

These 6 items must be resolved before any certification tier is possible.

---

### 1.1 Privacy Policy + TOS + Summary (GOV-01, HON-16, GOV-02, GOV-04)
**Points recovered:** Unblocks GOV-01 must-pass + HON-16 (2 pts) + GOV-02 (3 pts) + GOV-04 (2 pts) = 7 scored pts

**Create two new pages:**

#### `/privacy` — Privacy Policy Page
**File:** `src/app/privacy/page.tsx`

Content must cover (per QSF GOV-01/02/04):
- **Plain-language summary** (≤500 words, ≤8th-grade reading level) at the top, covering:
  1. What data is collected
  2. Why it is collected
  3. Who can see it
  4. How long it is kept
  5. How to delete it
- **Full policy** below the summary
- **Third-party disclosure section** listing all services with their data practices:
  | Service | Purpose | Data Shared |
  |---|---|---|
  | Google OAuth | Authentication | Email, name, profile image |
  | Google Gemini AI | Curriculum generation | Student name, grade, age, learning profile, interests, faith background |
  | Firebase Storage | File storage | Uploaded documents, book scans |
  | Inngest | Background processing | Event metadata (safety scans, document processing) |
  | Joshua Project API | Missions data | None (read-only public data) |
  | Bible ESV API | Scripture content | None (read-only) |
  | Google Books API | Book metadata | ISBN/search queries |
- **Data retention section** with specific timeframes per data category
- **Effective date** (must be within 12 months)

#### `/terms` — Terms of Service Page
**File:** `src/app/terms/page.tsx`

Content must include:
- Plain-language summary at 8th-grade reading level covering: data rights, service changes, cancellation
- Shutdown plan: what happens to user data if the product is discontinued (export window, data destruction timeline)
- This addresses DEP-11 (shutdown plan, 2 pts) as well

**Implementation notes:**
- Both pages should be static content (no auth required)
- Add to sidebar footer links (see Phase 2)
- Style with `.qc-prose` class for proper line length
- Links already exist at `src/app/signup/page.tsx:64-69` and `src/app/login/page.tsx:60-68` — they'll start working once routes exist

---

### 1.2 Monetization + Funding Disclosure (HON-13, HON-14, GOV-08)
**Points recovered:** Unblocks HON-13 must-pass + HON-14 (3 pts) + GOV-08 (2 pts) = 5 scored pts

**Create an About page:**

#### `/about` — About Page
**File:** `src/app/about/page.tsx`

Content must state:
- What the product is (homeschool curriculum platform)
- How it is funded (bootstrapped / pre-revenue / grant / etc. — **needs input from Adam**)
- Who builds it (company info)
- Funding sources with attention to conflicts of interest (are any investors in ad/data industries?)
- Design principles / ethical commitments (also addresses GOV-09, 2 pts)

This single page addresses HON-13, HON-14, GOV-08, and GOV-09 (4 criteria, 7 scored pts + 1 must-pass).

**User input needed:** Adam must provide the actual funding/monetization information.

---

### 1.3 Internet Requirement Disclosure (DEP-09)
**Points recovered:** Unblocks DEP-09 must-pass

**File:** `src/app/signup/page.tsx`

Add a small note before the terms/privacy agreement text (around line 62):
```tsx
<p className="text-xs text-qc-text-muted text-center">
  QuillNext requires an internet connection for all features.
</p>
```

Also add to `src/app/login/page.tsx` in the same location.

---

### 1.4 Full Data Export (DAT-01, DAT-02, DAT-03)
**Points recovered:** Unblocks 3 must-pass gates

**New files:**
- `src/app/actions/data-export.ts` — Server action to gather and export all user data
- Add "Data" tab to `src/components/navigation/ProfileSettingsDialog.tsx`

#### Server Action: `exportUserData()`

Query all user-owned data from Prisma and return as JSON:
```
{
  exportDate: "2026-03-30",
  user: { name, email, role, createdAt },
  organization: { name, settings },
  students: [{ profile, learnerProfile, assessments, courseProgress, activityProgress }],
  courses: [{ name, description, blocks, activities }],
  library: { books, videos, articles, documents },
  discipleship: {
    prayerEntries, bibleMemory, devotionalReflections,
    churchNotes, gratitudeJournal
  },
  transcripts: [...],
  planner: { scheduleEntries, assignments },
  blueprint: { classroom, schedule, preferences }
}
```

**Data to query (from Prisma schema relations on User model):**
- `db.user.findUnique()` with nested includes for all relations
- `db.student.findMany()` for org students with all nested data
- `db.course.findMany()` for org courses
- `db.book.findMany()`, `db.videoResource.findMany()`, etc.
- `db.prayerJournalEntry.findMany()`, `db.bibleMemory.findMany()`, etc.

**UI in ProfileSettingsDialog:**
- Add "Data" tab alongside Profile and Security
- Change `grid-cols-2` to `grid-cols-3` on TabsList (line 63)
- Tab content: "Export All Data" button → triggers server action → downloads JSON file
- Show what's included in the export (checklist)

**Accessibility:** Settings → Data tab → Export button = 2 clicks from settings (meets DAT-03's ≤3 clicks)

---

### 1.5 Account Deletion (DAT-14)
**Points recovered:** DAT-14 (3 pts) + DAT-15 (2 pts) = 5 scored pts

**Files to modify:**
- `prisma/schema.prisma` — Add `onDelete: Cascade` to User model relations that don't have it
- `src/app/actions/user-actions.ts` — Add `deleteUserAccount()` server action
- `src/components/navigation/ProfileSettingsDialog.tsx` — Add delete account UI in the Data tab

#### Prisma Schema Changes

Add `onDelete: Cascade` to the User-side of these relations (check each model's foreign key field):
- Activity (createdById → User)
- AssessmentAttempt (gradedById → User)
- Assessment (createdById → User)
- Book (addedById → User)
- ClassroomInstructor (userId → User)
- Classroom (createdById → User)
- Course (createdById → User)
- ResourceAssignment (assignedById → User)
- Resource (createdById → User)
- VideoResource (addedById → User)
- Article (addedById → User)
- DocumentResource (addedById → User)
- GratitudeJournal (userId → User)
- DevotionalReflection (userId → User)
- LocalChurchNotes (userId → User)
- PrayerJournalEntry (userId → User)
- BibleMemory (userId → User)

Run `npx prisma migrate dev` after changes.

#### Server Action: `deleteUserAccount()`

```typescript
export async function deleteUserAccount() {
  const session = await auth();
  if (!session?.user) throw new Error("Not authenticated");

  // Cascade deletes handle all related data via Prisma schema
  await db.user.delete({ where: { id: session.user.id } });

  // Sign out and redirect
  return { success: true };
}
```

#### UI in ProfileSettingsDialog

In the "Data" tab (same tab as export), add a danger zone section:
- Red-bordered section at the bottom
- "Delete Account" button (destructive variant)
- AlertDialog confirmation with:
  - Clear statement that deletion is permanent
  - Prompt to export data first
  - Text input requiring "DELETE" to confirm
  - Both "Deactivate" (keep data) and "Delete" (destroy data) options → addresses DAT-15

---

## Phase 2: High Priority (Scored Points) — ~3 days

---

### 2.1 AI Content Labeling (HON-11) — 2 pts

**Files to modify:**
- `src/components/ui/badge.tsx` — Add `ai` variant
- `src/components/resources/GeneratedResourceCard.tsx` — Add AI badge near title
- `src/app/creation-station/[id]/page.tsx` — Add notice that results are AI-generated
- `src/app/family-discipleship/bible-study/BibleStudyClient.tsx` — Already has label, verify consistency

#### Badge variant addition:
```typescript
ai: "border-purple-300 bg-purple-50 text-purple-700 dark:border-purple-600 dark:bg-purple-950 dark:text-purple-300",
```

#### GeneratedResourceCard.tsx (around line 57):
```tsx
<Badge variant="ai" className="text-xs">AI-Generated</Badge>
```

#### Creation Station page (around line 152):
Add a note in the form header area indicating content will be AI-generated by Google Gemini.

---

### 2.2 Auto-Save (DEP-02) — 2 pts

**Primary target:** `src/app/family-discipleship/prayer/PrayerJournalEditor.tsx`

**Implementation approach:**
- Add a `useEffect` that watches `title`, `editor content`, `tags`, `isPrivate`, `category`, `date`
- Debounce changes (1000ms) using a simple `setTimeout`/`clearTimeout` pattern
- Call `onSave()` automatically after debounce
- Add visual status indicator: "Saving..." → "Saved" (like CourseBuilder already does at line 627)
- Remove `window.location.reload()` from save handler (line 93) — use `router.refresh()` or state update instead

**Secondary targets** (if time allows):
- SpecForm.tsx — add localStorage draft persistence for form state
- Other form editors with manual save

---

### 2.3 Changelog Page (DUR-10) — 2 pts

#### `/changelog` — Changelog Page
**File:** `src/app/changelog/page.tsx`

Static content page listing recent changes from git history. Structure:
```markdown
## March 2026
- Curriculum Compiler (Studio 26 Integration)
- Icon dependency optimization
- Heart-check UI refinement with boxicons
- Prisma build fixes (pg driver adapter)

## February 2026
- [Earlier changes from git log]
```

Keep updated with each release. Style with `.qc-prose`.

---

## Phase 3: Quick Wins (Low Effort, High Value) — ~1 day

---

### 3.1 Feedback Channel (GOV-05) — 2 pts

**File:** `src/components/layout/Sidebar.tsx`

Add a "Feedback" link in the sidebar footer area (around line 102-106):
```tsx
<a href="mailto:support@quillandcompass.app" className="...">
  Send Feedback
</a>
```

Or create a simple `/feedback` page with a contact form. Minimal requirement: any public channel that doesn't require social media.

---

### 3.2 Design Principles (GOV-09) — 2 pts

Include in the `/about` page (Phase 1.2) a "Our Design Principles" section:
- Attention-respecting design (no notifications, no gamification)
- Data minimalism (no tracking, no ads)
- Child safety first
- AI transparency
- Family sovereignty over educational data

Must predate and be independent of QSF certification.

---

### 3.3 Sidebar Footer Links

**File:** `src/components/layout/Sidebar.tsx`

Add links in the footer section (before UserNav, around line 102):
```tsx
<div className="flex flex-wrap gap-x-3 gap-y-1 px-2 text-xs text-qc-text-muted">
  <Link href="/about">About</Link>
  <Link href="/changelog">Changelog</Link>
  <Link href="/privacy">Privacy</Link>
  <Link href="/terms">Terms</Link>
</div>
```

---

### 3.4 Session Timer (ATT-14) — 2 pts

**New file:** `src/components/layout/SessionTimer.tsx`

Client component that tracks time since page load:
- Show subtle timer in sidebar footer or status bar
- After 30 minutes, show a gentle "You've been here for 30 minutes" notification
- Non-intrusive — just informational

Add to `GlobalShell.tsx` or `Sidebar.tsx`.

---

### 3.5 Aria-Live Regions (DUR-04) — 2 pts

**Approach:** Sonner (toast library) already includes `role="status"` on its container, which provides basic screen reader support. To improve:

1. Verify sonner's Toaster component in `src/app/layout.tsx` has proper ARIA config
2. Add `aria-live="polite"` wrapper around dynamic content areas that update without page navigation:
   - Form submission result areas
   - Loading → loaded state transitions
   - CourseBuilder's "Saving..." / "Saved" indicator

**Files to modify:**
- `src/components/courses/CourseBuilder.tsx` — wrap save status in aria-live
- `src/app/family-discipleship/prayer/PrayerJournalEditor.tsx` — wrap auto-save status
- Verify sonner Toaster ARIA setup in layout

---

### 3.6 Ownership Transfer (DEP-08) — 2 pts

**Files:**
- `src/app/actions/organization-actions.ts` (new) — `transferOwnership()` action
- `src/components/navigation/ProfileSettingsDialog.tsx` — Add transfer UI for OWNER role

**Implementation:**
- Only visible to users with OWNER role
- Select another org member to transfer to
- Update `User.role` of current owner → PARENT, new owner → OWNER
- Confirmation dialog with clear explanation

---

## Phase Summary

| Phase | Items | Must-Pass Fixed | Points Gained | Effort |
|---|---|---|---|---|
| **Phase 1** | 1.1-1.5 | 6 (all) | ~19 pts | ~5 days |
| **Phase 2** | 2.1-2.3 | 0 | ~6 pts | ~3 days |
| **Phase 3** | 3.1-3.6 | 0 | ~12 pts | ~1 day |
| **Total** | 18 items | **6 → 27/27** | **~37 pts → 111/143** | **~9 days** |

## Projected Final Score

| Metric | Before | After |
|---|---|---|
| Must-Pass Gate | 21/27 FAIL | 27/27 PASS |
| Scored Points | 74/143 (52%) | ~111/143 (78%) |
| Domain Minimums | 3 failing | All passing |
| Tier | Not Certified | **QSF Certified** (potentially Exemplary at 114+) |

## Execution Order

Recommended sequence (dependencies matter):

1. **Day 1-2:** Phase 1.1 (Privacy + TOS + About pages) — unblocks 4 criteria, content-heavy
2. **Day 2:** Phase 1.2 + 1.3 (Monetization disclosure + internet disclosure) — quick text additions
3. **Day 3:** Phase 3.1-3.3, 3.6 (Sidebar links, feedback, changelog, design principles) — quick wins while policy pages settle
4. **Day 4-5:** Phase 1.4 (Data export server action + UI) — most complex engineering
5. **Day 5-6:** Phase 1.5 (Account deletion + Prisma migration) — needs careful cascade testing
6. **Day 7:** Phase 2.1 (AI labeling) + Phase 3.4 (Session timer) — UI additions
7. **Day 8:** Phase 2.2 (Auto-save) + Phase 3.5 (Aria-live) — behavior changes
8. **Day 9:** Phase 2.3 (Changelog) + testing + re-audit

## Open Questions for Adam

1. **Funding model:** How is QuillNext funded? (Bootstrapped? Pre-revenue? Grant? VC?) Needed for HON-13/14 and GOV-08.
2. **Data retention:** What retention periods should the privacy policy state? Suggested: active data retained while account exists, deleted within 30 days of account deletion request.
3. **Deactivation vs deletion:** Should we offer both "pause account" (data retained) and "delete account" (data destroyed)? QSF DAT-15 awards 2 pts for offering both.
4. **Support contact:** What email/form should be the feedback channel? (e.g., support@quillandcompass.app)
5. **Design principles:** Do existing design principles/manifesto docs exist that predate this audit? If so, where?
