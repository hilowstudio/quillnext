import Link from "next/link";
import { footer } from "../_content";

/** Public footer: legal links, a real contact address, and the doxological sign-off. */
export function SiteFooter() {
    return (
        <footer className="border-t border-qc-border-subtle">
            <div className="mx-auto flex max-w-4xl flex-col items-center gap-4 px-4 py-10 text-center">
                <nav className="flex flex-wrap items-center justify-center gap-6">
                    {footer.links.map((l) => (
                        <Link
                            key={l.href}
                            href={l.href}
                            className="font-body text-sm text-qc-primary hover:underline"
                        >
                            {l.label}
                        </Link>
                    ))}
                    <a
                        href={`mailto:${footer.email}`}
                        className="font-body text-sm text-qc-primary hover:underline"
                    >
                        {footer.email}
                    </a>
                </nav>
                <p className="font-body text-xs text-qc-text-muted">{footer.line}</p>
            </div>
        </footer>
    );
}
