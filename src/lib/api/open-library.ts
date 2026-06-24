import { BookMetadata } from "./google-books";
import { z } from "zod";

const OPEN_LIBRARY_BASE = "https://openlibrary.org";

// Validated at the OpenLibrary trust boundary (response.json()). A wrong-typed payload fails at the
// parse below — inside the try, so the lookup degrades to null — instead of flowing on unchecked.
const openLibraryBookSchema = z.object({
    title: z.string().optional(),
    authors: z.array(z.object({ name: z.string() })).optional(),
    publishers: z.array(z.object({ name: z.string().optional() })).optional(),
    publish_date: z.string().optional(),
    number_of_pages: z.number().optional(),
    cover: z.object({ medium: z.string().optional(), large: z.string().optional() }).optional(),
    excerpts: z.array(z.object({ text: z.string().optional() })).optional(),
});
const openLibraryResponseSchema = z.record(z.string(), openLibraryBookSchema);

export async function lookupOpenLibraryByIsbn(isbn: string): Promise<BookMetadata | null> {
    // OpenLibrary API: https://openlibrary.org/api/books?bibkeys=ISBN:xxx&format=json&jscmd=data
    const url = new URL(`${OPEN_LIBRARY_BASE}/api/books`);
    url.searchParams.append("bibkeys", `ISBN:${isbn}`);
    url.searchParams.append("format", "json");
    url.searchParams.append("jscmd", "data");

    try {
        const res = await fetch(url.toString());
        if (!res.ok) return null;

        const data = openLibraryResponseSchema.parse(await res.json());
        const key = `ISBN:${isbn}`;
        const bookData = data[key];

        // Skip results with no title so BookMetadata.title is never runtime-undefined
        // (the upstream JSON is not schema-validated).
        if (!bookData || !bookData.title) return null;

        return {
            title: bookData.title,
            authors: bookData.authors?.map((a) => a.name) || [],
            publisher: bookData.publishers?.[0]?.name,
            publishedDate: bookData.publish_date,
            pageCount: bookData.number_of_pages,
            coverUrl: bookData.cover?.medium || bookData.cover?.large,
            isbn: isbn, // we know it matches
            description: bookData.excerpts?.[0]?.text || "No description available via OpenLibrary."
        };
    } catch (error) {
        console.error("Failed to search OpenLibrary:", error);
        return null;
    }
}
