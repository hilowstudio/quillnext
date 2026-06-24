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
            <div className="flex items-center gap-3 p-4 bg-qc-warning-bg/50 border border-qc-warning-border rounded-lg animate-pulse">
                <div className="w-10 h-10 rounded-full bg-qc-surface-raised" />
                <div className="flex-1 h-2 bg-qc-surface-raised rounded-full" />
            </div>
        );
    }

    if (!audioUrl) return null;

    return (
        <div className="bg-white border border-qc-border-subtle rounded-lg p-4 shadow-sm flex flex-col gap-4 w-full">
            <div className="flex items-center gap-4">
                {/* Play Control */}
                <button
                    onClick={togglePlay}
                    className="w-10 h-10 rounded-full bg-qc-primary text-white flex items-center justify-center hover:bg-qc-primary/90 transition-colors flex-shrink-0"
                    aria-label={isPlaying ? 'Pause' : 'Play'}
                >
                    {isPlaying ? (
                        <Pause weight="fill" className="w-5 h-5" />
                    ) : (
                        <Play weight="fill" className="w-5 h-5 ml-0.5" />
                    )}
                </button>

                {/* Progress Bar and Time */}
                <div className="flex-1 space-y-1">
                    <div
                        className="h-2 bg-qc-surface-raised rounded-full cursor-pointer relative group"
                        onClick={handleSeek}
                    >
                        <div
                            className="absolute h-full bg-qc-primary rounded-full transition-all"
                            style={{ width: `${(currentTime / (duration || 1)) * 100}%` }}
                        />
                        {/* Scrub handle on hover */}
                        <div
                            className="absolute h-3 w-3 bg-white border border-qc-primary rounded-full top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity"
                            style={{ left: `${(currentTime / (duration || 1)) * 100}%` }}
                        />
                    </div>
                    <div className="flex justify-between text-xs text-qc-text-muted font-medium tabular-nums">
                        <span>{formatTime(currentTime)}</span>
                        <span>{formatTime(duration)}</span>
                    </div>
                </div>

                {/* Volume */}
                <div className="hidden sm:flex items-center gap-2 group w-24">
                    {volume === 0 ? <SpeakerX className="w-5 h-5 text-qc-text-muted" /> : <SpeakerHigh className="w-5 h-5 text-qc-text-muted" />}
                    <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.1"
                        value={volume}
                        onChange={(e) => setVolume(parseFloat(e.target.value))}
                        className="w-full h-1 bg-qc-surface-raised rounded-lg cursor-pointer opacity-50 group-hover:opacity-100 transition-opacity"
                    />
                </div>
            </div>

            <audio ref={audioRef} src={audioUrl} preload="metadata" />
        </div>
    );
}
