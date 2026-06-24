"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { VideoResource } from "@/generated/client";
import { AddVideoDialog } from "@/components/library/AddVideoDialog";
import { Trash } from "@phosphor-icons/react";
import { deleteVideo } from "@/app/actions/resource-library-actions";
import { toast } from "sonner";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useState } from "react";

import { useRouter } from "next/navigation";

interface VideoListProps {
    videos: any[];
    setVideos: (videos: any[]) => void;
}

export function VideoList({ videos, setVideos }: VideoListProps) {
    return (
        <div className="space-y-6">
            <div className="flex justify-end">
                <AddVideoDialog />
            </div>

            {videos.length === 0 ? (
                <Card>
                    <CardContent className="py-12 text-center">
                        <p className="font-body text-qc-text-muted mb-4">
                            No videos yet. Add a YouTube video to get started.
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {videos.map((video) => (
                        <VideoCard key={video.id} video={video} />
                    ))}
                </div>
            )}
        </div>
    );
}

function VideoCard({ video }: { video: any }) {
    const [isDeleting, setIsDeleting] = useState(false);
    const router = useRouter();

    const handleDelete = async () => {
        setIsDeleting(true);
        try {
            const result = await deleteVideo({ id: video.id });
            if (result.success) {
                toast.success("Video deleted successfully");
                router.refresh();
            } else {
                // ...
                // @ts-expect-error result is {success:true} (action throws on failure); 'error' not on type — defensive UI branch
                toast.error(result.error || "Failed to delete video");
            }
        } catch (error) {
            console.error(error);
            toast.error("An error occurred");
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <Card className="hover:shadow-lg transition-shadow relative group">
            <div className="aspect-video w-full bg-black relative">
                {video.thumbnailUrl && (
                    <img src={video.thumbnailUrl} alt={video.title || "Video"} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                )}
            </div>
            <CardHeader>
                <CardTitle className="font-display text-lg line-clamp-2">
                    {video.title || "Untitled Video"}
                </CardTitle>
                <CardDescription className="line-clamp-3">
                    {video.description}
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex gap-2 items-center">
                    <Button variant="outline" size="sm" asChild className="flex-1">
                        <Link href={`/creation-station?sourceType=VIDEO&sourceId=${video.id}`}>Use in Generator</Link>
                    </Button>
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="text-qc-text-muted hover:text-red-500">
                                <Trash size={18} />
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Delete Video?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    Are you sure you want to delete &quot;{video.title}&quot;? This action cannot be undone.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={handleDelete} className="bg-red-500 hover:bg-red-600">
                                    {isDeleting ? "Deleting..." : "Delete"}
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>
            </CardContent>
        </Card>
    );
}
