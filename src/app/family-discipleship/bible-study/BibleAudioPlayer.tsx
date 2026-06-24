'use client';

import { useState, useRef, useEffect } from 'react';
import { Play, Pause, SpeakerHigh, SpeakerLow, SpeakerX } from "@phosphor-icons/react";
import { cn } from '@/lib/utils';

interface BibleAudioPlayerProps {
    audioUrl?: string;
    reference?: string;
    isLoading?: boolean;
}

export default function BibleAudioPlayer({ audioUrl, reference, isLoading }: BibleAudioPlayerProps) {
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(1);
    const audioRef = useRef<HTMLAudioElement>(null);
    const progressBarRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        const updateTime = () => setCurrentTime(audio.currentTime);
        const updateDuration = () => setDuration(audio.duration);
        const handleEnded = () => setIsPlaying(false);

        audio.addEventListener('timeupdate', updateTime);
        audio.addEventListener('loadedmetadata', updateDuration);
        audio.addEventListener('ended', handleEnded);

        return () => {
            audio.removeEventListener('timeupdate', updateTime);
            audio.removeEventListener('loadedmetadata', updateDuration);
            audio.removeEventListener('ended', handleEnded);
        };
    }, []);

    useEffect(() => {
        if (audioRef.current) {
            audioRef.current.volume = volume;
        }
    }, [volume]);

    // Reset state when audioUrl changes
    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- deliberate external sync: reset transport UI and reload the <audio> element when the source prop changes; key-remount would also discard the user's volume
        setIsPlaying(false);
        setCurrentTime(0);
        // Audio ref load handled automatically by src change?
        // We should probably ensure it reloads metadata
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

    const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!audioRef.current) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const percentage = Math.min(Math.max(x / rect.width, 0), 1);
        const newTime = percentage * duration;

        audioRef.current.currentTime = newTime;
        setCurrentTime(newTime);
    };

    const formatTime = (seconds: number) => {
        if (!seconds || isNaN(seconds)) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
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
