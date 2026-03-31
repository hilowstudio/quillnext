'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MagnifyingGlass, Book, BookOpen, CaretLeft, CaretRight, Spinner, MagicWand, X } from "@phosphor-icons/react";
import { toast } from "sonner";
import { searchBible, getBiblePassage, getCommentary, getBibleAudio, summarizeCommentary, type CommentaryData } from "@/server/actions/bible-study";
import { useSearchParams, useRouter, usePathname } from 'next/navigation';

import BibleAudioPlayer from './BibleAudioPlayer';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';

export default function BibleStudyClient() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();

    // State
    const [query, setQuery] = useState(searchParams.get('q') || 'John 3:16');
    const [isLoading, setIsLoading] = useState(false);
    const [passageData, setPassageData] = useState<{ html: string; reference: string; meta: any } | null>(null);
    const [commentaryData, setCommentaryData] = useState<CommentaryData | null>(null);
    const [audioUrl, setAudioUrl] = useState<string | undefined>(undefined);
    const [isAudioLoading, setIsAudioLoading] = useState(false);

    const [activeTab, setActiveTab] = useState('scripture');
    const [summaryHtml, setSummaryHtml] = useState<string | null>(null);
    const [isSummarizing, setIsSummarizing] = useState(false);

    // Load data when query param changes
    useEffect(() => {
        const queryParam = searchParams.get('q');
        const targetQuery = queryParam || 'John 3:16';

        // Sync input if it differs (e.g. navigation)
        if (targetQuery !== query) {
            setQuery(targetQuery);
        }

        fetchData(targetQuery);
    }, [searchParams.get('q')]);

    const fetchData = async (searchQuery: string) => {
        if (!searchQuery) return;
        setIsLoading(true);
        setIsAudioLoading(true);
        try {
            // Fetch Passage
            const passage = await getBiblePassage({ reference: searchQuery });
            setPassageData(passage);

            // Fetch Commentary
            const commentary = await getCommentary(searchQuery);
            setCommentaryData(commentary);

            // Fetch Audio
            try {
                const audio = await getBibleAudio({ reference: searchQuery });
                setAudioUrl(audio?.audioUrl);
            } catch (err) {
                console.warn("Audio fetch failed", err);
                setAudioUrl(undefined);
            }

        } catch (error: any) {
            console.error("Search error:", error);
            toast.error(error.message || "Failed to load Bible study data");
            setPassageData(null);
            setCommentaryData(null);
            setAudioUrl(undefined);
            setSummaryHtml(null);
        } finally {
            setIsLoading(false);
            setIsAudioLoading(false);
        }
    };

    const onSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        // Just update URL, useEffect will handle fetch
        const params = new URLSearchParams(searchParams);
        params.set('q', query);
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    };

    const handleNavigation = (direction: 'prev' | 'next') => {
        if (!passageData?.meta) return;
        const targetRef = direction === 'prev' ? passageData.meta.prev_chapter : passageData.meta.next_chapter;
        if (targetRef) {
            // Format: [bookNum, chapterNum] - need to convert back to string or rely on API meta if it gave string?
            // ESV API meta gives tuples. We probably need the 'prev_chapter' raw reference if available or construct it.
            // Actually ESV passage_meta does not provide string ref for prev/next easily without mapping.
            // Let's rely on simple chapter navigation if possible or just warn not implemented fully yet.
            // For MVP, let's skip complex ref mapping and just toast "Navigation coming soon" if precise ref unavailable.
            // Wait, looking at ESV response, it sometimes gives string refs.
            // Update: We'll skip this for the exact moment unless we map book numbers back to names.
            toast.info("Chapter navigation coming in V2");
        }
    };

    const handleSummarize = async () => {
        if (!commentaryData?.html) return;
        setIsSummarizing(true);
        try {
            const result = await summarizeCommentary(commentaryData.html);
            if (result?.summary) {
                setSummaryHtml(result.summary);
                toast.success("Commentary summarized!");
            }
        } catch (error) {
            console.error(error);
            toast.error("Failed to summarize commentary");
        } finally {
            setIsSummarizing(false);
        }
    };

    return (
        <div className="container mx-auto p-4 max-w-5xl space-y-8">
            {/* Search - Standalone */}
            <div className="flex justify-center w-full">
                <form onSubmit={onSearchSubmit} className="flex w-full max-w-2xl gap-2 bg-white p-2 rounded-full shadow-sm border border-qc-border-subtle/50 items-center pl-4">
                    <MagnifyingGlass className="w-5 h-5 text-qc-text-muted" />
                    <Input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search passage (e.g. John 3:16) or Book..."
                        className="flex-1 border-none shadow-none focus-visible:ring-0 bg-transparent h-10 text-lg"
                    />
                    <Button type="submit" disabled={isLoading} className="rounded-full px-6" size="lg">
                        {isLoading ? <Spinner className="animate-spin" /> : "Search"}
                    </Button>
                </form>
            </div>

            {/* Main Display Card */}
            <Card className="min-h-[600px] bg-white border-qc-border-subtle/50 shadow-sm overflow-hidden flex flex-col">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
                    {/* Card Header Area: Toggle & Audio */}
                    <div className="bg-qc-parchment/30 border-b border-qc-border-subtle/50 p-4 md:p-6 space-y-4">
                        <div className="flex justify-center items-center">
                            <TabsList className="bg-white/50 border border-qc-border-subtle/30 h-11 px-1">
                                <TabsTrigger value="scripture" className="gap-2 px-6 text-sm md:text-base"><Book size={18} /> Scripture</TabsTrigger>
                                <TabsTrigger value="commentary" className="gap-2 px-6 text-sm md:text-base"><BookOpen size={18} /> Commentary</TabsTrigger>
                            </TabsList>
                        </div>
                    </div>

                    <CardContent className="p-0 flex-1 relative">
                        {/* Scripture Content */}
                        <TabsContent value="scripture" className="m-0 h-full">
                            {passageData ? (
                                <div className="p-6 md:p-10 prose prose-slate max-w-none prose-headings:font-display prose-headings:text-qc-primary prose-p:text-lg prose-p:leading-relaxed">
                                    <div className="flex items-center justify-between gap-3 mb-6 pb-4 border-b border-stone-200">
                                        <h2 className="text-3xl md:text-4xl font-display font-bold text-qc-primary m-0 text-balance">
                                            {passageData.reference}
                                        </h2>
                                        <BibleAudioPlayer
                                            audioUrl={audioUrl}
                                            reference={passageData.reference}
                                            isLoading={isAudioLoading}
                                        />
                                    </div>
                                    <div
                                        dangerouslySetInnerHTML={{ __html: passageData.html }}
                                    />
                                    <div className="text-xs text-center mt-12 pt-6 border-t text-muted-foreground">
                                        Scripture quotations are from the ESV® Bible (The Holy Bible, English Standard Version®), © 2001 by Crossway.
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center h-[400px] text-center p-8 space-y-4 text-muted-foreground">
                                    <Book className="w-12 h-12 opacity-20" />
                                    <p>Enter a passage to begin reading.</p>
                                </div>
                            )}
                        </TabsContent>

                        {/* Commentary Content */}
                        <TabsContent value="commentary" className="m-0 h-full bg-[#FFFBF4]">
                            {commentaryData ? (
                                <div className="p-6 md:p-10 prose prose-stone max-w-none prose-p:font-serif prose-p:text-lg prose-p:leading-loose prose-p:mb-6 prose-headings:mt-8 prose-headings:mb-4 relative [&_p]:mb-6">
                                    {/* AI Summary Ribbon */}
                                    <div className="absolute top-0 right-0 p-4 z-10">
                                        {!summaryHtml ? (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={handleSummarize}
                                                disabled={isSummarizing}
                                                className="bg-white/80 backdrop-blur-sm shadow-sm hover:bg-qc-primary/5 border-qc-primary/20 text-qc-primary gap-2 transition-all group"
                                            >
                                                {isSummarizing ? <Spinner className="animate-spin" /> : <MagicWand className="w-4 h-4 group-hover:text-qc-warning transition-colors" />}
                                                Plain English, please
                                            </Button>
                                        ) : (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => setSummaryHtml(null)}
                                                className="text-muted-foreground hover:text-qc-charcoal"
                                            >
                                                <X className="mr-1 w-3 h-3" /> Show Original
                                            </Button>
                                        )}
                                    </div>

                                    <div className="flex items-center gap-3 mb-6 pb-4 border-b border-stone-200">
                                        <div>
                                            <h3 className="text-lg font-bold text-stone-800 m-0">Matthew Henry's Commentary on {passageData?.reference}</h3>
                                        </div>
                                    </div>

                                    {/* Content Area */}
                                    {summaryHtml ? (
                                        <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                                            <div className="bg-qc-warning-bg/50 p-6 rounded-lg border border-qc-warning-border mb-6">
                                                <h4 className="flex items-center gap-2 text-qc-warning-text font-bold text-sm uppercase tracking-wider mb-4">
                                                    <MagicWand className="w-4 h-4" /> Inkling Generic Summary
                                                </h4>
                                                <div className="prose prose-sm prose-p:text-base prose-p:text-stone-700 prose-headings:text-qc-warning-text prose-strong:text-qc-warning-text max-w-none">
                                                    <ReactMarkdown
                                                        remarkPlugins={[remarkGfm, remarkBreaks]}
                                                        components={{
                                                            p: ({ node, ...props }) => <p className="mb-4 last:mb-0" {...props} />,
                                                            ul: ({ node, ...props }) => <ul className="list-disc pl-5 mb-4 space-y-1" {...props} />,
                                                            ol: ({ node, ...props }) => <ol className="list-decimal pl-5 mb-4 space-y-1" {...props} />,
                                                            li: ({ node, ...props }) => <li className="pl-1" {...props} />,
                                                            strong: ({ node, ...props }) => <span className="font-bold text-qc-warning-text" {...props} />,
                                                        }}
                                                    >
                                                        {summaryHtml}
                                                    </ReactMarkdown>
                                                </div>
                                            </div>
                                            <p className="text-xs text-center text-muted-foreground italic">
                                                This is an AI-generated summary of Matthew Henry's commentary.
                                            </p>
                                        </div>
                                    ) : (
                                        <div
                                            dangerouslySetInnerHTML={{ __html: commentaryData.html }}
                                        />
                                    )}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center h-[400px] text-center p-8 space-y-4 text-muted-foreground">
                                    <BookOpen className="w-12 h-12 opacity-20" />
                                    <p>{passageData ? "No commentary available for this passage." : "Search for a passage to see study notes."}</p>
                                </div>
                            )}
                        </TabsContent>
                    </CardContent>
                </Tabs>
            </Card>
        </div>
    );
}
