'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { PrayerEntry, PrayerEntryInput } from '@/server/actions/prayer-journal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { TextB, TextItalic, ListBullets, Pencil, FloppyDisk, X, Lock, LockOpen, Tag as TagIcon, Calendar as CalendarIcon, Quotes } from '@phosphor-icons/react/dist/ssr';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

interface PrayerJournalEditorProps {
    entry: PrayerEntry | null;
    isEditing: boolean;
    isCreating: boolean;
    categories: string[];
    onSave: (data: PrayerEntryInput) => void | Promise<void>;
    onSaveAndClose?: (data: PrayerEntryInput) => void | Promise<void>;
    onCancel: () => void;
    onEdit: () => void;
    initialTitle?: string;
    initialCategory?: string;
}

export default function PrayerJournalEditor({
    entry,
    isEditing,
    isCreating,
    categories,
    onSave,
    onSaveAndClose,
    onCancel,
    onEdit,
    initialTitle = '',
    initialCategory = ''
}: PrayerJournalEditorProps) {
    // Form State
    const [title, setTitle] = useState(entry?.title || initialTitle || '');
    const [date, setDate] = useState<Date>(entry?.date ? new Date(entry.date) : new Date());
    const [tags, setTags] = useState<string[]>(entry?.tags || []);
    const [tagInput, setTagInput] = useState('');
    const [category, setCategory] = useState(entry?.category || initialCategory || '');
    const [isPrivate, setIsPrivate] = useState(entry?.isPrivate || false);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
    const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // TipTap Editor
    const editor = useEditor({
        extensions: [StarterKit],
        content: entry?.content || '<p></p>',
        editable: isEditing,
        editorProps: {
            attributes: {
                class: 'prose prose-sm sm:prose lg:prose-lg xl:prose-xl focus:outline-none min-h-[300px] w-full',
            },
        },
        immediatelyRender: false,
    });

    // Update editor content when entry changes or mode changes
    useEffect(() => {
        if (editor && entry) {
            // Only update content if it's different to prevent cursor jumps, 
            // though key prop on parent usually handles full remounts for simple cases
            if (editor.getHTML() !== entry.content) {
                editor.commands.setContent(entry.content);
            }
        } else if (editor && isCreating) {
            // editor.commands.setContent('<p></p>');
        }
    }, [entry, editor, isCreating]);

    useEffect(() => {
        if (editor) {
            editor.setEditable(isEditing);
        }
    }, [isEditing, editor]);

    // Auto-save: debounced save on content/metadata changes.
    // Non-destructive: it ONLY persists (via onSave) and updates saveStatus.
    // It must never navigate, reload, or flip edit mode — that is the parent's
    // job for the explicit Save/Cancel buttons.
    const triggerAutoSave = useCallback(() => {
        if (!isEditing || !editor) return;
        if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = setTimeout(async () => {
            setSaveStatus('saving');
            const data: PrayerEntryInput = {
                title: title || 'Untitled Entry',
                content: editor.getHTML(),
                date: date,
                tags: tags,
                isPrivate: isPrivate,
                category: category || null,
            };
            try {
                await onSave(data);
            } finally {
                setSaveStatus('saved');
                setTimeout(() => setSaveStatus('idle'), 2000);
            }
        }, 1500);
    }, [isEditing, editor, title, date, tags, isPrivate, category, onSave]);

    // Watch metadata changes for auto-save
    useEffect(() => {
        if (isEditing && (entry || isCreating)) {
            triggerAutoSave();
        }
        return () => {
            if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
        };
    }, [title, date, tags, isPrivate, category, triggerAutoSave, isEditing, entry, isCreating]);

    // Watch editor content changes for auto-save
    useEffect(() => {
        if (!editor || !isEditing) return;
        const handler = () => triggerAutoSave();
        editor.on('update', handler);
        return () => { editor.off('update', handler); };
    }, [editor, isEditing, triggerAutoSave]);

    // Handlers
    // Explicit Save button: cancel any pending autosave (so it can't fire a
    // redundant write after we finalize) and persist immediately. If the parent
    // provided onSaveAndClose it finalizes (e.g. exits edit mode for the
    // create-then-close flow); otherwise it falls back to the in-place onSave.
    const handleSaveClick = () => {
        if (!editor) return;
        if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
        const data: PrayerEntryInput = {
            title: title || 'Untitled Entry',
            content: editor.getHTML(),
            date: date,
            tags: tags,
            isPrivate: isPrivate,
            category: category || null,
        };
        (onSaveAndClose ?? onSave)(data);
    };

    const handleAddTag = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && tagInput.trim()) {
            if (!tags.includes(tagInput.trim())) {
                setTags([...tags, tagInput.trim()]);
            }
            setTagInput('');
        }
    };

    const removeTag = (tagToRemove: string) => {
        setTags(tags.filter(tag => tag !== tagToRemove));
    };

    if (!entry && !isCreating) {
        return (
            <div className="h-full flex items-center justify-center bg-white rounded-qc-lg shadow-sm border border-qc-border-subtle/50 text-qc-text-muted">
                <div className="text-center">
                    <Quotes className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>Select an entry to view or create a new one.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col bg-white rounded-qc-lg shadow-qc-lg border border-qc-border-subtle/50 overflow-hidden">
            {/* Toolbar / Header */}
            <div className="p-4 border-b border-qc-border-subtle/50 flex flex-col gap-4 bg-qc-parchment/10">
                {/* Top Row: Title & Actions */}
                <div className="flex justify-between items-start gap-4">
                    <div className="flex-1">
                        {isEditing ? (
                            <Input
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="Entry Title"
                                className="text-2xl font-display font-bold text-qc-primary border-transparent hover:border-qc-border-subtle focus:border-qc-primary bg-transparent p-0 h-auto placeholder:text-qc-primary/30"
                            />
                        ) : (
                            <h1 className="text-2xl font-display font-bold text-qc-primary text-balance">
                                {entry?.title || "Untitled Entry"}
                            </h1>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        {/* View Mode Actions */}
                        {!isEditing && (
                            <Button
                                onClick={onEdit}
                                variant="outline"
                                size="sm"
                                className="border-qc-primary text-qc-primary hover:bg-qc-primary hover:text-white"
                            >
                                <Pencil className="w-4 h-4 mr-2" />
                                Edit
                            </Button>
                        )}

                        {/* Edit Mode Actions */}
                        {isEditing && (
                            <>
                                <Button
                                    onClick={handleSaveClick}
                                    size="sm"
                                    className="bg-qc-primary text-white hover:bg-qc-primary/90"
                                >
                                    <FloppyDisk className="w-4 h-4 mr-2" />
                                    Save
                                </Button>
                                {saveStatus !== 'idle' && (
                                    <span aria-live="polite" className="text-xs text-qc-text-muted">
                                        {saveStatus === 'saving' ? 'Saving...' : 'Saved'}
                                    </span>
                                )}
                                <Button
                                    onClick={onCancel}
                                    variant="ghost"
                                    size="sm"
                                >
                                    Cancel
                                </Button>
                            </>
                        )}
                    </div>
                </div>

                {/* Metadata Row */}
                <div className="flex flex-wrap items-center gap-4 text-sm">
                    {/* Date Picker */}
                    <div className="flex items-center gap-2">
                        <CalendarIcon className="w-4 h-4 text-qc-text-muted" />
                        {isEditing ? (
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" className="h-8 text-xs font-normal">
                                        {format(date, "PPP")}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0">
                                    <Calendar
                                        mode="single"
                                        selected={date}
                                        onSelect={(d: Date | undefined) => d && setDate(d)}
                                        initialFocus
                                    />
                                </PopoverContent>
                            </Popover>
                        ) : (
                            <span className="text-qc-charcoal">{format(date, "PPP")}</span>
                        )}
                    </div>

                    {/* Category */}
                    <div className="flex items-center gap-2 min-w-[150px]">
                        <TagIcon className="w-4 h-4 text-qc-text-muted" />
                        {isEditing ? (
                            <Select value={category} onValueChange={setCategory}>
                                <SelectTrigger className="h-8 text-xs">
                                    <SelectValue placeholder="No Category" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">No Category</SelectItem>
                                    {categories.map(c => (
                                        <SelectItem key={c} value={c}>{c}</SelectItem>
                                    ))}
                                    {/* Add 'Other' logic or manual input handled elsewhere for simplicity now */}
                                </SelectContent>
                            </Select>
                        ) : (
                            <span className="text-qc-charcoal">{category || "No Category"}</span>
                        )}
                    </div>

                    {/* Private Toggle */}
                    <div className="flex items-center gap-2">
                        {isEditing ? (
                            <div className="flex items-center space-x-2">
                                <Switch id="private-mode" checked={isPrivate} onCheckedChange={setIsPrivate} />
                                <Label htmlFor="private-mode" className="text-xs text-qc-text-muted">
                                    {isPrivate ? "Private" : "Public"}
                                </Label>
                            </div>
                        ) : (
                            isPrivate && (
                                <Badge variant="outline" className="gap-1 text-qc-text-muted">
                                    <Lock className="w-3 h-3" weight="fill" /> Private
                                </Badge>
                            )
                        )}
                    </div>
                </div>

                {/* Tags Row */}
                <div className="flex flex-wrap items-center gap-2">
                    {tags.map(tag => (
                        <Badge key={tag} variant="secondary" className="flex items-center gap-1">
                            {tag}
                            {isEditing && (
                                <X
                                    className="w-3 h-3 cursor-pointer hover:text-qc-error"
                                    onClick={() => removeTag(tag)}
                                />
                            )}
                        </Badge>
                    ))}
                    {isEditing && (
                        <Input
                            value={tagInput}
                            onChange={(e) => setTagInput(e.target.value)}
                            onKeyDown={handleAddTag}
                            placeholder="+ Add tag (Enter)"
                            className="w-32 h-6 text-xs bg-transparent border-transparent hover:border-qc-border-subtle focus:border-qc-primary px-1"
                        />
                    )}
                </div>
            </div>

            {/* Editor Content */}
            <div className="flex-1 overflow-auto bg-white relative">
                {/* Formatting Toolbar (Floating or Fixed) - Visible only in Edit Mode */}
                {isEditing && editor && (
                    <div className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b border-qc-border-subtle/30 p-2 flex gap-1">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => editor.chain().focus().toggleBold().run()}
                            className={editor.isActive('bold') ? 'bg-qc-parchment text-qc-primary' : ''}
                        >
                            <TextB className="w-4 h-4" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => editor.chain().focus().toggleItalic().run()}
                            className={editor.isActive('italic') ? 'bg-qc-parchment text-qc-primary' : ''}
                        >
                            <TextItalic className="w-4 h-4" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => editor.chain().focus().toggleBulletList().run()}
                            className={editor.isActive('bulletList') ? 'bg-qc-parchment text-qc-primary' : ''}
                        >
                            <ListBullets className="w-4 h-4" />
                        </Button>
                    </div>
                )}
                <div className="p-6 h-full font-body text-qc-charcoal leading-relaxed">
                    <EditorContent editor={editor} />
                </div>
            </div>
        </div>
    );
}
