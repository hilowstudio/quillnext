export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/server/db";
import { Prisma } from "@/generated/client";
import { getCurrentUserOrg } from "@/lib/auth-helpers";
import {
  generateStudentProfile,
  generateLearningStyleProfile,
  generateInterestProfile,
} from "@/server/ai/personality";

// The questionnaire answers are serialized into AI prompts, so we validate the SHAPE per step and
// fail fast before the paid AI call. personality/learning send a flat Record<string,string>; the
// interests step sends a nested object, so its values stay permissive (unknown). A discriminated
// union keeps each step typed to its generator's contract without unchecked casts. Mirrors the
// create path's studentSchema.
const assessmentSchema = z.discriminatedUnion("step", [
  z.object({ step: z.literal("personality"), answers: z.record(z.string(), z.string()) }),
  z.object({ step: z.literal("learning"), answers: z.record(z.string(), z.string()) }),
  z.object({ step: z.literal("interests"), answers: z.record(z.string(), z.unknown()) }),
]);

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

    const parsed = assessmentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    const { step } = parsed.data;

    console.log(`Processing assessment step '${step}' for student:`, id);

    // Get student
    const student = await db.learner.findUnique({
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
    const updateData: {
      completedAt: Date;
      personalityData?: Prisma.InputJsonValue;
      learningStyleData?: Prisma.InputJsonValue;
      interestsData?: Prisma.InputJsonValue;
    } = { completedAt: new Date() };

    // AI Generation & DB Update Logic based on Step (answers narrows via the discriminated union).
    if (parsed.data.step === "personality") {
      console.log("Generating Personality Profile...");
      const profile = await generateStudentProfile(parsed.data.answers, studentName);
      updateData.personalityData = profile as Prisma.InputJsonValue;
      result = profile;
    } else if (parsed.data.step === "learning") {
      console.log("Generating Learning Style Profile...");
      const profile = await generateLearningStyleProfile(parsed.data.answers, studentName);
      updateData.learningStyleData = profile as Prisma.InputJsonValue;
      result = profile;
    } else {
      console.log("Generating Interest Profile...");
      const profile = await generateInterestProfile(parsed.data.answers, studentName);
      updateData.interestsData = profile as Prisma.InputJsonValue;
      result = profile;
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

