"use server";

import { withTenant } from "@/server/db";
import { auth } from "@/auth";
import { getCurrentUserOrg } from "@/lib/auth-helpers";
import { assertParentProfile } from "@/server/profiles/guards";
import { revalidatePath, revalidateTag, unstable_cache } from "next/cache";
import { z } from "zod";
import * as cheerio from "cheerio";

// Helper removed - processing moved to Inngest worker

export async function getLibraryResources(organizationId: string) {
    const getCached = unstable_cache(
        async () => {
            // Removed defensive try/catch - let database errors surface explicitly
            // Converted include to select for precise field selection
            // RLS: all 7 org-scoped reads share ONE tenant-stamped tx so they
            // resolve against app.current_org under the non-bypass app_user role.
            const [books, videos, articles, documents, courses, resources, bundles] = await withTenant(
                (tx) => Promise.all([
                    tx.book.findMany({
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
                    tx.videoResource.findMany({
                        where: { organizationId },
                        // Fetch full object
                        orderBy: { createdAt: "desc" },
                        take: 100, // Explicit bound
                    }),
                    tx.article.findMany({
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
                    tx.documentResource.findMany({
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
                    tx.course.findMany({
                        where: { organizationId },
                        select: { id: true, title: true, subjectId: true, strandId: true },
                        orderBy: { createdAt: "desc" },
                        take: 100, // Explicit bound
                    }),
                    tx.resource.findMany({
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
                    tx.curriculumBundle.findMany({
                        where: { spec: { organizationId } },
                        include: { spec: true },
                        orderBy: { createdAt: "desc" },
                        take: 20,
                    })
                ]),
                undefined,
                { organizationId, userId: null }
            );

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

export async function addArticle(url: string) {
    // Derive tenancy + enforce the parent gate SERVER-SIDE — never trust client-supplied
    // organizationId/userId (the action is directly invokable, outside the proxy/page gate).
    const session = await auth();
    if (!session?.user) {
        return { success: false, error: "Unauthorized" };
    }
    try {
        await assertParentProfile();
    } catch {
        return { success: false, error: "Only a parent profile can add resources." };
    }
    const { organizationId, userId } = await getCurrentUserOrg();
    if (!organizationId) {
        return { success: false, error: "User has no organization" };
    }

    // (1) Validate the URL before doing any network work. Only http/https are scrapeable.
    let parsedUrl: URL;
    try {
        parsedUrl = new URL(url);
    } catch {
        return { success: false, error: "That doesn't look like a valid URL. Please include the full address, e.g. https://example.com/article." };
    }
    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
        return { success: false, error: "Only http and https web links can be imported." };
    }

    try {
        // (2) Fetch with a real browser User-Agent + Accept header so bot-protected
        // sites are less likely to block us, follow redirects, and bound the request
        // with a 15s timeout so a hung server can't stall the action indefinitely.
        const response = await fetch(parsedUrl.toString(), {
            redirect: "follow",
            signal: AbortSignal.timeout(15000),
            headers: {
                "User-Agent":
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
                "Accept":
                    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.9",
            },
        });

        // (3) Map non-OK statuses to a human-readable reason instead of an opaque "Failed to fetch URL".
        if (!response.ok) {
            let reason: string;
            switch (response.status) {
                case 401:
                case 403:
                    reason = "the site blocked our request (it may require signing in or is bot-protected)";
                    break;
                case 451:
                    reason = "the content is unavailable for legal reasons";
                    break;
                case 402:
                    reason = "the article is behind a paywall";
                    break;
                case 404:
                case 410:
                    reason = "the page could not be found (it may have been moved or removed)";
                    break;
                case 429:
                    reason = "the site is rate-limiting requests, please try again in a little while";
                    break;
                case 500:
                case 502:
                case 503:
                case 504:
                    reason = "the site is temporarily unavailable, please try again later";
                    break;
                default:
                    reason = `the site returned an error (HTTP ${response.status})`;
            }
            return { success: false, error: `Couldn't import this article because ${reason}.` };
        }

        // (4) Only HTML pages can be scraped for article text.
        const contentType = response.headers.get("content-type") || "";
        if (!contentType.includes("text/html") && !contentType.includes("application/xhtml")) {
            return {
                success: false,
                error: "That link doesn't point to a readable web page (it looks like a file or other content, not an article).",
            };
        }

        const html = await response.text();
        const $ = cheerio.load(html);

        const title = $('head > title').text().trim() || $('h1').first().text().trim() || "Untitled Article";
        const description = $('meta[name="description"]').attr('content') || "";
        const imageUrl = $('meta[property="og:image"]').attr('content') || "";

        // Basic content extraction - getting text from paragraphs
        const content = $('video, script, style, nav, footer, header').remove().end().find('p').map((i: number, el) => $(el).text()).get().join('\n\n');

        // (5) Guard against silently "accepting" empty / paywalled / JS-rendered pages.
        // If we couldn't pull a meaningful amount of readable text, don't store it as EXTRACTED.
        const cleanedContent = content.trim();
        if (cleanedContent.length < 200) {
            return {
                success: false,
                error: "We couldn't find readable article text on that page. It may be behind a paywall, require signing in, or render its content with JavaScript.",
            };
        }

        const article = await withTenant(
            (tx) => tx.article.create({
                data: {
                    organizationId,
                    addedByUserId: userId,
                    url: parsedUrl.toString(),
                    title,
                    description: description.substring(0, 500), // Limit description length
                    imageUrl: imageUrl ? imageUrl : null,
                    content: cleanedContent,
                    extractionStatus: "EXTRACTED", // Basic extraction done
                    extractedAt: new Date(),
                },
                // include subject/strand so the returned article matches the library list item shape
                // (LibraryArticle) for the client's optimistic prepend; both are null until classified.
                include: { subject: { select: { id: true, name: true } }, strand: { select: { id: true, name: true } } },
            }),
            undefined,
            { organizationId, userId: null }
        );

        revalidateTag(`library-${organizationId}`, {});
        return { success: true, article };

    } catch (error) {
        console.error("Error adding article:", error);
        // (6) Distinguish a timeout from a network/DNS failure so the user knows what to try next.
        if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
            return { success: false, error: "The site took too long to respond. Please try again, or check that the link is correct." };
        }
        if (error instanceof TypeError) {
            // fetch throws a TypeError for DNS / connection / TLS-level failures.
            return { success: false, error: "We couldn't reach that website. Please check the URL and your connection, then try again." };
        }
        return { success: false, error: "Something went wrong while importing the article. Please try again." };
    }
}

export async function addDocuments(formData: FormData) {
    // Derive tenancy + enforce the parent gate SERVER-SIDE — never trust client-supplied
    // organizationId/userId (the action is directly invokable, outside the proxy/page gate).
    const session = await auth();
    if (!session?.user) {
        return { success: false, errors: ["Unauthorized"] };
    }
    try {
        await assertParentProfile();
    } catch {
        return { success: false, errors: ["Only a parent profile can add resources."] };
    }
    const { organizationId, userId } = await getCurrentUserOrg();
    if (!organizationId) {
        return { success: false, errors: ["User has no organization"] };
    }

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
                const doc = await withTenant(
                    (tx) => tx.documentResource.create({
                        data: {
                            organizationId,
                            addedByUserId: userId,
                            fileName: file.name,
                            fileType: file.type || "unknown",
                            fileSize: file.size,
                            extractedText: "", // Will be populated by worker
                        },
                        // include subject/strand so the returned doc matches the library list item
                        // shape (LibraryDocument) for the client's optimistic prepend (both null here).
                        include: { subject: { select: { id: true, name: true } }, strand: { select: { id: true, name: true } } },
                    }),
                    undefined,
                    { organizationId, userId: null }
                );

                // 3. Dispatch Background Job
                await inngest.send({
                    name: "resource/process.document",
                    data: {
                        resourceId: doc.id,
                        fileUrl: storagePath, // Passing the storage path
                        fileType: file.type,
                        organizationId, // RLS tenant context for the background worker
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

    await assertParentProfile();

    const { organizationId } = await getCurrentUserOrg();

    // Typed per-model access (no dynamic tx[model] / @ts-ignore). All five models carry
    // organizationId, so we fetch just that for the ownership check, then delete.
    const resource = await withTenant(
        async (tx): Promise<{ organizationId: string } | null> => {
            switch (model) {
                case "book": return tx.book.findUnique({ where: { id }, select: { organizationId: true } });
                case "videoResource": return tx.videoResource.findUnique({ where: { id }, select: { organizationId: true } });
                case "article": return tx.article.findUnique({ where: { id }, select: { organizationId: true } });
                case "documentResource": return tx.documentResource.findUnique({ where: { id }, select: { organizationId: true } });
                case "resource": return tx.resource.findUnique({ where: { id }, select: { organizationId: true } });
                default: throw new Error(`Unknown model: ${model}`);
            }
        },
        undefined,
        { organizationId, userId: null }
    );

    if (!resource) {
        throw new Error(`${model} not found`);
    }

    if (resource.organizationId !== organizationId) {
        throw new Error("Unauthorized - resource belongs to different organization");
    }

    await withTenant(
        async (tx): Promise<void> => {
            switch (model) {
                case "book": await tx.book.delete({ where: { id } }); return;
                case "videoResource": await tx.videoResource.delete({ where: { id } }); return;
                case "article": await tx.article.delete({ where: { id } }); return;
                case "documentResource": await tx.documentResource.delete({ where: { id } }); return;
                case "resource": await tx.resource.delete({ where: { id } }); return;
                default: throw new Error(`Unknown model: ${model}`);
            }
        },
        undefined,
        { organizationId, userId: null }
    );

    revalidateTag(`library-${organizationId}`, {});
    revalidatePath("/living-library");
    return { success: true };
}
