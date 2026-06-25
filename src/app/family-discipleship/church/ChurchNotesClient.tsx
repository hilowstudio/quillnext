
"use client";

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash, ArrowLeft, Calendar, User, BookOpen, MusicNotes, HandsPraying, UsersThree, Lightbulb, Fire } from "@phosphor-icons/react/dist/ssr";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { addChurchNote, deleteChurchNote } from "../actions";
import Link from "next/link";
import { format } from "date-fns";
import { ScrollArea } from "@/components/ui/scroll-area";

type ChurchNote = {
    id: string;
    date: Date;
    preacher: string | null;
    mainPassage: string | null;
    applications: string | null;
    keyReferences?: string | null;
    mainPoints?: string[];
    oneThing?: string | null;
    servingIdeas?: string | null;
    generosityReflection?: string | null;
    communityPlan?: string | null;
    songs?: unknown; // JSON column (the form persists {title,theme}[]; not read back here)
};

export function ChurchNotesClient({ initialNotes }: { initialNotes: ChurchNote[] }) {
    const [isOpen, setIsOpen] = useState(false);
    const [isPending, setIsPending] = useState(false);

    // Form State
    const [mainPoints, setMainPoints] = useState<string[]>(['', '', '']);
    const [songs, setSongs] = useState<{ title: string, theme: string }[]>([{ title: '', theme: '' }]);

    const addSong = () => setSongs([...songs, { title: '', theme: '' }]);
    const updateSong = (index: number, field: 'title' | 'theme', value: string) => {
        const newSongs = [...songs];
        newSongs[index][field] = value;
        setSongs(newSongs);
    };
    const removeSong = (index: number) => {
        setSongs(songs.filter((_, i) => i !== index));
    };

    const updatePoint = (index: number, value: string) => {
        const newPoints = [...mainPoints];
        newPoints[index] = value;
        setMainPoints(newPoints);
    };

    async function handleSubmit(formData: FormData) {
        setIsPending(true);

        // Append complex JSON fields
        formData.append('mainPoints', JSON.stringify(mainPoints.filter(p => p.trim() !== '')));
        formData.append('songs', JSON.stringify(songs.filter(s => s.title.trim() !== '')));

        await addChurchNote(formData);

        // Reset state
        setMainPoints(['', '', '']);
        setSongs([{ title: '', theme: '' }]);
        setIsPending(false);
        setIsOpen(false);
    }

    return (
        <div className="space-y-6">


            <div className="flex justify-end">
                <Dialog open={isOpen} onOpenChange={setIsOpen}>
                    <DialogTrigger asChild>
                        <Button onClick={() => setIsOpen(true)} className="gap-2 bg-qc-primary hover:bg-qc-primary/90">
                            <Plus className="w-4 h-4" /> New Entry
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-4xl h-[90vh] flex flex-col p-0 gap-0">
                        <DialogHeader className="px-6 py-4 border-b">
                            <DialogTitle className="text-xl font-serif text-qc-primary">Add Sermon Note</DialogTitle>
                        </DialogHeader>

                        <div className="flex-1 overflow-y-auto px-6 py-6">
                            <form id="church-note-form" action={handleSubmit} className="space-y-8">
                                {/* Header Section */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <Label htmlFor="date">Date</Label>
                                        <div className="relative">
                                            <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                            <Input type="date" id="date" name="date" className="pl-9" required defaultValue={new Date().toISOString().split('T')[0]} />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="preacher">Preacher</Label>
                                        <div className="relative">
                                            <User className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                            <Input id="preacher" name="preacher" className="pl-9" placeholder="Who preached?" />
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <Label htmlFor="passage">Main Passage</Label>
                                        <div className="relative">
                                            <BookOpen className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                            <Input id="passage" name="passage" className="pl-9" placeholder="e.g. Ephesians 4:1-16" />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="keyReferences">Key References</Label>
                                        <Input id="keyReferences" name="keyReferences" placeholder="Comma-separated references" />
                                    </div>
                                </div>

                                {/* Main Points */}
                                <div className="space-y-3">
                                    <Label className="text-base font-semibold text-qc-primary">Main Sermon Points</Label>
                                    <div className="grid grid-cols-1 gap-3">
                                        {mainPoints.map((point, i) => (
                                            <Input
                                                key={i}
                                                value={point}
                                                onChange={(e) => updatePoint(i, e.target.value)}
                                                placeholder={`Point ${i + 1}`}
                                            />
                                        ))}
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="notes" className="text-base font-semibold text-qc-primary">Notes & Application</Label>
                                    <Textarea id="notes" name="notes" placeholder="How does this truth apply to your life?" className="min-h-[100px]" />
                                </div>

                                {/* The One Thing */}
                                <div className="space-y-4 p-4 bg-qc-warning-bg/50 rounded-lg border border-qc-warning-border">
                                    <div className="flex items-center gap-2">
                                        <Lightbulb className="h-5 w-5 text-qc-warning" />
                                        <Label htmlFor="oneThing" className="text-base font-semibold text-qc-primary">The One Thing (This Week)</Label>
                                    </div>
                                    <Input
                                        id="oneThing"
                                        name="oneThing"
                                        placeholder="What is the one thing to focus on this week?"
                                        className="bg-white"
                                    />
                                    <div className="text-xs text-muted-foreground space-y-1 ml-1">
                                        <p>• What was most challenging or encouraging?</p>
                                        <p>• Is there a promise to hold or a command to obey?</p>
                                    </div>
                                </div>

                                {/* Songs */}
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2">
                                        <MusicNotes className="h-5 w-5 text-qc-primary" />
                                        <Label className="text-base font-semibold text-qc-primary">Songs We Sang</Label>
                                    </div>
                                    <div className="space-y-3">
                                        {songs.map((song, index) => (
                                            <div key={index} className="flex gap-3">
                                                <Input
                                                    value={song.title}
                                                    onChange={(e) => updateSong(index, 'title', e.target.value)}
                                                    placeholder="Song title"
                                                    className="flex-1"
                                                />
                                                <Input
                                                    value={song.theme}
                                                    onChange={(e) => updateSong(index, 'theme', e.target.value)}
                                                    placeholder="Theme (e.g. Grace)"
                                                    className="flex-1"
                                                />
                                                {songs.length > 1 && (
                                                    <Button type="button" variant="ghost" size="icon" onClick={() => removeSong(index)}>
                                                        <Trash className="h-4 w-4 text-muted-foreground" />
                                                    </Button>
                                                )}
                                            </div>
                                        ))}
                                        <Button type="button" variant="outline" size="sm" onClick={addSong} className="mt-2">
                                            <Plus className="mr-2 h-3 w-3" /> Add Song
                                        </Button>
                                    </div>
                                </div>

                                {/* Serving & Generosity */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2">
                                            <HandsPraying className="h-5 w-5 text-qc-primary" />
                                            <Label htmlFor="servingIdeas" className="font-semibold text-qc-primary">Serving Availability</Label>
                                        </div>
                                        <Textarea id="servingIdeas" name="servingIdeas" placeholder="Where can we serve this week?" className="min-h-[80px]" />
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2">
                                            <Label htmlFor="generosityReflection" className="font-semibold text-qc-primary">Generosity Reflection</Label>
                                        </div>
                                        <Textarea id="generosityReflection" name="generosityReflection" placeholder="Reflections on giving..." className="min-h-[80px]" />
                                    </div>
                                </div>

                                {/* Community */}
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2">
                                        <UsersThree className="h-5 w-5 text-qc-primary" />
                                        <Label htmlFor="communityPlan" className="font-semibold text-qc-primary">Community Plan</Label>
                                    </div>
                                    <Textarea id="communityPlan" name="communityPlan" placeholder="Who will we check in on or pray for?" className="min-h-[80px]" />
                                </div>

                            </form>
                        </div>

                        <DialogFooter className="px-6 py-4 border-t bg-qc-surface-raised">
                            <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
                            <Button type="submit" form="church-note-form" disabled={isPending} className="bg-qc-primary hover:bg-qc-primary/90">
                                {isPending ? "Saving..." : "Save Note"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="space-y-4">
                {initialNotes.length === 0 ? (
                    <Card className="border-dashed bg-qc-parchment/30">
                        <CardContent className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                            <BookOpen className="h-12 w-12 mb-4 opacity-20" />
                            <p>No sermon notes yet.</p>
                        </CardContent>
                    </Card>
                ) : (
                    initialNotes.map((note) => (
                        <Card key={note.id} className="bg-white shadow-sm hover:shadow-md transition-all border-qc-border-subtle group">
                            <CardHeader className="bg-qc-parchment/30 border-b border-qc-border-subtle/50 pb-3">
                                <div className="flex justify-between items-start">
                                    <div className="space-y-1">
                                        <CardTitle className="text-lg font-serif text-qc-primary">{format(new Date(note.date), "MMMM do, yyyy")}</CardTitle>
                                        <CardDescription className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs mt-1">
                                            {note.preacher && <span className="flex items-center gap-1"><User className="h-3 w-3" /> {note.preacher}</span>}
                                            {note.mainPassage && <span className="flex items-center gap-1"><BookOpen className="h-3 w-3" /> {note.mainPassage}</span>}
                                        </CardDescription>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-muted-foreground hover:text-qc-error opacity-0 group-hover:opacity-100 transition-opacity"
                                        onClick={() => deleteChurchNote(note.id)}
                                    >
                                        <Trash className="h-4 w-4" />
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent className="pt-4 space-y-3">
                                {note.mainPoints && note.mainPoints.length > 0 && (
                                    <div className="text-sm">
                                        <span className="font-semibold text-qc-primary">Key Points:</span>
                                        <ul className="list-disc list-inside text-qc-text mt-1 space-y-0.5">
                                            {note.mainPoints.slice(0, 3).map((p, i) => (
                                                <li key={i}>{p}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                {note.oneThing && (
                                    <div className="p-3 bg-qc-warning-bg rounded text-sm border border-qc-warning-border">
                                        <span className="font-semibold text-qc-warning-text block mb-1 flex items-center gap-1"><Fire size={16} weight="fill" /> One Thing:</span>
                                        {note.oneThing}
                                    </div>
                                )}

                                {!note.mainPoints?.length && !note.oneThing && (
                                    <p className="whitespace-pre-line text-qc-text leading-relaxed">
                                        {note.applications || "No details recorded."}
                                    </p>
                                )}
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>
        </div >
    );
}
