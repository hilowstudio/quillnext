import { revalidateTag } from "next/cache";
import { inngest } from "@/inngest/client";
import { getStorageBucket } from "@/lib/firebase-admin";
import { withTenant } from "@/server/db";
import PDFParser from "pdf2json";

// Helper to parse PDF buffer
async function parsePdfBuffer(buffer: Buffer): Promise<string> {
    return new Promise((resolve, reject) => {
        const pdfParser = new PDFParser(null, true); // needRawText: text-only output

        pdfParser.on("pdfParser_dataError", (errData) => {
            reject(errData instanceof Error ? errData : new Error(String(errData.parserError)));
        });

        pdfParser.on("pdfParser_dataReady", (pdfData) => {
            try {
                const text = pdfParser.getRawTextContent();
                resolve(text);
            } catch (e) {
                resolve("");
            }
        });

        pdfParser.parseBuffer(buffer);
    });
}

export const processDocument = inngest.createFunction(
    {
        id: "process-document",
        retries: 2,
        // Q-23-003: a genuine extraction failure marks the document FAILED so it isn't left
        // silently blank with no signal (mirrors extract-book/extract-video). DocumentResource is
        // org-scoped, so the tenant must be stamped explicitly (ALS doesn't reach Prisma here).
        onFailure: async ({ event }) => {
            const orig = event.data?.event?.data;
            const resourceId = orig?.resourceId;
            const organizationId = orig?.organizationId;
            if (!resourceId || !organizationId) return;
            await withTenant(
                (tx) =>
                    tx.documentResource.update({
                        where: { id: resourceId },
                        data: { extractionStatus: "FAILED" },
                    }),
                undefined,
                { organizationId, userId: null },
            ).catch((e) =>
                console.error("[process-document onFailure] failed to mark DocumentResource FAILED", e),
            );
        },
    },
    { event: "resource/process.document" },
    async ({ event, step }) => {
        const { resourceId, fileUrl, fileType, organizationId } = event.data;
        // Background worker has no request — AsyncLocalStorage does NOT reach the Prisma
        // layer here, so the tenant must be threaded EXPLICITLY into withTenant for every
        // org-scoped db op (see update-db step). DocumentResource is org-scoped, not
        // user-scoped, so { organizationId, userId: null } is correct.

        // 1. Download file from Firebase Storage. The producer (resource-library-actions
        // uploadDocument) always passes the Storage object PATH in `fileUrl`, so download it
        // via the Admin SDK bucket.
        const base64File = await step.run("download-file", async (): Promise<string> => {
            const bucket = await getStorageBucket();
            const file = bucket.file(fileUrl);
            const [downloadedBuffer] = await file.download();
            return downloadedBuffer.toString("base64");
        });

        // 2. Extract Text
        const extractedText = await step.run("extract-text", async (): Promise<string> => {
            const buffer = Buffer.from(base64File, "base64");

            if (fileType === "application/pdf") {
                return parsePdfBuffer(buffer);
            }
            // Text/Markdown
            return buffer.toString("utf-8");
        });

        // 3. Update Database
        await step.run("update-db", async () => {
            // Both the read and the write target the org-scoped DocumentResource table, so
            // they run inside ONE withTenant tx with the event's organizationId stamped on
            // the connection (ALS doesn't propagate into Prisma in the Inngest runtime).
            const doc = await withTenant(
                async (tx) => {
                    // Fetch the doc first to get the orgId for the cache tag
                    const found = await tx.documentResource.findUnique({
                        where: { id: resourceId },
                        select: { organizationId: true }
                    });

                    if (!found) throw new Error("Document not found");

                    await tx.documentResource.update({
                        where: { id: resourceId },
                        data: {
                            extractedText: extractedText,
                            extractionStatus: "EXTRACTED",
                        },
                    });

                    return found;
                },
                undefined,
                { organizationId, userId: null },
            );

            // Invalidate the library list so the user sees the new text/status
            revalidateTag(`library-${doc.organizationId}`, {});
        });

        return { success: true, resourceId };
    }
);
