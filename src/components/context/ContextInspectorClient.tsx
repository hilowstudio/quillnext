"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { MasterContext } from "@/lib/context/master-context";

interface ContextInspectorClientProps {
  masterContext: MasterContext;
  contextPreview: string;
  organizationId: string;
  studentId?: string;
  objectiveId?: string;
  courseId?: string;
}

export function ContextInspectorClient({
  masterContext,
  contextPreview,
}: ContextInspectorClientProps) {
  const [activeTab, setActiveTab] = useState<"preview" | "raw" | "structured">("preview");

  const contextCompleteness = {
    family: masterContext.family !== null,
    student: masterContext.student !== null,
    academic: masterContext.academic !== null,
    library: masterContext.library !== null,
    schedule: masterContext.schedule !== null,
  };

  return (
    <div className="space-y-6">
      {/* Context Sources Status */}
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-lg">Context Sources</CardTitle>
          <CardDescription>Available context sources for this configuration</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {Object.entries(contextCompleteness).map(([key, available]) => (
              <div
                key={key}
                className={`p-3 rounded-qc-md border ${available
                  ? "bg-qc-primary/5 border-qc-primary/20"
                  : "bg-qc-warm-stone border-qc-border-subtle"
                  }`}
              >
                <p
                  className={`font-body text-xs font-medium mb-1 ${available ? "text-qc-primary" : "text-qc-text-muted"
                    }`}
                >
                  {key.charAt(0).toUpperCase() + key.slice(1)}
                </p>
                <p className="font-body text-xs text-qc-text-muted">
                  {available ? "Available" : "Not Available"}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Context Preview */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="font-display text-lg">Serialized Context</CardTitle>
              <CardDescription>
                The context string that will be sent to AI models
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant={activeTab === "preview" ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveTab("preview")}
              >
                Preview
              </Button>
              <Button
                variant={activeTab === "raw" ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveTab("raw")}
              >
                Raw JSON
              </Button>
              <Button
                variant={activeTab === "structured" ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveTab("structured")}
              >
                Structured
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {activeTab === "preview" && (
            <div className="bg-qc-warm-stone rounded-qc-md p-4 max-h-96 overflow-y-auto">
              <pre className="font-mono text-xs text-qc-charcoal whitespace-pre-wrap">
                {contextPreview || "No context available"}
              </pre>
            </div>
          )}

          {activeTab === "raw" && (
            <div className="bg-qc-warm-stone rounded-qc-md p-4 max-h-96 overflow-y-auto">
              <pre className="font-mono text-xs text-qc-charcoal whitespace-pre-wrap">
                {JSON.stringify(masterContext, null, 2)}
              </pre>
            </div>
          )}

          {activeTab === "structured" && (
            <div className="space-y-4">
              {masterContext.family && (
                <div className="p-4 bg-qc-primary/5 rounded-qc-md border border-qc-primary/20">
                  <p className="font-body text-sm font-medium text-qc-primary mb-2">
                    Family Context
                  </p>
                  <p className="font-body text-xs text-qc-charcoal">
                    Classroom: {masterContext.family.classroom.name}
                  </p>
                  <p className="font-body text-xs text-qc-charcoal">
                    Philosophy: {masterContext.family.classroom.educationalPhilosophy}
                  </p>
                </div>
              )}

              {masterContext.student && (
                <div className="p-4 bg-qc-primary/5 rounded-qc-md border border-qc-primary/20">
                  <p className="font-body text-sm font-medium text-qc-primary mb-2">
                    Student Context
                  </p>
                  <p className="font-body text-xs text-qc-charcoal">
                    {masterContext.student.student.firstName} {masterContext.student.student.lastName} - Grade {masterContext.student.student.currentGrade}
                  </p>
                  {masterContext.student.profile && (
                    <p className="font-body text-xs text-qc-charcoal mt-1">
                      Personality Profile: Available
                    </p>
                  )}
                </div>
              )}

              {masterContext.academic && (
                <div className="p-4 bg-qc-parchment rounded-qc-md border border-qc-border-subtle">
                  <p className="font-body text-sm font-medium text-qc-charcoal mb-2">
                    Academic Context
                  </p>
                  <p className="font-body text-xs text-qc-charcoal">
                    {masterContext.academic.fullPath}
                  </p>
                </div>
              )}

              {masterContext.library && (
                <div className="p-4 bg-qc-parchment rounded-qc-md border border-qc-border-subtle">
                  <p className="font-body text-sm font-medium text-qc-charcoal mb-2">
                    Library Context
                  </p>
                  <p className="font-body text-xs text-qc-charcoal">
                    {masterContext.library.relevantBooks.length} books available
                  </p>
                </div>
              )}

              {masterContext.schedule && (
                <div className="p-4 bg-qc-parchment rounded-qc-md border border-qc-border-subtle">
                  <p className="font-body text-sm font-medium text-qc-charcoal mb-2">
                    Schedule Context
                  </p>
                  <p className="font-body text-xs text-qc-charcoal">
                    School Year: {new Date(masterContext.schedule.schoolYearStartDate).toLocaleDateString()} - {new Date(masterContext.schedule.schoolYearEndDate).toLocaleDateString()}
                  </p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Export Options */}
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-lg">Export Context</CardTitle>
          <CardDescription>Download context for debugging or analysis</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={() => {
              const blob = new Blob([contextPreview], { type: "text/plain" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `context-${Date.now()}.txt`;
              a.click();
            }}
          >
            Download as Text
          </Button>
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={() => {
              const blob = new Blob([JSON.stringify(masterContext, null, 2)], {
                type: "application/json",
              });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `context-${Date.now()}.json`;
              a.click();
            }}
          >
            Download as JSON
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

