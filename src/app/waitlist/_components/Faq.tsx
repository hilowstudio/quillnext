import type { Faq as FaqItem } from "../_content";

/** Q&A list as native <details> — keyboard-accessible, no JavaScript, calm by default. */
export function Faq({ items }: { items: FaqItem[] }) {
    return (
        <div className="mt-8 border-t border-qc-border-subtle">
            {items.map((item) => (
                <details key={item.q} className="group border-b border-qc-border-subtle py-4">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-body text-base font-medium text-qc-charcoal [&::-webkit-details-marker]:hidden">
                        <span>{item.q}</span>
                        <span
                            aria-hidden="true"
                            className="shrink-0 text-xl leading-none text-qc-primary transition-transform duration-200 group-open:rotate-45"
                        >
                            +
                        </span>
                    </summary>
                    <p className="mt-3 font-body text-sm leading-relaxed text-qc-text-muted">{item.a}</p>
                </details>
            ))}
        </div>
    );
}
