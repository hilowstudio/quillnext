import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getCurrentUserOrg } from "@/lib/auth-helpers";
export const dynamic = "force-dynamic";

import { db } from "@/server/db";
import { courseBlockSchema, validateBlockNesting } from "@/lib/schemas/courses";

export async function GET(
  request: NextRequest,
  props: { params: Promise<{ id: string }> },
) {
  const params = await props.params;
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { organizationId } = await getCurrentUserOrg();
    if (!organizationId) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }
    const courseId = params.id;

    // Verify course exists and belongs to organization (org filter in the query predicate,
    // not a droppable post-fetch `!==`).
    const course = await db.course.findFirst({
      where: { id: courseId, organizationId },
    });

    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    const blocks = await db.courseBlock.findMany({
      where: { courseId },
      orderBy: { position: "asc" },
      include: {
        parentBlock: {
          select: {
            id: true,
            title: true,
            kind: true,
          },
        },
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
      },
    });

    return NextResponse.json({ blocks });
  } catch (error) {
    console.error("Failed to get course blocks:", error);
    return NextResponse.json(
      { error: "Failed to get course blocks" },
      { status: 500 },
    );
  }
}

export async function POST(
  request: NextRequest,
  props: { params: Promise<{ id: string }> },
) {
  const params = await props.params;
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { organizationId } = await getCurrentUserOrg();
    if (!organizationId) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }
    const courseId = params.id;
    const body = await request.json();

    // Verify course exists and belongs to organization (org filter in the query predicate,
    // not a droppable post-fetch `!==`).
    const course = await db.course.findFirst({
      where: { id: courseId, organizationId },
    });

    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    // Validate input
    const validated = courseBlockSchema.parse(body);

    // Verify parent block if provided
    if (validated.parentBlockId) {
      const parentBlock = await db.courseBlock.findUnique({
        where: { id: validated.parentBlockId },
      });

      if (!parentBlock || parentBlock.courseId !== courseId) {
        return NextResponse.json(
          { error: "Parent block not found or doesn't belong to this course" },
          { status: 400 },
        );
      }

      // Enforce kind-nesting rules server-side (not browser-only)
      const nesting = validateBlockNesting(validated.kind, parentBlock.kind);
      if (!nesting.ok) {
        return NextResponse.json({ error: nesting.error }, { status: 400 });
      }
    }

    // Handle Topic
    let topicId = validated.topicId;
    let topic;

    if (topicId && topicId.startsWith("new:")) {
      if (!course.strandId) {
        return NextResponse.json({ error: "Cannot create topic without a course strand" }, { status: 400 });
      }
      const name = topicId.replace("new:", "");
      // Fetch strand to get subject (for code generation, optional but good)
      const strand = await db.strand.findUnique({ where: { id: course.strandId } });
      if (!strand) return NextResponse.json({ error: "Strand not found" }, { status: 400 });

      const code = strand.code + "." + name.slice(0, 3).toUpperCase() + "-" + Date.now().toString().slice(-4);

      topic = await db.topic.create({
        data: {
          name,
          code,
          strandId: course.strandId,
          sortOrder: 999
        }
      });
      topicId = topic.id;
    } else if (topicId) {
      topic = await db.topic.findUnique({
        where: { id: topicId },
      });

      if (!topic) {
        return NextResponse.json({ error: "Topic not found" }, { status: 400 });
      }
    }

    // Handle Subtopic
    let subtopicId = validated.subtopicId;
    if (subtopicId && subtopicId.startsWith("new:")) {
      // Must have a valid topicId now (either existing or just created)
      if (!topicId) {
        return NextResponse.json({ error: "Cannot create subtopic without a topic" }, { status: 400 });
      }
      const name = subtopicId.replace("new:", "");
      // We know topic exists (fetched or created)
      // Reload topic if created to be safe? No, just use data.
      // Actually topic object might be missing code if we didn't fetch it in "existing" path...
      // Let's ensure we have topic.code
      if (!topic) topic = await db.topic.findUnique({ where: { id: topicId! } });

      const code = (topic?.code || "TOP") + "." + name.slice(0, 3).toUpperCase() + "-" + Date.now().toString().slice(-4);

      const subtopic = await db.subtopic.create({
        data: {
          name,
          code,
          topicId: topicId!,
          sortOrder: 999
        }
      });
      subtopicId = subtopic.id;

    } else if (subtopicId) {
      const subtopic = await db.subtopic.findUnique({
        where: { id: subtopicId },
        include: { topic: true },
      });

      if (!subtopic) {
        return NextResponse.json({ error: "Subtopic not found" }, { status: 400 });
      }

      // If topicId also provided, verify they match
      if (topicId && subtopic.topicId !== topicId) {
        return NextResponse.json(
          { error: "Subtopic doesn't belong to the specified topic" },
          { status: 400 },
        );
      }
    }

    // Create block
    const block = await db.courseBlock.create({
      data: {
        courseId,
        kind: validated.kind,
        title: validated.title,
        description: validated.description || null,
        position: validated.position,
        parentBlockId: validated.parentBlockId || null,
        topicId: topicId || null,
        subtopicId: subtopicId || null,
        bookId: validated.bookId || null,
        bookChapterId: validated.bookChapterId || null,
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
    console.error("Failed to create course block:", error);
    return NextResponse.json(
      { error: "Failed to create course block" },
      { status: 500 },
    );
  }
}
