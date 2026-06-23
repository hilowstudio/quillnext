import { z } from "zod";

// Bible Memory verse/folder action schemas — wired into the actions in
// src/app/family-discipleship/bible-memory/actions.ts (Q-20-006). ids are uuid (schema.prisma:
// Learner.id, BibleMemory.id, BibleMemoryFolder.id all @default(uuid())).

export const addVerseSchema = z.object({
    studentId: z.string().uuid("Invalid student ID format"),
    reference: z.string().min(1, "Reference is required").max(100, "Reference too long"),
    text: z.string().max(10000, "Text too long").optional(),
});

export const createFolderSchema = z.object({
    studentId: z.string().uuid("Invalid student ID format"),
    name: z.string().min(1, "Folder name is required").max(50, "Folder name too long"),
});

export const renameFolderSchema = z.object({
    folderId: z.string().uuid("Invalid folder ID format"),
    name: z.string().min(1, "Folder name is required").max(50, "Folder name too long"),
});

export const moveVerseSchema = z.object({
    verseId: z.string().uuid("Invalid verse ID format"),
    folderId: z.string().uuid("Invalid folder ID format").nullable(),
});
