import { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Changelog — Quill & Compass",
};

export default function ChangelogPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-qc-parchment p-4">
      <div className="w-full max-w-3xl space-y-8 py-12">
        <header className="text-center space-y-2">
          <h1 className="font-display text-4xl text-qc-charcoal">Changelog</h1>
          <p className="font-body text-sm text-qc-text-muted">
            What&apos;s new, changed, and fixed in QuillNext
          </p>
        </header>

        <article className="qc-prose font-body text-qc-charcoal space-y-8 text-sm leading-relaxed">
          <section className="space-y-3">
            <h2 className="font-display text-2xl">March 2026</h2>
            <h3 className="font-display text-lg">QSF Compliance &amp; Data Rights</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Added:</strong> Full data export in JSON format (Account Settings &rarr; Data &amp; Privacy)</li>
              <li><strong>Added:</strong> Account deletion and deactivation options</li>
              <li><strong>Added:</strong> Privacy Policy and Terms of Service pages</li>
              <li><strong>Added:</strong> AI-Generated content labels across all generated resources</li>
              <li><strong>Added:</strong> Session duration awareness indicator</li>
              <li><strong>Added:</strong> Auto-save for prayer journal and content editors</li>
              <li><strong>Added:</strong> Organization ownership transfer</li>
              <li><strong>Added:</strong> Accessibility improvements (aria-live regions for dynamic content)</li>
              <li><strong>Added:</strong> About page with design principles and funding transparency</li>
              <li><strong>Added:</strong> This changelog</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-2xl">February 2026</h2>
            <h3 className="font-display text-lg">Curriculum Compiler</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Added:</strong> Complete Curriculum Compiler</li>
              <li><strong>Improved:</strong> Icon dependencies optimized for smaller bundle size</li>
              <li><strong>Improved:</strong> Heart-check UI refined with Boxicons, emoji replaced</li>
              <li><strong>Fixed:</strong> Prisma build with pg driver adapter, enforced Node runtime</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-2xl">January 2026</h2>
            <h3 className="font-display text-lg">Production Launch</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Added:</strong> Production deployment configuration</li>
              <li><strong>Added:</strong> Stripe integration preparation</li>
              <li><strong>Added:</strong> Full curriculum generation pipeline</li>
              <li><strong>Added:</strong> Family discipleship suite (prayer journal, Bible study, Bible memory, catechism, devotionals, missions, church notes, heart check)</li>
              <li><strong>Added:</strong> Living Library with book scanning, video resources, and semantic search</li>
              <li><strong>Added:</strong> Student assessment and grading system</li>
              <li><strong>Added:</strong> Official transcript builder and PDF export</li>
              <li><strong>Added:</strong> Thinkling Chat with AI safety monitoring</li>
            </ul>
          </section>
        </article>

        <footer className="text-center pt-8 border-t border-qc-border-subtle">
          <Link
            href="/"
            className="font-body text-sm text-qc-primary hover:underline"
          >
            &larr; Back to QuillNext
          </Link>
        </footer>
      </div>
    </div>
  );
}
