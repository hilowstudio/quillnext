"use server";

import { db as dbInstance } from "@/server/db";
import { auth } from "@/auth";
import { getCurrentUserOrg } from "@/lib/auth-helpers";
import { revalidatePath, revalidateTag, unstable_cache } from "next/cache";
import { z } from "zod";
import * as cheerio from "cheerio";

// Prisma client instance
const prisma = dbInstance;
// Helper removed - processing moved to Inngest worker

export async function getLibraryResources(organizationId: string) {
    const getCached = unstable_cache(
        async () => {
            // Removed defensive try/catch - let database errors surface explicitly
            // Converted include to select for precise field selection
            const [books, videos, articles, documents, courses, resources, bundles] = await Promise.all([
                prisma.book.findMany({
                    where: { organizationId },
                    include: {
                        subject: {
                            select: {
                                id: true,
                                name: true,
                                code: true,
                            },
                        },
                    },
                    orderBy: { createdAt: "desc" },
                    take: 100, // Explicit bound
                }),
                prisma.videoResource.findMany({
                    where: { organizationId },
                    // Fetch full object
                    orderBy: { createdAt: "desc" },
                    take: 100, // Explicit bound
                }),
                prisma.article.findMany({
                    where: { organizationId },
                    include: {
                        subject: {
                            select: {
                                id: true,
                                name: true,
                            },
                        },
                        strand: {
                            select: {
                                id: true,
                                name: true,
                            },
                        },
                    },
                    orderBy: { createdAt: "desc" },
                    take: 100, // Explicit bound
                }),
                prisma.documentResource.findMany({
                    where: { organizationId },
                    include: {
                        subject: {
                            select: {
                                id: true,
                                name: true,
                            },
                        },
                        strand: {
                            select: {
                                id: true,
                                name: true,
                            },
                        },
                    },
                    orderBy: { createdAt: "desc" },
                    take: 100, // Explicit bound
                }),
                prisma.course.findMany({
                    where: { organizationId },
                    select: { id: true, title: true, subjectId: true, strandId: true },
                    orderBy: { createdAt: "desc" },
                    take: 100, // Explicit bound
                }),
                prisma.resource.findMany({
                    where: { organizationId },
                    select: {
                        id: true,
                        title: true,
                        resourceKind: {
                            select: {
                                label: true,
                                code: true,
                            }
                        },
                        createdAt: true,
                    },
                    orderBy: { createdAt: "desc" },
                    take: 100,
                }),
                prisma.curriculumBundle.findMany({
                    where: { spec: { organizationId } },
                    include: { spec: true },
                    orderBy: { createdAt: "desc" },
                    take: 20,
                })
            ]);

            return { success: true, books, videos, articles, documents, courses, resources, bundles };
        },
        [`library-${organizationId}`],
        {
            tags: [`library-${organizationId}`],
            revalidate: 3600 // 1 hour
        }
    );

    return getCached();
}

export async function addArticle(url: string, organizationId: string, userId: string): Promise<{ success: boolean; error?: string; article?: any }> {
    try {
        // Simple scraping logic
        const response = await fetch(url);
        if (!response.ok) {
            return { success: false, error: "Failed to fetch URL" };
        }
        const html = await response.text();
        const $ = cheerio.load(html);

        const title = $('head > title').text() || $('h1').first().text() || "Untitled Article";
        const description = $('meta[name="description"]').attr('content') || "";
        const imageUrl = $('meta[property="og:image"]').attr('content') || "";

        // Basic content extraction - getting text from paragraphs
        const content = $('video, script, style, nav, footer, header').remove().end().find('p').map((i: number, el: any) => $(el).text()).get().join('\n\n');

        const article = await prisma.article.create({
            data: {
                organizationId,
                addedByUserId: userId,
                url,
                title,
                description: description.substring(0, 500), // Limit description length
                imageUrl: imageUrl ? imageUrl : null,
                content: content || "",
                extractionStatus: "EXTRACTED", // Basic extraction done
                extractedAt: new Date(),
            }
        });

        revalidateTag(`library-${organizationId}`, {});
        return { success: true, article };

    } catch (error) {
        console.error("Error adding article:", error);
        return { success: false, error: "Failed to add article" };
    }
}

export async function addDocuments(formData: FormData, organizationId: string, userId: string): Promise<{ success: boolean; documents?: any[]; errors?: string[] }> {
    try {
        const files = formData.getAll("files") as File[];
        if (!files || files.length === 0) {
            return { success: false, errors: ["No files provided"] };
        }

        const documents = [];
        const errors = [];
        // Dynamic import to avoid edge/server issues if needed, or just standard import
        const { getStorageBucket } = await import("@/lib/firebase-admin");
        const { inngest } = await import("@/inngest/client");
        const bucket = await getStorageBucket();

        for (const file of files) {
            try {
                const buffer = Buffer.from(await file.arrayBuffer());
                const uniqueFilename = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.]/g, "_")}`;
                const storagePath = `documents/${organizationId}/${uniqueFilename}`;
                const fileRef = bucket.file(storagePath);

                // 1. Upload to Firebase
                await fileRef.save(buffer, {
                    metadata: {
                        contentType: file.type,
                    }
                });

                // 2. Create DB Record (Initial State)
                const doc = await prisma.documentResource.create({
                    data: {
                        organizationId,
                        addedByUserId: userId,
                        fileName: file.name,
                        fileType: file.type || "unknown",
                        fileSize: file.size,
                        extractedText: "", // Will be populated by worker
                    }
                });

                // 3. Dispatch Background Job
                await inngest.send({
                    name: "resource/process.document",
                    data: {
                        resourceId: doc.id,
                        fileUrl: storagePath, // Passing the storage path
                        fileType: file.type,
                    }
                });

                documents.push(doc);
            } catch (err) {
                console.error(`Error processing file ${file.name}:`, err);
                errors.push(`Failed to process ${file.name}`);
            }
        }

        if (documents.length === 0 && errors.length > 0) {
            return { success: false, errors };
        }

        revalidateTag(`library-${organizationId}`, {});
        return { success: true, documents, errors: errors.length > 0 ? errors : undefined };

    } catch (error) {
        console.error("Error adding documents:", error);
        return { success: false, errors: ["Failed to add documents"] };
    }
}

const deleteResourceSchema = z.object({
    id: z.string().uuid(),
});

export async function deleteBook(rawData: unknown) {
    const data = deleteResourceSchema.parse(rawData);
    return deleteResource(data.id, "book");
}

export async function deleteVideo(rawData: unknown) {
    const data = deleteResourceSchema.parse(rawData);
    return deleteResource(data.id, "videoResource");
}

export async function deleteArticle(rawData: unknown) {
    const data = deleteResourceSchema.parse(rawData);
    return deleteResource(data.id, "article");
}

export async function deleteDocument(rawData: unknown) {
    const data = deleteResourceSchema.parse(rawData);
    return deleteResource(data.id, "documentResource");
}


export async function deleteGeneratedResource(rawData: unknown) {
    const data = deleteResourceSchema.parse(rawData);
    return deleteResource(data.id, "resource");
}

async function deleteResource(id: string, model: "book" | "videoResource" | "article" | "documentResource" | "resource") {
    const curSession = await auth();
    if (!curSession?.user) {
        throw new Error("Unauthorized");
    }

    const { organizationId } = await getCurrentUserOrg();

    // Removed defensive try/catch - authorization and delete errors should surface explicitly
    // @ts-ignore - dynamic model access
    const resource = await prisma[model].findUnique({
        where: { id },
    });

    if (!resource) {
        throw new Error(`${model} not found`);
    }

    if (resource.organizationId !== organizationId) {
        throw new Error("Unauthorized - resource belongs to different organization");
    }

    // @ts-ignore
    await prisma[model].delete({
        where: { id },
    });

    revalidateTag(`library-${organizationId}`, {});
    revalidatePath("/living-library");
    revalidatePath("/resources");
    return { success: true };
}
