'use client';

import React, { useState, useMemo } from 'react';
import {
    PrayerEntry,
    PrayerEntryInput,
    createPrayerEntry,
    updatePrayerEntry,
    deletePrayerEntry,
    togglePrayerAnswered
} from '@/server/actions/prayer-journal';
import PrayerJournalSidebar from './PrayerJournalSidebar';
// Dynamically import editor to reduce initial bundle size (Tiptap is heavy)
import dynamic from 'next/dynamic';
const PrayerJournalEditor = dynamic(() => import('./PrayerJournalEditor'), {
    ssr: false,
    loading: () => <div className="h-[500px] w-full bg-white rounded-xl border border-qc-border-subtle animate-pulse flex items-center justify-center text-qc-text-muted">Loading Editor...</div>
});
import { toast } from 'sonner';

interface PrayerJournalClientProps {
    initialEntries: PrayerEntry[];
    initialCategories: { id: string; name: string }[];
}

import { useSearchParams, useRouter } from 'next/navigation';

export default function PrayerJournalClient({
    initialEntries,
    initialCategories
}: PrayerJournalClientProps) {
    // Search Params for deep linking
    const searchParams = useSearchParams();
    const paramTitle = searchParams.get('title');
    const paramCategory = searchParams.get('category');
    const router = useRouter();

    // State
    const [entries, setEntries] = useState<PrayerEntry[]>(initialEntries);
    const [selectedEntry, setSelectedEntry] = useState<PrayerEntry | null>(null);
    const [isCreating, setIsCreating] = useState(!!paramTitle);
    const [isEditing, setIsEditing] = useState(!!paramTitle);
    // Stable identity for the mounted editor across an edit session. Changing
    // this is the ONLY thing that should remount the TipTap editor; saving must
    // never change it (otherwise autosave would unmount the editor mid-typing).
    const [editorKey, setEditorKey] = useState<string>(() =>
        paramTitle ? `new-${paramTitle}` : 'empty'
    );

    // Filter State
    const [filterDate, setFilterDate] = useState('');
    const [filterCategory, setFilterCategory] = useState('');
    const [filterTags, setFilterTags] = useState<string[]>([]);
    const [showFilters, setShowFilters] = useState(false);


    // Derived State
    const uniqueCategories = useMemo(() => {
        const cats = new Set(initialCategories.map(c => c.name));
        entries.forEach(e => { if (e.category) cats.add(e.category) });
        return Array.from(cats).sort();
    }, [initialCategories, entries]);

    const uniqueTags = useMemo(() => {
        const tags = new Set<string>();
        entries.forEach(e => e.tags.forEach(t => tags.add(t)));
        return Array.from(tags).sort();
    }, [entries]);

    // Handlers
    const handleNewEntry = () => {
        setSelectedEntry(null);
        setIsCreating(true);
        setIsEditing(true);
        // Fresh editor session for the new entry.
        setEditorKey(`new-${Date.now()}`);
    };

    const handleSelectEntry = (entry: PrayerEntry) => {
        setSelectedEntry(entry);
        setIsCreating(false);
        setIsEditing(false); // Valid: View mode first
        setEditorKey(entry.id);
    };

    const handleEditEntry = () => {
        setIsEditing(true);
    };

    // Non-destructive save. Persists via the server action and updates local
    // state in place so the editor stays mounted (no full reload / remount).
    // Used by BOTH the debounced autosave and the explicit Save button.
    const handleSave = async (data: PrayerEntryInput) => {
        try {
            if (selectedEntry && !isCreating) {
                // Update: persist, then merge edited fields into the matching
                // entry. Keep selectedEntry / isEditing exactly as they were.
                await updatePrayerEntry({ id: selectedEntry.id, ...data });
                const updated: PrayerEntry = { ...selectedEntry, ...data };
                setEntries(prev =>
                    prev.map(e => (e.id === selectedEntry.id ? updated : e))
                );
                setSelectedEntry(updated);
                toast.success('Prayer entry updated');
            } else {
                // Create: persist and adopt the returned row as the selected
                // entry so subsequent (auto)saves become updates and the editor
                // stays mounted. The editor key is left unchanged on purpose.
                const created = await createPrayerEntry(data);
                if (created) {
                    setEntries(prev => [created as PrayerEntry, ...prev]);
                    setSelectedEntry(created as PrayerEntry);
                    setIsCreating(false);
                }
                toast.success('Prayer entry created');
            }
            // Server actions already revalidatePath; refresh RSC data in place
            // WITHOUT unmounting the client (no window.location.reload()).
            router.refresh();
        } catch (error) {
            console.error(error);
            toast.error('Failed to save entry');
        }
    };

    // Explicit Save button (create-then-close flow): persist in place, then
    // settle into VIEW mode on the saved entry instead of staying in edit mode.
    // Does not reload/remount; the editor remains mounted on the saved row.
    const handleSaveAndClose = async (data: PrayerEntryInput) => {
        await handleSave(data);
        setIsEditing(false);
        setIsCreating(false);
    };

    const handleDelete = async (entry: PrayerEntry) => {
        if (!confirm("Are you sure you want to delete this entry?")) return;
        try {
            await deletePrayerEntry(entry.id);
            setEntries(entries.filter(e => e.id !== entry.id));
            if (selectedEntry?.id === entry.id) {
                setSelectedEntry(null);
                setIsEditing(false);
                setEditorKey('empty');
            }
            toast.success('Entry deleted');
        } catch (error) {
            console.error(error);
            toast.error('Failed to delete entry');
        }
    };

    const handleCancelEdit = () => {
        setIsEditing(false);
        setIsCreating(false);
        if (isCreating) {
            setSelectedEntry(null);
            setEditorKey('empty');
        }
    };

    return (
        <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-12rem)] min-h-[600px]">
            {/* Sidebar (30%) */}
            <div className="w-full lg:w-1/3 min-w-[300px] flex-shrink-0 h-full">
                <PrayerJournalSidebar
                    entries={entries}
                    selectedEntry={selectedEntry}
                    onEntrySelect={handleSelectEntry}
                    onNewEntry={handleNewEntry}
                    onDeleteEntry={handleDelete}
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

            {/* Main Content (70%) */}
            <div className="flex-1 h-full min-w-0">
                <PrayerJournalEditor
                    key={editorKey}
                    entry={selectedEntry}
                    isEditing={isEditing}
                    isCreating={isCreating}
                    categories={uniqueCategories}
                    onSave={handleSave}
                    onSaveAndClose={handleSaveAndClose}
                    onCancel={handleCancelEdit}
                    onEdit={handleEditEntry}
                    initialTitle={paramTitle || ''}
                    initialCategory={paramCategory || ''}
                />
            </div>
        </div>
    );
}
