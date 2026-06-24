/** A quiet band of the core promises, reinforcing the calm-tech posture between content and CTA. */
const PROMISES = ["No ads", "No tracking", "Your data is yours", "Bootstrapped by one person"];

export function ValueStrip() {
    return (
        <section className="border-y border-qc-border-subtle bg-qc-surface/60">
            <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-center gap-x-8 gap-y-2 px-4 py-6 text-center">
                {PROMISES.map((p) => (
                    <span key={p} className="font-body text-sm font-medium text-qc-text-secondary">
                        {p}
                    </span>
                ))}
            </div>
        </section>
    );
}
