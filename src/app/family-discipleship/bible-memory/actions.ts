'use server';

import { withTenant } from "@/server/db";
import { revalidatePath } from "next/cache";
import { getBibleText } from "@/server/actions/bible-study";
import { getCurrentUserOrg } from "@/lib/auth-helpers";
import {
    addVerseSchema,
    createFolderSchema,
    renameFolderSchema,
    moveVerseSchema,
} from "@/lib/schemas/bible-memory";

// --- Types ---

const PRELOADED_VERSES = [
    "Genesis 1:1-2", "Genesis 1:27-31", "Exodus 33:13-19", "Exodus 34:6-9", "Deuteronomy 6:4-9",
    "Deuteronomy 10:14-21", "Psalm 23:1-6", "Psalm 32:1-5", "Psalm 51:17", "Isaiah 53:1-12",
    "Daniel 3:17-18", "Habakkuk 1:5", "Zephaniah 3:17", "Matthew 28:18-20", "Mark 1:11",
    "John 1:1-5", "John 3:3-8", "John 6:63", "John 8:56-58", "John 10:14-18",
    "John 10:24-31", "John 11:35", "John 13:12-17", "John 14:1-9", "John 15:3-5",
    "Romans 5:1-11", "Romans 6:1-11", "Romans 8:1-39", "1 Corinthians 15:3-11",
    "1 Corinthians 15:50-57", "2 Corinthians 1:3-5", "2 Corinthians 4:5-7", "Galatians 5:1-6",
    "Ephesians 2:1-10", "Philippians 2:1-11", "Colossians 1:15-20", "Colossians 2:6-14",
    "2 Thessalonians 2:16-17", "1 Timothy 1:15-17", "Hebrews 10:19-23", "Hebrews 12:1-5",
    "Hebrews 13:20-21", "James 1:2-5", "James 4:13-14", "James 5:13-16", "1 Peter 4:12-14",
    "1 John 1:5-9", "1 John 4:9-19", "Jude 1:24-25", "Revelation 21:1-6"
];

// --- Auth / ownership guards ---
// Every action below is reachable by any client, so each must (a) require a session
// and (b) verify the target student/verse/folder belongs to the caller's organization.

async function requireCaller() {
    const { userId, organizationId } = await getCurrentUserOrg(); // throws if unauthenticated
    if (!organizationId) throw new Error("No organization found");
    return { userId, organizationId };
}

async function assertStudentInOrg(studentId: string, organizationId: string, userId: string) {
    const s = await withTenant(
        (tx) => tx.learner.findUnique({ where: { id: studentId }, select: { organizationId: true } }),
        undefined,
        { organizationId, userId },
    );
    if (!s || s.organizationId !== organizationId) throw new Error("Unauthorized");
}

// A verse is the caller's if its student is in the caller's org, or it is the caller's own user verse.
async function assertVerseAccess(verseId: string, organizationId: string, userId: string) {
    const v = await withTenant(
        (tx) => tx.bibleMemory.findUnique({
            where: { id: verseId },
            select: { userId: true, student: { select: { organizationId: true } } },
        }),
        undefined,
        { organizationId, userId },
    );
    if (!v || (v.student?.organizationId !== organizationId && v.userId !== userId)) {
        throw new Error("Unauthorized");
    }
}

async function assertFolderInOrg(folderId: string, organizationId: string, userId: string) {
    const f = await withTenant(
        (tx) => tx.bibleMemoryFolder.findUnique({
            where: { id: folderId },
            select: { student: { select: { organizationId: true } } },
        }),
        undefined,
        { organizationId, userId },
    );
    if (!f || f.student.organizationId !== organizationId) throw new Error("Unauthorized");
}

// --- Helpers ---

/**
 * Ensure library verses exist in DB.
 * Lazy-load: We only check counts and seed if low/empty.
 */
async function ensureLibrarySeeded(organizationId: string, userId: string) {
    await withTenant(async (tx) => {
        const count = await tx.bibleMemory.count({ where: { isDefault: true } });
        if (count > 5) return; // Assume seeded

        const existing = await tx.bibleMemory.findMany({
            where: { isDefault: true, reference: { in: PRELOADED_VERSES } },
            select: { reference: true },
        });

        const existingRefs = new Set(existing.map(v => v.reference));

        const toCreate = PRELOADED_VERSES
            .filter(ref => !existingRefs.has(ref))
            .map(ref => ({
                reference: ref,
                isDefault: true,
                text: "" // Placeholder - will be fetched later
            }));

        if (toCreate.length > 0) {
            await tx.bibleMemory.createMany({
                data: toCreate,
                skipDuplicates: true
            });
        }
    }, undefined, { organizationId, userId });
}

// --- Actions ---

export async function getLibraryVerses() {
    const { organizationId, userId } = await requireCaller(); // global library, but still require a logged-in user
    await ensureLibrarySeeded(organizationId, userId);
    return withTenant(
        (tx) => tx.bibleMemory.findMany({
            where: { isDefault: true },
            orderBy: { reference: 'asc' }
        }),
        undefined,
        { organizationId, userId },
    );
}

export async function getUserVerses(studentId?: string) {
    if (!studentId) return [];
    const { organizationId, userId } = await requireCaller();
    await assertStudentInOrg(studentId, organizationId, userId);

    return withTenant(
        (tx) => tx.bibleMemory.findMany({
            where: { studentId, isDefault: false },
            orderBy: { createdAt: 'desc' }
        }),
        undefined,
        { organizationId, userId },
    );
}

export async function addVerseToUser(rawData: unknown) {
    try {
        const data = addVerseSchema.parse(rawData); // Q-20-006: shape/length + uuid validation
        const { organizationId, userId } = await requireCaller();
        await assertStudentInOrg(data.studentId, organizationId, userId);

        let text = data.text;
        if (!text) {
            // Q-20-003: getBibleText expects { reference } (Zod object), not a bare string — passing the
            // string threw (caught → empty text on add). Keep the try/catch so an ESV outage / bad reference
            // still creates the verse (PracticeMode lazy-backfills the text on first practice).
            try {
                text = await getBibleText({ reference: data.reference });
            } catch {
                text = "";
            }
        }

        const newVerse = await withTenant(
            (tx) => tx.bibleMemory.create({
                data: {
                    studentId: data.studentId,
                    reference: data.reference,
                    text: text,
                    isDefault: false,
                    currentStep: 0,
                    lastPracticedAt: new Date()
                }
            }),
            undefined,
            { organizationId, userId },
        );

        revalidatePath('/family-discipleship/bible-memory');
        return { success: true, verse: newVerse };
    } catch (e: unknown) {
        console.error("Failed to add verse error:", e);
        return { success: false, error: "Failed to add verse: " + (e instanceof Error ? e.message : String(e)) };
    }
}

export async function updateVerseProgress(verseId: string, stepCompleted: number) {
    try {
        const { organizationId, userId } = await requireCaller();
        await assertVerseAccess(verseId, organizationId, userId);

        const updateData: any = {
            currentStep: stepCompleted,
            lastPracticedAt: new Date()
        };
        if (stepCompleted >= 8) {
            updateData.masteredAt = new Date();
        }

        await withTenant(
            (tx) => tx.bibleMemory.update({ where: { id: verseId }, data: updateData }),
            undefined,
            { organizationId, userId },
        );

        revalidatePath('/family-discipleship/bible-memory');
        return { success: true };
    } catch (e) {
        console.error("Failed to update progress:", e);
        return { success: false, error: "Failed to update progress" };
    }
}

export async function deleteUserVerse(verseId: string) {
    try {
        const { organizationId, userId } = await requireCaller();
        await assertVerseAccess(verseId, organizationId, userId);

        await withTenant(
            (tx) => tx.bibleMemory.delete({ where: { id: verseId } }),
            undefined,
            { organizationId, userId },
        );
        revalidatePath('/family-discipleship/bible-memory');
        return { success: true };
    } catch (e) {
        return { success: false, error: "Failed to delete" };
    }
}

export async function updateVerseText(verseId: string, text: string) {
    try {
        const { organizationId, userId } = await requireCaller();
        await assertVerseAccess(verseId, organizationId, userId);

        await withTenant(
            (tx) => tx.bibleMemory.update({ where: { id: verseId }, data: { text } }),
            undefined,
            { organizationId, userId },
        );
        revalidatePath('/family-discipleship/bible-memory');
        return { success: true };
    } catch (e) {
        console.error("Failed to update verse text:", e);
        return { success: false, error: "Failed to update text" };
    }
}

// --- Folder Actions ---

export async function getStudentFolders(studentId: string) {
    if (!studentId) return [];
    const { organizationId, userId } = await requireCaller();
    await assertStudentInOrg(studentId, organizationId, userId);

    return withTenant(
        (tx) => tx.bibleMemoryFolder.findMany({
            where: { studentId },
            include: { _count: { select: { verses: true } } },
            orderBy: { name: 'asc' }
        }),
        undefined,
        { organizationId, userId },
    );
}

export async function createFolder(studentId: string, name: string) {
    try {
        createFolderSchema.parse({ studentId, name }); // Q-20-006: validate shape/length + uuid
        const { organizationId, userId } = await requireCaller();
        await assertStudentInOrg(studentId, organizationId, userId);

        const folder = await withTenant(
            (tx) => tx.bibleMemoryFolder.create({ data: { studentId, name } }),
            undefined,
            { organizationId, userId },
        );
        revalidatePath('/family-discipleship/bible-memory');
        return { success: true, folder };
    } catch (e) {
        return { success: false, error: "Failed to create folder" };
    }
}

export async function deleteFolder(folderId: string) {
    try {
        const { organizationId, userId } = await requireCaller();
        await assertFolderInOrg(folderId, organizationId, userId);

        await withTenant(
            (tx) => tx.bibleMemoryFolder.delete({ where: { id: folderId } }),
            undefined,
            { organizationId, userId },
        );
        revalidatePath('/family-discipleship/bible-memory');
        return { success: true };
    } catch (e) {
        return { success: false, error: "Failed to delete folder" };
    }
}

export async function renameFolder(folderId: string, name: string) {
    try {
        renameFolderSchema.parse({ folderId, name }); // Q-20-006: validate shape/length + uuid
        const { organizationId, userId } = await requireCaller();
        await assertFolderInOrg(folderId, organizationId, userId);

        await withTenant(
            (tx) => tx.bibleMemoryFolder.update({ where: { id: folderId }, data: { name } }),
            undefined,
            { organizationId, userId },
        );
        revalidatePath('/family-discipleship/bible-memory');
        return { success: true };
    } catch (e) {
        return { success: false, error: "Failed to rename folder" };
    }
}

export async function moveVerseToFolder(verseId: string, folderId: string | null) {
    try {
        moveVerseSchema.parse({ verseId, folderId }); // Q-20-006: validate uuid (folderId nullable)
        const { organizationId, userId } = await requireCaller();
        await assertVerseAccess(verseId, organizationId, userId);
        // Moving INTO a folder requires that folder to belong to the caller's org too.
        if (folderId) await assertFolderInOrg(folderId, organizationId, userId);

        await withTenant(
            (tx) => tx.bibleMemory.update({ where: { id: verseId }, data: { folderId } }),
            undefined,
            { organizationId, userId },
        );
        revalidatePath('/family-discipleship/bible-memory');
        return { success: true };
    } catch (e) {
        return { success: false, error: "Failed to move verse" };
    }
}

// (copyFolderToStudent removed 2026-06-22 — dead code, zero callers; surfaced during the Q-20-006
// wiring. Same dead-code class as Q-20-005.)

// --- Refresh & Restore Actions ---

export async function refreshVerse(verseId: string) {
    try {
        const { organizationId, userId } = await requireCaller();
        await assertVerseAccess(verseId, organizationId, userId);

        await withTenant(
            (tx) => tx.bibleMemory.update({
                where: { id: verseId },
                data: { lastRefreshedAt: new Date(), lastPracticedAt: new Date() }
            }),
            undefined,
            { organizationId, userId },
        );
        revalidatePath('/family-discipleship/bible-memory');
        return { success: true };
    } catch (e) {
        return { success: false, error: "Failed to refresh verse" };
    }
}

export async function resetVerseMastery(verseId: string) {
    try {
        const { organizationId, userId } = await requireCaller();
        await assertVerseAccess(verseId, organizationId, userId);

        await withTenant(
            (tx) => tx.bibleMemory.update({
                where: { id: verseId },
                data: {
                    masteredAt: null,
                    currentStep: 0,
                    lastPracticedAt: new Date(),
                    lastRefreshedAt: null
                }
            }),
            undefined,
            { organizationId, userId },
        );
        revalidatePath('/family-discipleship/bible-memory');
        return { success: true };
    } catch (e) {
        return { success: false, error: "Failed to reset mastery" };
    }
}
