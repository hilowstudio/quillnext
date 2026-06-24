import Image from "next/image";
import { hero } from "../_content";
import { WaitlistForm } from "./WaitlistForm";

/** Top of the page: the logo lockup, the value-prop headline, and the first waitlist form. */
export function Hero() {
    return (
        <section className="mx-auto flex max-w-3xl flex-col items-center px-4 pb-12 pt-16 text-center sm:pt-24">
            <Image
                src="/assets/branding/Quill-and-Compass.png"
                alt="Quill & Compass"
                width={460}
                height={230}
                priority
                className="h-auto w-full max-w-[340px] sm:max-w-[440px]"
            />
            <h1 className="mt-8 font-display text-4xl leading-[1.1] text-qc-charcoal sm:text-5xl md:text-6xl">
                {hero.headline}
            </h1>
            <p className="mt-6 max-w-2xl font-body text-base leading-relaxed text-qc-text-muted sm:text-lg">
                {hero.sub}
            </p>
            <div className="mt-8 w-full max-w-md">
                <WaitlistForm idPrefix="hero" />
                <p className="mt-3 font-body text-xs leading-relaxed text-qc-text-muted">{hero.microcopy}</p>
            </div>
        </section>
    );
}
