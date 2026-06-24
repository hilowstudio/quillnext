import type { Metadata } from "next";
import { Hero } from "./_components/Hero";
import { GroundingStack } from "./_components/GroundingStack";
import { FeatureSection } from "./_components/FeatureSection";
import { ValueStrip } from "./_components/ValueStrip";
import { SiteFooter } from "./_components/SiteFooter";
import { WaitlistForm } from "./_components/WaitlistForm";
import { features, founderNote, honesty, finalCta } from "./_content";

export const metadata: Metadata = {
    title: "Quill & Compass — calm, grounded homeschooling",
    description:
        "AI that plans the week, drafts the lessons, grounds them in real books and a real K-12 spine, and keeps the records. Discipleship built in. Join the waitlist for the 2026-27 school year.",
    openGraph: {
        title: "Quill & Compass — calm, grounded homeschooling",
        description:
            "Homeschool that runs on rest. AI curriculum grounded in a real spine and your own library, discipleship built in, your data left alone.",
        images: ["/assets/branding/Quill-and-Compass.png"],
        type: "website",
    },
};

export default function WaitlistPage() {
    return (
        <>
            <Hero />

            {/* Founder note (Reformed voice) */}
            <section className="bg-qc-surface-raised/50">
                <div className="mx-auto max-w-2xl px-4 py-16 sm:py-20">
                    <p className="font-body text-xs font-semibold uppercase tracking-[0.18em] text-qc-secondary">
                        {founderNote.heading}
                    </p>
                    <div className="mt-5 space-y-5 font-body text-base leading-relaxed text-qc-charcoal">
                        {founderNote.paragraphs.map((p) => (
                            <p key={p.slice(0, 24)}>{p}</p>
                        ))}
                    </div>
                    <p className="mt-6 font-display text-lg text-qc-primary">{founderNote.signoff}</p>
                </div>
            </section>

            <GroundingStack />

            {features.map((f, i) => (
                <FeatureSection
                    key={f.id}
                    feature={f}
                    index={i}
                    mark={
                        f.id === "generation"
                            ? {
                                  src: "/assets/branding/Inkling.png",
                                  alt: "Inkling, the Quill & Compass writing assistant",
                              }
                            : undefined
                    }
                />
            ))}

            <ValueStrip />

            {/* Where we are, honestly */}
            <section className="mx-auto max-w-2xl px-4 py-16 text-center sm:py-20">
                <h2 className="font-display text-3xl text-qc-charcoal sm:text-4xl">{honesty.heading}</h2>
                <p className="mt-5 font-body text-base leading-relaxed text-qc-text-muted sm:text-lg">
                    {honesty.body}
                </p>
            </section>

            {/* Final CTA */}
            <section className="bg-qc-primary/[0.04]">
                <div className="mx-auto max-w-xl px-4 py-16 text-center sm:py-20">
                    <h2 className="font-display text-3xl text-qc-charcoal sm:text-4xl">{finalCta.heading}</h2>
                    <p className="mt-4 font-body text-base leading-relaxed text-qc-text-muted">
                        {finalCta.body}
                    </p>
                    <div className="mt-8">
                        <WaitlistForm idPrefix="cta" />
                    </div>
                </div>
            </section>

            <SiteFooter />
        </>
    );
}
