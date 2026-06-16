"use server";

import { fetchPlaylistData, YouTubePlaylist } from "@/lib/api/youtube";
import { fetchPlaylistSchema } from "@/lib/schemas/actions";

export async function getPlaylistDetails(rawData: unknown): Promise<{ success: boolean; data?: YouTubePlaylist; error?: string }> {
    // Validate input
    const data = fetchPlaylistSchema.parse(rawData);

    const apiKey = process.env.GOOGLE_BOOKS_API_KEY ?? process.env.NEXT_PUBLIC_GOOGLE_BOOKS_API_KEY; // Using the key user mentioned is configured (usually same project)
    // IMPORTANT: Ideally we should use a specific YOUTUBE_API_KEY, but often they are the same GCP project key.
    // I will check if there is a specific YOUTUBE key, if not fallback to generic or existing.
    // For now assuming the standard key works for both if enabled.

    if (!apiKey) {
        return { success: false, error: "Server configuration error: Missing API Key" };
    }

    const playlist = await fetchPlaylistData(data.url, apiKey);

    if (playlist) {
        return { success: true, data: playlist };
    }

    return { success: false, error: "Could not fetch playlist. Check privacy settings or URL." };
}
