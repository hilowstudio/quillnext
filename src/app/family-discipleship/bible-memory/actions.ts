'use server';

import { db } from "@/server/db";
import { revalidatePath } from "next/cache";
import { getBibleText } from "@/server/actions/bible-study";
import { getCurrentUserOrg } from "@/lib/auth-helpers";

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

async function assertStudentInOrg(studentId: string, organizationId: string) {
    const s = await db.student.findUnique({ where: { id: studentId }, select: { organizationId: true } });
    if (!s || s.organizationId !== organizationId) throw new Error("Unauthorized");
}

// A verse is the caller's if its student is in the caller's org, or it is the caller's own user verse.
async function assertVerseAccess(verseId: string, organizationId: string, userId: string) {
    const v = await db.bibleMemory.findUnique({
        where: { id: verseId },
        select: { userId: true, student: { select: { organizationId: true } } },
    });
    if (!v || (v.student?.organizationId !== organizationId && v.userId !== userId)) {
        throw new Error("Unauthorized");
    }
}

async function assertFolderInOrg(folderId: string, organizationId: string) {
    const f = await db.bibleMemoryFolder.findUnique({
        where: { id: folderId },
        select: { student: { select: { organizationId: true } } },
    });
    if (!f || f.student.organizationId !== organizationId) throw new Error("Unauthorized");
}

// --- Helpers ---

/**
 * Ensure library verses exist in DB.
 * Lazy-load: We only check counts and seed if low/empty.
 */
async function ensureLibrarySeeded() {
    const count = await db.bibleMemory.count({ where: { isDefault: true } });
    if (count > 5) return; // Assume seeded

    const existing = await db.bibleMemory.findMany({
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
        await db.bibleMemory.createMany({
            data: toCreate,
            skipDuplicates: true
        });
    }
}

// --- Actions ---

export async function getLibraryVerses() {
    await requireCaller(); // global library, but still require a logged-in user
    await ensureLibrarySeeded();
    return db.bibleMemory.findMany({
        where: { isDefault: true },
        orderBy: { reference: 'asc' }
    });
}

export async function getUserVerses(studentId?: string) {
    if (!studentId) return [];
    const { organizationId } = await requireCaller();
    await assertStudentInOrg(studentId, organizationId);

    return db.bibleMemory.findMany({
        where: { studentId, isDefault: false },
        orderBy: { createdAt: 'desc' }
    });
}

export async function addVerseToUser(data: { studentId: string, reference: string, text?: string }) {
    try {
        const { organizationId } = await requireCaller();
        await assertStudentInOrg(data.studentId, organizationId);

        let text = data.text;
        if (!text) {
            try {
                text = await getBibleText(data.reference);
            } catch {
                text = "";
            }
        }

        const newVerse = await db.bibleMemory.create({
            data: {
                studentId: data.studentId,
                reference: data.reference,
                text: text,
                isDefault: false,
                currentStep: 0,
                lastPracticedAt: new Date()
            }
        });

        revalidatePath('/family-discipleship/bible-memory');
        return { success: true, verse: newVerse };
    } catch (e: any) {
        console.error("Failed to add verse error:", e);
        return { success: false, error: "Failed to add verse: " + e.message };
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

        await db.bibleMemory.update({ where: { id: verseId }, data: updateData });

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

        await db.bibleMemory.delete({ where: { id: verseId } });
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

        await db.bibleMemory.update({ where: { id: verseId }, data: { text } });
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
    const { organizationId } = await requireCaller();
    await assertStudentInOrg(studentId, organizationId);

    return db.bibleMemoryFolder.findMany({
        where: { studentId },
        include: { _count: { select: { verses: true } } },
        orderBy: { name: 'asc' }
    });
}

export async function createFolder(studentId: string, name: string) {
    if (!studentId || !name) return { success: false, error: "Missing required fields" };
    try {
        const { organizationId } = await requireCaller();
        await assertStudentInOrg(studentId, organizationId);

        const folder = await db.bibleMemoryFolder.create({ data: { studentId, name } });
        revalidatePath('/family-discipleship/bible-memory');
        return { success: true, folder };
    } catch (e) {
        return { success: false, error: "Failed to create folder" };
    }
}

export async function deleteFolder(folderId: string) {
    try {
        const { organizationId } = await requireCaller();
        await assertFolderInOrg(folderId, organizationId);

        await db.bibleMemoryFolder.delete({ where: { id: folderId } });
        revalidatePath('/family-discipleship/bible-memory');
        return { success: true };
    } catch (e) {
        return { success: false, error: "Failed to delete folder" };
    }
}

export async function renameFolder(folderId: string, name: string) {
    try {
        const { organizationId } = await requireCaller();
        await assertFolderInOrg(folderId, organizationId);

        await db.bibleMemoryFolder.update({ where: { id: folderId }, data: { name } });
        revalidatePath('/family-discipleship/bible-memory');
        return { success: true };
    } catch (e) {
        return { success: false, error: "Failed to rename folder" };
    }
}

export async function moveVerseToFolder(verseId: string, folderId: string | null) {
    try {
        const { organizationId, userId } = await requireCaller();
        await assertVerseAccess(verseId, organizationId, userId);
        // Moving INTO a folder requires that folder to belong to the caller's org too.
        if (folderId) await assertFolderInOrg(folderId, organizationId);

        await db.bibleMemory.update({ where: { id: verseId }, data: { folderId } });
        revalidatePath('/family-discipleship/bible-memory');
        return { success: true };
    } catch (e) {
        return { success: false, error: "Failed to move verse" };
    }
}

export async function copyFolderToStudent(folderId: string, targetStudentId: string) {
    try {
        const { organizationId } = await requireCaller();
        // Both the source folder and the destination student must be in the caller's org.
        await assertFolderInOrg(folderId, organizationId);
        await assertStudentInOrg(targetStudentId, organizationId);

        const sourceFolder = await db.bibleMemoryFolder.findUnique({
            where: { id: folderId },
            include: { verses: true }
        });
        if (!sourceFolder) return { success: false, error: "Folder not found" };

        const newFolder = await db.bibleMemoryFolder.create({
            data: { studentId: targetStudentId, name: sourceFolder.name }
        });

        const versesToCreate = sourceFolder.verses.map((v: any) => ({
            studentId: targetStudentId,
            folderId: newFolder.id,
            reference: v.reference,
            text: v.text,
            isDefault: false,
            currentStep: 0
        }));

        if (versesToCreate.length > 0) {
            await db.bibleMemory.createMany({ data: versesToCreate });
        }

        revalidatePath('/family-discipleship/bible-memory');
        return { success: true };
    } catch (e) {
        console.error(e);
        return { success: false, error: "Failed to copy folder" };
    }
}

// --- Refresh & Restore Actions ---

export async function refreshVerse(verseId: string) {
    try {
        const { organizationId, userId } = await requireCaller();
        await assertVerseAccess(verseId, organizationId, userId);

        await db.bibleMemory.update({
            where: { id: verseId },
            data: { lastRefreshedAt: new Date(), lastPracticedAt: new Date() }
        });
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

        await db.bibleMemory.update({
            where: { id: verseId },
            data: {
                masteredAt: null,
                currentStep: 0,
                lastPracticedAt: new Date(),
                lastRefreshedAt: null
            }
        });
        revalidatePath('/family-discipleship/bible-memory');
        return { success: true };
    } catch (e) {
        return { success: false, error: "Failed to reset mastery" };
    }
}
