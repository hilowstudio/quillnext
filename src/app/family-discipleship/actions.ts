
'use server'

import { auth } from "@/auth";
import { db } from "@/server/db";
import { revalidatePath } from "next/cache";

// NOTE (2026-06-22, Q-20-004): the legacy createPrayerRequest / togglePrayerAnswered /
// deletePrayerRequest / addMemoryVerse / deleteMemoryVerse exports were removed — they were dead
// (zero importers), used raw `db` (no withTenant), and duplicated the live prayer-journal.ts /
// bible-memory actions. The legacy togglePrayerAnswered also collided by name with the LIVE one in
// prayer-journal.ts (which is what PrayerJournalClient actually imports). Only the church-note
// actions below are wired (ChurchNotesClient).

export async function addChurchNote(formData: FormData) {
    const session = await auth();
    if (!session?.user?.id) {
        throw new Error("Unauthorized");
    }

    const dateStr = formData.get("date") as string;
    const preacher = formData.get("preacher") as string;
    const passage = formData.get("passage") as string;
    const notes = formData.get("notes") as string; // Applications

    // New fields
    const keyReferences = formData.get("keyReferences") as string;
    const oneThing = formData.get("oneThing") as string;
    const servingIdeas = formData.get("servingIdeas") as string;
    const generosityReflection = formData.get("generosityReflection") as string;
    const communityPlan = formData.get("communityPlan") as string;

    // JSON fields
    const mainPointsRaw = formData.get("mainPoints") as string;
    const songsRaw = formData.get("songs") as string;

    const mainPoints = mainPointsRaw ? JSON.parse(mainPointsRaw) : [];
    const songs = songsRaw ? JSON.parse(songsRaw) : [];

    if (!dateStr) {
        throw new Error("Date is required");
    }

    await db.localChurchNotes.create({
        data: {
            userId: session.user.id,
            date: new Date(dateStr),
            preacher,
            mainPassage: passage,
            applications: notes,
            keyReferences,
            oneThing,
            servingIdeas,
            generosityReflection,
            communityPlan,
            mainPoints,
            songs
        },
    });

    revalidatePath("/family-discipleship/church");
}

export async function deleteChurchNote(id: string) {
    const session = await auth();
    if (!session?.user?.id) {
        throw new Error("Unauthorized");
    }

    const note = await db.localChurchNotes.findUnique({
        where: { id },
    });

    if (!note || note.userId !== session.user.id) {
        throw new Error("Unauthorized or not found");
    }

    await db.localChurchNotes.delete({
        where: { id },
    });

    revalidatePath("/family-discipleship/church");
}
