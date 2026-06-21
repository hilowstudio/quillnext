"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";

/**
 * Renders generated-resource markdown: GFM + soft line breaks (remark-gfm +
 * remark-breaks), the same plugin set as HeartCheck / BibleStudy.
 * Intentionally NO math (KaTeX) and NO raw HTML: the generation pipeline emits
 * math as `\(...\)`/`\[...\]` or strips it (never bare `$...$`, the only form
 * remark-math parses by default), single-`$` would mangle currency in word
 * problems, and rehype-raw is an XSS risk on AI-generated content. ThinklingChat
 * enables remark-math/rehype-katex for its live chat view; this persisted-resource
 * view deliberately does not.
 */
export function MarkdownContent({ content }: { content: string }) {
    return (
        <div className="prose prose-sm max-w-none prose-headings:font-display prose-headings:text-qc-charcoal">
            <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>{content}</ReactMarkdown>
        </div>
    );
}
