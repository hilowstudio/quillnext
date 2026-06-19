"use server";

import { fetchPlaylistData, YouTubePlaylist } from "@/lib/api/youtube";
import { fetchPlaylistSchema } from "@/lib/schemas/actions";

export async function getPlaylistDetails(rawData: unknown): Promise<{ success: boolean; data?: YouTubePlaylist; error?: string }> {
    // Validate input
    const data = fetchPlaylistSchema.parse(rawData);

    // Server-only key (YouTube Data API). Prefer a dedicated YOUTUBE_API_KEY; fall back to the shared
    // Google Books key (same GCP project). No NEXT_PUBLIC_ fallback — that would expose the key to the browser.
    const apiKey = process.env.YOUTUBE_API_KEY ?? process.env.GOOGLE_BOOKS_API_KEY;

    if (!apiKey) {
        return { success: false, error: "Server configuration error: Missing API Key" };
    }

    const playlist = await fetchPlaylistData(data.url, apiKey);

    if (playlist) {
        return { success: true, data: playlist };
    }

    return { success: false, error: "Could not fetch playlist. Check privacy settings or URL." };
}
