export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getCurrentUserOrg } from "@/lib/auth-helpers";
import { db, withTenant } from "@/server/db";
import { gradeAttemptApiSchema } from "@/lib/schemas/grading";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { userId, organizationId } = await getCurrentUserOrg();
  if (!organizationId) {
    return NextResponse.json({ error: "Attempt not found" }, { status: 404 });
  }

  // Q-18-001 — validate the request body. scorePoints/maxPoints are intentionally NOT accepted
  // from the client (they are recomputed server-side below); this only bounds the shape of
  // itemScores/itemFeedback/feedback and constrains gradingMethod to the GradingMethod enum.
  const parsed = gradeAttemptApiSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const { feedback, itemScores = {}, itemFeedback = {}, gradingMethod } = parsed.data;

  // Q-18-002 — tenant boundary: confirm the attempt belongs to the caller's org via the
  // assessment→course relation (AssessmentAttempt has no direct org column; mirrors the RLS
  // policy `assessment_id IN (… courses WHERE account_id = current_org)`). Also loads the item
  // points + existing per-item scores needed to recompute the grade authoritatively. With RLS
  // off this merged predicate IS the live boundary; with RLS on, getCurrentUserOrg() set the
  // request context so the per-query extension scopes this read too.
  const attempt = await db.assessmentAttempt.findFirst({
    where: { id, assessment: { course: { organizationId } } },
    select: {
      id: true,
      assessment: { select: { items: { select: { id: true, points: true } } } },
      itemResponses: { select: { itemId: true, pointsEarned: true } },
    },
  });
  if (!attempt) {
    return NextResponse.json({ error: "Attempt not found" }, { status: 404 });
  }

  // Q-18-001 — recompute the grade authoritatively. For each assessment item use the client's
  // submitted score (clamped to [0, item.points]) or fall back to the existing stored score;
  // sum to scorePoints, with maxPoints from the item points. Client-supplied totals are ignored
  // and no per-item score can exceed its item's points (a forged/buggy client cannot persist a
  // grade that disagrees with the items). Unknown itemIds in the payload are ignored.
  const existing = new Map(
    attempt.itemResponses.map((r) => [r.itemId, Number(r.pointsEarned ?? 0)]),
  );
  let scorePoints = 0;
  let maxPoints = 0;
  const itemWrites: { itemId: string; pointsEarned: number }[] = [];
  for (const item of attempt.assessment.items) {
    const max = Number(item.points);
    maxPoints += max;
    const submittedScore = itemScores[item.id];
    const raw = submittedScore ?? existing.get(item.id) ?? 0;
    const clamped = Math.min(Math.max(raw, 0), max);
    scorePoints += clamped;
    if (submittedScore !== undefined) {
      itemWrites.push({ itemId: item.id, pointsEarned: clamped });
    }
  }

  // Q-18-003 — persist the attempt header + all item scores atomically (no partial GRADED
  // state) and without the per-item N+1 read. `withTenant(async tx => …)` is the codebase's
  // RLS-correct multi-write pattern; `db.$transaction([…])` on the extended client would nest
  // tenant transactions (db.ts:91-97). `updateMany` keyed on the @@unique([attemptId,itemId])
  // touches 0-or-1 rows — the 0-row case reproduces the old `if (response)` skip.
  await withTenant(
    async (tx) => {
      await tx.assessmentAttempt.update({
        where: { id },
        data: {
          scorePoints,
          maxPoints,
          feedback: feedback ?? null,
          gradingMethod: gradingMethod ?? "AI_ASSISTED",
          graderUserId: userId,
          status: "GRADED",
          completedAt: new Date(),
        },
      });
      for (const w of itemWrites) {
        await tx.assessmentItemResponse.updateMany({
          where: { attemptId: id, itemId: w.itemId },
          data: {
            pointsEarned: w.pointsEarned,
            feedback: itemFeedback[w.itemId] ?? null,
            gradedAt: new Date(),
          },
        });
      }
    },
    undefined,
    { organizationId, userId },
  );

  return NextResponse.json({ success: true });
}

