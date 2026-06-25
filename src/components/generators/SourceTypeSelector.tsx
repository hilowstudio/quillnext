"use client";

import { Book, Video, PresentationChart, TextT, Link as LinkIcon, FileText, YoutubeLogo, GraduationCap } from "@phosphor-icons/react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SourceType } from "@/app/actions/generator-actions";

interface SourceTypeSelectorProps {
    value: SourceType | null | undefined;
    onValueChange: (value: SourceType) => void;
}

export function SourceTypeSelector({ value, onValueChange }: SourceTypeSelectorProps) {
    return (
        <Tabs value={value || ""} onValueChange={(val) => onValueChange(val as SourceType)} className="w-full">
            <TabsList className="grid w-full grid-cols-4 lg:grid-cols-8 h-auto">
                <TabsTrigger value="SPINE" className="flex flex-col gap-1 py-3 h-auto">
                    <GraduationCap size={20} />
                    <span className="text-xs">Curriculum</span>
                </TabsTrigger>
                <TabsTrigger value="BOOK" className="flex flex-col gap-1 py-3 h-auto">
                    <Book size={20} />
                    <span className="text-xs">Book</span>
                </TabsTrigger>
                <TabsTrigger value="VIDEO" className="flex flex-col gap-1 py-3 h-auto">
                    <Video size={20} />
                    <span className="text-xs">Video</span>
                </TabsTrigger>
                <TabsTrigger value="COURSE" className="flex flex-col gap-1 py-3 h-auto">
                    <PresentationChart size={20} />
                    <span className="text-xs">Course</span>
                </TabsTrigger>
                <TabsTrigger value="TOPIC" className="flex flex-col gap-1 py-3 h-auto">
                    <TextT size={20} />
                    <span className="text-xs">Topic</span>
                </TabsTrigger>
                <TabsTrigger value="URL" className="flex flex-col gap-1 py-3 h-auto">
                    <LinkIcon size={20} />
                    <span className="text-xs">Article</span>
                </TabsTrigger>
                <TabsTrigger value="FILE" className="flex flex-col gap-1 py-3 h-auto">
                    <FileText size={20} />
                    <span className="text-xs">File</span>
                </TabsTrigger>
                <TabsTrigger value="YOUTUBE_PLAYLIST" className="flex flex-col gap-1 py-3 h-auto">
                    <YoutubeLogo size={20} />
                    <span className="text-xs">Playlist</span>
                </TabsTrigger>
            </TabsList>
        </Tabs>
    );
}
