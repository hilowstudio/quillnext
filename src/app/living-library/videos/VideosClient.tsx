"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";

interface Subject {
    id: string;
    name: string;
    code: string;
}

interface Strand {
    id: string;
    name: string;
    code: string;
    subjectId: string;
}

// Match the exact shape returned by the DAL
interface Video {
    id: string;
    youtubeUrl: string;
    youtubeVideoId: string;
    title: string | null;
    description: string | null;
    thumbnailUrl: string | null;
    durationSeconds: number | null;
    channelName: string | null;
    extractionStatus: string;
    extractedSummary: string | null;
    subject: { name: string } | null;
    strand: { name: string } | null;
}

interface VideosClientProps {
    initialVideos: Video[];
    initialSubjects: Subject[];
}

interface ExtractResponse {
    status: "EXTRACTED" | "EXTRACTING" | "FAILED";
    reused?: boolean;
    started?: boolean;
}

const POLL_INTERVAL_MS = 4000;
const MAX_POLLS = 30;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export default function VideosClient({ initialVideos, initialSubjects }: VideosClientProps) {
    const router = useRouter();
    const [videos, setVideos] = useState<Video[]>(initialVideos);
    const [youtubeUrl, setYoutubeUrl] = useState("");
    const [isAdding, setIsAdding] = useState(false);
    const [isExtracting, setIsExtracting] = useState<string | null>(null);
    const [selectedSubject, setSelectedSubject] = useState<string>("");
    const [selectedStrand, setSelectedStrand] = useState<string>("");
    const [strands, setStrands] = useState<Strand[]>([]);

    useEffect(() => {
        if (selectedSubject) {
            fetch(`/api/curriculum/strands?subjectId=${selectedSubject}`)
                .then((res) => res.json())
                .then((data) => setStrands(data.strands || []))
                .catch(console.error);
        } else {
            setStrands([]);
        }
    }, [selectedSubject]);

    const handleAddVideo = async () => {
        if (!youtubeUrl.trim()) {
            alert("Please enter a YouTube URL");
            return;
        }

        setIsAdding(true);
        try {
            const response = await fetch("/api/library/videos", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    youtubeUrl: youtubeUrl.trim(),
                    subjectId: selectedSubject || null,
                    strandId: selectedStrand || null,
                }),
            });

            if (!response.ok) {
                throw new Error("Failed to add video");
            }

            const { video } = await response.json();
            // Optimistically show the (possibly newly created) row; the extract poll below
            // re-fetches the list once extraction settles. If the org already had this video,
            // the create endpoint returns the existing row — avoid duplicating it in the list.
            setVideos((prev) =>
                prev.some((v) => v.id === video.id) ? prev : [video, ...prev],
            );
            setYoutubeUrl("");
            setSelectedSubject("");
            setSelectedStrand("");

            // Kick off the create -> trigger -> poll flow for every add.
            await handleExtract(video.id);

            router.refresh(); // Refresh server data alignment
        } catch (error) {
            console.error("Failed to add video:", error);
            alert("Failed to add video. Please try again.");
        } finally {
            setIsAdding(false);
        }
    };

    // POST the idempotent extract trigger/poll endpoint. Throws on a non-OK response.
    const postExtract = async (videoId: string): Promise<ExtractResponse> => {
        const res = await fetch(`/api/library/videos/${videoId}/extract`, {
            method: "POST",
        });
        if (!res.ok) {
            throw new Error(`Extraction request failed (${res.status})`);
        }
        return (await res.json()) as ExtractResponse;
    };

    // Re-fetch the org's video list (GET route) and sync local state to it.
    const refreshList = async () => {
        const listRes = await fetch("/api/library/videos");
        if (listRes.ok) {
            const data = await listRes.json();
            setVideos(data.videos || []);
        }
        router.refresh();
    };

    const handleExtract = async (videoId: string) => {
        setIsExtracting(videoId);
        try {
            // Trigger extraction. The endpoint is idempotent; if a shared (cross-org)
            // extraction already exists it returns EXTRACTED immediately (reused).
            let result = await postExtract(videoId);

            if (result.status === "EXTRACTED" || result.status === "FAILED") {
                await refreshList();
                return;
            }

            // status === "EXTRACTING" -> poll the same idempotent endpoint until it settles.
            for (let attempt = 0; attempt < MAX_POLLS; attempt++) {
                await sleep(POLL_INTERVAL_MS);
                result = await postExtract(videoId);
                if (result.status === "EXTRACTED" || result.status === "FAILED") {
                    await refreshList();
                    return;
                }
            }

            // Still running after the poll budget — leave it to the background worker; the
            // list will reflect the final status on the next manual extract/refresh.
            await refreshList();
        } catch (error) {
            console.error("Failed to extract video:", error);
            alert("Failed to extract video content. Please try again.");
        } finally {
            setIsExtracting(null);
        }
    };

    return (
        <div className="container mx-auto max-w-6xl px-4 py-8">
            <div className="mb-8 flex items-center justify-between">
                <div>
                    <h1 className="font-display text-4xl font-bold text-qc-charcoal mb-2 text-balance">
                        Video Resources
                    </h1>
                    <p className="font-body text-qc-text-muted qc-prose">
                        Add YouTube videos and extract educational content
                    </p>
                </div>
                <Button variant="outline" asChild>
                    <Link href="/living-library">Back to Library</Link>
                </Button>
            </div>

            {/* Add Video Form */}
            <Card className="mb-8">
                <CardHeader>
                    <CardTitle className="font-display text-xl">Add YouTube Video</CardTitle>
                    <CardDescription>
                        Add a YouTube video URL to extract transcripts and generate educational content
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div>
                        <Label htmlFor="youtube-url" className="font-body">
                            YouTube URL *
                        </Label>
                        <Input
                            id="youtube-url"
                            value={youtubeUrl}
                            onChange={(e) => setYoutubeUrl(e.target.value)}
                            placeholder="https://www.youtube.com/watch?v=..."
                            className="mt-2"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label htmlFor="video-subject" className="font-body">
                                Subject (Optional)
                            </Label>
                            <select
                                id="video-subject"
                                value={selectedSubject}
                                onChange={(e) => {
                                    setSelectedSubject(e.target.value);
                                    setSelectedStrand("");
                                }}
                                className="mt-2 flex h-10 w-full rounded-qc-md border border-qc-border-subtle bg-white px-3 py-2 font-body text-sm text-qc-charcoal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-qc-primary focus-visible:ring-offset-2"
                            >
                                <option value="">Select a subject</option>
                                {initialSubjects.map((subject) => (
                                    <option key={subject.id} value={subject.id}>
                                        {subject.name} ({subject.code})
                                    </option>
                                ))}
                            </select>
                        </div>

                        {selectedSubject && strands.length > 0 && (
                            <div>
                                <Label htmlFor="video-strand" className="font-body">
                                    Strand (Optional)
                                </Label>
                                <select
                                    id="video-strand"
                                    value={selectedStrand}
                                    onChange={(e) => setSelectedStrand(e.target.value)}
                                    className="mt-2 flex h-10 w-full rounded-qc-md border border-qc-border-subtle bg-white px-3 py-2 font-body text-sm text-qc-charcoal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-qc-primary focus-visible:ring-offset-2"
                                >
                                    <option value="">Select a strand</option>
                                    {strands.map((strand) => (
                                        <option key={strand.id} value={strand.id}>
                                            {strand.name} ({strand.code})
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>

                    <Button onClick={handleAddVideo} disabled={isAdding || !youtubeUrl.trim()}>
                        {isAdding ? "Adding..." : "Add Video"}
                    </Button>
                </CardContent>
            </Card>

            {/* Videos List */}
            {videos.length === 0 ? (
                <Card>
                    <CardContent className="py-12 text-center">
                        <p className="font-body text-qc-text-muted mb-4">
                            No videos yet. Add your first YouTube video to get started.
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {videos.map((video) => (
                        <Card key={video.id} className="hover:shadow-lg transition-shadow">
                            <CardHeader>
                                {video.thumbnailUrl && (
                                    <img
                                        src={video.thumbnailUrl}
                                        alt={video.title || "Video thumbnail"}
                                        className="w-full rounded-qc-md mb-4"
                                    />
                                )}
                                <CardTitle className="font-display text-lg line-clamp-2">
                                    {video.title || "Untitled Video"}
                                </CardTitle>
                                <CardDescription>
                                    {video.channelName || "Unknown Channel"}
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {video.subject && (
                                    <div>
                                        <p className="font-body text-sm font-medium text-qc-text-muted mb-1">
                                            Subject
                                        </p>
                                        <p className="font-body text-sm text-qc-charcoal">
                                            {video.subject.name}
                                            {video.strand && ` > ${video.strand.name}`}
                                        </p>
                                    </div>
                                )}

                                {video.extractedSummary && (
                                    <div>
                                        <p className="font-body text-sm font-medium text-qc-text-muted mb-1">
                                            Summary
                                        </p>
                                        <p className="font-body text-xs text-qc-charcoal line-clamp-3">
                                            {video.extractedSummary}
                                        </p>
                                    </div>
                                )}

                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span
                                            className={`font-body text-xs px-2 py-1 rounded ${video.extractionStatus === "EXTRACTED"
                                                ? "bg-qc-success/10 text-qc-success"
                                                : video.extractionStatus === "EXTRACTING"
                                                    ? "bg-qc-warning/10 text-qc-warning"
                                                    : "bg-qc-text-muted/10 text-qc-text-muted"
                                                }`}
                                        >
                                            {video.extractionStatus || "NOT_EXTRACTED"}
                                        </span>
                                    </div>
                                    <div className="flex gap-2">
                                        {video.extractionStatus !== "EXTRACTED" && (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleExtract(video.id)}
                                                disabled={isExtracting === video.id}
                                                className="flex-1"
                                            >
                                                {isExtracting === video.id ? "Extracting..." : "Extract"}
                                            </Button>
                                        )}
                                        <Button variant="outline" size="sm" asChild className="flex-1">
                                            <Link href={`/creation-station?videoId=${video.id}`}>Use</Link>
                                        </Button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
