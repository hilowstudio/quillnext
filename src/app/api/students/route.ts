export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { getCurrentUserOrg } from "@/lib/auth-helpers";
import { db, withTenant } from "@/server/db";
import { studentSchema } from "@/lib/schemas/students";
import { studentProfileId } from "@/server/profiles/ids";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const userOrg = await getCurrentUserOrg();
    const userId = userOrg.userId;
    let organizationId = userOrg.organizationId;

    // Self-healing: Ensure user has an organization. These bootstrap writes stay on the raw `db`
    // client by necessity: the org INSERT must run under the null org context the relaxed
    // `organizations` RLS policy permits ("id = app.current_org() OR app.current_org() IS NULL" —
    // you cannot stamp a GUC for an org that does not exist yet), and `User` is a CONTEXT_FREE
    // model. The org-scoped learner writes below run under an explicit tenant transaction.
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

    // Create the learner, its empty profile, and a STUDENT picker Profile in ONE tenant-scoped
    // transaction so every org-scoped write is tenant-stamped (RLS-ready) and atomic — no orphaned
    // learner/profile if a later step fails. organizationId is the caller's own org, resolved/created
    // above, and is passed explicitly as the tenant context (the only reliable path in the Next
    // runtime). The same id as the backfill is used for the STUDENT profile.
    const student = await withTenant(
      async (tx) => {
        const learner = await tx.learner.create({
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

        await tx.learnerProfile.create({
          data: {
            studentId: learner.id,
          },
        });

        const profileId = studentProfileId(learner.id);
        await tx.profile.create({
          data: {
            id: profileId,
            organizationId,
            type: "STUDENT",
            displayName: validated.preferredName || validated.firstName,
          },
        });
        await tx.learner.update({ where: { id: learner.id }, data: { profileId } });

        return learner;
      },
      undefined,
      { organizationId, userId: null },
    );

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

