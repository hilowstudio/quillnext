"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

// Error Boundary for /transcripts/[studentId]. Catches errors thrown while server-rendering
// this segment (including the transcript data fetch/generation) and child-render crashes from
// TranscriptBuilder. `reset()` re-renders the segment. Replaces the page's former inline
// try/catch (which also leaked the raw error.message to the user).
export default function TranscriptBuilderError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error("Transcript Builder Error:", error);
    }, [error]);

    return (
        <div className="container mx-auto py-12 text-center">
            <h3 className="text-lg font-bold text-qc-error">Error Loading Transcript</h3>
            <p className="text-qc-text-muted mb-4">Could not load the student data. Please try again.</p>
            <Button variant="outline" onClick={reset}>Try Again</Button>
        </div>
    );
}
