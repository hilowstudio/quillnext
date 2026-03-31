"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { generateLearningTool } from "@/app/actions/generate-tool";

interface GeneratorFormProps {
  resourceKindId: string;
  resourceKindCode: string;
  resourceKindLabel: string;
  contentType: string;
  contextParams: {
    organizationId: string;
    studentId?: string;
    objectiveId?: string;
    courseId?: string;
    courseBlockId?: string;
    bookId?: string;
    videoId?: string;
    articleId?: string;
    documentId?: string;
    subject?: string;
    readingLevel?: string;
  };
}

export function GeneratorForm({
  resourceKindId,
  resourceKindCode,
  resourceKindLabel,
  contentType,
  contextParams,
}: GeneratorFormProps) {
  const router = useRouter();
  const [userPrompt, setUserPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedContent, setGeneratedContent] = useState<React.ReactNode>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!userPrompt.trim()) {
      alert("Please enter a prompt");
      return;
    }

    setIsGenerating(true);
    setGeneratedContent(null);

    try {
      const result = await generateLearningTool({
        toolType: resourceKindCode,
        userPrompt: userPrompt.trim(),
        studentId: contextParams.studentId,
        objectiveId: contextParams.objectiveId,
        organizationId: contextParams.organizationId,
        courseId: contextParams.courseId,
        courseBlockId: contextParams.courseBlockId,
        bookId: contextParams.bookId,
        videoId: contextParams.videoId,
        articleId: contextParams.articleId,
        documentId: contextParams.documentId,
        resourceKindId: resourceKindId,
      });

      // The result from streamUI contains the component in .value
      setGeneratedContent(result.value);
    } catch (error) {
      console.error("Generation error:", error);
      alert("Failed to generate content. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-xl">Generate Content</CardTitle>
          <CardDescription>
            Describe what you want to generate. Inkling will use all available context to
            personalize the content.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="prompt" className="font-body">
                Your Instructions
              </Label>
              <textarea
                id="prompt"
                value={userPrompt}
                onChange={(e) => setUserPrompt(e.target.value)}
                placeholder="e.g., Create a quiz about fractions with 10 questions..."
                className="mt-2 w-full min-h-[150px] rounded-qc-md border border-qc-border-subtle px-3 py-2 font-body text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-qc-primary focus-visible:ring-offset-2"
                disabled={isGenerating}
              />
            </div>

            {contextParams.studentId && (
              <div className="p-3 bg-qc-primary/5 rounded-qc-md border border-qc-primary/20">
                <p className="font-body text-xs text-qc-text-muted">
                  This content will be personalized for the selected student
                </p>
              </div>
            )}

            <Button type="submit" disabled={isGenerating || !userPrompt.trim()} className="w-full">
              {isGenerating ? "Generating..." : "Generate Content"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Generated Content */}
      {generatedContent && (
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-xl">Generated Content</CardTitle>
            <CardDescription>Your Inkling-generated content</CardDescription>
          </CardHeader>
          <CardContent>{generatedContent}</CardContent>
        </Card>
      )}

      {isGenerating && (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="flex flex-col items-center gap-4">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-qc-border-subtle border-t-qc-primary"></div>
              <p className="font-body text-qc-text-muted">
                Generating personalized content...
              </p>
              <p className="font-body text-xs text-qc-text-muted">
                Using context from family blueprint, student profile, and academic spine
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

