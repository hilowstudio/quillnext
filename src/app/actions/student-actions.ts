"use server";

import { auth } from "@/auth";
import { getCurrentUserOrg } from "@/lib/auth-helpers";
import { assertParentProfile } from "@/server/profiles/guards";
import { db } from "@/server/db";
import { revalidatePath } from "next/cache";
import { deleteStudentSchema } from "@/lib/schemas/actions";

export async function deleteStudent(rawData: unknown) {
    // Validate input
    const data = deleteStudentSchema.parse(rawData);

    const session = await auth();
    if (!session?.user) {
        throw new Error("Not authenticated");
    }

    await assertParentProfile();

    const { organizationId } = await getCurrentUserOrg();

    // Verify student belongs to organization
    const student = await db.learner.findUnique({
        where: { id: data.id },
    });

    if (!student) {
        throw new Error("Student not found");
    }

    if (student.organizationId !== organizationId) {
        return { success: false, error: "Unauthorized - student belongs to different organization" };
    }

    // Removed defensive try/catch - let Prisma handle cascade deletes
    // If delete fails due to constraints, error will bubble up explicitly
    try {
        await db.learner.delete({
            where: { id: data.id },
        });

        revalidatePath("/students");
        return { success: true };
    } catch (error) {
        return { success: false, error: "Failed to delete student" };
    }
}
