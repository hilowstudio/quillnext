'use server';

import { auth } from "@/auth";
import { db, withTenant } from "@/server/db";
import { getCurrentUserOrg } from "@/lib/auth-helpers";
import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/client";
import { createPrayerJournalSchema } from "@/lib/schemas/actions";
import { z } from "zod";

export type PrayerEntryInput = {
    title: string;
    content: string;
    date: Date;
    tags: string[];
    isPrivate: boolean;
    category?: string | null; // Allow null for optional fields
    studentId?: string;
    answerNotes?: string | null;
    answeredAt?: Date | null;
};

// Define a type that matches the Prisma return type but is safe for client consumption
export type PrayerEntry = {
    id: string;
    userId: string;
    studentId: string | null;
    title: string;
    content: string;
    date: Date;
    tags: string[];
    isPrivate: boolean;
    type: string;
    category: string | null;
    status: string;
    answeredAt: Date | null;
    answerNotes: string | null;
    createdAt: Date;
    updatedAt: Date;
    student?: {
        firstName: string;
        lastName: string | null;
    } | null;
};

export async function getPrayerEntries(studentId?: string): Promise<PrayerEntry[]> {
    const session = await auth();
    if (!session?.user?.id) return [];
    const { userId, organizationId } = await getCurrentUserOrg(session);

    const where: Prisma.PrayerJournalEntryWhereInput = {
        userId: session.user.id,
        ...(studentId ? { studentId } : {}),
    };

    const entries = await withTenant(
        (tx) => tx.prayerJournalEntry.findMany({
            where,
            orderBy: { date: 'desc' },
            include: {
                student: {
                    select: {
                        firstName: true,
                        lastName: true,
                    }
                }
            }
        }),
        undefined,
        { organizationId, userId }
    );

    return entries;
}

export async function createPrayerEntry(rawData: unknown) {
    // Validate input
    const data = createPrayerJournalSchema.parse(rawData);

    const session = await auth();
    if (!session?.user?.id) throw new Error("Not authenticated");
    const { userId, organizationId } = await getCurrentUserOrg(session);

    const created = await withTenant(
        (tx) => tx.prayerJournalEntry.create({
            data: {
                userId,
                studentId: data.studentId,
                title: data.title,
                content: data.content,
                date: new Date(), // Use current date
                tags: [], // Default empty
                isPrivate: false, // Default
                category: data.prayerType,
                // Defaults
                type: 'entry',
                status: 'ongoing',
            },
            include: {
                student: {
                    select: {
                        firstName: true,
                        lastName: true,
                    }
                }
            }
        }),
        undefined,
        { organizationId, userId }
    );

    revalidatePath('/family-discipleship/prayer');

    return created;
}

const updatePrayerSchema = z.object({
    id: z.string().uuid(),
    title: z.string().min(1).max(200),
    content: z.string().max(10000),
    answerNotes: z.string().max(2000).optional().nullable(),
    answeredAt: z.string().or(z.date()).optional().nullable(),
});

export async function updatePrayerEntry(rawData: unknown) {
    const data = updatePrayerSchema.parse(rawData);

    const session = await auth();
    if (!session?.user?.id) throw new Error("Not authenticated");
    const { userId, organizationId } = await getCurrentUserOrg(session);

    await withTenant(
        async (tx) => {
            // Verify ownership
            const existing = await tx.prayerJournalEntry.findUnique({
                where: { id: data.id },
            });

            if (!existing) {
                throw new Error("Prayer entry not found");
            }

            if (existing.userId !== userId) {
                throw new Error("Unauthorized - entry belongs to different user");
            }

            await tx.prayerJournalEntry.update({
                where: { id: data.id },
                data: {
                    title: data.title,
                    content: data.content,
                    answerNotes: data.answerNotes,
                    answeredAt: data.answeredAt ? new Date(data.answeredAt) : null,
                    status: data.answeredAt ? 'answered' : 'ongoing',
                },
            });
        },
        undefined,
        { organizationId, userId }
    );

    revalidatePath('/family-discipleship/prayer');
}

const deletePrayerSchema = z.object({
    id: z.string().uuid(),
});

export async function deletePrayerEntry(rawData: unknown) {
    const data = deletePrayerSchema.parse(rawData);

    const session = await auth();
    if (!session?.user?.id) throw new Error("Not authenticated");
    const { userId, organizationId } = await getCurrentUserOrg(session);

    await withTenant(
        async (tx) => {
            // Verify ownership
            const existing = await tx.prayerJournalEntry.findUnique({
                where: { id: data.id },
            });

            if (!existing) {
                throw new Error("Prayer entry not found");
            }

            if (existing.userId !== userId) {
                throw new Error("Unauthorized - entry belongs to different user");
            }

            await tx.prayerJournalEntry.delete({
                where: { id: data.id },
            });
        },
        undefined,
        { organizationId, userId }
    );

    revalidatePath('/family-discipleship/prayer');
}

export async function togglePrayerAnswered(id: string, date?: Date) {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");
    const { userId, organizationId } = await getCurrentUserOrg(session);

    await withTenant(
        async (tx) => {
            const existing = await tx.prayerJournalEntry.findUnique({
                where: { id },
            });

            if (!existing || existing.userId !== userId) {
                throw new Error("Unauthorized or not found");
            }

            const isAnswered = !!existing.answeredAt;

            await tx.prayerJournalEntry.update({
                where: { id },
                data: {
                    answeredAt: isAnswered ? null : (date || new Date()),
                    status: isAnswered ? 'ongoing' : 'answered',
                },
            });
        },
        undefined,
        { organizationId, userId }
    );

    revalidatePath('/family-discipleship/prayer');
}

export async function getPrayerCategories() {
    // Q-20-001: PrayerCategory is global reference content, but require a session (defense-in-depth;
    // the prayer page already gates, so this is a self-gating backstop).
    const session = await auth();
    if (!session?.user) throw new Error("Unauthorized");
    // In the future this could fetch from DB if we allow custom categories
    // For now we can return static or fetch from the PrayerCategory model if populated
    const categories = await db.prayerCategory.findMany({
        orderBy: { name: 'asc' }
    });
    return categories;
}
