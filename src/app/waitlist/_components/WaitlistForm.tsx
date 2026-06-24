"use client";

import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { joinWaitlist } from "../actions";

/**
 * Public waitlist form (client island). Posts to the `joinWaitlist` server action, which delivers to
 * the owner's inbox via Resend. `idPrefix` keeps input ids unique so the form can render twice on the
 * page (hero + final CTA) without colliding. Includes an off-screen honeypot field for bots.
 */
export function WaitlistForm({
    idPrefix,
    buttonLabel = "Join the waitlist",
}: {
    idPrefix: string;
    buttonLabel?: string;
}) {
    const [email, setEmail] = useState("");
    const [firstName, setFirstName] = useState("");
    const [company, setCompany] = useState(""); // honeypot
    const [status, setStatus] = useState<"idle" | "submitting" | "done">("idle");

    async function handleSubmit(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        if (status === "submitting") return;
        setStatus("submitting");
        try {
            const result = await joinWaitlist({ email, firstName, company });
            if (result.ok) {
                setStatus("done");
                toast.success("You're on the list. Thank you.");
            } else {
                setStatus("idle");
                toast.error(result.error);
            }
        } catch {
            setStatus("idle");
            toast.error(
                "Something went wrong. Please email adam@quillandcompass.app and I'll add you by hand.",
            );
        }
    }

    if (status === "done") {
        return (
            <div
                role="status"
                className="rounded-qc-lg border border-qc-success-border bg-qc-success-bg p-4 text-center font-body text-sm text-qc-success-text"
            >
                You&apos;re on the list. I&apos;ll write once, when the school year opens.
            </div>
        );
    }

    const emailId = `${idPrefix}-email`;
    const nameId = `${idPrefix}-firstName`;
    const honeypotId = `${idPrefix}-company`;

    return (
        <form onSubmit={handleSubmit} className="space-y-3 text-left">
            <div className="flex flex-col gap-3 sm:flex-row">
                <div className="sm:flex-1">
                    <label htmlFor={nameId} className="sr-only">
                        First name (optional)
                    </label>
                    <Input
                        id={nameId}
                        name="firstName"
                        autoComplete="given-name"
                        placeholder="First name (optional)"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                    />
                </div>
                <div className="sm:flex-[1.4]">
                    <label htmlFor={emailId} className="sr-only">
                        Email address
                    </label>
                    <Input
                        id={emailId}
                        name="email"
                        type="email"
                        required
                        autoComplete="email"
                        placeholder="you@email.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                    />
                </div>
            </div>

            {/* Honeypot: off-screen and hidden from assistive tech; only bots fill it. */}
            <div
                aria-hidden="true"
                className="pointer-events-none absolute -left-[9999px] top-0 h-0 w-0 overflow-hidden"
            >
                <label htmlFor={honeypotId}>Company</label>
                <input
                    id={honeypotId}
                    name="company"
                    type="text"
                    tabIndex={-1}
                    autoComplete="off"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                />
            </div>

            <Button type="submit" size="lg" className="w-full" disabled={status === "submitting"}>
                {status === "submitting" ? "Adding you..." : buttonLabel}
            </Button>
        </form>
    );
}
