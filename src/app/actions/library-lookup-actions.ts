"use server";

import { lookupGoogleBookByIsbn, searchGoogleBooks, BookMetadata } from "@/lib/api/google-books";
import { lookupOpenLibraryByIsbn } from "@/lib/api/open-library";
import { searchLibrarySchema } from "@/lib/schemas/actions";

/**
 * Unified lookup strategy:
 * 1. Try Google Books (richest data)
 * 2. Try OpenLibrary (fallback)
 */
export async function lookupBook(rawData: unknown): Promise<{ success: boolean; data?: BookMetadata; error?: string }> {
    const validated = searchLibrarySchema.parse(rawData);

    const apiKey = process.env.GOOGLE_BOOKS_API_KEY ?? process.env.NEXT_PUBLIC_GOOGLE_BOOKS_API_KEY;
    const query = validated.query;
    const type = validated.type === "BOOK" ? "ISBN" : "TITLE_AUTHOR";

    try {
        if (type === "ISBN") {
            // Clean ISBN
            const cleanIsbn = query.replace(/[^0-9X]/gi, "");

            // Try Google first
            let result = await lookupGoogleBookByIsbn(cleanIsbn, apiKey);

            // Try OpenLibrary if Google fails
            if (!result) {
                console.log("Google Books failed, trying OpenLibrary...");
                result = await lookupOpenLibraryByIsbn(cleanIsbn);
            }

            if (result) {
                return { success: true, data: result };
            }
            return { success: false, error: "Book not found in any database." };
        }
        else {
            // Search by Title/Author
            const results = await searchGoogleBooks(query, apiKey);
            if (results.length > 0) {
                // Return first match for now, or we could return list
                return { success: true, data: results[0] };
            }
            return { success: false, error: "No books found matching query." };
        }
    } catch (error) {
        console.error("Lookup failed:", error);
        return { success: false, error: "Internal lookup error." };
    }
}
