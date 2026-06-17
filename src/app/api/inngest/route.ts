import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import { processDocument } from "@/inngest/functions/process-document";
import { scanMessage } from "@/inngest/functions/safety-scan";
import { compileCurriculum } from "@/inngest/functions/compile-curriculum";
import { extractBook } from "@/inngest/functions/extract-book";
import { extractVideo } from "@/inngest/functions/extract-video";
import {
    ingestTextbookCorpus,
    ingestTextbook,
    refreshTextbookCrosswalk,
    recrosswalkTextbook,
} from "@/inngest/functions/ingest-textbooks";

// Each Inngest STEP runs as a fresh invocation of THIS Vercel function, so it is bounded by the
// function's maxDuration (NOT by Inngest's orchestration). On the Vercel HOBBY plan the hard
// ceiling is 60s (the platform clamps anything higher), so every step in every worker is designed
// to do at most ONE bounded unit of work — one AI call, or one embedding batch — and longer/bulk
// work is fanned out across many memoized steps so no single step approaches this ceiling. Raise
// to 300 only after upgrading to Vercel Pro.
export const maxDuration = 60;

export const { GET, POST, PUT } = serve({
    client: inngest,
    functions: [
        processDocument,
        scanMessage,
        compileCurriculum,
        extractBook,
        extractVideo,
        ingestTextbookCorpus,
        ingestTextbook,
        refreshTextbookCrosswalk,
        recrosswalkTextbook,
    ],
});
