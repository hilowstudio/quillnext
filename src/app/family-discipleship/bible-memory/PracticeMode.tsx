'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
    Keyboard, Microphone, SpeakerHigh, Eye, EyeSlash,
    ArrowRight, ArrowLeft, ArrowCounterClockwise
} from '@phosphor-icons/react/dist/ssr';
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { updateVerseProgress, refreshVerse, resetVerseMastery, updateVerseText } from './actions';
import { getBibleAudio, getBibleText } from "@/server/actions/bible-study";
import BibleAudioPlayer from "./BibleAudioPlayer";

// --- Types ---

interface PracticeModeProps {
    verse: {
        id: string;
        reference: string;
        text?: string | null;
        currentStep: number;
    };
    onComplete: () => void;
    onExit: () => void;
    initialStep?: number;
    isRefresh?: boolean;
}

const STEPS = [
    { id: 1, label: "Read Silently", type: "read", mode: "full", hide: false },
    { id: 2, label: "Listen Aloud", type: "listen", mode: "full", hide: false },
    { id: 3, label: "Read Aloud", type: "speak", mode: "full", hide: false },
    { id: 4, label: "Type", type: "type", mode: "full", hide: false },
    { id: 5, label: "Speak (First Letter)", type: "speak", mode: "first-letter", hide: false },
    { id: 6, label: "Type (First Letter)", type: "type", mode: "first-letter", hide: false },
    { id: 7, label: "Speak (Hidden)", type: "speak", mode: "hidden", hide: true },
    { id: 8, label: "Type (Hidden)", type: "type", mode: "hidden", hide: true },
];

// --- Helper Functions ---

const cleanText = (text: string) => text.replace(/[.,/#!$%^&*;:{}=\-_`~()"']/g, "").toLowerCase().trim();

// Levenshtein distance for fuzzy matching
const levenshteinDistance = (a: string, b: string): number => {
    const matrix = [];

    for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i];
    }

    for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) == a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1, // substitution
                    Math.min(
                        matrix[i][j - 1] + 1, // insertion
                        matrix[i - 1][j] + 1 // deletion
                    )
                );
            }
        }
    }

    return matrix[b.length][a.length];
};

const calculateSimilarity = (str1: string, str2: string): number => {
    if (!str1 || !str2) return 0;
    const longer = str1.length > str2.length ? str1 : str2;
    if (longer.length === 0) return 1.0;
    return (longer.length - levenshteinDistance(str1, str2)) / longer.length;
};

// --- Main Component ---

export default function PracticeMode({ verse, onComplete, onExit, initialStep = 0, isRefresh = false }: PracticeModeProps) {
    // Determine initial internal step based on DB state or override for refresh
    const [currentStepIndex, setCurrentStepIndex] = useState(() => {
        if (initialStep) return Math.min(Math.max(0, initialStep - 1), 7);
        const step = verse.currentStep || 0;
        return Math.min(Math.max(0, step), 7);
    });

    const step = STEPS[currentStepIndex];
    const [userInput, setUserInput] = useState('');
    const [isListening, setIsListening] = useState(false);
    const [feedback, setFeedback] = useState<'neutral' | 'success' | 'error'>('neutral');
    const [accuracy, setAccuracy] = useState(0);

    const [audioUrl, setAudioUrl] = useState<string | undefined>(undefined);
    const [isAudioLoading, setIsAudioLoading] = useState(false);

    // New state for lazy-loaded text
    const [verseText, setVerseText] = useState<string | null>(verse.text || null);
    const [isTextLoading, setIsTextLoading] = useState(false);

    const recognitionRef = useRef<any>(null);

    // --- Lazy Load Text if Missing ---
    useEffect(() => {
        if (!verseText && verse.reference) {
            const fetchText = async () => {
                setIsTextLoading(true);
                try {
                    const text = await getBibleText({ reference: verse.reference });
                    if (text) {
                        setVerseText(text);
                        // Persist it back to DB so we don't fetch every time
                        await updateVerseText(verse.id, text);
                    }
                } catch (error) {
                    console.error("Failed to fetch verse text:", error);
                    toast.error("Could not load verse text. Please try again.");
                } finally {
                    setIsTextLoading(false);
                }
            };
            fetchText();
        }
    }, [verse.id, verse.reference, verseText]);


    // --- Speech Setup ---
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const SpeechClass = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
            if (SpeechClass) {
                const recognition = new SpeechClass();
                recognition.continuous = true;
                recognition.interimResults = true;
                recognition.lang = 'en-US';

                recognition.onresult = (event: any) => {
                    let fullTranscript = '';
                    for (let i = 0; i < event.results.length; i++) {
                        fullTranscript += event.results[i][0].transcript;
                    }
                    setUserInput(fullTranscript);
                };

                recognition.onend = () => setIsListening(false);
                recognitionRef.current = recognition;
            }
        }
    }, []);

    // --- Audio Fetching (Step 2) ---
    useEffect(() => {
        if (step.type === 'listen' && verse.reference && !audioUrl) {
            const fetchAudio = async () => {
                setIsAudioLoading(true);
                try {
                    const res = await getBibleAudio({ reference: verse.reference });
                    if (res?.audioUrl) {
                        setAudioUrl(res.audioUrl);
                    }
                } catch (error) {
                    console.error("Failed to fetch audio:", error);
                } finally {
                    setIsAudioLoading(false);
                }
            };
            fetchAudio();
        }
    }, [step.type, verse.reference, audioUrl]);

    // --- Validation Logic ---
    useEffect(() => {
        // Use verseText state instead of prop
        if (!verseText) return;
        if (step.type === 'read' || step.type === 'listen') return; // No validation needed

        const targetClean = cleanText(verseText);
        const inputClean = cleanText(userInput);

        if (!targetClean) return;

        // NEW: Fuzzy matching using Levenshtein distance
        const similarity = calculateSimilarity(inputClean, targetClean);
        const newAccuracy = Math.round(similarity * 100);
        setAccuracy(newAccuracy);

        // Threshold: 85% accuracy is enough to pass
        if (newAccuracy >= 85) {
            setFeedback('success');
            if (isListening && recognitionRef.current) recognitionRef.current.stop();
        } else {
            setFeedback('neutral');
        }

    }, [userInput, verseText, step.type, isListening]);

    // --- Handlers ---

    const handleNext = async () => {
        const nextStepNum = step.id;

        // Optimistic UI update only if NOT in refresh mode (don't mess up history/stats?)
        // Or we update it to show they did it. 
        if (!isRefresh) {
            await updateVerseProgress(verse.id, nextStepNum);
        }

        if (currentStepIndex < STEPS.length - 1) {
            setCurrentStepIndex(prev => prev + 1);
            setUserInput('');
            setFeedback('neutral');
            setAccuracy(0);
        } else {
            if (isRefresh) {
                await refreshVerse(verse.id);
            }
            onComplete();
        }
    };

    const handleBack = () => {
        if (currentStepIndex > 0) {
            setCurrentStepIndex(prev => prev - 1);
            setUserInput('');
            setFeedback('neutral');
            setAccuracy(0);
            setIsListening(false);
            if (recognitionRef.current) recognitionRef.current.stop();
        }
    };

    const handleRetry = () => {
        setUserInput('');
        setFeedback('neutral');
        setAccuracy(0);
        setIsListening(false);
        if (recognitionRef.current) recognitionRef.current.stop();
    };

    const handleNeedsPractice = async () => {
        if (confirm("Moving this verse back to 'Learning' will reset your progress. Are you sure?")) {
            await resetVerseMastery(verse.id);
            onExit();
        }
    };

    const toggleListening = () => {
        if (isListening) {
            recognitionRef.current?.stop();
            setIsListening(false);
        } else {
            setUserInput('');
            recognitionRef.current?.start();
            setIsListening(true);
        }
    };

    // --- Render Helpers ---

    const renderVerseDisplay = () => {
        // Handle loading state explicitly
        if (!verseText) {
            return (
                <div className="flex flex-col items-center gap-2 text-qc-text-muted">
                    {isTextLoading ? (
                        <>
                            <div className="animate-spin h-5 w-5 border-2 border-qc-primary border-t-transparent rounded-full" />
                            <p>Fetching verse text...</p>
                        </>
                    ) : (
                        <p>Text missing. Please try reloading.</p>
                    )}
                </div>
            );
        }

        if (step.mode === 'hidden') {
            return (
                <div className="text-center italic text-qc-text-muted py-8">
                    (Verse Hidden)
                </div>
            );
        }

        const words = verseText.split(/\s+/);
        return (
            <div className="flex flex-wrap gap-2 text-xl leading-relaxed justify-center font-serif text-qc-black">
                {words.map((word, i) => {
                    let display = word;
                    if (step.mode === 'first-letter') {
                        const firstLet = word.match(/[a-zA-Z0-9]/)?.[0] || "";
                        const punctuation = word.match(/[^a-zA-Z0-9]*$/)?.[0] || "";
                        display = word.length > 1 ? `${firstLet}___${punctuation}` : word;
                    }
                    return <span key={i}>{display}</span>;
                })}
            </div>
        );
    };

    return (
        <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in zoom-in-95 duration-300">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex gap-2">
                    <Button variant="ghost" onClick={onExit} className="gap-2 text-muted-foreground w-24 justify-start p-0 hover:bg-transparent hover:text-foreground">
                        <ArrowLeft className="h-4 w-4" /> {isRefresh ? "Done" : "Exit"}
                    </Button>
                </div>

                <div className="text-center">
                    <h2 className="text-2xl font-bold text-qc-primary">{verse.reference}</h2>
                    <p className="text-sm text-muted-foreground font-medium">
                        {isRefresh ? "Mastery Refresh" : `Step ${step.id} of 8: ${step.label}`}
                    </p>
                </div>

                <div className="flex gap-2 w-24 justify-end">
                    {currentStepIndex > 0 && (
                        <Button variant="ghost" size="icon" onClick={handleBack} title="Previous Step">
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                    )}
                    <Button variant="ghost" size="icon" onClick={handleRetry} title="Reset Step">
                        <ArrowCounterClockwise className="h-5 w-5" />
                    </Button>
                </div>
            </div>

            {/* Progress Bar */}
            <Progress value={(currentStepIndex / 8) * 100} className="h-2 w-full" />

            {/* Main Content */}
            <Card className="min-h-[400px] flex flex-col items-center justify-center p-8 bg-qc-warning-bg/50 border-qc-primary/20 shadow-sm relative">

                {isRefresh && (
                    <div className="absolute top-4 right-4">
                        <Button variant="ghost" className="text-xs text-qc-warning-text hover:text-qc-warning-text hover:bg-qc-warning-bg" onClick={handleNeedsPractice}>
                            I need practice 😓
                        </Button>
                    </div>
                )}

                <CardContent className="w-full space-y-10 text-center">

                    {/* Verse Display */}
                    <div className="min-h-[100px] flex items-center justify-center">
                        {renderVerseDisplay()}
                    </div>

                    {/* Action Area */}
                    <div className="w-full max-w-md mx-auto space-y-6">

                        {step.type === 'read' && (
                            <Button size="lg" className="w-full h-12 text-lg gap-2" onClick={handleNext} disabled={!verseText}>
                                I have read it silently <ArrowRight className="h-5 w-5" />
                            </Button>
                        )}

                        {step.type === 'listen' && (
                            <div className="space-y-4">
                                <div className="p-4 bg-white rounded-xl shadow-sm border text-left">
                                    <h3 className="text-sm font-semibold text-qc-text-muted mb-2 uppercase tracking-wider">ESV Audio Bible</h3>
                                    <BibleAudioPlayer
                                        audioUrl={audioUrl}
                                        reference={verse.reference}
                                        isLoading={isAudioLoading}
                                    />
                                </div>
                                <Button size="lg" className="w-full h-12 text-lg gap-2" onClick={handleNext} disabled={!verseText}>
                                    I have listened <ArrowRight className="h-5 w-5" />
                                </Button>
                            </div>
                        )}

                        {step.type === 'speak' && (
                            <div className="space-y-4">
                                <button
                                    className={cn(
                                        "w-full p-8 border-2 border-dashed rounded-2xl transition-all duration-300 flex flex-col items-center gap-3",
                                        isListening ? "border-qc-error bg-qc-error-bg scale-[1.02]" : "border-qc-border-subtle hover:border-qc-border-subtle hover:bg-white",
                                        !verseText && "opacity-50 cursor-not-allowed"
                                    )}
                                    onClick={verseText ? toggleListening : undefined}
                                    disabled={!verseText}
                                >
                                    <div className={cn("p-4 rounded-full bg-white shadow-sm", isListening && "animate-pulse ring-4 ring-qc-error-bg")}>
                                        <Microphone className={cn("h-8 w-8", isListening ? "text-qc-error" : "text-qc-text-muted")} />
                                    </div>
                                    <p className="font-medium text-qc-text-muted">{isListening ? "Listening..." : "Tap to Speak"}</p>
                                </button>

                                <div className="min-h-[2rem] text-sm text-qc-text-muted font-medium space-y-1">
                                    {userInput ? (
                                        <>
                                            <p className="italic">&quot;{userInput}&quot;</p>
                                            <p className="text-xs text-muted-foreground">Accuracy: {accuracy}%</p>
                                        </>
                                    ) : "..."}
                                </div>

                                {feedback === 'success' && (
                                    <Button size="lg" className="w-full h-12 text-lg gap-2 bg-qc-success hover:bg-qc-success/90 animate-in fade-in slide-in-from-bottom-2" onClick={handleNext}>
                                        Perfect! Next Step <ArrowRight className="h-5 w-5" />
                                    </Button>
                                )}

                                {/* Manual Override */}
                                {feedback !== 'success' && userInput.length > 5 && (
                                    <Button variant="ghost" className="text-xs text-muted-foreground w-full hover:text-qc-primary" onClick={handleNext}>
                                        I said it correctly, mark as done
                                    </Button>
                                )}
                            </div>
                        )}

                        {step.type === 'type' && (
                            <div className="space-y-4">
                                <Textarea
                                    value={userInput}
                                    onChange={(e) => setUserInput(e.target.value)}
                                    placeholder="Type the passage here..."
                                    className="min-h-[120px] text-lg p-4 font-serif resize-none focus:ring-qc-primary"
                                    autoFocus
                                    disabled={!verseText}
                                />
                                {feedback === 'success' && (
                                    <Button size="lg" className="w-full h-12 text-lg gap-2 bg-qc-success hover:bg-qc-success/90 animate-in fade-in slide-in-from-bottom-2" onClick={handleNext}>
                                        Correct! Next Step <ArrowRight className="h-5 w-5" />
                                    </Button>
                                )}

                                {/* Manual Override */}
                                {feedback !== 'success' && userInput.length > 5 && (
                                    <Button variant="ghost" className="text-xs text-muted-foreground w-full hover:text-qc-primary" onClick={handleNext}>
                                        I typed it correctly, mark as done
                                    </Button>
                                )}
                            </div>
                        )}

                    </div>

                </CardContent>
            </Card>

        </div>
    );
}
