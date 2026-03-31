'use client';

import React, { useState } from 'react';
import { PrayerEntry } from '@/server/actions/prayer-journal';
import PrayerJournalFilters from './PrayerJournalFilters';
import { Button } from '@/components/ui/button';
import { Plus, MagnifyingGlass, Lock, Trash, HandsPraying } from '@phosphor-icons/react/dist/ssr';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

interface PrayerJournalSidebarProps {
    entries: PrayerEntry[];
    selectedEntry: PrayerEntry | null;
    onEntrySelect: (entry: PrayerEntry) => void;
    onNewEntry: () => void;
    onDeleteEntry: (entry: PrayerEntry) => void;
    // Filter State
    filterDate: string;
    setFilterDate: (date: string) => void;
    filterCategory: string;
    setFilterCategory: (category: string) => void;
    filterTags: string[];
    setFilterTags: (tags: string[]) => void;
    uniqueCategories: string[];
    uniqueTags: string[];
    showFilters: boolean;
    setShowFilters: (show: boolean) => void;
}

export default function PrayerJournalSidebar({
    entries,
    selectedEntry,
    onEntrySelect,
    onNewEntry,
    onDeleteEntry,
    filterDate,
    setFilterDate,
    filterCategory,
    setFilterCategory,
    filterTags,
    setFilterTags,
    uniqueCategories,
    uniqueTags,
    showFilters,
    setShowFilters
}: PrayerJournalSidebarProps) {
    const [searchQuery, setSearchQuery] = useState('');

    // Filter Logic
    const filteredEntries = entries.filter(entry => {
        // Search
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            const matchesTitle = entry.title.toLowerCase().includes(query);
            const matchesContent = entry.content.toLowerCase().includes(query);
            if (!matchesTitle && !matchesContent) return false;
        }
        // Date
        if (filterDate) {
            const entryDate = new Date(entry.date).toDateString();
            const targetDate = new Date(filterDate).toDateString();
            if (entryDate !== targetDate) return false;
        }
        // Category
        if (filterCategory && filterCategory !== 'all') {
            if (entry.category !== filterCategory) return false;
        }
        // Tags
        if (filterTags.length > 0) {
            const hasTag = filterTags.some(tag => entry.tags.includes(tag));
            if (!hasTag) return false;
        }
        return true;
    });

    return (
        <div className="flex flex-col h-full bg-white rounded-qc-lg shadow-sm border border-qc-border-subtle/50 overflow-hidden">
            {/* Header / Actions */}
            <div className="p-4 border-b border-qc-border-subtle/50 space-y-4 bg-qc-parchment/20">
                <Button
                    onClick={onNewEntry}
                    className="w-full bg-qc-primary text-white hover:bg-qc-primary/90 shadow-md"
                >
                    <Plus className="w-5 h-5 mr-2" weight="bold" />
                    New Prayer Entry
                </Button>

                <div className="relative">
                    <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 text-qc-text-muted w-4 h-4" />
                    <Input
                        placeholder="Search entries..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 bg-white"
                    />
                </div>

                <PrayerJournalFilters
                    filterDate={filterDate}
                    setFilterDate={setFilterDate}
                    filterCategory={filterCategory}
                    setFilterCategory={setFilterCategory}
                    filterTags={filterTags}
                    setFilterTags={setFilterTags}
                    uniqueCategories={uniqueCategories}
                    uniqueTags={uniqueTags}
                    showFilters={showFilters}
                    setShowFilters={setShowFilters}
                />
            </div>

            {/* Entry List */}
            <ScrollArea className="flex-1 p-4">
                {filteredEntries.length === 0 ? (
                    <div className="text-center py-8 opacity-60">
                        <div className="w-16 h-16 bg-qc-parchment rounded-full flex items-center justify-center mx-auto mb-3">
                            <HandsPraying className="w-8 h-8 text-qc-text-muted" weight="duotone" />
                        </div>
                        <p className="text-qc-text-muted text-sm">No entries found.</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {filteredEntries.map(entry => (
                            <div
                                key={entry.id}
                                onClick={() => onEntrySelect(entry)}
                                className={`
                                    group relative p-4 rounded-qc-md border cursor-pointer transition-all duration-200
                                    ${selectedEntry?.id === entry.id
                                        ? 'bg-qc-parchment border-qc-primary/30 shadow-sm'
                                        : 'bg-white border-transparent hover:bg-qc-parchment/30 hover:border-qc-border-subtle'
                                    }
                                `}
                            >
                                <div className="flex justify-between items-start mb-1">
                                    <h3 className={`font-semibold text-sm ${selectedEntry?.id === entry.id ? 'text-qc-primary' : 'text-qc-charcoal'}`}>
                                        {entry.title || "Untitled Entry"}
                                    </h3>
                                    {entry.isPrivate && <Lock className="w-3 h-3 text-qc-text-muted/70" weight="fill" />}
                                </div>
                                <p className="text-xs text-qc-text-muted mb-2">
                                    {format(new Date(entry.date), 'MMM d, yyyy')}
                                </p>

                                {entry.category && (
                                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5">
                                        {entry.category}
                                    </Badge>
                                )}

                                {/* Delete Button - Visible on Hover */}
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onDeleteEntry(entry);
                                    }}
                                    className="absolute right-2 bottom-2 p-1.5 rounded-full text-qc-text-muted hover:text-qc-error hover:bg-qc-error-bg opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <Trash className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </ScrollArea>
        </div>
    );
}
