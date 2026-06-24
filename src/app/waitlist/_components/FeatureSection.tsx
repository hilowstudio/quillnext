import Image from "next/image";
import type { Feature } from "../_content";
import { Faq } from "./Faq";

/** One pain-point feature block: eyebrow, headline, body, and its Q&A. Odd rows get a raised band. */
export function FeatureSection({
    feature,
    index,
    mark,
}: {
    feature: Feature;
    index: number;
    mark?: { src: string; alt: string };
}) {
    const raised = index % 2 === 1;
    return (
        <section className={raised ? "bg-qc-surface-raised/50" : undefined}>
            <div className="mx-auto max-w-3xl px-4 py-14 sm:py-20">
                <div className="flex items-center gap-3">
                    {mark ? (
                        <Image
                            src={mark.src}
                            alt={mark.alt}
                            width={48}
                            height={48}
                            className="h-12 w-12 shrink-0 rounded-qc-md object-contain"
                        />
                    ) : null}
                    <p className="font-body text-xs font-semibold uppercase tracking-[0.18em] text-qc-secondary">
                        {feature.eyebrow}
                    </p>
                </div>
                <h2 className="mt-3 font-display text-3xl text-qc-charcoal sm:text-4xl">
                    {feature.headline}
                </h2>
                <p className="mt-5 font-body text-base leading-relaxed text-qc-text-muted sm:text-lg">
                    {feature.body}
                </p>
                <Faq items={feature.faqs} />
            </div>
        </section>
    );
}
