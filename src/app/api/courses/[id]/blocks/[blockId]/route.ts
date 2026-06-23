export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getCurrentUserOrg } from "@/lib/auth-helpers";
import { assertParentProfile } from "@/server/profiles/guards";
import { db } from "@/server/db";
import { courseBlockSchema, validateBlockNesting, type CourseBlockKind } from "@/lib/schemas/courses";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; blockId: string }> },
) {
  const { id: courseId, blockId } = await params;
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { organizationId } = await getCurrentUserOrg();
    if (!organizationId) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    // Verify course exists and belongs to organization (org filter in the query predicate,
    // not a droppable post-fetch `!==`).
    const course = await db.course.findFirst({
      where: { id: courseId, organizationId },
    });

    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    // Get block with full details
    const block = await db.courseBlock.findUnique({
      where: { id: blockId },
      include: {
        topic: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        subtopic: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        activities: {
          orderBy: { position: "asc" },
          select: {
            id: true,
            title: true,
            activityType: true,
            position: true,
          },
        },
        childBlocks: {
          orderBy: { position: "asc" },
          select: {
            id: true,
            title: true,
            kind: true,
          },
        },
      },
    });

    if (!block || block.courseId !== courseId) {
      return NextResponse.json({ error: "Block not found" }, { status: 404 });
    }

    return NextResponse.json({ block });
  } catch (error) {
    console.error("Failed to get course block:", error);
    return NextResponse.json(
      { error: "Failed to get course block" },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; blockId: string }> },
) {
  const { id: courseId, blockId } = await params;
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { organizationId } = await getCurrentUserOrg();
    if (!organizationId) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }
    const body = await request.json();

    // Verify course exists and belongs to organization (org filter in the query predicate,
    // not a droppable post-fetch `!==`).
    const course = await db.course.findFirst({
      where: { id: courseId, organizationId },
    });

    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    // Verify block exists and belongs to course
    const existingBlock = await db.courseBlock.findUnique({
      where: { id: blockId },
    });

    if (!existingBlock || existingBlock.courseId !== courseId) {
      return NextResponse.json({ error: "Block not found" }, { status: 404 });
    }

    // Validate input (partial update, so make all fields optional)
    const partialSchema = courseBlockSchema.partial();
    const validated = partialSchema.parse(body);

    // Verify parent block if provided and different
    let resolvedNewParentKind: CourseBlockKind | undefined; // set when the parent is (re)assigned to a block
    if (validated.parentBlockId && validated.parentBlockId !== existingBlock.parentBlockId) {
      // Prevent circular reference
      if (validated.parentBlockId === blockId) {
        return NextResponse.json(
          { error: "Block cannot be its own parent" },
          { status: 400 },
        );
      }

      const parentBlock = await db.courseBlock.findUnique({
        where: { id: validated.parentBlockId },
        select: { kind: true, courseId: true },
      });

      if (!parentBlock || parentBlock.courseId !== courseId) {
        return NextResponse.json(
          { error: "Parent block not found or doesn't belong to this course" },
          { status: 400 },
        );
      }

      resolvedNewParentKind = parentBlock.kind;
    }

    // Enforce kind-nesting rules on the merged post-update (kind, parentKind) pair —
    // kind and parentBlockId can change independently, so validate the effective result.
    const effectiveKind: CourseBlockKind = validated.kind ?? existingBlock.kind;
    const effectiveParentId =
      validated.parentBlockId !== undefined
        ? validated.parentBlockId || null
        : existingBlock.parentBlockId;
    let effectiveParentKind: CourseBlockKind | null = null;
    if (effectiveParentId) {
      effectiveParentKind =
        resolvedNewParentKind ??
        (
          await db.courseBlock.findUnique({
            where: { id: effectiveParentId },
            select: { kind: true },
          })
        )?.kind ??
        null;
    }
    const nesting = validateBlockNesting(effectiveKind, effectiveParentKind);
    if (!nesting.ok) {
      return NextResponse.json({ error: nesting.error }, { status: 400 });
    }

    // Update block
    const block = await db.courseBlock.update({
      where: { id: blockId },
      data: {
        ...(validated.kind && { kind: validated.kind }),
        ...(validated.title && { title: validated.title }),
        ...(validated.description !== undefined && { description: validated.description || null }),
        ...(validated.position && { position: validated.position }),
        ...(validated.parentBlockId !== undefined && {
          parentBlockId: validated.parentBlockId || null,
        }),
        ...(validated.topicId !== undefined && { topicId: validated.topicId || null }),
        ...(validated.subtopicId !== undefined && { subtopicId: validated.subtopicId || null }),
      },
      include: {
        topic: {
          include: {
            strand: {
              include: {
                subject: true,
              },
            },
          },
        },
        subtopic: {
          include: {
            topic: {
              include: {
                strand: {
                  include: {
                    subject: true,
                  },
                },
              },
            },
          },
        },
        activities: {
          orderBy: { position: "asc" },
        },
        childBlocks: {
          orderBy: { position: "asc" },
        },
      },
    });

    return NextResponse.json({ block });
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        { error: "Validation failed", details: error },
        { status: 400 },
      );
    }
    console.error("Failed to update course block:", error);
    return NextResponse.json(
      { error: "Failed to update course block" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; blockId: string }> },
) {
  const { id: courseId, blockId } = await params;
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await assertParentProfile();

    const { organizationId } = await getCurrentUserOrg();
    if (!organizationId) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    // Verify course exists and belongs to organization (org filter in the query predicate,
    // not a droppable post-fetch `!==`).
    const course = await db.course.findFirst({
      where: { id: courseId, organizationId },
    });

    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    // Verify block exists and belongs to course
    const block = await db.courseBlock.findUnique({
      where: { id: blockId },
      include: {
        childBlocks: true,
        activities: true,
      },
    });

    if (!block || block.courseId !== courseId) {
      return NextResponse.json({ error: "Block not found" }, { status: 404 });
    }

    // Check if block has children (cascade delete will handle this, but warn user)
    if (block.childBlocks.length > 0) {
      return NextResponse.json(
        {
          error: "Cannot delete block with child blocks. Delete child blocks first.",
          hasChildren: true,
        },
        { status: 400 },
      );
    }

    // Delete block (cascade will handle activities)
    await db.courseBlock.delete({
      where: { id: blockId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete course block:", error);
    return NextResponse.json(
      { error: "Failed to delete course block" },
      { status: 500 },
    );
  }
}

