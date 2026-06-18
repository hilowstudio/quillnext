export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { revalidateTag, revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { getCurrentUserOrg } from "@/lib/auth-helpers";
import { db } from "@/server/db";
import { studentSchema } from "@/lib/schemas/students";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    let { organizationId, userId } = await getCurrentUserOrg();

    // Self-healing: Ensure user has an organization
    if (!organizationId) {
      console.log("No organizationId found for user. Creating default organization...");
      const newOrg = await db.organization.create({
        data: {
          name: "My School",
          type: "PARENT_INSTRUCTOR",
          users: { connect: { id: userId } },
        },
      });
      organizationId = newOrg.id;

      // Update user to default to this org
      await db.user.update({
        where: { id: userId },
        data: { organizationId: newOrg.id },
      });
    }

    const body = await request.json();

    // Validate input
    const validated = studentSchema.parse({
      ...body,
      birthdate: body.birthdate ? new Date(body.birthdate) : undefined,
    });

    // Create student
    const student = await db.learner.create({
      data: {
        organization: { connect: { id: organizationId } },
        firstName: validated.firstName,
        lastName: validated.lastName || null,
        preferredName: validated.preferredName || null,
        birthdate: validated.birthdate,
        currentGrade: validated.currentGrade,
        sex: validated.sex || null,
        learningDifficulties: validated.learningDifficulties?.join(", ") || null,
        support_labels: validated.supportLabels || [],
        support_profile: validated.supportProfile || undefined,
        support_intensity: validated.supportIntensity || null,
      },
    });

    // Create empty learner profile
    await db.learnerProfile.create({
      data: {
        studentId: student.id,
      },
    });

    // Invalidate students cache so the new student appears immediately
    // revalidateTag("students");
    // Also revalidate the students page path to be safe
    revalidatePath("/students");

    return NextResponse.json({ student });
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        { error: "Validation failed", details: error },
        { status: 400 },
      );
    }
    console.error("Failed to create student:", error);
    return NextResponse.json(
      {
        error: "Failed to create student",
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 },
    );
  }
}

