'use client';

import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Plus, CheckCircle, BookOpen, Trophy, Folder, FolderPlus, DotsThreeVertical, Trash, PencilSimple, ArrowCounterClockwise, ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import { addVerseToUser, createFolder, deleteFolder, renameFolder, moveVerseToFolder, deleteUserVerse } from './actions';
import PracticeMode from './PracticeMode';
import { toast } from 'sonner';

interface BibleMemoryDashboardProps {
    initialUserVerses: any[];
    libraryVerses: any[];
    studentId: string; // Current user context
    folders: any[];
}

export default function BibleMemoryDashboard({ initialUserVerses, libraryVerses, studentId, folders: initialFolders }: BibleMemoryDashboardProps) {
    const [verses, setVerses] = useState(initialUserVerses);
    const [folders, setFolders] = useState(initialFolders);
    const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null); // null = All Verses

    const [practicingVerse, setPracticingVerse] = useState<any | null>(null);
    const [practiceMode, setPracticeMode] = useState<'standard' | 'refresh'>('standard');

    const [isAddVerseOpen, setIsAddVerseOpen] = useState(false);
    const [isAddFolderOpen, setIsAddFolderOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [customRef, setCustomRef] = useState("");
    const [newFolderName, setNewFolderName] = useState("");

    const [isDragging, setIsDragging] = useState(false);
    const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);

    // --- Derived State ---
    const filteredVerses = selectedFolderId
        ? verses.filter(v => (v as any).folderId === selectedFolderId)
        : verses.filter(v => !(v as any).folderId); // If root (null state), only show unfiled verses

    const learningVerses = filteredVerses.filter(v => ((v as any).currentStep || 0) < 8);
    const masteredVerses = filteredVerses.filter(v => ((v as any).currentStep || 0) >= 8);

    // --- DnD Handlers ---

    const handleDragStart = (e: React.DragEvent, verseId: string) => {
        e.dataTransfer.setData("verseId", verseId);
        e.dataTransfer.effectAllowed = "move";
        setIsDragging(true);
    };

    const handleDragEnd = () => {
        setIsDragging(false);
        setDragOverFolderId(null);
    };

    const handleDragOver = (e: React.DragEvent, folderId: string) => {
        e.preventDefault();
        setDragOverFolderId(folderId);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setDragOverFolderId(null);
    };

    const handleDropOnFolder = async (e: React.DragEvent, folderId: string) => {
        e.preventDefault();
        setDragOverFolderId(null);
        const verseId = e.dataTransfer.getData("verseId");
        if (verseId) {
            await handleMoveVerse(verseId, folderId);
            toast.success("Verse moved to folder");
        }
    };

    const handleDropOnTrash = async (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const verseId = e.dataTransfer.getData("verseId");
        if (verseId) {
            await handleDeleteVerse(verseId);
        }
    };

    // --- Render Helpers ---

    const renderFolderCards = () => {
        // Only show folders in the Root view (when no folder is selected)
        if (selectedFolderId) return null;

        return folders.map(folder => (
            <Card
                key={folder.id}
                className={`hover:shadow-md transition-all cursor-pointer bg-qc-info-bg/30 border-2 group relative
                    ${dragOverFolderId === folder.id ? 'border-qc-primary bg-qc-info-bg scale-105 shadow-xl' : 'border-dashed border-qc-info-border hover:border-solid'}
                `}
                onClick={() => setSelectedFolderId(folder.id)}
                onDragOver={(e) => handleDragOver(e, folder.id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDropOnFolder(e, folder.id)}
            >
                <div className="absolute top-2 right-2 z-10">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-qc-primary/60 hover:text-qc-primary hover:bg-qc-info-bg/50"><DotsThreeVertical weight="bold" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent onClick={e => e.stopPropagation()}>
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleRenameFolder(folder.id, folder.name); }}>
                                <PencilSimple className="mr-2 h-4 w-4" /> Rename
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleDeleteFolder(folder.id); }} className="text-qc-error">
                                <Trash className="mr-2 h-4 w-4" /> Delete
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
                <CardContent className="p-6 flex flex-col items-center justify-center text-center space-y-3 min-h-[220px]">
                    <div className="p-4 bg-qc-info-bg rounded-full text-qc-primary">
                        <Folder className="h-8 w-8" weight="fill" />
                    </div>
                    <div className="space-y-1 w-full">
                        <h3 className="font-bold text-lg text-qc-charcoal truncate px-2">{folder.name}</h3>
                        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{folder._count?.verses || 0} Verses</p>
                    </div>
                </CardContent>
            </Card>
        ));
    };

    // --- Handlers ---

    const handleCreateFolder = async () => {
        if (!newFolderName) return;
        const res = await createFolder(studentId, newFolderName);
        if (res.success && res.folder) {
            setFolders([...folders, res.folder]);
            setNewFolderName("");
            setIsAddFolderOpen(false);
            toast.success("Folder created");
        } else {
            toast.error(res.error || "Failed to create folder");
        }
    };

    const handleDeleteFolder = async (id: string) => {
        if (!confirm("Are you sure? Verses in this folder will be unfiled.")) return;
        const res = await deleteFolder(id);
        if (res.success) {
            setFolders(folders.filter(f => f.id !== id));
            if (selectedFolderId === id) setSelectedFolderId(null);
            // Update local verses to remove folderId
            setVerses(verses.map(v => (v as any).folderId === id ? { ...v, folderId: null } : v));
            toast.success("Folder deleted");
        } else {
            toast.error("Failed to delete folder");
        }
    };

    const handleRenameFolder = async (id: string, oldName: string) => {
        const newName = prompt("Enter new name:", oldName);
        if (newName && newName !== oldName) {
            const res = await renameFolder(id, newName);
            if (res.success) {
                setFolders(folders.map(f => f.id === id ? { ...f, name: newName } : f));
                toast.success("Folder renamed");
            } else {
                toast.error("Failed to rename");
            }
        }
    };

    const handleAddLibraryVerse = async (verse: any) => {
        setIsAddVerseOpen(false);
        const res = await addVerseToUser({
            studentId,
            reference: verse.reference,
            text: verse.text
        });
        if (res.success && res.verse) {
            // Apply current folder if selected
            if (selectedFolderId) {
                await moveVerseToFolder(res.verse.id, selectedFolderId);
                (res.verse as any).folderId = selectedFolderId;
            }
            setVerses([res.verse, ...verses]);
            toast.success("Verse added");
        }
    };

    const handleDeleteVerse = async (id: string) => {
        if (!confirm("Are you sure you want to delete this verse?")) return;
        const res = await deleteUserVerse(id);
        if (res.success) {
            setVerses(verses.filter(v => v.id !== id));
            toast.success("Verse deleted");
        } else {
            toast.error("Failed to delete verse");
        }
    };

    const handleAddCustomVerse = async () => {
        if (!customRef) return;
        setIsAddVerseOpen(false);
        const res = await addVerseToUser({
            studentId,
            reference: customRef,
        });
        if (res.success && res.verse) {
            if (selectedFolderId) {
                await moveVerseToFolder(res.verse.id, selectedFolderId);
                (res.verse as any).folderId = selectedFolderId;
            }
            setVerses([res.verse, ...verses]);
            toast.success("Verse added");
            setCustomRef("");
        }
    };
    const handleMoveVerse = async (verseId: string, folderId: string | null) => {
        const res = await moveVerseToFolder(verseId, folderId);
        if (res.success) {
            setVerses(verses.map(v => v.id === verseId ? { ...v, folderId } : v));
            toast.success("Verse moved");
        }
    };

    const handlePracticeComplete = () => {
        if (practicingVerse) {
            setVerses(prev => prev.map(v => {
                if (v.id !== practicingVerse.id) return v;

                if (practiceMode === 'refresh') {
                    return { ...v, lastRefreshedAt: new Date() };
                } else {
                    return { ...v, currentStep: 8, masteredAt: new Date() };
                }
            }));
        }
        setPracticingVerse(null);
        setPracticeMode('standard');
    };

    // --- Render ---

    if (practicingVerse) {
        return (
            <PracticeMode
                verse={practicingVerse}
                onComplete={handlePracticeComplete}
                onExit={() => { setPracticingVerse(null); setPracticeMode('standard'); }}
                initialStep={practiceMode === 'refresh' ? 6 : undefined}
                isRefresh={practiceMode === 'refresh'}
            />
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-500 relative min-h-screen">
            {/* Delete Drop Zone - Only visible when dragging */}
            <div
                className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-50 transition-all duration-300 transform 
                    ${isDragging ? 'translate-y-0 opacity-100' : 'translate-y-20 opacity-0 pointer-events-none'}
                `}
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDropOnTrash}
            >
                <div className="bg-qc-error-bg border-2 border-qc-error border-dashed rounded-full h-20 w-20 flex items-center justify-center shadow-2xl hover:bg-qc-error-bg hover:scale-110 transition-transform cursor-pointer">
                    <Trash className="h-8 w-8 text-qc-error" weight="fill" />
                </div>
                <p className="text-center font-bold text-qc-error mt-2 bg-white/80 backdrop-blur px-2 rounded-full text-xs shadow-sm">Drop to Delete</p>
            </div>

            {/* Dialogs (mounted unconditionally so both empty-state CTAs and toolbar buttons can open them) */}
            <Dialog open={isAddFolderOpen} onOpenChange={setIsAddFolderOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>New Folder</DialogTitle>
                    </DialogHeader>
                    <div className="gap-4 py-4">
                        <Input placeholder="Folder Name" value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} />
                        <Button className="mt-4 w-full" onClick={handleCreateFolder}>Create Folder</Button>
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={isAddVerseOpen} onOpenChange={setIsAddVerseOpen}>
                <DialogContent className="max-w-xl">
                    <DialogHeader>
                        <DialogTitle>Add a Verse</DialogTitle>
                        <DialogDescription>Choose from our library or add your own.</DialogDescription>
                    </DialogHeader>

                    <Tabs defaultValue="library">
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="library">Library</TabsTrigger>
                            <TabsTrigger value="custom">Custom</TabsTrigger>
                        </TabsList>

                        <TabsContent value="library" className="space-y-4 max-h-[400px] overflow-y-auto pt-4">
                            <Input
                                placeholder="Search verses..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                            <div className="grid grid-cols-1 gap-2">
                                {libraryVerses
                                    .filter(v => v.reference.toLowerCase().includes(searchQuery.toLowerCase()))
                                    .map(v => (
                                        <div key={v.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-qc-surface-hover">
                                            <span className="font-medium">{v.reference}</span>
                                            <Button size="sm" variant="outline" onClick={() => handleAddLibraryVerse(v)}>Add</Button>
                                        </div>
                                    ))}
                            </div>
                        </TabsContent>

                        <TabsContent value="custom" className="space-y-4 pt-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Verse Reference</label>
                                <Input
                                    placeholder="e.g. John 3:16"
                                    value={customRef}
                                    onChange={(e) => setCustomRef(e.target.value)}
                                />
                                <p className="text-xs text-muted-foreground">We'll automatically fetch the text for you.</p>
                            </div>
                            <Button className="w-full" onClick={handleAddCustomVerse} disabled={!customRef}>
                                Add Verse
                            </Button>
                        </TabsContent>
                    </Tabs>
                </DialogContent>
            </Dialog>

            {/* Header Area */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4 w-full">
                    {selectedFolderId && (
                        <Button variant="outline" size="icon" onClick={() => setSelectedFolderId(null)} className="shrink-0 bg-white shadow-sm border-qc-border-subtle">
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                    )}
                    <div>
                        {selectedFolderId && (
                            <h1 className="text-3xl font-bold text-qc-primary flex items-center gap-2">
                                <Folder className="h-8 w-8 text-qc-primary/60" weight="duotone" />
                                {folders.find(f => f.id === selectedFolderId)?.name}
                            </h1>
                        )}
                        {selectedFolderId && (
                            <p className="text-muted-foreground">Viewing Folder</p>
                        )}
                    </div>
                </div>
            </div>

            {/* Dashboard Tabs */}
            <Tabs defaultValue="learning" className="space-y-6">
                <TabsList className="bg-white border p-1 rounded-xl shadow-sm h-12">
                    <TabsTrigger value="learning" className="gap-2 px-6 h-10 data-[state=active]:bg-qc-primary data-[state=active]:text-white transition-all rounded-lg">
                        <BookOpen className="h-4 w-4" /> Learning ({learningVerses.length})
                    </TabsTrigger>
                    <TabsTrigger value="mastered" className="gap-2 px-6 h-10 data-[state=active]:bg-qc-success data-[state=active]:text-white transition-all rounded-lg">
                        <Trophy className="h-4 w-4" /> Mastered ({masteredVerses.length})
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="learning" className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {/* Empty State: Only if NO folders AND NO verses */}
                    {learningVerses.length === 0 && folders.length === 0 && !selectedFolderId ? (
                        <div className="text-center py-24 border-2 border-dashed rounded-xl bg-qc-surface-raised/50">
                            <div className="bg-white p-4 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center shadow-sm">
                                <BookOpen className="h-8 w-8 text-qc-text-muted" />
                            </div>
                            <h3 className="text-lg font-semibold text-qc-charcoal">Start Memorizing</h3>
                            <p className="text-muted-foreground mb-6 max-w-sm mx-auto">Create a folder to organize references or add your first verse to get started.</p>
                            <div className="flex gap-2 justify-center">
                                <Button variant="outline" onClick={() => setIsAddFolderOpen(true)}>Create Folder</Button>
                                <Button onClick={() => setIsAddVerseOpen(true)}>Add Verse</Button>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {/* Actions Toolbar */}
                            <div className="flex justify-end gap-2">
                                <Button variant="outline" className="gap-2 bg-white" onClick={() => setIsAddFolderOpen(true)}>
                                    <FolderPlus className="h-4 w-4" /> New Folder
                                </Button>

                                <Button className="gap-2 shadow-sm" onClick={() => setIsAddVerseOpen(true)}>
                                    <Plus className="h-4 w-4" /> Add Verse
                                </Button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                {/* 1. Folders (Only visible at root) */}
                                {renderFolderCards()}

                                {/* 2. Verses */}
                                {learningVerses.map(verse => (
                                    <Card key={verse.id}
                                        className={`hover:shadow-lg transition-all duration-300 relative group border-t-4 border-t-qc-primary overflow-hidden cursor-move active:cursor-grabbing hover:scale-[1.02] 
                                            ${isDragging ? 'ring-2 ring-offset-2 ring-qc-primary/20' : ''}
                                        `}
                                        draggable={true}
                                        onDragStart={(e) => handleDragStart(e, verse.id)}
                                        onDragEnd={handleDragEnd}
                                    >
                                        <div className="absolute top-2 right-2 z-10">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-qc-text-muted hover:text-qc-charcoal bg-white/50 backdrop-blur hover:bg-white border border-transparent hover:border-qc-border-subtle shadow-sm"><DotsThreeVertical weight="bold" /></Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuLabel>Move to Folder</DropdownMenuLabel>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem onClick={() => handleMoveVerse(verse.id, null)}>
                                                        <Folder className="mr-2 h-4 w-4 opacity-50" /> None (Unfiled)
                                                    </DropdownMenuItem>
                                                    {folders.map(f => (
                                                        <DropdownMenuItem key={f.id} onClick={() => handleMoveVerse(verse.id, f.id)}>
                                                            <Folder className="mr-2 h-4 w-4 text-qc-primary" /> {f.name}
                                                        </DropdownMenuItem>
                                                    ))}
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem onClick={() => handleDeleteVerse(verse.id)} className="text-qc-error focus:text-qc-error focus:bg-qc-error-bg">
                                                        <Trash className="mr-2 h-4 w-4" /> Delete Verse
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>

                                        <CardContent className="p-6 space-y-6">
                                            <div className="flex justify-between items-start pr-8">
                                                <h3 className="font-bold text-xl text-qc-primary leading-tight">{verse.reference}</h3>
                                            </div>

                                            <div className="space-y-2">
                                                <div className="flex justify-between items-end text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                                    <span>Step {(verse.currentStep || 0) + 1} of 8</span>
                                                    <span>{Math.round(((verse.currentStep || 0) / 8) * 100)}%</span>
                                                </div>
                                                <Progress value={((verse.currentStep || 0) / 8) * 100} className="h-2 rounded-full" />
                                            </div>

                                            <Button className="w-full shadow-sm hover:shadow-md transition-shadow" onClick={() => setPracticingVerse(verse)}>
                                                Continue Practice
                                            </Button>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        </div>
                    )}
                </TabsContent>

                <TabsContent value="mastered" className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {masteredVerses.length === 0 ? (
                        <div className="text-center py-24 border-2 border-dashed rounded-xl bg-qc-surface-raised/50">
                            <div className="bg-white p-4 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center shadow-sm">
                                <Trophy className="h-8 w-8 text-qc-warning" />
                            </div>
                            <h3 className="text-lg font-semibold text-qc-charcoal">No Mastered Verses Yet</h3>
                            <p className="text-muted-foreground mb-6 max-w-sm mx-auto">Keep practicing! Your rewards will appear here.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                            {masteredVerses.map(verse => (
                                <Card key={verse.id} className="bg-qc-success-bg/30 border-qc-success-border relative group border-t-4 border-t-qc-success">
                                    <div className="absolute top-2 right-2 z-10">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-qc-success-text hover:text-qc-success-text hover:bg-qc-success-bg/50"><DotsThreeVertical weight="bold" /></Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem onClick={() => handleDeleteVerse(verse.id)} className="text-qc-error focus:text-qc-error focus:bg-qc-error-bg">
                                                    <Trash className="mr-2 h-4 w-4" /> Delete Verse
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>

                                    <CardContent className="p-6 flex flex-col h-full justify-between gap-6">
                                        <div className="flex items-start gap-4">
                                            <div className="bg-qc-success-bg p-2 rounded-full text-qc-success-text shrink-0">
                                                <CheckCircle weight="fill" className="h-6 w-6" />
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-lg text-qc-charcoal">{verse.reference}</h3>
                                                <p className="text-xs text-qc-success-text font-medium mt-1">
                                                    Mastered {verse.masteredAt ? new Date(verse.masteredAt).toLocaleDateString() : ''}
                                                </p>
                                            </div>
                                        </div>

                                        <Button
                                            variant="outline"
                                            className="w-full gap-2 border-qc-success-border text-qc-success-text hover:bg-qc-success-bg hover:text-qc-success-text bg-white"
                                            onClick={() => {
                                                setPracticeMode('refresh');
                                                setPracticingVerse(verse);
                                            }}
                                        >
                                            <ArrowCounterClockwise className="h-4 w-4" /> Refresh
                                        </Button>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </TabsContent>
            </Tabs>
        </div>
    );
}
