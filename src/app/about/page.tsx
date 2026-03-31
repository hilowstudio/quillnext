import { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "About — Quill & Compass",
};

export default function AboutPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-qc-parchment p-4">
      <div className="w-full max-w-3xl space-y-8 py-12">
        <header className="text-center space-y-2">
          <h1 className="font-display text-4xl text-qc-charcoal">
            About Quill &amp; Compass
          </h1>
          <p className="font-body text-sm text-qc-text-muted">
            Calm tools for intentional education
          </p>
        </header>

        <article className="qc-prose font-body text-qc-charcoal space-y-8 text-sm leading-relaxed">

          {/* ── Mission ── */}
          <section className="space-y-3">
            <h2 className="font-display text-2xl">What We Build</h2>
            <p>
              QuillNext is a curriculum management and family discipleship
              platform for homeschool families. It uses AI to generate
              personalized educational content — lessons, quizzes, worksheets,
              and more — aligned with your family&apos;s values, your
              student&apos;s learning style, and your educational philosophy.
            </p>
            <p>
              We believe educational software should serve the family, not
              extract attention from it. QuillNext is designed to help you plan,
              generate, and manage curriculum so you can spend more time
              teaching and less time preparing.
            </p>
          </section>

          {/* ── Funding & Monetization (HON-13, HON-14, GOV-08) ── */}
          <section className="space-y-3">
            <h2 className="font-display text-2xl">
              How QuillNext Is Funded
            </h2>
            <p>
              QuillNext is <strong>bootstrapped and self-funded</strong> by its
              creator. There are no venture capital investors, no advertising
              partners, and no data monetization arrangements. No one with
              interests in advertising, data brokerage, or attention-extraction
              industries has any financial stake in this product.
            </p>
            <p>
              The product is currently free while in active development. Our
              planned monetization model is a straightforward paid subscription
              — you pay for the software, and the software works for you. We
              will never run ads, sell your data, or introduce engagement
              tricks to boost metrics.
            </p>
          </section>

          {/* ── Design Principles (GOV-09) ── */}
          <section className="space-y-3">
            <h2 className="font-display text-2xl">Our Design Principles</h2>
            <p>
              These principles guide every decision we make. They predate any
              certification process and reflect the product&apos;s foundational
              philosophy:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong>Calm Technology:</strong> The interface must not scream
                for attention. We avoid &ldquo;doom-loop&rdquo; patterns,
                infinite scroll, gamification, streak mechanics, and any design
                that manufactures urgency or anxiety.
              </li>
              <li>
                <strong>Attention Respect:</strong> No push notifications. No
                re-engagement emails. No badges or points. We design for the
                smallest possible footprint on your attention.
              </li>
              <li>
                <strong>Data Sovereignty:</strong> Your data belongs to you. We
                collect nothing beyond what features require. We never sell or
                share data with advertisers. You can export everything and
                delete your account at any time.
              </li>
              <li>
                <strong>AI Transparency:</strong> All AI-generated content is
                clearly labeled. AI is a tool for the parent, not a
                replacement. Every generated resource is marked as a draft for
                parental review.
              </li>
              <li>
                <strong>Child Safety First:</strong> Student interactions are
                monitored for safety concerns with privacy-preserving
                techniques. Safety alerts minimize data exposure while
                protecting children.
              </li>
              <li>
                <strong>Analog Warmth:</strong> The interface evokes the
                feeling of paper, ink, and wood — not the cold efficiency of
                enterprise software. Utility follows aesthetics that feel
                durable and human.
              </li>
              <li>
                <strong>Accessibility:</strong> All text meets WCAG AA
                contrast standards. All interactive elements have visible focus
                states. Touch targets meet the 44px minimum. Reduced motion
                preferences are respected globally.
              </li>
            </ul>
          </section>

          {/* ── Contact & Feedback (GOV-05) ── */}
          <section className="space-y-3">
            <h2 className="font-display text-2xl">Contact &amp; Feedback</h2>
            <p>
              We welcome bug reports, feature requests, and general feedback.
              No social media account required.
            </p>
            <p>
              Email:{" "}
              <a
                href="mailto:adam@quillandcompass.app"
                className="underline text-qc-primary hover:text-qc-primary/80"
              >
                adam@quillandcompass.app
              </a>
            </p>
          </section>

          {/* ── Support Policy (DUR-11) ── */}
          <section className="space-y-3">
            <h2 className="font-display text-2xl">Support Policy</h2>
            <p>
              We aim to respond to all support requests within 48 hours. Bug
              reports that affect data integrity or child safety are treated as
              urgent and addressed within 24 hours.
            </p>
            <p>
              The current version of QuillNext receives continuous security
              updates and bug fixes. If a version is deprecated, we will
              provide at least 90 days notice and ensure data export remains
              available.
            </p>
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
