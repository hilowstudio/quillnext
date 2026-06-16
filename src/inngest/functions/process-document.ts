import { revalidateTag } from "next/cache";
import { inngest } from "@/inngest/client";
import { getStorageBucket } from "@/lib/firebase-admin";
import { db } from "@/server/db";
import { setRlsContext } from "@/server/rls-context";
// @ts-ignore
import PDFParser from "pdf2json";

// Helper to parse PDF buffer
async function parsePdfBuffer(buffer: Buffer): Promise<string> {
    return new Promise((resolve, reject) => {
        // @ts-ignore
        const pdfParser = new PDFParser(null, 1); // 1 = text only

        pdfParser.on("pdfParser_dataError", (errData: any) => {
            reject(new Error(errData.parserError));
        });

        pdfParser.on("pdfParser_dataReady", (pdfData: any) => {
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
    { id: "process-document" },
    { event: "resource/process.document" },
    async ({ event, step }) => {
        const { resourceId, fileUrl, fileType, organizationId } = event.data;
        // Background worker has no request — establish RLS tenant context from the event.
        setRlsContext({ organizationId, userId: null });

        // 1. Download file from Firebase Storage
        const base64File = await step.run("download-file", async (): Promise<string> => {
            // fileUrl might be a public URL or a gs:// path.
            // For this implementation, we assume we passed the storage path (e.g. "documents/abc.pdf")
            // OR we just use the public URL to fetch it if it's signed.
            // OPTION A: Fetch via HTTP if signed URL
            // OPTION B: Use Admin SDK if we have the path.

            // Let's assume we pass the storage path in 'fileUrl' for internal processing, 
            // or we handle the download via fetch if it is a public http url.

            // If it is a firebase storage URL, we can use fetch.
            if (fileUrl.startsWith("http")) {
                const res = await fetch(fileUrl);
                if (!res.ok) throw new Error("Failed to fetch file");
                const arrayBuffer = await res.arrayBuffer();
                return Buffer.from(arrayBuffer).toString("base64");
            }

            // Fallback: assume it is a path info and we use admin sdk
            // But for simplicity in "Scale 3" refactor, let's assume standard fetch works if public,
            // or we use the Admin SDK bucket logic if we passed a path.

            // REFACTOR: We will change `resource-library-actions` to upload and give us a path or url.
            // Let's stick to using the Admin SDK to download by file name if we passed a path.

            const bucket = await getStorageBucket();
            // Extract file path from URL if needed, or expect 'fileUrl' to be the path.
            // For safety, let's try to just download it assuming it is the path in the bucket.
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
            // Fetch the doc first to get the orgId for the cache tag
            const doc = await db.documentResource.findUnique({
                where: { id: resourceId },
                select: { organizationId: true }
            });

            if (!doc) throw new Error("Document not found");

            await db.documentResource.update({
                where: { id: resourceId },
                data: {
                    extractedText: extractedText,
                },
            });

            // Invalidate the library list so the user sees the new text/status
            // @ts-ignore
            revalidateTag(`library-${doc.organizationId}`);
        });

        return { success: true, resourceId };
    }
);
