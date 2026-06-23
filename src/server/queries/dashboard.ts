import "server-only";
import { db, withTenant } from "@/server/db";
import { excludeParentLearners } from "./learner-filters";
import { analyzeContextCompleteness } from "@/lib/context/context-suggestions";

export async function getStudentDashboardData(organizationId: string, studentId: string) {
    // RLS: run inside a transaction with the tenant GUCs stamped on the connection from the
    // EXPLICIT org (no AsyncLocalStorage / no extension — those don't reach the query layer in
    // the Next runtime). All reads use `tx`.
    return withTenant(
        (tx) =>
            tx.learner.findUnique({
                where: { id: studentId, organizationId },
                select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    preferredName: true,
                    currentGrade: true,
                    avatarConfig: true,
                    learnerProfile: {
                        select: {
                            id: true,
                            personalityData: true,
                            learningStyleData: true,
                            interestsData: true,
                        },
                    },
                },
            }),
        undefined,
        { organizationId, userId: null },
    );
}

export async function getParentDashboardData(organizationId: string) {
    // analyzeContextCompleteness threads the tenant itself: every org-scoped read inside it (and inside
    // the getMasterContext it calls) runs via `withTenant(..., { organizationId })`, so it is RLS-safe
    // and returns correct org data, not empty. Its only bare-`db` reads are the global academic spine
    // (Objective, in CONTEXT_FREE_MODELS), which correctly run without the org GUC. Called here, outside
    // the dashboard's own withTenant block below, because it opens its own transactions.
    const { completeness, suggestions } = await analyzeContextCompleteness(organizationId);

    return withTenant(
        async (tx) => {
            const recentResources = await tx.resource.findMany({
                where: { organizationId },
                select: {
                    id: true,
                    title: true,
                    createdAt: true,
                    resourceKind: { select: { id: true, label: true, code: true } },
                    createdByUser: { select: { id: true, name: true } },
                },
                orderBy: { createdAt: "desc" },
                take: 5,
            });

            const recentCourses = await tx.course.findMany({
                where: { organizationId },
                select: {
                    id: true,
                    title: true,
                    updatedAt: true,
                    subject: { select: { id: true, name: true } },
                    students: {
                        select: {
                            student: {
                                select: { id: true, firstName: true, lastName: true, preferredName: true },
                            },
                        },
                    },
                },
                orderBy: { updatedAt: "desc" },
                take: 5,
            });

            const students = await tx.learner.findMany({
                where: { organizationId, ...excludeParentLearners },
                select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    preferredName: true,
                    avatarConfig: true,
                    learnerProfile: { select: { id: true } },
                },
                take: 10,
            });

            const classroom = await tx.classroom.findFirst({
                where: { organizationId },
                orderBy: { createdAt: "desc" },
                select: { name: true },
            });

            return {
                completeness,
                suggestions,
                recentResources,
                recentCourses,
                students,
                classroomName: classroom?.name,
            };
        },
        undefined,
        { organizationId, userId: null },
    );
}

/**
 * Today's morning devotional (Spurgeon "Morning & Evening", seeded global reference data with no
 * org column), used by the parent dashboard's "Daily Liturgy" card. Read on the bare `db` like the
 * devotionals page (`family-discipleship/devotionals/page.tsx`) since it is cross-org reference data.
 * The seeded rows carry a metadata prefix ("<date>\nMorning Reading\n\n\"<verse>\"\n- <ref>\n\n<prose>"),
 * so we derive a clean reference (first line of keyverse) + a short prose excerpt.
 */
export async function getTodayDevotional() {
    const today = new Date();
    const devotional = await db.devotional.findFirst({
        where: { month: today.getMonth() + 1, day: today.getDate(), time: "am" },
        select: { keyverse: true, body: true },
    });
    if (!devotional) return null;

    const firstLine = devotional.keyverse.split("\n").find((l) => l.trim());
    const reference = firstLine ? firstLine.replace(/^["'\s]+/, "").trim() : "Today's Reading";

    const paragraphs = devotional.body.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
    const prose = (paragraphs.slice(2).join(" ") || devotional.body).replace(/\s+/g, " ").trim();
    const excerpt = prose.length > 170 ? `${prose.slice(0, 170).trimEnd()}…` : prose;

    return { reference, excerpt };
}
