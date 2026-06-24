"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

// Route-level Error Boundary for /transcripts (and nested segments without their own
// error.tsx). Catches errors thrown while server-rendering the segment — including failed
// data fetches — which the page's former inline try/catch handled, plus child-render crashes
// it could not. `reset()` retries the segment render (the recovery path the inline catch lacked).
export default function TranscriptsError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error("Transcripts Page Error:", error);
    }, [error]);

    return (
        <div className="container mx-auto py-12 text-center text-qc-error">
            <h3 className="text-lg font-bold">Error Loading Students</h3>
            <p>Please ensure you have set up your organization.</p>
            <div className="mt-4 flex justify-center gap-3">
                <Button variant="outline" onClick={reset}>Try Again</Button>
                <Link href="/">
                    <Button variant="outline">Go Home</Button>
                </Link>
            </div>
        </div>
    );
}
