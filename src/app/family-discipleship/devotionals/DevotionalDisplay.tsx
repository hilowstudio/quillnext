
"use client";

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sun, Moon, ArrowLeft, BookOpen } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";

type DevotionalEntry = {
    id: string;
    time: string;
    keyverse: string;
    body: string;
};

interface DevotionalDisplayProps {
    devotionals: DevotionalEntry[];
    date: string;
}

export function DevotionalDisplay({ devotionals, date }: DevotionalDisplayProps) {
    const morning = devotionals.find(d => d.time === 'am');
    const evening = devotionals.find(d => d.time === 'pm');

    // Determine default tab based on current time (rough heuristic)
    const currentHour = new Date().getHours();
    const defaultTab = currentHour >= 17 ? "evening" : "morning";

    return (
        <div className="space-y-6">


            <Tabs defaultValue={defaultTab} className="w-full">
                <p className="text-center text-lg font-display text-qc-charcoal mb-4">{date}</p>
                <TabsList className="grid w-full grid-cols-2 max-w-[400px] mx-auto">
                    <TabsTrigger value="morning" className="flex items-center gap-2">
                        <Sun className="h-4 w-4" /> Morning
                    </TabsTrigger>
                    <TabsTrigger value="evening" className="flex items-center gap-2">
                        <Moon className="h-4 w-4" /> Evening
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="morning">
                    {morning ? (
                        <DevotionalCard entry={morning} timeLabel="Morning" icon={<Sun className="h-5 w-5 text-orange-500" />} />
                    ) : (
                        <EmptyState message="No morning devotional available for today." />
                    )}
                </TabsContent>

                <TabsContent value="evening">
                    {evening ? (
                        <DevotionalCard entry={evening} timeLabel="Evening" icon={<Moon className="h-5 w-5 text-indigo-500" />} />
                    ) : (
                        <EmptyState message="No evening devotional available for today." />
                    )}
                </TabsContent>
            </Tabs>
        </div>
    );
}

function DevotionalCard({ entry, timeLabel, icon }: { entry: any, timeLabel: string, icon: React.ReactNode }) {
    const formatKeyVerse = (raw: string) => {
        let text = raw.toString();
        let reference = "";

        // Extract trailing reference if present (e.g. "... — 2 Peter 3:18")
        if (text.includes("—")) {
            const parts = text.split("—");
            reference = parts[parts.length - 1].trim();
            text = parts.slice(0, parts.length - 1).join("—").trim();
        } else if (text.includes("-")) {
            // Fallback for hyphen if em-dash is missing (heuristic)
            const parts = text.split("-");
            const potentialRef = parts[parts.length - 1].trim();
            // Simple check if it looks like a reference (contains number)
            if (/\d/.test(potentialRef)) {
                reference = potentialRef;
                text = parts.slice(0, parts.length - 1).join("-").trim();
            }
        }

        // Remove surrounding quotes
        text = text.replace(/^"|"$/g, '').trim();

        // Remove leading reference if it matches the extracted reference
        if (reference && text.startsWith(reference)) {
            text = text.substring(reference.length).trim();
        }

        return { text, reference };
    };

    const { text: verseText, reference: verseRef } = formatKeyVerse(entry.keyverse);

    const cleanBodyText = (text: string) => {
        const lines = text.toString().split('\n');
        // We want to remove the initial "header" section.
        // Heuristic:
        // 1. Remove blank lines at start
        // 2. Remove lines that look like dates (Month Day)
        // 3. Remove "Morning Reading" / "Evening Reading"
        // 4. Remove the verse reference line (starts with "-" or "—")
        // 5. Remove the verse text (quoted string)

        let startIndex = 0;
        let inHeader = true;

        while (startIndex < lines.length && inHeader) {
            const line = lines[startIndex].trim();

            if (!line) {
                startIndex++;
                continue;
            }

            // Check for Date (e.g. "January 4th", "January 4")
            if (/^[A-Z][a-z]+ \d{1,2}(st|nd|rd|th)?$/.test(line)) {
                startIndex++;
                continue;
            }

            // Check for Reading Label
            if (line.includes("Morning Reading") || line.includes("Evening Reading")) {
                startIndex++;
                continue;
            }

            // Check for Reference line
            if (line.startsWith("-") || line.startsWith("—")) {
                startIndex++;
                continue;
            }

            // Check for Verse text (quoted or just matches keyverse text loosely)
            // It's safer to just look for the quoted line which the user example showed
            if (line.startsWith('"') && line.endsWith('"')) {
                startIndex++;
                continue;
            }

            // If we hit a line that doesn't match these headers, we assume body started
            // HOWEVER, the user example shows a block: Date \n Reading \n "Verse" \n - Ref
            // We need to consume that whole block.

            // Let's rely on the structure:
            // if we just consumed "Morning Reading", the next non-empty lines are likely the verse and ref.
            // But implementing a "skip until" might comprise the actual body if it starts with a quote.

            // User said: "That whole section should be removed" referring to the block AT THE BEGINNING.

            // Let's refine:
            // If we are at the top, and we see something matching the keyverse, skip it.
            const similarToKeyVerse = entry.keyverse && line.includes(entry.keyverse.substring(0, 20)); // simplistic check

            if (similarToKeyVerse) {
                startIndex++;
                continue;
            }

            // If we've passed the obvious headers and didn't trigger a skip, we are done
            inHeader = false;
        }

        return lines.slice(startIndex).join('\n').trim();
    };

    const finalBody = cleanBodyText(entry.body);

    return (
        <Card className="mt-4 border-qc-border-subtle shadow-sm">
            <div className="px-8 py-8 items-center text-center">
                <div className="relative">
                    <span className="absolute -top-6 -left-4 text-6xl text-qc-primary/20 font-serif leading-none">“</span>
                    <div className="relative z-10 flex flex-col gap-4">
                        <p className="italic text-2xl md:text-3xl text-qc-charcoal font-serif leading-relaxed font-medium">
                            {verseText}
                        </p>
                        {verseRef && (
                            <p className="text-center text-lg text-qc-primary font-bold font-display uppercase tracking-widest mt-2">— {verseRef}</p>
                        )}
                    </div>
                    <span className="absolute -bottom-12 -right-4 text-6xl text-qc-primary/20 font-serif leading-none">”</span>
                </div>
            </div>

            <CardHeader className="bg-qc-parchment/50 border-y border-qc-border-subtle/30 pb-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        {icon}
                        <CardTitle className="text-xl font-serif">{timeLabel} Reading</CardTitle>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
                <div className="prose prose-stone max-w-none text-qc-text leading-relaxed whitespace-pre-line">
                    {finalBody}
                </div>
            </CardContent>
        </Card>
    );
}

function EmptyState({ message }: { message: string }) {
    return (
        <Card className="mt-4 bg-qc-parchment/20 border-dashed">
            <CardContent className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground">
                <BookOpen className="h-12 w-12 mb-4 opacity-20" />
                <p>{message}</p>
            </CardContent>
        </Card>
    )
}
// import { BookOpen } from 'lucide-react'; // Removed duplicate import
