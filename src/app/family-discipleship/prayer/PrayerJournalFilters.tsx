'use client';

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Funnel, X, Calendar, Tag as TagIcon } from '@phosphor-icons/react/dist/ssr';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { format } from 'date-fns';

interface PrayerJournalFiltersProps {
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

export default function PrayerJournalFilters({
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
}: PrayerJournalFiltersProps) {

    const clearFilters = () => {
        setFilterDate('');
        setFilterCategory('');
        setFilterTags([]);
    };

    const hasActiveFilters = filterDate || filterCategory || filterTags.length > 0;

    const toggleTag = (tag: string) => {
        if (filterTags.includes(tag)) {
            setFilterTags(filterTags.filter(t => t !== tag));
        } else {
            setFilterTags([...filterTags, tag]);
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowFilters(!showFilters)}
                    className={showFilters ? 'bg-qc-parchment' : ''}
                >
                    <Funnel className="w-4 h-4 mr-2" weight={showFilters ? 'fill' : 'regular'} />
                    Filters
                    {hasActiveFilters && (
                        <span className="ml-2 flex h-4 w-4 items-center justify-center rounded-full bg-qc-primary text-[10px] text-white">
                            {(filterDate ? 1 : 0) + (filterCategory ? 1 : 0) + filterTags.length}
                        </span>
                    )}
                </Button>

                {hasActiveFilters && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={clearFilters}
                        className="text-qc-text-muted hover:text-qc-primary"
                    >
                        Clear all
                        <X className="w-4 h-4 ml-1" />
                    </Button>
                )}
            </div>

            {showFilters && (
                <div className="p-4 bg-qc-parchment/30 rounded-qc-md border border-qc-border-subtle/50 space-y-4 animate-in slide-in-from-top-2">
                    {/* Date Filter */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-qc-charcoal flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-qc-primary" />
                            Date
                        </label>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    className={`w-full justify-start text-left font-normal ${!filterDate && "text-muted-foreground"}`}
                                >
                                    {filterDate ? format(new Date(filterDate), "PPP") : <span>Pick a date</span>}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                                <CalendarComponent
                                    mode="single"
                                    selected={filterDate ? new Date(filterDate) : undefined}
                                    onSelect={(date: Date | undefined) => setFilterDate(date ? date.toISOString() : '')}
                                    initialFocus
                                />
                            </PopoverContent>
                        </Popover>
                    </div>

                    {/* Category Filter */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-qc-charcoal flex items-center gap-2">
                            <TagIcon className="w-4 h-4 text-qc-primary" />
                            Category
                        </label>
                        <Select value={filterCategory} onValueChange={setFilterCategory}>
                            <SelectTrigger className="w-full bg-white">
                                <SelectValue placeholder="All Categories" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Categories</SelectItem>
                                {uniqueCategories.map(category => (
                                    <SelectItem key={category} value={category}>
                                        {category}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Tags Filter */}
                    {uniqueTags.length > 0 && (
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-qc-charcoal flex items-center gap-2">
                                <TagIcon className="w-4 h-4 text-qc-primary" />
                                Tags
                            </label>
                            <div className="flex flex-wrap gap-2">
                                {uniqueTags.map(tag => (
                                    <Badge
                                        key={tag}
                                        variant={filterTags.includes(tag) ? 'default' : 'outline'}
                                        className="cursor-pointer"
                                        onClick={() => toggleTag(tag)}
                                    >
                                        {tag}
                                    </Badge>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
