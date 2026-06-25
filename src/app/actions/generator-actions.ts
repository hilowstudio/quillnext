"use server";

import { auth } from "@/auth";
import { getCurrentUserOrg } from "@/lib/auth-helpers";
import { db } from "@/server/db";
import { extractTextFromFile } from "@/lib/extract-text";

export type SourceType = "BOOK" | "VIDEO" | "COURSE" | "TOPIC" | "URL" | "FILE" | "YOUTUBE_PLAYLIST" | "SPINE";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_TEXT_CHARS = 200_000; // generation also budgets fileContent; cap here so payloads stay sane

/**
 * Extract text from a file the user picks as a generation source. Transient: the file is read into
 * memory, its text returned, and nothing is persisted — no Storage upload, no DB row (matches the
 * owner's "don't database user uploads" decision). Session-gated; the file is not org-scoped data.
 */
export async function extractUploadedText(
    formData: FormData,
): Promise<{ success: true; text: string; fileName: string } | { success: false; error: string }> {
    const session = await auth();
    if (!session?.user) return { success: false as const, error: "Unauthorized" };

    const file = formData.get("file");
    if (!(file instanceof File)) return { success: false as const, error: "No file provided." };
    if (file.size > MAX_UPLOAD_BYTES) return { success: false as const, error: "File is too large (max 10 MB)." };

    try {
        const buffer = Buffer.from(await file.arrayBuffer());
        let text = (await extractTextFromFile(buffer, file.name)).trim();
        if (!text) return { success: false as const, error: "No readable text could be extracted from this file." };
        if (text.length > MAX_TEXT_CHARS) text = text.slice(0, MAX_TEXT_CHARS);
        return { success: true as const, text, fileName: file.name };
    } catch (e) {
        console.error("extractUploadedText failed:", e);
        return { success: false as const, error: e instanceof Error ? e.message : "Could not read this file." };
    }
}

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
