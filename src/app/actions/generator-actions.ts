"use server";

import { getCurrentUserOrg } from "@/lib/auth-helpers";
import { db } from "@/server/db";

export type SourceType = "BOOK" | "VIDEO" | "COURSE" | "TOPIC" | "URL" | "FILE" | "YOUTUBE_PLAYLIST" | "SPINE";

export async function getSourceMetadata(sourceId: string, sourceType: SourceType) {
    // Tenant boundary: Book/VideoResource/Course are org-scoped and RLS is OFF (db.ts:9), so the
    // app layer is the only live boundary — every lookup MUST carry an explicit organizationId
    // predicate, or any authenticated user can read another org's source by id (Q-10-001).
    const { organizationId } = await getCurrentUserOrg();
    if (!organizationId) throw new Error("No organization found");

    // Removed defensive try/catch - database errors should surface explicitly
    let subjectId: string | null | undefined;
    let strandId: string | null | undefined;

    if (sourceType === "BOOK") {
        const source = await db.book.findFirst({
            where: { id: sourceId, organizationId },
            select: { subjectId: true, strandId: true }
        });
        if (!source) return { success: false as const, error: "Source not found" };
        subjectId = source.subjectId;
        strandId = source.strandId;
    } else if (sourceType === "VIDEO") {
        const source = await db.videoResource.findFirst({
            where: { id: sourceId, organizationId },
            select: { subjectId: true, strandId: true }
        });
        if (!source) return { success: false as const, error: "Source not found" };
        subjectId = source.subjectId;
        strandId = source.strandId;
    } else if (sourceType === "COURSE") {
        const source = await db.course.findFirst({
            where: { id: sourceId, organizationId },
            select: { subjectId: true, strandId: true }
        });
        if (!source) return { success: false as const, error: "Source not found" };
        subjectId = source.subjectId;
        strandId = source.strandId;
    }

    return { success: true as const, metadata: { subjectId, strandId } };
}
