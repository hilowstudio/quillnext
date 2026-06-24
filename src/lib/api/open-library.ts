import { BookMetadata } from "./google-books";

const OPEN_LIBRARY_BASE = "https://openlibrary.org";

// Minimal shape of the OpenLibrary "books" API entries we read (not schema-validated upstream).
interface OpenLibraryBook {
    title?: string;
    authors?: { name: string }[];
    publishers?: { name?: string }[];
    publish_date?: string;
    number_of_pages?: number;
    cover?: { medium?: string; large?: string };
    excerpts?: { text?: string }[];
}

export async function lookupOpenLibraryByIsbn(isbn: string): Promise<BookMetadata | null> {
    // OpenLibrary API: https://openlibrary.org/api/books?bibkeys=ISBN:xxx&format=json&jscmd=data
    const url = new URL(`${OPEN_LIBRARY_BASE}/api/books`);
    url.searchParams.append("bibkeys", `ISBN:${isbn}`);
    url.searchParams.append("format", "json");
    url.searchParams.append("jscmd", "data");

    try {
        const res = await fetch(url.toString());
        if (!res.ok) return null;

        const data: Record<string, OpenLibraryBook | undefined> = await res.json();
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
