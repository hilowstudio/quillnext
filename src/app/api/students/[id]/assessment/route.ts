export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/server/db";
import { getCurrentUserOrg } from "@/lib/auth-helpers";
import {
  generateStudentProfile,
  generateLearningStyleProfile,
  generateInterestProfile,
} from "@/server/ai/personality";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const { step, answers } = body;

    console.log(`Processing assessment step '${step}' for student:`, id);

    // Get student
    const student = await db.student.findUnique({
      where: { id },
    });

    if (!student) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    // Multi-tenant guard: the student must belong to the caller's organization.
    const { organizationId } = await getCurrentUserOrg();
    if (student.organizationId !== organizationId) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    const studentName = student.preferredName || student.firstName;
    let result;
    const updateData: any = { completedAt: new Date() };

    // AI Generation & DB Update Logic based on Step
    if (step === "personality") {
      console.log("Generating Personality Profile...");
      const profile = await generateStudentProfile(answers, studentName);
      updateData.personalityData = profile as any;
      result = profile;
    } else if (step === "learning") {
      console.log("Generating Learning Style Profile...");
      const profile = await generateLearningStyleProfile(answers, studentName);
      updateData.learningStyleData = profile as any;
      result = profile;
    } else if (step === "interests") {
      console.log("Generating Interest Profile...");
      const profile = await generateInterestProfile(answers, studentName);
      updateData.interestsData = profile as any;
      result = profile;
    } else {
      return NextResponse.json({ error: "Invalid step" }, { status: 400 });
    }

    // Upsert LearnerProfile
    console.log(`Saving ${step} data to database...`);
    await db.learnerProfile.upsert({
      where: { studentId: id },
      create: {
        studentId: id,
        ...updateData,
      },
      update: updateData,
    });

    return NextResponse.json({ success: true, profile: result });
  } catch (error) {
    console.error("Error in assessment submission:", error);
    return NextResponse.json(
      {
        error: "Internal Server Error",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

