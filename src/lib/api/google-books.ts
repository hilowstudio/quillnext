import { Book } from "@/generated/client";

const GOOGLE_BOOKS_API_BASE = "https://www.googleapis.com/books/v1/volumes";

export interface BookMetadata {
    title: string;
    authors: string[];
    description?: string;
    publisher?: string;
    publishedDate?: string;
    pageCount?: number;
    coverUrl?: string;
    isbn?: string;
    categories?: string[];
    language?: string;
}

export async function searchGoogleBooks(query: string, apiKey?: string): Promise<BookMetadata[]> {
    const url = new URL(GOOGLE_BOOKS_API_BASE);
    url.searchParams.append("q", query);
    url.searchParams.append("maxResults", "10");
    if (apiKey) {
        url.searchParams.append("key", apiKey);
    }

    try {
        const res = await fetch(url.toString());
        if (!res.ok) {
            console.error("Google Books API error:", res.statusText);
            return [];
        }
        const data = await res.json();

        if (!data.items) return [];

        return data.items.map((item: any) => {
            const info = item.volumeInfo;
            const isbn = info.industryIdentifiers?.find((id: any) => id.type === "ISBN_13")?.identifier ||
                info.industryIdentifiers?.find((id: any) => id.type === "ISBN_10")?.identifier;

            return {
                title: info.title,
                authors: info.authors || [],
                description: info.description,
                publisher: info.publisher,
                publishedDate: info.publishedDate,
                pageCount: info.pageCount,
                coverUrl: info.imageLinks?.thumbnail?.replace("http:", "https:"),
                isbn,
                categories: info.categories,
                language: info.language
            };
        });
    } catch (error) {
        console.error("Failed to search Google Books:", error);
        return [];
    }
}

export async function lookupGoogleBookByIsbn(isbn: string, apiKey?: string): Promise<BookMetadata | null> {
    const results = await searchGoogleBooks(`isbn:${isbn}`, apiKey);
    return results.length > 0 ? results[0] : null;
}
