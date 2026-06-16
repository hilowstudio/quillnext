"use server";

import { auth } from "@/auth";
import { getCurrentUserOrg } from "@/lib/auth-helpers";
import { db } from "@/server/db";
import { revalidatePath } from "next/cache";
import { CURRICULUM_KIND_CODES } from "@/lib/constants/curriculum-kinds";
import { clampDurationDays } from "@/lib/validation/curriculum-spec";

/**
 * Why this exists:
 *   The Curriculum Compiler ("Studio 26") compiles a CurriculumSpec into a
 *   CurriculumBundle of generated teaching artifacts (Teacher Guide, Student
 *   Packet, Slides, Reading Anthology, Graphic Organizers). "Exploding" a
 *   completed bundle materializes it into a teacher's Course as a ready-to-run
 *   Unit: the generated materials attached so each is reachable in the builder,
 *   plus a day-by-day lesson scaffold for pacing.
 *
 * The attachment model:
 *   Every compiled artifact is an inline `Resource` row (markdown/JSON) — it has
 *   no Book/Video/Article/Document record. A CourseBlock exposes ONE slot per
 *   resource type, and inline Resources can only occupy `resourceId`. So each
 *   artifact gets its OWN block (one `resourceId` each); that is the only way all
 *   of them surface in the builder, which renders attachments per single slot.
 *   (The previous implementation read `tg.book`/`sp.document`/`ra.article`, which
 *   are always null for inline Resources, so 4 of 5 artifacts silently vanished.)
 */

// The teaching artifacts a compiled bundle produces, in the order a teacher meets
// them. The Release Manifest / QA report is build scaffolding, not classroom
// material, so it is intentionally not exploded into the course.
const MATERIAL_ORDER: { code: string; title: string }[] = [
    { code: CURRICULUM_KIND_CODES.TEACHER_GUIDE, title: "Teacher Guide" },
    { code: CURRICULUM_KIND_CODES.STUDENT_PACKET, title: "Student Packet" },
    { code: CURRICULUM_KIND_CODES.SLIDES, title: "Slides" },
    { code: CURRICULUM_KIND_CODES.READING_ANTHOLOGY, title: "Reading Anthology" },
    { code: CURRICULUM_KIND_CODES.GRAPHIC_ORGANIZERS, title: "Charts & Organizers" },
];

export async function explodeCurriculumBundle(bundleId: string, courseId: string) {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");

    const { organizationId } = await getCurrentUserOrg();
    if (!organizationId) throw new Error("No organization found");

    // 1. Load the bundle (spec + generated artifacts) and the target course.
    const [bundle, course] = await Promise.all([
        db.curriculumBundle.findUnique({
            where: { id: bundleId },
            include: {
                spec: true,
                resources: { include: { resourceKind: true } },
            },
        }),
        db.course.findUnique({
            where: { id: courseId },
            select: { id: true, organizationId: true },
        }),
    ]);

    if (!bundle) throw new Error("Bundle not found");
    if (!course) throw new Error("Course not found");

    // Multi-tenant guard: the bundle AND the destination course must both belong
    // to the caller's organization. (Without this, any member could graft another
    // org's compiled unit into their course, or target another org's course.)
    if (bundle.spec.organizationId !== organizationId || course.organizationId !== organizationId) {
        throw new Error("Unauthorized");
    }

    if (bundle.status !== "COMPLETED") {
        throw new Error("Bundle must be COMPLETED to add it to a course");
    }

    // Idempotency: never add the same compiled unit to a course twice.
    const existingUnit = await db.courseBlock.findFirst({
        where: { courseId, sourceBundleId: bundle.id, kind: "UNIT" },
        select: { id: true },
    });
    if (existingUnit) {
        throw new Error("This curriculum unit has already been added to this course.");
    }

    // 2. Resolve the teaching materials in canonical order — one block per artifact.
    const materials = MATERIAL_ORDER.flatMap(({ code, title }) => {
        const res = bundle.resources.find((r) => r.resourceKind.code === code);
        return res ? [{ resourceId: res.id, title }] : [];
    });

    // Safety net: if ResourceKind codes ever drift so none of the canonical
    // materials match but the bundle still has artifacts, attach them all (by their
    // own titles) rather than silently producing an empty unit.
    const attachable =
        materials.length > 0
            ? materials
            : bundle.resources.map((r) => ({ resourceId: r.id, title: r.title || r.resourceKind.label }));

    const topicLabel = bundle.spec.topic || bundle.spec.title;
    // Defensive: clamp to 1..MAX even though compileCurriculumAction now validates on the way in.
    const duration = clampDurationDays(bundle.spec.durationDays ?? 1);

    // 3. Append after the course's current last block. The builder renders a flat
    //    list ordered by `position` (indentation derives from `kind`), and drag
    //    reordering reindexes positions globally — so positions must be globally
    //    sequential, not per-parent.
    const lastBlock = await db.courseBlock.findFirst({
        where: { courseId },
        orderBy: { position: "desc" },
        select: { position: true },
    });
    const base = (lastBlock?.position ?? -1) + 1;

    // Lay out in render order: UNIT, [Materials module + its lessons], [Daily module + day lessons].
    const hasMaterials = attachable.length > 0;
    const unitPos = base;
    const materialsModulePos = base + 1;
    const firstMaterialPos = base + 2;
    const dailyModulePos = hasMaterials ? firstMaterialPos + attachable.length : base + 1;
    const firstDayPos = dailyModulePos + 1;

    // 4. Materialize the whole structure atomically.
    const unitId = await db.$transaction(async (tx) => {
        const unit = await tx.courseBlock.create({
            data: {
                courseId,
                kind: "UNIT",
                title: bundle.spec.title,
                position: unitPos,
                sourceBundleId: bundle.id,
            },
        });

        if (hasMaterials) {
            const materialsModule = await tx.courseBlock.create({
                data: {
                    courseId,
                    parentBlockId: unit.id,
                    kind: "MODULE",
                    title: "Unit Materials",
                    description: "Generated teaching materials for this unit.",
                    position: materialsModulePos,
                    sourceBundleId: bundle.id,
                },
            });

            await tx.courseBlock.createMany({
                data: attachable.map((m, i) => ({
                    courseId,
                    parentBlockId: materialsModule.id,
                    kind: "LESSON" as const,
                    title: m.title,
                    position: firstMaterialPos + i,
                    resourceId: m.resourceId,
                    sourceBundleId: bundle.id,
                })),
            });
        }

        const dailyModule = await tx.courseBlock.create({
            data: {
                courseId,
                parentBlockId: unit.id,
                kind: "MODULE",
                title: "Daily Lessons",
                description: `Day-by-day pacing for ${topicLabel}.`,
                position: dailyModulePos,
                sourceBundleId: bundle.id,
            },
        });

        await tx.courseBlock.createMany({
            data: Array.from({ length: duration }, (_, i) => ({
                courseId,
                parentBlockId: dailyModule.id,
                kind: "LESSON" as const,
                title: `Day ${i + 1}: ${topicLabel}`,
                position: firstDayPos + i,
                sourceBundleId: bundle.id,
            })),
        });

        return unit.id;
    });

    revalidatePath(`/courses/${courseId}`);
    revalidatePath(`/courses/${courseId}/builder`);
    return { success: true, unitId, materialCount: attachable.length, days: duration };
}
