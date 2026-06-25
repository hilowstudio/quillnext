'use client';

import { useState, useRef, useEffect } from 'react';
import { SpeakerHigh, SpeakerX } from "@phosphor-icons/react";
import { cn } from '@/lib/utils';

interface BibleAudioPlayerProps {
    audioUrl?: string;
    reference?: string;
    isLoading?: boolean;
}

export default function BibleAudioPlayer({ audioUrl, isLoading }: BibleAudioPlayerProps) {
    const [isPlaying, setIsPlaying] = useState(false);
    const audioRef = useRef<HTMLAudioElement>(null);

    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        const handleEnded = () => setIsPlaying(false);
        audio.addEventListener('ended', handleEnded);
        return () => {
            audio.removeEventListener('ended', handleEnded);
        };
    }, []);

    // Reset transport when the audio source changes
    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- deliberate external sync: reset transport UI and reload the <audio> element when the source prop changes
        setIsPlaying(false);
        if (audioRef.current && audioUrl) {
            audioRef.current.load();
        }
    }, [audioUrl]);

    const togglePlay = () => {
        const audio = audioRef.current;
        if (!audio) return;

        if (isPlaying) {
            audio.pause();
        } else {
            audio.play();
        }
        setIsPlaying(!isPlaying);
    };

    if (isLoading) {
        return (
            <div className="w-8 h-8 rounded-full bg-qc-neutral-200 animate-pulse" />
        );
    }

    if (!audioUrl) return null;

    return (
        <>
            <button
                onClick={togglePlay}
                className={cn(
                    "flex items-center justify-center w-8 h-8 rounded-full transition-colors",
                    isPlaying ? "bg-qc-primary text-white" : "text-qc-primary hover:bg-qc-primary/10"
                )}
                aria-label={isPlaying ? 'Stop Audio' : 'Play Audio'}
                title={isPlaying ? 'Stop Audio' : 'Play Audio'}
            >
                {isPlaying ? (
                    <SpeakerX weight="fill" className="w-5 h-5" />
                ) : (
                    <SpeakerHigh weight="fill" className="w-5 h-5" />
                )}
            </button>
            <audio ref={audioRef} src={audioUrl} preload="none" />
        </>
    );
}
