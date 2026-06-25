import PDFParser from "pdf2json";
import mammoth from "mammoth";

// Server-only text extraction (imports Node-only pdf2json/mammoth — never import from client code).
// Used to turn an uploaded file into a generation SOURCE: the caller reads the text and discards the
// file (extract-and-discard; nothing is persisted to storage or the DB).

const TEXT_EXTENSIONS = new Set([
    "txt", "text", "md", "markdown", "csv", "tsv", "html", "htm", "json", "log",
]);

function parsePdfBuffer(buffer: Buffer): Promise<string> {
    return new Promise((resolve, reject) => {
        const pdfParser = new PDFParser(null, true); // needRawText: text-only output
        pdfParser.on("pdfParser_dataError", (errData) =>
            reject(errData instanceof Error ? errData : new Error(String(errData.parserError))),
        );
        pdfParser.on("pdfParser_dataReady", () => {
            try {
                resolve(pdfParser.getRawTextContent());
            } catch {
                resolve("");
            }
        });
        pdfParser.parseBuffer(buffer);
    });
}

/**
 * Extract plain text from an uploaded file buffer, routed by extension. Supports plain-text formats,
 * PDF (pdf2json), and DOCX (mammoth). Throws on an unsupported extension.
 */
export async function extractTextFromFile(buffer: Buffer, fileName: string): Promise<string> {
    const ext = fileName.split(".").pop()?.toLowerCase() ?? "";

    if (ext === "pdf") return parsePdfBuffer(buffer);
    if (ext === "docx") return (await mammoth.extractRawText({ buffer })).value;
    if (TEXT_EXTENSIONS.has(ext)) return buffer.toString("utf-8");

    throw new Error(`Unsupported file type: .${ext || "(none)"}. Use a text, PDF, or DOCX file.`);
}
