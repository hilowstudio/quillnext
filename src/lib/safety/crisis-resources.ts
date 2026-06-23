import type { SafetyAssessment } from "./types";

type Category = SafetyAssessment["category"];

export interface CrisisResource {
    name: string;
    /** Child-readable instruction for how to reach it. */
    contact: string;
    /** Optional online chat / info link. */
    url?: string;
    /** Short, calm note about when/how it helps. */
    note?: string;
}

/**
 * The single source of truth for child-facing crisis resources (Q-12-007). Verified against official
 * sources 2026-06-23 (owner-approved): US-primary, the Military Crisis Line for deployed/OCONUS military
 * families, emergency services, and an international directory fallback. **Re-verify periodically** —
 * numbers change (the shape-lock test guards the core contacts). Pure data: safe to import on both the
 * server (chat route pre-check) and the client (the affordance UI).
 */
export const CRISIS_RESOURCES: readonly CrisisResource[] = [
    {
        name: "988 Suicide & Crisis Lifeline",
        contact: "Call or text 988",
        url: "https://chat.988lifeline.org/",
        note: "Free, private, and open all day, every day (US).",
    },
    {
        name: "Childhelp National Child Abuse Hotline",
        contact: "Call or text 1-800-422-4453 (text the word GO)",
        url: "https://www.childhelphotline.org/",
        note: "If someone is hurting you. Free and open all day, every day.",
    },
    {
        name: "Crisis Text Line",
        contact: "Text HOME to 741741 (text HOLA for Spanish)",
        url: "https://www.crisistextline.org/",
        note: "Free texting support, all day, every day.",
    },
    {
        name: "Military Crisis Line",
        contact: "Dial 988 then Press 1, or text 838255 (on base: DSN 988)",
        url: "https://www.veteranscrisisline.net/get-help/military-crisis-line/",
        note: "For military families, including overseas.",
    },
    {
        name: "Military OneSource",
        contact: "Call 800-342-9647",
        url: "https://www.militaryonesource.mil/",
        note: "Support for military families, worldwide.",
    },
    {
        name: "Emergency services",
        contact: "Call 911",
        note: "If you or someone else is in immediate danger (US) — or your local emergency number.",
    },
    {
        name: "Find A Helpline",
        contact: "Visit findahelpline.com",
        url: "https://findahelpline.com/",
        note: "Find a free, confidential helpline in your country.",
    },
];

// Category → the resource names to lead with (most relevant first). The remaining resources follow in
// list order, so the full set is always offered (fail-safe: over-provide help) — only the ordering changes.
const PRIORITY_BY_CATEGORY: Partial<Record<Category, string[]>> = {
    SELF_HARM: ["988 Suicide & Crisis Lifeline", "Crisis Text Line"],
    VIOLENCE: ["988 Suicide & Crisis Lifeline", "Emergency services"],
    BULLYING: ["Childhelp National Child Abuse Hotline", "988 Suicide & Crisis Lifeline"],
    INCEST: ["Childhelp National Child Abuse Hotline", "988 Suicide & Crisis Lifeline"],
    GROOMING: ["Childhelp National Child Abuse Hotline", "988 Suicide & Crisis Lifeline"],
    SEXUAL_CONTENT: ["Childhelp National Child Abuse Hotline"],
};

/**
 * Returns the crisis resources ordered for the given category (most relevant first), or the full list
 * in canonical order when no category is given (the persistent "Need help now?" affordance). Always
 * returns every resource — the category only re-orders, it never filters help away.
 */
export function getCrisisResources(category?: Category): CrisisResource[] {
    const priority = (category && PRIORITY_BY_CATEGORY[category]) || [];
    const lead = priority
        .map((n) => CRISIS_RESOURCES.find((r) => r.name === n))
        .filter((r): r is CrisisResource => Boolean(r));
    const rest = CRISIS_RESOURCES.filter((r) => !priority.includes(r.name));
    return [...lead, ...rest];
}
