'use client';

import React, { useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { Input } from "@/components/ui/input";
import { MagnifyingGlass } from "@phosphor-icons/react/dist/ssr";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CountryInfoCard } from './CountryInfoCard';
import type { OperationWorldStats } from './actions';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GlobeHemisphereWest, List } from "@phosphor-icons/react";

// Dynamically import map to avoid SSR issues with Leaflet
const WorldMap = dynamic(() => import('./WorldMap'), {
    ssr: false,
    loading: () => <div className="h-[400px] w-full flex items-center justify-center bg-qc-surface-raised rounded-lg">Loading Map...</div>
});

interface MissionsClientProps {
    stats: OperationWorldStats | null;
}

export default function MissionsClient({ stats }: MissionsClientProps) {
    const [search, setSearch] = useState('');
    const [selectedCountry, setSelectedCountry] = useState<any>(null);
    const [view, setView] = useState<'map' | 'list'>('map');

    const countries = useMemo(() => {
        if (!stats?.countries) return [];
        return stats.countries.filter(c =>
            c.country.toLowerCase().includes(search.toLowerCase())
        );
    }, [stats, search]);

    if (!stats) {
        return <div className="p-6 text-center text-muted-foreground">Unable to load Operation World data.</div>;
    }

    return (
        <div className="flex flex-col space-y-4">
            {/* Controls */}
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-center p-4 border rounded-lg bg-white shadow-sm">
                <div className="relative w-full sm:w-72">
                    <MagnifyingGlass className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search countries..."
                        className="pl-9 bg-qc-surface-raised"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                <div className="flex bg-qc-surface-raised p-1 rounded-lg">
                    <button
                        onClick={() => setView('map')}
                        className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${view === 'map' ? 'bg-white shadow text-qc-primary' : 'text-qc-text-muted hover:text-qc-charcoal'
                            }`}
                    >
                        <GlobeHemisphereWest size={16} />
                        Interactive Map
                    </button>
                    <button
                        onClick={() => setView('list')}
                        className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${view === 'list' ? 'bg-white shadow text-qc-primary' : 'text-qc-text-muted hover:text-qc-charcoal'
                            }`}
                    >
                        <List size={16} />
                        List View
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div className="bg-white border rounded-lg shadow-sm overflow-hidden min-h-[500px]">
                {view === 'map' ? (
                    <div className="h-[600px] w-full p-1">
                        <WorldMap
                            stats={stats}
                            onCountrySelect={setSelectedCountry}
                        />
                    </div>
                ) : (
                    <ScrollArea className="h-[600px] p-4">
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            {countries.map((c) => (
                                <button
                                    key={c.country}
                                    onClick={() => setSelectedCountry(c)}
                                    className="flex flex-col items-start p-4 rounded-lg border hover:bg-qc-surface-raised transition-all text-left group hover:border-qc-gold/50"
                                >
                                    <span className="font-semibold text-sm mb-1 group-hover:text-qc-primary transition-colors">{c.country}</span>
                                    <span className="text-xs text-muted-foreground">
                                        {parseInt(c.data.population as string || '0').toLocaleString()} people
                                    </span>
                                    <div className="flex gap-2 mt-2">
                                        {(c.data._evangelical as string)?.startsWith('0') && (
                                            <span className="w-2 h-2 rounded-full bg-qc-error ring-4 ring-qc-error-bg" title="Low Evangelical %" />
                                        )}
                                        {(c.data.persecution_ranking as string) && (
                                            <span className="w-2 h-2 rounded-full bg-qc-warning ring-4 ring-qc-warning-bg" title="Persecution Watch" />
                                        )}
                                    </div>
                                </button>
                            ))}
                            {countries.length === 0 && (
                                <div className="col-span-full text-center py-10 text-muted-foreground">
                                    No countries found matching "{search}"
                                </div>
                            )}
                        </div>
                    </ScrollArea>
                )}
            </div>

            <CountryInfoCard
                isOpen={!!selectedCountry}
                onClose={() => setSelectedCountry(null)}
                countryData={selectedCountry}
            />

            <div className="text-center text-xs text-muted-foreground mt-2">
                Data Source: Operation World ({new Date(stats.metadata.scrapedAt).toLocaleDateString()})
            </div>
        </div>
    );
}
