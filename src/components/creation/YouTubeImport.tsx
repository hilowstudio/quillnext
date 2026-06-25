"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getPlaylistDetails } from "@/app/actions/youtube-actions";
import { YouTubePlaylist } from "@/lib/api/youtube";
import { toast } from "sonner";
import { YoutubeLogo, CheckCircle, ArrowRight } from "@phosphor-icons/react";

interface YouTubeImportProps {
    onImport: (playlist: YouTubePlaylist) => void;
}

export function YouTubeImport({ onImport }: YouTubeImportProps) {
    const [url, setUrl] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [preview, setPreview] = useState<YouTubePlaylist | null>(null);

    const handleFetch = async () => {
        if (!url) return;
        setIsLoading(true);
        setPreview(null);

        try {
            const result = await getPlaylistDetails(url);
            if (result.success && result.data) {
                setPreview(result.data);
                toast.success("Playlist found!");
            } else {
                toast.error(result.error || "Failed to load playlist");
            }
        } catch {
            toast.error("Something went wrong");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex gap-2">
                <Input
                    placeholder="Paste YouTube Playlist URL..."
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleFetch()}
                />
                <Button onClick={handleFetch} disabled={isLoading || !url} className="bg-[#FF0000] hover:bg-[#CC0000] text-white">
                    <YoutubeLogo className="mr-2 w-5 h-5" weight="fill" />
                    {isLoading ? "Fetching..." : "Fetch"}
                </Button>
            </div>

            {preview && (
                <div className="animate-in slide-in-from-bottom duration-500 space-y-4">
                    <div className="flex items-start gap-4 p-4 bg-white border border-qc-border-subtle rounded-lg shadow-sm">
                        <img src={preview.thumbnailUrl} alt="Playlist" className="w-32 h-auto rounded-md object-cover aspect-video" referrerPolicy="no-referrer" />
                        <div className="flex-1">
                            <h3 className="font-bold text-lg text-qc-charcoal">{preview.title}</h3>
                            <p className="text-sm text-qc-text-muted mb-1">by {preview.author} • {preview.itemCount} videos</p>
                            <div className="flex flex-wrap gap-2 text-xs text-qc-text-muted/80">
                                {preview.videos.slice(0, 3).map(v => (
                                    <span key={v.id} className="bg-qc-parchment px-2 py-1 rounded truncate max-w-[200px] border border-qc-border-subtle">
                                        📺 {v.title}
                                    </span>
                                ))}
                                {preview.videos.length > 3 && <span>+{preview.videos.length - 3} more</span>}
                            </div>
                        </div>
                    </div>

                    <div className="bg-qc-info-bg border border-qc-info-border p-3 rounded-md flex gap-2 items-start text-sm text-qc-info-text">
                        <CheckCircle className="w-5 h-5 shrink-0 mt-0.5" weight="fill" />
                        <div>
                            <p className="font-bold">Ready to Generate Curriculum</p>
                            <p>We will watch these {preview.itemCount} videos and create a comprehensive lesson plan.</p>
                        </div>
                    </div>

                    <Button className="w-full" size="lg" onClick={() => onImport(preview)}>
                        Generate Curriculum <ArrowRight className="ml-2" />
                    </Button>
                </div>
            )}
        </div>
    );
}
