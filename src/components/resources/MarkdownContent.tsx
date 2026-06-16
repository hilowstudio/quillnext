"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";

/**
 * Renders generated-resource markdown content, matching how the app renders
 * markdown elsewhere (ThinklingChat / HeartCheck).
 */
export function MarkdownContent({ content }: { content: string }) {
    return (
        <div className="prose prose-sm max-w-none prose-headings:font-display prose-headings:text-qc-charcoal">
            <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>{content}</ReactMarkdown>
        </div>
    );
}
