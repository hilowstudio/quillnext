"use server";

import { db } from "@/server/db";

export type SourceType = "BOOK" | "VIDEO" | "COURSE" | "TOPIC" | "URL" | "FILE" | "YOUTUBE_PLAYLIST" | "SPINE";

export async function getSourceMetadata(sourceId: string, sourceType: SourceType) {
    // Removed defensive try/catch - database errors should surface explicitly
    let subjectId: string | null | undefined;
    let strandId: string | null | undefined;

    if (sourceType === "BOOK") {
        const source = await db.book.findUnique({
            where: { id: sourceId },
            select: { subjectId: true, strandId: true }
        });
        subjectId = source?.subjectId;
        strandId = source?.strandId;
    } else if (sourceType === "VIDEO") {
        const source = await db.videoResource.findUnique({
            where: { id: sourceId },
            select: { subjectId: true, strandId: true }
        });
        subjectId = source?.subjectId;
        strandId = source?.strandId;
    } else if (sourceType === "COURSE") {
        const source = await db.course.findUnique({
            where: { id: sourceId },
            select: { subjectId: true, strandId: true }
        });
        subjectId = source?.subjectId;
        strandId = source?.strandId;
    }

    return { success: true, metadata: { subjectId, strandId } };
}
