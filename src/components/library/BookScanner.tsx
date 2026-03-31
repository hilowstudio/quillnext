"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { lookupBook } from "@/app/actions/library-lookup-actions";
import { processImageForOcr } from "@/lib/image-processing";
import { toast } from "sonner";
import { Camera, MagnifyingGlass, Barcode, TextT } from "@phosphor-icons/react";

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

export function BookScanner({ organizationId }: BookScannerProps) {
  const router = useRouter();

  // State
  const [activeTab, setActiveTab] = useState("isbn");
  const [isLoading, setIsLoading] = useState(false);
  const [extractedData, setExtractedData] = useState<ExtractedBookData | null>(null);

  // Form State
  const [isbnQuery, setIsbnQuery] = useState("");
  const [textQuery, setTextQuery] = useState("");

  // Image State
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

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

  // Handlers
  const handleIsbnLookup = async () => {
    if (!isbnQuery) return toast.error("Please enter an ISBN");

    setIsLoading(true);
    const result = await lookupBook({ query: isbnQuery, type: "BOOK" });
    setIsLoading(false);

    if (result.success && result.data) {
      setExtractedData(result.data);
      toast.success("Book found!");
    } else {
      toast.error(result.error || "Book not found");
    }
  };

  const handleTextLookup = async () => {
    if (!textQuery) return toast.error("Please enter a title or author");

    setIsLoading(true);
    // Type undefined defaults to TITLE_AUTHOR search in backend for now
    const result = await lookupBook({ query: textQuery });
    setIsLoading(false);

    if (result.success && result.data) {
      setExtractedData(result.data);
      toast.success("Book found!");
    } else {
      toast.error(result.error || "Book not found");
    }
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const url = URL.createObjectURL(file);
      setImagePreview(url);

      // If we are in "Scan" mode, we might want to auto-process
      // For now, we wait for user to click "Proccess"
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
          <CardDescription>Search by ISBN, scan a cover, or enter manually.</CardDescription>
        </CardHeader>
        <CardContent>
          {!extractedData ? (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-3 mb-6">
                <TabsTrigger value="isbn"><Barcode className="mr-2" /> ISBN</TabsTrigger>
                <TabsTrigger value="text"><MagnifyingGlass className="mr-2" /> Search</TabsTrigger>
                <TabsTrigger value="scan"><Camera className="mr-2" /> Scan Cover</TabsTrigger>
              </TabsList>

              <TabsContent value="isbn" className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="Enter ISBN (e.g. 9780141182636)"
                    value={isbnQuery}
                    onChange={(e) => setIsbnQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleIsbnLookup()}
                  />
                  <Button onClick={handleIsbnLookup} disabled={isLoading}>
                    {isLoading ? "Searching..." : "Lookup"}
                  </Button>
                </div>
                <p className="text-xs text-qc-text-muted">Supports ISBN-10 and ISBN-13.</p>
              </TabsContent>

              <TabsContent value="text" className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="Title or Author..."
                    value={textQuery}
                    onChange={(e) => setTextQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleTextLookup()}
                  />
                  <Button onClick={handleTextLookup} disabled={isLoading}>
                    {isLoading ? "Searching..." : "Search"}
                  </Button>
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
                    <span className="text-xs text-qc-text-muted mt-1">We'll attempt to read the cover text</span>
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
        <p className="font-bold mb-1">💡 Deep Extraction (Alpha)</p>
        <p>After saving, you can upload Table of Contents images to automatically generate chapter-level metadata using AI.</p>
      </div>
    </div>
  );
}
