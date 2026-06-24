"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { YoutubeLogo, Spinner } from "@phosphor-icons/react";
import { toast } from "sonner";

interface ExtractResponse {
    status: "EXTRACTED" | "EXTRACTING" | "FAILED";
    reused?: boolean;
    started?: boolean;
}

const POLL_INTERVAL_MS = 4000;
const MAX_POLLS = 30;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function AddVideoDialog() {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [url, setUrl] = useState("");
    const [isProcessing, setIsProcessing] = useState(false);

    // POST the idempotent extract trigger/poll endpoint. Throws on a non-OK response.
    async function postExtract(videoId: string): Promise<ExtractResponse> {
        const res = await fetch(`/api/library/videos/${videoId}/extract`, {
            method: "POST",
        });
        if (!res.ok) {
            throw new Error(`Extraction request failed (${res.status})`);
        }
        return (await res.json()) as ExtractResponse;
    }

    const handleProcess = async () => {
        if (!url.trim() || isProcessing) return;

        setIsProcessing(true);
        try {
            // 1) Create (or reuse) the per-org VideoResource. No global dup-block: the create
            //    endpoint returns the existing row for this org if the video was added before.
            const createRes = await fetch("/api/library/videos", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ youtubeUrl: url.trim() }),
            });

            if (!createRes.ok) {
                const body = await createRes.json().catch(() => null);
                toast.error(body?.error ?? "Failed to add video.");
                return;
            }

            const { video } = await createRes.json();
            if (!video?.id) {
                toast.error("Failed to add video.");
                return;
            }

            // 2) Trigger extraction. The endpoint is idempotent; if a shared (cross-org)
            //    extraction already exists it returns EXTRACTED immediately (reused).
            toast.info("Extracting video... this may take a minute.");
            let result = await postExtract(video.id);

            if (result.status === "EXTRACTED") {
                toast.success(
                    result.reused
                        ? "Extraction reused from shared library."
                        : "Video added and extracted!",
                );
                setOpen(false);
                setUrl("");
                router.refresh();
                return;
            }

            if (result.status === "FAILED") {
                toast.error("Extraction failed. Please try again.");
                router.refresh();
                return;
            }

            // 3) status === "EXTRACTING" -> poll the same idempotent endpoint until it settles.
            for (let attempt = 0; attempt < MAX_POLLS; attempt++) {
                await sleep(POLL_INTERVAL_MS);
                result = await postExtract(video.id);
                if (result.status === "EXTRACTED") {
                    toast.success("Video added and extracted!");
                    setOpen(false);
                    setUrl("");
                    router.refresh();
                    return;
                }
                if (result.status === "FAILED") {
                    toast.error("Extraction failed. Please try again.");
                    router.refresh();
                    return;
                }
            }

            // Still running after the poll budget — leave the dialog open and let the
            // background worker finish; the list will reflect it on the next refresh.
            toast.info("Extraction is still running. It'll appear once it's done.");
            setOpen(false);
            setUrl("");
            router.refresh();
        } catch (error) {
            toast.error("An unexpected error occurred");
            console.error(error);
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={(next) => !isProcessing && setOpen(next)}>
            <DialogTrigger asChild>
                <Button variant="outline" className="gap-2">
                    <YoutubeLogo size={20} className="text-red-600" />
                    Add Video
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Add YouTube Video</DialogTitle>
                    <DialogDescription>
                        Enter a YouTube URL. We&apos;ll pull the transcript (falling back to Gemini 3 Pro
                        to watch it), extract a summary, key points, and chapters, and generate
                        embeddings for the Living Library.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label htmlFor="url">YouTube URL</Label>
                        <Input
                            id="url"
                            placeholder="https://www.youtube.com/watch?v=..."
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            disabled={isProcessing}
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button onClick={handleProcess} disabled={!url.trim() || isProcessing}>
                        {isProcessing ? (
                            <>
                                <Spinner className="mr-2 h-4 w-4 animate-spin" />
                                Extracting...
                            </>
                        ) : (
                            "Add & Extract"
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
