"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { lookupBook } from "@/app/actions/library-lookup-actions";
import type { BookMetadata } from "@/lib/api/google-books";
import { processImageForOcr } from "@/lib/image-processing";
import { BarcodeScanner } from "@/components/library/BarcodeScanner";
import { toast } from "sonner";
import { Camera, MagnifyingGlass, Barcode } from "@phosphor-icons/react";

interface BookScannerProps {
  organizationId: string;
}

interface ExtractedBookData {
  isbn?: string;
  title: string;
  authors?: string[];
  publisher?: string;
  publishedDate?: string;
  description?: string;
  coverUrl?: string;
  pageCount?: number;
}

interface Subject {
  id: string;
  name: string;
  code: string;
}

interface Strand {
  id: string;
  name: string;
  code: string;
  subjectId: string;
}

/** True when the trimmed query (sans spaces/hyphens) looks like an ISBN-10/13. */
function looksLikeIsbn(query: string): boolean {
  const stripped = query.trim().replace(/[\s-]/g, "");
  return /^[0-9]{9}[0-9X]$/i.test(stripped) || /^[0-9]{13}$/.test(stripped);
}

export function BookScanner({ organizationId }: BookScannerProps) {
  // organizationId is reserved for org-scoped behavior; currently the save route
  // resolves the tenant server-side, so it is intentionally not read here.
  void organizationId;
  const router = useRouter();

  // State
  const [activeTab, setActiveTab] = useState("search");
  const [isLoading, setIsLoading] = useState(false);
  const [extractedData, setExtractedData] = useState<ExtractedBookData | null>(null);

  // Omnibox search
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<BookMetadata[] | null>(null);

  // Image State
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // Barcode manual fallback
  const [manualIsbn, setManualIsbn] = useState("");

  // Taxonomy
  const [selectedSubject, setSelectedSubject] = useState<string>("");
  const [selectedStrand, setSelectedStrand] = useState<string>("");
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [strands, setStrands] = useState<Strand[]>([]);

  // Load subjects
  useEffect(() => {
    fetch("/api/curriculum/subjects")
      .then((res) => res.json())
      .then((data) => setSubjects(data.subjects || []))
      .catch(console.error);
  }, []);

  // Load strands
  useEffect(() => {
    if (selectedSubject) {
      fetch(`/api/curriculum/strands?subjectId=${selectedSubject}`)
        .then((res) => res.json())
        .then((data) => setStrands(data.strands || []))
        .catch(console.error);
    } else {
      setStrands([]);
    }
  }, [selectedSubject]);

  /** Run an ISBN lookup (single result) and jump straight to the preview form. */
  const runIsbnLookup = async (rawIsbn: string) => {
    const isbn = rawIsbn.trim();
    if (!isbn) return toast.error("Please enter an ISBN");

    setIsLoading(true);
    const result = await lookupBook({ query: isbn, type: "BOOK" });
    setIsLoading(false);

    if (result.success && result.data) {
      setSearchResults(null);
      setExtractedData(result.data);
      toast.success("Book found!");
    } else {
      toast.error(result.error || "Book not found");
    }
  };

  /** Omnibox handler: auto-detect ISBN vs. title/author and act accordingly. */
  const handleOmniSearch = async () => {
    const query = searchQuery.trim();
    if (!query) return toast.error("Enter a title, author, or ISBN");

    if (looksLikeIsbn(query)) {
      await runIsbnLookup(query);
      return;
    }

    setIsLoading(true);
    setSearchResults(null);
    const result = await lookupBook({ query });
    setIsLoading(false);

    if (result.success && result.results && result.results.length > 0) {
      setSearchResults(result.results);
    } else if (result.success && result.data) {
      // Defensive: a backend that still returns a single `data` for titles.
      setSearchResults([result.data]);
    } else {
      setSearchResults([]);
      toast.error(result.error || "No books found matching that search.");
    }
  };

  /** User picked a result from the list — promote it to the preview form. */
  const handleSelectResult = (book: BookMetadata) => {
    setExtractedData({
      isbn: book.isbn,
      title: book.title,
      authors: book.authors,
      publisher: book.publisher,
      publishedDate: book.publishedDate,
      description: book.description,
      coverUrl: book.coverUrl,
      pageCount: book.pageCount,
    });
    setSearchResults(null);
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const url = URL.createObjectURL(file);
      setImagePreview(url);
    }
  };

  const handleCoverScan = async () => {
    if (!imageFile) return;
    setIsLoading(true);

    try {
      // Pre-process image for better OCR results
      const processedBase64 = await processImageForOcr(imageFile);
      const cleanBase64 = processedBase64.split(",")[1];

      // Call Vision API
      const response = await fetch("/api/library/scan/vision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: cleanBase64 }),
      });

      if (!response.ok) throw new Error("Vision API failed");

      const data = await response.json();
      if (data.book) {
        setExtractedData(data.book);
        toast.success("Info extracted from cover!");
      } else {
        toast.warning("Could not extract info. Try manual entry.");
      }

    } catch (err) {
      console.error(err);
      toast.error("Failed to scan image");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!extractedData || !selectedSubject) {
      return toast.error("Subject is required to save to library");
    }

    setIsLoading(true);
    try {
      const response = await fetch("/api/library/books", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...extractedData,
          subjectId: selectedSubject,
          strandId: selectedStrand || null,
          externalSource: "GOOGLE_BOOKS", // TODO: Determine if OpenLibrary was used
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to save");
      }

      const { book } = await response.json();
      toast.success("Book saved to library!");
      router.push(`/living-library/${book.id}`); // Redirect to book page
    } catch (error) {
      console.error(error);
      toast.error("Failed to save book");
    } finally {
      setIsLoading(false);
    }
  };

  // Render the selectable list of search results.
  const renderResults = () => {
    if (!searchResults) return null;
    if (searchResults.length === 0) {
      return (
        <p className="text-sm text-qc-text-muted text-center py-6">
          No matches found. Try a different search or an ISBN.
        </p>
      );
    }
    return (
      <div className="space-y-2 animate-in fade-in duration-300">
        <div className="flex items-center justify-between">
          <p className="text-xs text-qc-text-muted">{searchResults.length} result{searchResults.length === 1 ? "" : "s"} — pick one to continue.</p>
          <Button variant="ghost" size="sm" onClick={() => setSearchResults(null)}>Clear</Button>
        </div>
        <ul className="divide-y divide-qc-border-subtle rounded-lg border border-qc-border-subtle overflow-hidden">
          {searchResults.map((book, idx) => {
            const year = book.publishedDate?.slice(0, 4);
            return (
              <li key={`${book.isbn || book.title}-${idx}`}>
                <button
                  type="button"
                  onClick={() => handleSelectResult(book)}
                  className="flex w-full gap-3 p-3 text-left hover:bg-qc-parchment/60 transition-colors"
                >
                  {book.coverUrl ? (
                    <img src={book.coverUrl} alt="" className="w-12 h-16 object-cover rounded shadow-sm flex-shrink-0" />
                  ) : (
                    <div className="w-12 h-16 rounded bg-qc-parchment flex items-center justify-center flex-shrink-0">
                      <Barcode className="w-5 h-5 text-qc-text-muted" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-qc-charcoal truncate">{book.title}</p>
                    {book.authors && book.authors.length > 0 && (
                      <p className="text-xs text-qc-text-muted truncate">{book.authors.join(", ")}</p>
                    )}
                    <p className="text-xs text-qc-text-muted mt-0.5 truncate">
                      {[year, book.publisher].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    );
  };

  // Render form fields
  const renderForm = () => {
    if (!extractedData) return null;
    return (
      <div className="space-y-4 animate-in slide-in-from-bottom duration-500">
        <div className="flex gap-4 items-start bg-qc-parchment p-4 rounded-lg border border-qc-border-subtle">
          {extractedData.coverUrl && (
            <img src={extractedData.coverUrl} alt="Cover" className="w-24 h-auto rounded shadow-sm" />
          )}
          <div className="flex-1">
            <h3 className="font-bold text-lg text-qc-charcoal">{extractedData.title}</h3>
            <p className="text-sm text-qc-text-muted">{extractedData.authors?.join(", ")}</p>
            {extractedData.publisher && <p className="text-xs text-qc-text-muted mt-1">{extractedData.publisher}, {extractedData.publishedDate}</p>}
          </div>
          <Button variant="ghost" size="sm" onClick={() => setExtractedData(null)}>Change</Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Subject *</Label>
            <Select value={selectedSubject} onValueChange={(val) => { setSelectedSubject(val); setSelectedStrand(""); }}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select Subject" />
              </SelectTrigger>
              <SelectContent>
                {subjects.map(s => <SelectItem key={s.id} value={s.id}>{s.name} ({s.code})</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {/* Only show strand if subject matches */}
          <div>
            <Label>Strand (Optional)</Label>
            <Select value={selectedStrand} onValueChange={setSelectedStrand} disabled={!selectedSubject || strands.length === 0}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select Strand" />
              </SelectTrigger>
              <SelectContent>
                {strands.map(s => <SelectItem key={s.id} value={s.id}>{s.name} ({s.code})</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <Label>Description</Label>
          <textarea
            className="w-full mt-1 min-h-[100px] p-2 rounded-md border border-input text-sm"
            value={extractedData.description || ""}
            onChange={(e) => setExtractedData({ ...extractedData, description: e.target.value })}
          />
        </div>

        <Button className="w-full" onClick={handleSave} disabled={isLoading || !selectedSubject}>
          {isLoading ? "Saving..." : "Add to Library"}
        </Button>
      </div>
    );
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-2xl">Add New Book</CardTitle>
          <CardDescription>Search by title, author, or ISBN, scan a barcode or cover, or enter manually.</CardDescription>
        </CardHeader>
        <CardContent>
          {!extractedData ? (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-3 mb-6">
                <TabsTrigger value="search"><MagnifyingGlass className="mr-2" /> Search</TabsTrigger>
                <TabsTrigger value="barcode"><Barcode className="mr-2" /> Scan Barcode</TabsTrigger>
                <TabsTrigger value="scan"><Camera className="mr-2" /> Scan Cover</TabsTrigger>
              </TabsList>

              <TabsContent value="search" className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="Search by title, author, or ISBN"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleOmniSearch()}
                  />
                  <Button onClick={handleOmniSearch} disabled={isLoading}>
                    {isLoading ? "Searching..." : "Search"}
                  </Button>
                </div>
                <p className="text-xs text-qc-text-muted">
                  Enter an ISBN-10/13 for an exact match, or a title/author to browse results.
                </p>
                {renderResults()}
              </TabsContent>

              <TabsContent value="barcode" className="space-y-4">
                <BarcodeScanner onIsbn={(isbn) => void runIsbnLookup(isbn)} />
                <div className="space-y-2">
                  <Label className="text-xs text-qc-text-muted">Or enter the ISBN manually</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="e.g. 9780141182636"
                      value={manualIsbn}
                      onChange={(e) => setManualIsbn(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && runIsbnLookup(manualIsbn)}
                    />
                    <Button variant="outline" onClick={() => runIsbnLookup(manualIsbn)} disabled={isLoading}>
                      {isLoading ? "..." : "Lookup"}
                    </Button>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="scan" className="space-y-4">
                <div className="border-2 border-dashed border-qc-border-subtle rounded-lg p-6 text-center hover:bg-qc-parchment/50 transition-colors">
                  <Input type="file" accept="image/*" capture="environment" className="hidden" id="scan-upload" onChange={handleImageSelect} />
                  <label htmlFor="scan-upload" className="cursor-pointer flex flex-col items-center">
                    {imagePreview ? (
                      <img src={imagePreview} className="max-h-64 object-contain rounded-md mb-4" />
                    ) : (
                      <Camera className="w-12 h-12 text-qc-text-muted mb-2" />
                    )}
                    <span className="text-sm font-medium text-qc-primary">Tap to Take Photo / Upload</span>
                    <span className="text-xs text-qc-text-muted mt-1">We&apos;ll attempt to read the cover text</span>
                  </label>
                </div>
                {imagePreview && (
                  <Button className="w-full" onClick={handleCoverScan} disabled={isLoading}>
                    {isLoading ? "Processing Image..." : "Extract Info"}
                  </Button>
                )}
              </TabsContent>
            </Tabs>
          ) : (
            renderForm()
          )}
        </CardContent>
      </Card>

      <div className="p-4 bg-qc-warning-bg border border-qc-warning-border rounded-lg text-sm text-qc-warning-text">
        <p className="font-bold mb-1">Deep Extraction</p>
        <p>After saving, open the book to run Deep Extraction — it generates a summary, chapter table of contents, and reading-level metadata.</p>
      </div>
    </div>
  );
}
