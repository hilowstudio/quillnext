import { grounding } from "../_content";

/** The "how it works together" triad: spine + library + child, handed to the AI together. */
export function GroundingStack() {
    return (
        <section className="mx-auto max-w-4xl px-4 py-16 text-center sm:py-20">
            <h2 className="font-display text-3xl text-qc-charcoal sm:text-4xl">{grounding.heading}</h2>
            <p className="mx-auto mt-5 max-w-2xl font-body text-base leading-relaxed text-qc-text-muted sm:text-lg">
                {grounding.intro}
            </p>
            <div className="mt-12 grid gap-6 sm:grid-cols-3">
                {grounding.pillars.map((p) => (
                    <div
                        key={p.title}
                        className="rounded-qc-lg border border-qc-border-subtle bg-qc-surface p-6 text-left shadow-qc-soft"
                    >
                        <h3 className="font-display text-xl text-qc-primary">{p.title}</h3>
                        <p className="mt-2 font-body text-sm leading-relaxed text-qc-text-muted">{p.body}</p>
                    </div>
                ))}
            </div>
            <p className="mx-auto mt-10 max-w-2xl font-body text-base leading-relaxed text-qc-charcoal">
                {grounding.close}
            </p>
        </section>
    );
}
