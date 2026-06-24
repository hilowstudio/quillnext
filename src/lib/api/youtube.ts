
import { z } from "zod";

const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";

export interface YouTubeVideo {
    id: string;
    title: string;
    description: string;
    thumbnailUrl: string;
    channelTitle: string;
    publishedAt: string;
    position: number;
}

export interface YouTubePlaylist {
    id: string;
    title: string;
    description: string;
    author: string;
    itemCount: number;
    thumbnailUrl: string;
    videos: YouTubeVideo[];
}

// Validated at the YouTube trust boundary (response.json()). Fields are lenient because
// private/deleted entries (filtered out below by title) carry partial snippets — a strict schema
// would reject a whole playlist that contains one; the map defaults each missing field.
const youTubePlaylistItemSchema = z.object({
    snippet: z.object({
        resourceId: z.object({ videoId: z.string().optional() }).optional(),
        title: z.string().optional(),
        description: z.string().optional(),
        thumbnails: z.object({ high: z.object({ url: z.string() }).optional(), medium: z.object({ url: z.string() }).optional() }).optional(),
        videoOwnerChannelTitle: z.string().optional(),
        publishedAt: z.string().optional(),
        position: z.number().optional(),
    }),
});
const youTubePlaylistItemsResponseSchema = z.object({ items: z.array(youTubePlaylistItemSchema) });

export async function fetchPlaylistData(playlistUrlOrId: string, apiKey?: string): Promise<YouTubePlaylist | null> {
    if (!apiKey) {
        // Prefer server-side env var if not passed
        // Note: Client-side calls might fail if this is not exposed, so we should always proxy this via a server action
        console.error("API Key is required for YouTube Data");
        return null;
    }

    // Extract ID
    let playlistId = playlistUrlOrId;
    const urlMatch = playlistUrlOrId.match(/[?&]list=([^#\&\?]+)/);
    if (urlMatch) {
        playlistId = urlMatch[1];
    }

    try {
        // 1. Get Playlist Details
        const detailsUrl = new URL(`${YOUTUBE_API_BASE}/playlists`);
        detailsUrl.searchParams.append("part", "snippet,contentDetails");
        detailsUrl.searchParams.append("id", playlistId);
        detailsUrl.searchParams.append("key", apiKey);

        const detailsRes = await fetch(detailsUrl.toString());
        if (!detailsRes.ok) throw new Error(`Playlist fetch failed: ${detailsRes.statusText}`);

        const detailsData = await detailsRes.json();
        if (!detailsData.items || detailsData.items.length === 0) return null;

        const playlistInfo = detailsData.items[0].snippet;

        // 2. Get Playlist Items (Videos)
        const itemsUrl = new URL(`${YOUTUBE_API_BASE}/playlistItems`);
        itemsUrl.searchParams.append("part", "snippet");
        itemsUrl.searchParams.append("playlistId", playlistId);
        itemsUrl.searchParams.append("maxResults", "50"); // Fetch up to 50
        itemsUrl.searchParams.append("key", apiKey);

        const itemsRes = await fetch(itemsUrl.toString());
        if (!itemsRes.ok) throw new Error(`Items fetch failed: ${itemsRes.statusText}`);

        const itemsData = youTubePlaylistItemsResponseSchema.parse(await itemsRes.json());

        const videos: YouTubeVideo[] = itemsData.items.map((item) => ({
            id: item.snippet.resourceId?.videoId ?? "",
            title: item.snippet.title ?? "",
            description: item.snippet.description ?? "",
            thumbnailUrl: item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.medium?.url || "",
            channelTitle: item.snippet.videoOwnerChannelTitle || "",
            publishedAt: item.snippet.publishedAt ?? "",
            position: item.snippet.position ?? 0
        })).filter((v) => v.title !== "Private video" && v.title !== "Deleted video");

        return {
            id: playlistId,
            title: playlistInfo.title,
            description: playlistInfo.description,
            author: playlistInfo.channelTitle,
            itemCount: videos.length,
            thumbnailUrl: playlistInfo.thumbnails?.high?.url || playlistInfo.thumbnails?.medium?.url,
            videos: videos
        };

    } catch (error) {
        console.error("YouTube Fetch Error:", error);
        return null;
    }
}

export interface YouTubeVideoMetadata {
    title: string | null;
    description: string | null;
    thumbnailUrl: string | null;
    channelName: string | null;
    durationSeconds: number | null;
}

/**
 * Parse an ISO-8601 duration string (e.g. "PT1H2M30S") into total seconds.
 * Returns 0 for unparseable / empty input. Never throws.
 */
export function parseIso8601Duration(iso: string): number {
    if (!iso) return 0;
    // ISO-8601 duration: PnYnMnDTnHnMnS. For YouTube videos only H/M/S matter,
    // but we tolerate days as well for robustness.
    const match = iso.match(/P(?:(\d+)D)?T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return 0;
    const days = match[1] ? parseInt(match[1], 10) : 0;
    const hours = match[2] ? parseInt(match[2], 10) : 0;
    const minutes = match[3] ? parseInt(match[3], 10) : 0;
    const seconds = match[4] ? parseInt(match[4], 10) : 0;
    return days * 86400 + hours * 3600 + minutes * 60 + seconds;
}

const ALL_NULL_METADATA: YouTubeVideoMetadata = {
    title: null,
    description: null,
    thumbnailUrl: null,
    channelName: null,
    durationSeconds: null,
};

/**
 * Fetch metadata for a single YouTube video via the YouTube Data API v3.
 * Uses YOUTUBE_API_KEY, falling back to the Google Books key (same GCP project).
 * NEVER throws — returns an all-null object on any failure or missing key.
 */
export async function fetchVideoMetadata(videoId: string): Promise<YouTubeVideoMetadata> {
    const apiKey =
        process.env.YOUTUBE_API_KEY ??
        process.env.GOOGLE_BOOKS_API_KEY;

    if (!apiKey) {
        console.warn("fetchVideoMetadata: no YouTube/Google API key configured; returning empty metadata");
        return { ...ALL_NULL_METADATA };
    }

    try {
        const url = new URL(`${YOUTUBE_API_BASE}/videos`);
        url.searchParams.append("part", "snippet,contentDetails");
        url.searchParams.append("id", videoId);
        url.searchParams.append("key", apiKey);

        const res = await fetch(url.toString());
        if (!res.ok) throw new Error(`Video fetch failed: ${res.statusText}`);

        const data = await res.json();
        const item = data?.items?.[0];
        if (!item) return { ...ALL_NULL_METADATA };

        const snippet = item.snippet ?? {};
        const contentDetails = item.contentDetails ?? {};

        const thumbnails = snippet.thumbnails ?? {};
        const thumbnailUrl =
            thumbnails.high?.url ??
            thumbnails.medium?.url ??
            thumbnails.default?.url ??
            null;

        const durationSeconds = contentDetails.duration
            ? parseIso8601Duration(contentDetails.duration)
            : null;

        return {
            title: snippet.title ?? null,
            description: snippet.description ?? null,
            thumbnailUrl,
            channelName: snippet.channelTitle ?? null,
            durationSeconds,
        };
    } catch (error) {
        console.warn("fetchVideoMetadata error:", error);
        return { ...ALL_NULL_METADATA };
    }
}
