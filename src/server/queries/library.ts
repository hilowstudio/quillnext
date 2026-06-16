import "server-only";
import { db, withTenant } from "@/server/db";


export async function getLibraryVideos(organizationId: string) {
    const videos = await withTenant((tx) => tx.videoResource.findMany({
        where: { organizationId },
        select: {
            id: true,
            youtubeUrl: true,
            youtubeVideoId: true,
            title: true,
            description: true,
            thumbnailUrl: true,
            durationSeconds: true,
            channelName: true,
            extractionStatus: true,
            extractedSummary: true,
            subject: {
                select: {
                    name: true,
                },
            },
            strand: {
                select: {
                    name: true,
                },
            },
        },
        orderBy: { createdAt: "desc" },
        take: 100, // Explicit bound - pagination can be added later if needed
    }), undefined, { organizationId, userId: null });

    return videos;
}

export async function getLibrarySubjects() {
    const subjects = await db.subject.findMany({
        select: {
            id: true,
            name: true,
            code: true,
        },
        orderBy: { name: "asc" },

    });
    return subjects;
}
