import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getCurrentUserOrg } from "@/lib/auth-helpers";
import { assertParentProfile } from "@/server/profiles/guards";
import { createActivityApiSchema } from "@/lib/schemas/courses";
export const dynamic = "force-dynamic";

import { db } from "@/server/db";

export async function POST(
  request: NextRequest,
  props: { params: Promise<{ id: string; blockId: string }> },
) {
  const params = await props.params;
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Authoring activities is course-authoring → parent-only (defense-in-depth: the
  // proxy does NOT gate /api routes, so a STUDENT-profile session on the shared
  // family login could POST here). Mirrors POST /api/courses + block DELETE.
  try {
    await assertParentProfile();
  } catch {
    return NextResponse.json({ error: "This action requires a parent profile." }, { status: 403 });
  }

  try {
    const { organizationId, userId } = await getCurrentUserOrg();
    if (!organizationId) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }
    const { id: courseId, blockId } = params;

    // Verify the course exists and belongs to the org (org filter in the query
    // predicate, not a droppable post-fetch `!==` — mirrors Q-17-004).
    const course = await db.course.findFirst({
      where: { id: courseId, organizationId },
      select: { id: true },
    });
    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    // Verify the block belongs to the course and is a LESSON (activities attach to
    // lessons only — the UI exposes "Add Activity" on LESSON blocks).
    const block = await db.courseBlock.findFirst({
      where: { id: blockId, courseId },
      select: { id: true, kind: true },
    });
    if (!block) {
      return NextResponse.json({ error: "Block not found" }, { status: 404 });
    }
    if (block.kind !== "LESSON") {
      return NextResponse.json(
        { error: "Activities can only be added to LESSON blocks." },
        { status: 400 },
      );
    }

    const parsed = createActivityApiSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid activity data", details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const data = parsed.data;

    // Verify the linked objective exists if provided (Objective is global spine /
    // CONTEXT_FREE, so no org scoping). The client drops `new:` custom objectives,
    // so the route never mints an Objective — it links an existing one.
    if (data.objectiveId) {
      const objective = await db.objective.findUnique({
        where: { id: data.objectiveId },
        select: { id: true },
      });
      if (!objective) {
        return NextResponse.json({ error: "Objective not found" }, { status: 400 });
      }
    }

    // Assign the next position within the block (the client form does not send one).
    const last = await db.activity.findFirst({
      where: { courseBlockId: blockId },
      orderBy: { position: "desc" },
      select: { position: true },
    });
    const position = (last?.position ?? 0) + 1;

    const activity = await db.activity.create({
      data: {
        courseBlockId: blockId,
        createdByUserId: userId,
        title: data.title,
        description: data.description || null,
        estimatedMinutes: data.estimatedMinutes ?? null,
        activityType: data.activityType,
        position,
        ...(data.objectiveId
          ? { objectives: { create: { isPrimary: true, objective: { connect: { id: data.objectiveId } } } } }
          : {}),
      },
    });

    return NextResponse.json({ activity });
  } catch (error) {
    console.error("Failed to create activity:", error);
    return NextResponse.json({ error: "Failed to create activity" }, { status: 500 });
  }
}
