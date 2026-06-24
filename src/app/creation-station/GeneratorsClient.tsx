"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { generateResource } from "@/app/actions/generate-resource";
import { toast } from "sonner";
import Link from "next/link";
import { MagicWand, Spinner, ArrowLeft, BookOpen, Video, ChalkboardTeacher, Sparkle, Globe, File as FileIcon, YoutubeLogo } from "@phosphor-icons/react";
import { ResourcePicker } from "@/components/courses/ResourcePicker";
import { getSourceMetadata, SourceType } from "@/app/actions/generator-actions";
import { SourceTypeSelector } from "@/components/generators/SourceTypeSelector";
import { TopicSelector } from "@/components/generators/TopicSelector";
import { SpineBrowser, type SpineSelection } from "@/components/generators/SpineBrowser";
import { UrlInput, FileUpload } from "@/components/generators/SimpleInputs";
import { YouTubeImport } from "@/components/creation/YouTubeImport";
import { YouTubePlaylist } from "@/lib/api/youtube";

interface ResourceKind {
  id: string;
  label: string;
  description: string | null;
  contentType: string;
  subjectId: string | null;
  strandId: string | null;
  subject: { name: string } | null;
}

type WizardStep = "SOURCE" | "TEMPLATE"; // Assuming WizardStep is defined elsewhere or needs to be defined

export default function GeneratorsClient({ organizationId }: { organizationId: string }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // Initial State derived from URL
  const [sourceType, setSourceType] = useState<SourceType | null>(() => {
    // Initialize from URL if present
    const src = searchParams.get("sourceType") as SourceType;
    return src || null;
  });

  const [kinds, setKinds] = useState<ResourceKind[]>([]);
  const [selectedKindId, setSelectedKindId] = useState<string>("");

  // Generic Source ID (Book ID, Video ID, Course ID). The library "Use in Generator" deep-links
  // (BookList/VideoList/CourseList/DocumentList/ArticleList) pass it as `sourceId`; the older
  // book/video/course links pass type-specific keys — accept either so the source pre-selects.
  const [sourceId, setSourceId] = useState<string>(
    searchParams.get("bookId") || searchParams.get("videoId") || searchParams.get("courseId") || searchParams.get("sourceId") || ""
  );
  const [sourceTitle, setSourceTitle] = useState<string>("");

  // Specific Data for new types
  const [topicText, setTopicText] = useState("");
  const [spineSelection, setSpineSelection] = useState<SpineSelection | null>(null);
  const [url, setUrl] = useState(() => searchParams.get("url") || "");
  const [file, setFile] = useState<File | null>(null);
  const [fileContent, setFileContent] = useState("");

  const [instructions, setInstructions] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedResourceId, setGeneratedResourceId] = useState<string | null>(null);

  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [sourceMetadata, setSourceMetadata] = useState<{ subjectId?: string | null, strandId?: string | null }>({});

  // Sync URL with Source Type
  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (sourceType) {
      params.set("sourceType", sourceType);
    } else {
      params.delete("sourceType");
    }
    router.replace(`${pathname}?${params.toString()}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- syncs only on sourceType change; searchParams is read to preserve sibling params but must NOT be a dep (the effect's own router.replace mutates it → re-fire loop)
  }, [sourceType, router, pathname]);

  // Load Kinds
  useEffect(() => {
    fetch("/api/curriculum/resource-kinds")
      .then(res => res.json())
      .then(data => setKinds(data.kinds || []))
      .catch(console.error);
  }, []);

  // Fetch Source Metadata (for filtering)
  useEffect(() => {
    async function fetchMetadata() {
      // Only fetch metadata for ID-based sources
      if (!sourceType || !sourceId || !["BOOK", "VIDEO", "COURSE"].includes(sourceType)) {
        if (sourceType === "TOPIC") {
          // We rely on TopicSelector to set metadata if implemented
        } else {
          setSourceMetadata({});
        }
        return;
      }

      const res = await getSourceMetadata(sourceId, sourceType);
      if (res.success && res.metadata) {
        setSourceMetadata(res.metadata);
      }
    }

    fetchMetadata();
  }, [sourceId, sourceType]);

  // File Reading
  useEffect(() => {
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => setFileContent(e.target?.result as string);
      reader.readAsText(file);
    } else {
      setFileContent("");
    }
  }, [file]);


  // Filter Kinds based on Metadata
  const filteredKinds = kinds.filter(kind => {
    // If no source selected (for ID types) or initialized, show all
    if (sourceType && ["BOOK", "VIDEO", "COURSE"].includes(sourceType) && !sourceId) return true;

    // If resource kind is specific to a subject, check match
    if (kind.subjectId && sourceMetadata.subjectId && kind.subjectId !== sourceMetadata.subjectId) {
      return false;
    }

    // If resource kind is specific to a strand, check match
    if (kind.strandId && sourceMetadata.strandId && kind.strandId !== sourceMetadata.strandId) {
      return false;
    }

    return true;
  });

  const handleGenerate = async () => {
    if (!selectedKindId || !sourceType) return;

    // Validation
    if (sourceType === "TOPIC" && !topicText) return toast.error("Please enter a topic.");
    if (sourceType === "URL" && !url) return toast.error("Please enter a URL.");
    if (sourceType === "FILE" && !fileContent) return toast.error("Please upload a file.");
    if (sourceType === "SPINE" && !spineSelection) return toast.error("Please select a curriculum level.");
    if (sourceType && ["BOOK", "VIDEO", "COURSE"].includes(sourceType) && !sourceId) return toast.error("Please select a source.");

    setIsGenerating(true);
    try {
      toast.success("Spinning up the generator...");

      // SPINE generates at the selected spine level: the level IS the generation sourceType, the
      // node id is the sourceId, and the subject rides through for textbook grounding.
      const result = sourceType === "SPINE"
        ? await generateResource(
            spineSelection!.id,
            spineSelection!.level,
            selectedKindId,
            instructions,
            { subject: spineSelection!.subjectName },
          )
        : await generateResource(
            sourceId || (sourceType === "URL" ? url : sourceType === "TOPIC" ? "topic" : "file"),
            sourceType,
            selectedKindId,
            instructions,
            {
              topicText: sourceType === "TOPIC" ? topicText : undefined,
              url: sourceType === "URL" ? url : undefined,
              fileContent: sourceType === "FILE" ? fileContent : undefined,
              fileName: file?.name,
            },
          );

      if (result.success) {
        toast.success("Content generated successfully!");
        setGeneratedResourceId(result.resourceId);
      } else {
        toast.error("Generation failed. Please try again.");
      }
    } catch (error) {
      console.error(error);
      toast.error("An error occurred");
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePlaylistImport = (playlist: YouTubePlaylist) => {
    // For playlist, we use the playlist URL/ID as the source
    // Assuming backend takes the content URL or ID
    // We'll construct a standard YouTube Playlist URL
    const playlistUrl = `https://www.youtube.com/playlist?list=${playlist.id}`;
    setUrl(playlistUrl);
    setSourceTitle(playlist.title);
    setSourceId(playlistUrl); // Use URL as ID for YOUTUBE_PLAYLIST type if needed, or let generateResource handle precedence
    toast.success("Playlist selected! Now choose a template.");
  };

  const hasSource =
    (sourceType === "BOOK" && sourceId) ||
    (sourceType === "VIDEO" && sourceId) ||
    (sourceType === "COURSE" && sourceId) ||
    (sourceType === "TOPIC") ||
    (sourceType === "URL") ||
    (sourceType === "FILE") ||
    (sourceType === "SPINE" && !!spineSelection);

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6">

        <h1 className="font-display text-4xl font-bold text-qc-charcoal mb-2 text-balance">
          Creation Station
        </h1>
        <p className="font-body text-qc-text-muted qc-prose">
          Create worksheets, quizzes, and lesson plans from any source.
        </p>
      </div>

      <ResourcePicker
        organizationId={organizationId}
        open={isPickerOpen}
        onOpenChange={setIsPickerOpen}
        onSelectBook={(book) => {
          setSourceId(book.id);
          setSourceTitle(book.title);
        }}
        onSelectVideo={(video) => {
          setSourceId(video.id);
          setSourceTitle(video.title || "Untitled Video");
        }}

        onSelectArticle={(article) => {
          setSourceId(article.id);
          setSourceTitle(article.title);
        }}
        onSelectDocument={(doc) => {
          setSourceId(doc.id);
          setSourceTitle(doc.fileName);
        }}
        onSelectResource={(resource) => {
          setSourceId(resource.id);
          setSourceTitle(resource.title);
        }}

      />

      <div className="mb-8">
        <SourceTypeSelector value={sourceType || undefined} onValueChange={(val) => {
          setSourceType(val);
          // When switching, maintain ID if staying in library types, else clear?
          // For simplicity, we keep sourceId but it won't be used if we switch to TOPIC
        }} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Settings Column */}
        <div className="md:col-span-1 space-y-6">


          {/* Source Input Area */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                1. Select Content
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* BOOK / VIDEO / COURSE - Use Pickers */}
              {sourceType && ["BOOK", "VIDEO", "COURSE"].includes(sourceType) && (
                <div className="space-y-4">
                  {!sourceId ? (
                    <div className="text-center py-6 bg-qc-parchment rounded-lg border border-dashed border-qc-text-muted/30">
                      <p className="text-sm text-qc-text-muted mb-3">Select a {sourceType?.toLowerCase()} from your library</p>
                      <Button size="sm" onClick={() => setIsPickerOpen(true)}>Browse Library</Button>
                    </div>
                  ) : (
                    <div className="relative group">
                      <div className="p-3 bg-qc-parchment border border-qc-primary/20 rounded-md">
                        <div className="text-xs font-bold text-qc-primary mb-1">{sourceType}</div>
                        <div className="font-medium line-clamp-2">{sourceTitle || "Selected Item"}</div>
                        <div className="text-xs text-qc-text-muted font-mono mt-1">{sourceId.substring(0, 8)}...</div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-white/80 hover:bg-white"
                        onClick={() => setIsPickerOpen(true)}
                      >
                        Change
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {/* TOPIC */}
              {sourceType === "TOPIC" && (
                <TopicSelector onTopicChange={(topic, meta) => {
                  setTopicText(topic);
                  if (meta) {
                    setSourceMetadata(prev => ({ ...prev, ...meta }));
                  } else {
                    setSourceMetadata({});
                  }
                }} />
              )}

              {/* URL */}
              {sourceType === "URL" && (
                <UrlInput value={url} onChange={setUrl} />
              )}

              {/* FILE */}
              {sourceType === "FILE" && (
                <div className="p-8 border-2 border-dashed border-qc-border-subtle rounded-lg text-center">
                  <p>File upload coming soon...</p>
                </div>
              )}

              {sourceType === "YOUTUBE_PLAYLIST" && (
                <YouTubeImport onImport={handlePlaylistImport} />
              )}

              {/* SPINE — generate at ANY level of the academic spine */}
              {sourceType === "SPINE" && (
                <SpineBrowser onSelect={setSpineSelection} />
              )}
            </CardContent>
          </Card>

          {/* Template Selection */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">2. Choose Template</CardTitle>
              {Object.keys(sourceMetadata).length > 0 && (filteredKinds.length < kinds.length) && (
                <div className="text-xs text-muted-foreground font-normal">
                  Filtered by relevant subject/strand
                </div>
              )}
            </CardHeader>
            <CardContent className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
              {filteredKinds.map(kind => (
                <div
                  key={kind.id}
                  onClick={() => setSelectedKindId(kind.id)}
                  className={`p-3 rounded-qc-md border cursor-pointer transition-all ${selectedKindId === kind.id
                    ? "border-qc-primary bg-qc-primary/5 shadow-sm ring-1 ring-qc-primary/20"
                    : "border-qc-border-subtle hover:border-qc-primary/50 hover:bg-qc-parchment"
                    }`}
                >
                  <div className="font-bold text-sm flex justify-between">
                    {kind.subject && <span className="text-[10px] bg-qc-surface-raised px-1.5 py-0.5 rounded text-qc-text-muted uppercase tracking-wider">{kind.subject.name}</span>}
                  </div>
                  {kind.description && <div className="text-xs text-qc-text-muted mt-1">{kind.description}</div>}
                </div>
              ))}
              {filteredKinds.length === 0 && <div className="text-sm text-qc-text-muted text-center py-4">No matching templates found.</div>}
            </CardContent>
          </Card>
        </div>

        {/* Action Column */}
        <div className="md:col-span-2 space-y-6">
          <Card className="h-full flex flex-col border-qc-border-subtle shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">3. Confirm & Generate</CardTitle>
              <CardDescription>Review your settings and let Inkling build your resource.</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 space-y-6">

              <div className="p-4 bg-qc-parchment/50 rounded-lg border border-qc-border-subtle/50">
                <h4 className="text-sm font-semibold mb-2 text-qc-charcoal">Request Summary</h4>
                <ul className="text-sm space-y-1 text-qc-text-muted">
                  <li className="flex gap-2"><span className="w-16 font-medium text-qc-text-muted/70">Source:</span> <span className="text-qc-charcoal">{sourceType}</span></li>
                  <li className="flex gap-2"><span className="w-16 font-medium text-qc-text-muted/70">Content:</span> <span className="text-qc-charcoal font-medium truncate max-w-md">
                    {
                      sourceType === "TOPIC" ? topicText || "-" :
                        sourceType === "URL" ? url || "-" :
                          sourceType === "FILE" ? file?.name || "-" :
                            sourceType === "SPINE" ? (spineSelection ? `${spineSelection.level}: ${spineSelection.name}` : "-") :
                              sourceTitle || "-"
                    }
                  </span></li>
                  <li className="flex gap-2"><span className="w-16 font-medium text-qc-text-muted/70">Template:</span> <span className="text-qc-charcoal">{kinds.find(k => k.id === selectedKindId)?.label || "-"}</span></li>
                </ul>
              </div>

              <div className="space-y-2">
                <Label>Special Instructions (Optional)</Label>
                <Textarea
                  placeholder="E.g., Make it suitable for a 5th grader. Focus on vocabulary."
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  className="h-32 resize-none bg-white"
                />
              </div>
            </CardContent>

            <CardContent className="border-t border-qc-border-subtle pt-6 pb-6 bg-qc-parchment/30 mt-auto">
              <Button
                size="lg"
                className="w-full gap-2 text-lg h-12 shadow-lg shadow-qc-primary/20 hover:shadow-xl transition-all"
                disabled={!selectedKindId || isGenerating ||
                  (sourceType === "TOPIC" && !topicText) ||
                  (sourceType === "URL" && !url) ||
                  (sourceType === "FILE" && !file) ||
                  (!!sourceType && ["BOOK", "VIDEO", "COURSE"].includes(sourceType) && !sourceId)
                }
                onClick={handleGenerate}
              >
                {isGenerating ? (
                  <>
                    <Spinner className="animate-spin" /> Generating...
                  </>
                ) : (
                  <>
                    <MagicWand weight="fill" /> Create Resource
                  </>
                )}
              </Button>

              {generatedResourceId && (
                <div className="mt-4 p-4 bg-qc-success/10 border border-qc-success/20 rounded-qc-md flex justify-between items-center animate-in fade-in slide-in-from-bottom-2">
                  <div className="flex items-center gap-2 text-qc-success">
                    <div className="w-2 h-2 rounded-full bg-qc-success animate-pulse"></div>
                    <span className="font-bold text-sm">Generation Complete!</span>
                  </div>
                  <Button variant="outline" size="sm" asChild className="border-qc-success/30 hover:bg-qc-success/10 hover:text-qc-success">
                    <Link href={`/living-library/resource/${generatedResourceId}`}>View Resource</Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
