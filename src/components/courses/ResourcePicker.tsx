"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Button } from "@/components/ui/button";
import { Book, Video, PresentationChart, MagicWand } from "@phosphor-icons/react";
import { getLibraryResources } from "@/app/actions/resource-library-actions";
import { Book as BookType, VideoResource as VideoType, Article as ArticleType, DocumentResource as DocumentType } from "@/generated/client";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { FileText, File } from "@phosphor-icons/react";

interface ResourcePickerProps {
    organizationId: string;
    trigger?: React.ReactNode;
    onSelectBook?: (book: BookType) => void;
    onSelectVideo?: (video: VideoType) => void;
    onSelectArticle: (article: ArticleType) => void;
    onSelectDocument: (doc: DocumentType) => void;
    onSelectResource: (resource: { id: string; title: string; resourceKind: { label: string } }) => void;
    // Universal Mode Props
    mode?: "picker" | "universal";
    onGenerate?: (kindId: string, kindLabel: string) => void;
    // Bundle Selection
    onSelectBundle?: (bundleId: string) => void;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
}

export function ResourcePicker({
    organizationId,
    trigger,
    onSelectBook,
    onSelectVideo,
    onSelectArticle,
    onSelectDocument,
    onSelectResource,
    onSelectBundle,
    mode = "picker",
    onGenerate,
    open: controlledOpen,
    onOpenChange: setControlledOpen
}: ResourcePickerProps) {
    const [internalOpen, setInternalOpen] = useState(false);
    const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
    const setOpen = setControlledOpen || setInternalOpen;

    const [loading, setLoading] = useState(false);
    const [books, setBooks] = useState<BookType[]>([]);
    const [videos, setVideos] = useState<VideoType[]>([]);
    const [articles, setArticles] = useState<ArticleType[]>([]);
    const [documents, setDocuments] = useState<DocumentType[]>([]);
    const [resources, setResources] = useState<{ id: string; title: string; resourceKind: { label: string } }[]>([]);
    const [bundles, setBundles] = useState<any[]>([]); // Using any for simplicity or import CurriculumBundle type
    const [kinds, setKinds] = useState<{ id: string; label: string; description: string | null }[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        async function fetchData() {
            try {
                const [libraryRes, kindsRes] = await Promise.all([
                    getLibraryResources(organizationId),
                    mode === "universal" ? fetch("/api/curriculum/resource-kinds").then(r => r.json()) : Promise.resolve({ kinds: [] })
                ]);

                if (libraryRes.success) {
                    setBooks(libraryRes.books || []);
                    setVideos(libraryRes.videos || []);
                    setArticles(libraryRes.articles || []);
                    setDocuments(libraryRes.documents || []);
                    setResources(libraryRes.resources || []);
                    setBundles(libraryRes.bundles || []);
                }

                if (kindsRes?.kinds) {
                    setKinds(kindsRes.kinds);
                }
            } catch (error) {
                console.error("Failed to fetch data", error);
            } finally {
                setIsLoading(false);
            }
        }

        if (open) {
            fetchData();
        }
    }, [open, organizationId, mode]);

    const handleSelectBook = (book: BookType) => {
        onSelectBook?.(book);
        setOpen(false);
    };

    const handleSelectVideo = (video: VideoType) => {
        onSelectVideo?.(video);
        setOpen(false);
    };

    const handleSelectArticle = (article: ArticleType) => {
        onSelectArticle?.(article);
        setOpen(false);
    };

    const handleSelectDocument = (doc: DocumentType) => {
        onSelectDocument(doc);
        setOpen(false);
    };

    const handleSelectResource = (resource: { id: string; title: string; resourceKind: { label: string } }) => {
        onSelectResource(resource);
        setOpen(false);
    };

    const handleGenerateClick = (kindId: string, kindLabel: string) => {
        onGenerate?.(kindId, kindLabel);
        setOpen(false);
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger}
            </DialogTrigger>
            <DialogContent className="max-w-4xl h-[85vh] flex flex-col p-6">
                <DialogHeader className="pb-4 border-b">
                    <DialogTitle className="text-2xl font-display text-qc-charcoal">
                        {mode === "universal" ? "Add to Course" : "Select Resource"}
                    </DialogTitle>
                </DialogHeader>

                <Tabs defaultValue={mode === "universal" ? "create" : "books"} className="flex-1 flex flex-col min-h-0 mt-4">
                    <TabsList className="mb-4 bg-qc-parchment/50 p-1">
                        {mode === "universal" && (
                            <TabsTrigger value="create" className="gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm">
                                <MagicWand className="text-qc-accent" weight="fill" />
                                <span className="font-semibold text-qc-charcoal">Generate New</span>
                            </TabsTrigger>
                        )}
                        <TabsTrigger value="books" className="gap-2"><Book /> Library Books</TabsTrigger>
                        <TabsTrigger value="videos" className="gap-2"><Video /> Videos</TabsTrigger>
                        <TabsTrigger value="articles" className="gap-2"><FileText /> Articles</TabsTrigger>
                        <TabsTrigger value="documents" className="gap-2"><File /> Documents</TabsTrigger>
                        <TabsTrigger value="resources" className="gap-2"><PresentationChart /> My Resources</TabsTrigger>
                        {mode === "universal" && (
                            <TabsTrigger value="bundles" className="gap-2"><MagicWand /> My Bundles</TabsTrigger>
                        )}
                    </TabsList>

                    {/* CREATE TAB */}
                    {mode === "universal" && (
                        <TabsContent value="create" className="flex-1 overflow-y-auto min-h-0 pb-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {/* Special Card for Curriculum Compiler */}
                                <Card
                                    className="p-4 cursor-pointer hover:border-qc-accent hover:shadow-md transition-all group border-qc-accent/30 bg-gradient-to-br from-white to-qc-accent/5"
                                    onClick={() => handleGenerateClick("COMPILER", "Curriculum Bundle")}
                                >
                                    <div className="flex items-start gap-4">
                                        <div className="p-3 rounded-full bg-qc-accent/10 text-qc-accent group-hover:bg-qc-accent group-hover:text-white transition-colors">
                                            <MagicWand size={24} weight="duotone" />
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-qc-charcoal">Curriculum Bundle</h4>
                                            <p className="text-xs text-qc-text-muted mt-1">Generate a full 20-day unit with TG, Student Packet, and Slides.</p>
                                        </div>
                                    </div>
                                </Card>

                                {kinds.map(kind => (
                                    <Card
                                        key={kind.id}
                                        className="p-4 cursor-pointer hover:border-qc-primary hover:shadow-md transition-all group"
                                        onClick={() => handleGenerateClick(kind.id, kind.label)}
                                    >
                                        <div className="flex items-start gap-3">
                                            <div className="mt-1 p-2 rounded bg-qc-parchment text-qc-text-muted group-hover:text-qc-primary flex-shrink-0">
                                                <PresentationChart size={20} />
                                            </div>
                                            <div>
                                                <h4 className="font-semibold text-sm text-qc-charcoal">{kind.label}</h4>
                                                {kind.description && (
                                                    <p className="text-xs text-qc-text-muted mt-1 line-clamp-2">{kind.description}</p>
                                                )}
                                            </div>
                                        </div>
                                    </Card>
                                ))}
                            </div>
                        </TabsContent>
                    )}

                    <TabsContent value="books" className="flex-1 overflow-y-auto min-h-0 py-4">
                        {loading ? <p>Loading books...</p> : (
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                {books.map(book => (
                                    <Card
                                        key={book.id}
                                        className="p-3 cursor-pointer hover:border-qc-primary flex flex-col gap-2 transition-all h-full"
                                        onClick={() => handleSelectBook(book)}
                                    >
                                        <div className="flex items-center justify-center bg-qc-surface-raised rounded h-32 relative">
                                            {book.coverUrl ? (
                                                <img src={book.coverUrl} alt={book.title} className="h-full object-contain" />
                                            ) : (
                                                <Book size={32} className="text-qc-text-muted" />
                                            )}
                                        </div>
                                        <div>
                                            <h4 className="font-semibold text-sm line-clamp-2">{book.title}</h4>
                                            <p className="text-xs text-muted-foreground">{Array.isArray(book.authors) ? (book.authors as string[]).join(", ") : "Unknown Author"}</p>
                                        </div>
                                    </Card>
                                ))}
                                {books.length === 0 && <p className="col-span-full text-center text-muted-foreground">No books found.</p>}
                            </div>
                        )}
                    </TabsContent>

                    <TabsContent value="videos" className="flex-1 overflow-y-auto min-h-0 py-4">
                        {loading ? <p>Loading videos...</p> : (
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                {videos.map(video => (
                                    <Card
                                        key={video.id}
                                        className="p-3 cursor-pointer hover:border-qc-primary flex flex-col gap-2 transition-all h-full"
                                        onClick={() => handleSelectVideo(video)}
                                    >
                                        <div className="aspect-video bg-qc-surface-raised rounded flex items-center justify-center overflow-hidden">
                                            {video.thumbnailUrl ? (
                                                <img src={video.thumbnailUrl} alt={video.title || "Video"} className="w-full h-full object-cover" />
                                            ) : (
                                                <Video size={32} className="text-qc-text-muted" />
                                            )}
                                        </div>
                                        <div>
                                            <h4 className="font-semibold text-sm line-clamp-2">{video.title || "Untitled Video"}</h4>
                                            <p className="text-xs text-muted-foreground">{video.channelName}</p>
                                        </div>
                                    </Card>
                                ))}
                                {videos.length === 0 && <p className="col-span-full text-center text-muted-foreground">No videos found.</p>}
                            </div>
                        )}
                    </TabsContent>

                    <TabsContent value="articles" className="flex-1 overflow-y-auto min-h-0 py-4">
                        {loading ? <p>Loading articles...</p> : (
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                {articles.map(article => (
                                    <Card
                                        key={article.id}
                                        className="p-3 cursor-pointer hover:border-qc-primary flex flex-col gap-2 transition-all"
                                        onClick={() => handleSelectArticle(article)}
                                    >
                                        <div className="flex items-center justify-center bg-qc-surface-raised rounded h-24">
                                            <FileText size={32} className="text-qc-text-muted" />
                                        </div>
                                        <div>
                                            <h4 className="font-semibold text-sm line-clamp-2">{article.title}</h4>
                                        </div>
                                    </Card>
                                ))}
                                {articles.length === 0 && <p className="col-span-full text-center text-muted-foreground">No articles found.</p>}
                            </div>
                        )}
                    </TabsContent>

                    <TabsContent value="documents" className="flex-1 overflow-y-auto min-h-0 py-4">
                        {loading ? <p>Loading documents...</p> : (
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                {documents.map(doc => (
                                    <Card
                                        key={doc.id}
                                        className="p-3 cursor-pointer hover:border-qc-primary flex flex-col gap-2 transition-all"
                                        onClick={() => handleSelectDocument(doc)}
                                    >
                                        <div className="flex items-center justify-center bg-qc-surface-raised rounded h-24">
                                            <File size={32} className="text-qc-text-muted" />
                                        </div>
                                        <div>
                                            <h4 className="font-semibold text-sm line-clamp-2">{doc.fileName}</h4>
                                            <p className="text-xs text-muted-foreground">{(doc.fileSize / 1024).toFixed(1)} KB</p>
                                        </div>
                                    </Card>
                                ))}
                                {documents.length === 0 && <p className="col-span-full text-center text-muted-foreground">No documents found.</p>}
                            </div>
                        )}
                    </TabsContent>

                    <TabsContent value="resources" className="flex-1 overflow-y-auto min-h-0 py-4">
                        {loading ? <p>Loading resources...</p> : (
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                {resources.map(res => (
                                    <Card
                                        key={res.id}
                                        className="p-3 cursor-pointer hover:border-qc-primary flex flex-col gap-2 transition-all"
                                        onClick={() => handleSelectResource(res)}
                                    >
                                        <div className="flex items-center justify-center bg-qc-surface-raised rounded h-24">
                                            <PresentationChart size={32} className="text-qc-text-muted" />
                                        </div>
                                        <div>
                                            <h4 className="font-semibold text-sm line-clamp-2">{res.title}</h4>
                                            <p className="text-xs text-muted-foreground text-qc-primary">{res.resourceKind.label}</p>
                                        </div>
                                    </Card>
                                ))}
                                {resources.length === 0 && <p className="col-span-full text-center text-muted-foreground">No resources found.</p>}
                            </div>
                        )}
                    </TabsContent>


                    {mode === "universal" && (
                        <TabsContent value="bundles" className="flex-1 overflow-y-auto min-h-0 py-4">
                            {loading ? <p>Loading bundles...</p> : (
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                    {bundles.map(bundle => (
                                        <Card
                                            key={bundle.id}
                                            className="p-3 cursor-pointer hover:border-qc-primary flex flex-col gap-2 transition-all border-l-4 border-l-qc-accent"
                                            onClick={() => {
                                                if (onSelectBundle) {
                                                    onSelectBundle(bundle.id);
                                                    setOpen(false);
                                                }
                                            }}
                                        >
                                            <div className="flex items-center justify-center bg-qc-accent/5 rounded h-24">
                                                <MagicWand size={32} className="text-qc-accent" />
                                            </div>
                                            <div>
                                                <h4 className="font-semibold text-sm line-clamp-2">{bundle.spec.title}</h4>
                                                <div className="flex items-center justify-between text-xs mt-1">
                                                    <span className="text-qc-text-muted">{bundle.spec.topic}</span>
                                                    <span className={cn(
                                                        "px-1.5 py-0.5 rounded-full font-bold uppercase text-[10px]",
                                                        bundle.status === "COMPLETED" ? "bg-qc-success-bg text-qc-success-text" :
                                                            bundle.status === "FAILED" ? "bg-qc-error-bg text-qc-error-text" :
                                                                "bg-qc-warning-bg text-qc-warning-text"
                                                    )}>
                                                        {bundle.status}
                                                    </span>
                                                </div>
                                            </div>
                                        </Card>
                                    ))}
                                    {bundles.length === 0 && <p className="col-span-full text-center text-muted-foreground">No bundles found.</p>}
                                </div>
                            )}
                        </TabsContent>
                    )}
                </Tabs>
            </DialogContent >
        </Dialog >
    );
}
