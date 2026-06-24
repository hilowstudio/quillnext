'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MagnifyingGlass, Book, BookOpen, CaretLeft, CaretRight, Spinner, MagicWand, X } from "@phosphor-icons/react";
import { toast } from "sonner";
import { getBiblePassage, getCommentary, getBibleAudio, summarizeCommentary, type CommentaryData } from "@/server/actions/bible-study";
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { cn } from "@/lib/utils";

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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [passageData, setPassageData] = useState<{ html: string; reference: string; meta: any } | null>(null);
    const [commentaryData, setCommentaryData] = useState<CommentaryData | null>(null);
    const [audioUrl, setAudioUrl] = useState<string | undefined>(undefined);
    const [isAudioLoading, setIsAudioLoading] = useState(false);

    const [activeTab, setActiveTab] = useState('scripture');
    const [summaryHtml, setSummaryHtml] = useState<string | null>(null);
    const [isSummarizing, setIsSummarizing] = useState(false);

    const targetRef = useRef<HTMLDivElement | null>(null);

    // The section to focus: the one covering the looked-up verse, else the first.
    const activeSectionIndex = commentaryData
        ? commentaryData.targetSectionIndex ?? commentaryData.sections[0]?.sectionIndex ?? null
        : null;

    // Load data when query param changes
    useEffect(() => {
        const queryParam = searchParams.get('q');
        const targetQuery = queryParam || 'John 3:16';
        if (targetQuery !== query) setQuery(targetQuery);
        fetchData(targetQuery);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchParams.get('q')]);

    // When viewing Commentary, scroll to (and briefly highlight) the looked-up verse
    // within its section: MH's inline reference if present, else the scripture verse
    // anchor, else the section itself. Scoped to the active section so cross-section
    // references don't steal focus.
    useEffect(() => {
        if (activeTab !== 'commentary' || !commentaryData) return;
        const container = targetRef.current;
        if (!container) return;

        const verse = commentaryData.verse;
        let el: HTMLElement | null = null;
        if (verse !== null) {
            el =
                (container.querySelector(`.mh-vref[data-verse="${verse}"]`) as HTMLElement | null) ||
                (container.querySelector(`#v${verse}`) as HTMLElement | null);
        }

        (el ?? container).scrollIntoView({ behavior: 'smooth', block: el ? 'center' : 'start' });

        if (el) {
            const prev = el.style.backgroundColor;
            el.style.backgroundColor = 'rgba(217, 164, 65, 0.4)'; // qc gold flash
            el.style.borderRadius = '3px';
            el.style.transition = 'background-color 0.5s ease';
            const t = setTimeout(() => { el!.style.backgroundColor = prev; }, 2800);
            return () => clearTimeout(t);
        }
    }, [activeTab, commentaryData]);

    const fetchData = async (searchQuery: string) => {
        if (!searchQuery) return;
        setIsLoading(true);
        setIsAudioLoading(true);
        setSummaryHtml(null);
        try {
            const passage = await getBiblePassage({ reference: searchQuery });
            setPassageData(passage);

            const commentary = await getCommentary(searchQuery);
            setCommentaryData(commentary);

            try {
                const audio = await getBibleAudio({ reference: searchQuery });
                setAudioUrl(audio?.audioUrl);
            } catch (err) {
                console.warn("Audio fetch failed", err);
                setAudioUrl(undefined);
            }
        } catch (error) {
            console.error("Search error:", error);
            toast.error(error instanceof Error ? error.message : "Failed to load Bible study data");
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
        const params = new URLSearchParams(searchParams);
        params.set('q', query);
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    };

    const navigateTo = (ref: string) => {
        setQuery(ref);
        const params = new URLSearchParams(searchParams);
        params.set('q', ref);
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    };

    const handleSummarize = async () => {
        const section = commentaryData?.sections.find((s) => s.sectionIndex === activeSectionIndex);
        if (!section?.html) return;
        setIsSummarizing(true);
        try {
            const result = await summarizeCommentary(section.html);
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
                                    <div dangerouslySetInnerHTML={{ __html: passageData.html }} />
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
                                <div className="p-6 md:p-10">
                                    {/* Header + chapter navigation */}
                                    <div className="flex flex-wrap items-center justify-between gap-3 mb-2 pb-4 border-b border-stone-200">
                                        <h3 className="text-lg font-bold text-stone-800 m-0">
                                            Matthew Henry on {commentaryData.book} {commentaryData.chapter}
                                        </h3>
                                        <div className="flex items-center gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                disabled={!commentaryData.prevRef}
                                                onClick={() => commentaryData.prevRef && navigateTo(commentaryData.prevRef)}
                                            >
                                                <CaretLeft className="w-4 h-4 mr-1" /> Prev
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                disabled={!commentaryData.nextRef}
                                                onClick={() => commentaryData.nextRef && navigateTo(commentaryData.nextRef)}
                                            >
                                                Next <CaretRight className="w-4 h-4 ml-1" />
                                            </Button>
                                        </div>
                                    </div>

                                    {commentaryData.verse !== null && commentaryData.targetSectionIndex !== null && (
                                        <p className="text-sm text-qc-text-muted mb-6">
                                            Showing the section covering {commentaryData.book} {commentaryData.chapter}:{commentaryData.verse} (highlighted), with the rest of the chapter for context.
                                        </p>
                                    )}

                                    {/* Chapter overview (collapsible) */}
                                    {commentaryData.intro && (
                                        <details className="mb-8 rounded-lg border border-stone-200 bg-white/60 p-4">
                                            <summary className="cursor-pointer font-medium text-qc-primary">Chapter overview</summary>
                                            <div
                                                className="prose prose-stone max-w-none mt-3 prose-p:font-serif prose-p:leading-relaxed"
                                                dangerouslySetInnerHTML={{ __html: commentaryData.intro }}
                                            />
                                        </details>
                                    )}

                                    {/* Sections */}
                                    <div className="space-y-6">
                                        {commentaryData.sections.map((s) => {
                                            const isActive = s.sectionIndex === activeSectionIndex;
                                            const showSummary = isActive && !!summaryHtml;
                                            return (
                                                <div
                                                    key={s.sectionIndex}
                                                    ref={isActive ? targetRef : undefined}
                                                    className={cn(
                                                        "scroll-mt-24 rounded-lg p-5 border transition-colors",
                                                        isActive
                                                            ? "border-qc-primary/40 bg-qc-primary/5 ring-1 ring-qc-primary/20"
                                                            : "border-stone-200/70 bg-white/40"
                                                    )}
                                                >
                                                    <div className="flex items-center justify-between gap-3 mb-3">
                                                        <h4 className="font-display text-lg font-bold text-qc-primary m-0">
                                                            {s.title || `Verses ${s.verseStart}–${s.verseEnd}`}
                                                        </h4>
                                                        <span className="shrink-0 text-xs uppercase tracking-wide text-qc-text-muted bg-white/80 border border-stone-200 px-2 py-0.5 rounded">
                                                            vv {s.verseStart}–{s.verseEnd}
                                                        </span>
                                                    </div>

                                                    {showSummary ? (
                                                        <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                                                            <div className="bg-qc-warning-bg/50 p-6 rounded-lg border border-qc-warning-border mb-4">
                                                                <h5 className="flex items-center gap-2 text-qc-warning-text font-bold text-sm uppercase tracking-wider mb-4">
                                                                    <MagicWand className="w-4 h-4" /> Inkling Plain-English Summary
                                                                </h5>
                                                                <div className="prose prose-sm prose-p:text-base prose-p:text-stone-700 max-w-none">
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
                                                            <p className="text-xs text-muted-foreground italic">
                                                                AI-generated summary of Matthew Henry&apos;s commentary on these verses.
                                                            </p>
                                                        </div>
                                                    ) : (
                                                        <div
                                                            className="prose prose-stone max-w-none prose-p:font-serif prose-p:leading-loose [&_p]:mb-4"
                                                            dangerouslySetInnerHTML={{ __html: s.html }}
                                                        />
                                                    )}

                                                    {isActive && (
                                                        <div className="mt-4">
                                                            {!summaryHtml ? (
                                                                <Button
                                                                    variant="outline"
                                                                    size="sm"
                                                                    onClick={handleSummarize}
                                                                    disabled={isSummarizing}
                                                                    className="bg-white/80 backdrop-blur-sm shadow-sm hover:bg-qc-primary/5 border-qc-primary/20 text-qc-primary gap-2"
                                                                >
                                                                    {isSummarizing ? <Spinner className="animate-spin" /> : <MagicWand className="w-4 h-4" />}
                                                                    Plain English, please
                                                                </Button>
                                                            ) : (
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    onClick={() => setSummaryHtml(null)}
                                                                    className="text-muted-foreground hover:text-qc-charcoal"
                                                                >
                                                                    <X className="mr-1 w-3 h-3" /> Show original
                                                                </Button>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
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
