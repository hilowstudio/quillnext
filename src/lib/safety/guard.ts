import { generateObject } from "ai";
import { models } from "@/lib/ai/config";
import { z } from "zod";
import { SafetyAssessment } from "./types";

const safetySchema = z.object({
    isSafe: z.boolean(),
    severity: z.enum(["CONCERN", "DANGER", "SAFE", "TIER_1", "TIER_2", "TIER_3"]),
    category: z.enum(["BULLYING", "SELF_HARM", "GROOMING", "VIOLENCE", "SEXUAL_CONTENT", "INCEST", "BYPASS_ATTEMPT", "OTHER", "NONE"]),
    implicatedCaregiver: z.boolean().describe("Whether a parent, guardian, or teacher is the source of the threat."),
    reasoning: z.string(),
    evidenceLevel: z.enum(["THOUGHT", "INTENT", "PLAN", "ACTION", "VICTIM_DISCLOSURE"]),
    target: z.enum(["SELF", "OTHER_CHILD", "ADULT", "UNKNOWN"]),
    relationshipToTarget: z.enum(["SIBLING", "STEP_SIBLING", "PEER", "ADULT_AUTHORITY", "ONLINE_STRANGER", "OTHER"]),
    coercion: z.enum(["NONE", "POSSIBLE", "LIKELY", "CONFESSED"]),
    ageGap: z.enum(["UNKNOWN", "SIMILAR", "OLDER_OTHER", "OLDER_SELF"]),
    disclosureRisk: z.enum(["LOW", "MEDIUM", "HIGH"]).describe("HIGH if notifying parents increases risk (fear of retaliation/shame)."),
});

type SafetyCategory = z.infer<typeof safetySchema>['category'];
type SafetySeverity = z.infer<typeof safetySchema>['severity'];

interface SafetyPattern {
    regex: RegExp[];
    category: SafetyCategory;
    severity: SafetySeverity;
    tier: number;
    label: string;
    // Optional overrides for fast-path
    evidenceLevel?: "THOUGHT" | "INTENT" | "PLAN" | "ACTION" | "VICTIM_DISCLOSURE";
    // When true, the academic-context whitelist may NOT suppress this pattern. Reserved for
    // explicit first-person self-harm phrases and concrete abuse/incest ACTION disclosures —
    // no classroom/homework context makes those benign (Q-12-004).
    exemptFromWhitelist?: boolean;
}

// Redundancy: Sophisticated Regex Engine. Exported for unit testing of the regex fast-path.
export class SafetyRegexEngine {

    private static whitelist = [
        /\b(health class|biology|education|safety lesson|history|literature|novel|book|article)\b/i,
        /\b(we studied|class|assignment|homework|project)\b/i,
        /\b(reproduction|anatomy|cell|body parts)\b/i
    ];

    // Caregiver implication + Fear detection
    private static caregiverRegex = /\b(my|step)?(mom|dad|father|mother|parent|teacher|uncle|aunt|grandpa|grandma).{0,40}(hurt|hit|beat|touch|kill|force|make me|threat|scare)\b/i;
    private static fearRegex = /\b(don'?t tell).{0,30}\b(mom|dad|parents|will hurt|kick me out|beat me|kill me)\b/i;

    private static patterns: SafetyPattern[] = [
        // 1. SELF_HARM — explicit first-person intent. Exempt from the academic whitelist: no
        //    classroom/homework context makes "I want to kill myself" benign (Q-12-004).
        {
            label: "Self-Harm Intent (Tier 1)",
            regex: [/\b(kill myself|end my life|want to die)\b/i],
            category: "SELF_HARM", severity: "TIER_1", tier: 1, evidenceLevel: "INTENT",
            exemptFromWhitelist: true
        },
        // SELF_HARM — bare reference "suicide". Stays whitelist-gated: it legitimately appears in
        //    academic / awareness text ("an article about suicide rates"), unlike "kill myself".
        {
            label: "Self-Harm Reference",
            regex: [/\bsuicide\b/i],
            category: "SELF_HARM", severity: "TIER_1", tier: 1, evidenceLevel: "INTENT"
        },
        // SELF_HARM — explicit first-person behaviour. Exempt from the whitelist.
        {
            label: "Self-Harm Behavior (Tier 2)",
            regex: [/\b(hurt myself|cut myself|cut my wrists)\b/i],
            category: "SELF_HARM", severity: "TIER_2", tier: 2, evidenceLevel: "ACTION",
            exemptFromWhitelist: true
        },
        // SELF_HARM — bare reference "self harm". Stays whitelist-gated (awareness/curriculum text).
        {
            label: "Self-Harm Behavior Reference",
            regex: [/\b(self harm|self-harm)\b/i],
            category: "SELF_HARM", severity: "TIER_2", tier: 2, evidenceLevel: "ACTION"
        },
        // 2. BULLYING & ABUSE — stays whitelist-gated ("the ball hit me in gym class" is benign).
        {
            label: "Physical Abuse",
            regex: [/\b(hit me|punched me|beating me up|kicked me)\b/i],
            category: "BULLYING", severity: "TIER_1", tier: 1, evidenceLevel: "VICTIM_DISCLOSURE"
        },
        // 3. INCEST / SIBLING (Distinguish Thought vs Action)
        // Thought-only stays whitelist-gated (may be academic/curiosity discussion).
        {
            label: "Incest/Sibling Thought",
            regex: [/\b(mom|dad|stepmom|stepdad|stepsister|stepbrother|brother|sister).{0,40}\b(crush|attracted|like|love|thinking about)\b/i],
            category: "INCEST", severity: "TIER_1", tier: 1, evidenceLevel: "THOUGHT"
        },
        // Explicit abuse/incest ACTION disclosure. Exempt from the whitelist: "my brother touched
        //    me in class" must flag — an academic word must not cloak a concrete disclosure
        //    (Q-12-004, INCEST scope).
        {
            label: "Incest/Sibling Action",
            regex: [/\b(mom|dad|stepmom|stepdad|stepsister|stepbrother|brother|sister).{0,40}\b(spied|peeked|watched|touched|asked to touch|tried to)\b/i],
            category: "INCEST", severity: "TIER_1", tier: 1, evidenceLevel: "ACTION",
            exemptFromWhitelist: true
        },
        // 4. VIOLENCE — stays whitelist-gated (historical/news/fiction discussion is common).
        {
            label: "Threat",
            regex: [/\b(shoot|stab|kill).{0,40}\b(them|him|her|people|school)\b/i],
            category: "VIOLENCE", severity: "TIER_1", tier: 1, evidenceLevel: "INTENT"
        }
    ];

    static isWhitelisted(text: string): boolean {
        return this.whitelist.some(re => re.test(text));
    }

    static scan(text: string): SafetyAssessment | null {
        // Negation Check (de-escalation): a genuine retraction ("I don't want to kill myself")
        // must not flag. Kept whole-message and applied to ALL patterns; narrowing its scope
        // (e.g. "I don't want to kill anyone but myself") is a tracked follow-up (Q-12-004).
        if (/\b(not|never|don'?t want to).{0,10}\b(kill|hurt|suicide)\b/i.test(text)) {
            return null;
        }

        // Academic-context whitelist. It suppresses AMBIGUOUS patterns (anatomy/history/fiction
        // discussion) but must NOT null an explicit first-person self-harm phrase or a concrete
        // abuse/incest ACTION disclosure — those patterns carry `exemptFromWhitelist`, so
        // "for my project, I want to kill myself" still flags (Q-12-004). Computed once here and
        // applied per-pattern in the loop below (was a blanket early-return that disabled the
        // entire fast path on any benign academic word).
        const whitelisted = this.isWhitelisted(text);

        // Caregiver Implication Check
        const caregiverImplicated = this.caregiverRegex.test(text);

        // Disclosure Risk Check (Fear of reaction)
        const fearDetected = this.fearRegex.test(text);
        const disclosureRisk = (caregiverImplicated || fearDetected) ? "HIGH" : "LOW";

        for (const pattern of this.patterns) {
            if (whitelisted && !pattern.exemptFromWhitelist) {
                continue;
            }
            for (const re of pattern.regex) {
                if (re.test(text)) {
                    // If we match a pattern, return immediately
                    return {
                        isSafe: false,
                        severity: pattern.severity,
                        category: pattern.category,
                        implicatedCaregiver: caregiverImplicated,
                        reasoning: `[Regex Guard] Matched ${pattern.label}. Caregiver implicated: ${caregiverImplicated}, Fear: ${fearDetected}`,
                        evidenceLevel: pattern.evidenceLevel || "INTENT",
                        target: "SELF", // Default assumption for regex fast-path, refined by pattern if needed
                        relationshipToTarget: "OTHER",
                        coercion: "NONE",
                        ageGap: "UNKNOWN",
                        disclosureRisk: disclosureRisk
                    };
                }
            }
        }
        return null;
    }
}

export async function assessMessageSafety(message: string): Promise<SafetyAssessment> {
    // 1. Fast Path
    const keywordResult = SafetyRegexEngine.scan(message);
    if (keywordResult) {
        return keywordResult;
    }

    // 2. Deep Path
    try {
        const { object } = await generateObject({
            model: models.flashLite,
            schema: safetySchema,
            prompt: `
             You are a sensitive child safety monitoring system.
             Analyze risk in the message based STRICTLY on the text.
             
             GOALS:
             1. Detect harm (Self-harm, bullying, violence, grooming, sexual content).
             2. Assess EVIDENCE LEVEL: Is it just a THOUGHT, an INTENT, a PLAN, or an ACTION?
             3. Assess DISCLOSURE RISK: Does the child express fear of parents knowing? (e.g. "don't tell my mom", "they will kill me").
             4. Assess TARGET: SELF, OTHER_CHILD, ADULT?
             
             CONTEXT:
             - "I have a crush on my stepsister" -> INCEST, THOUGHT, SIBLING/STEP_SIBLING.
             - "I touched my stepsister" -> INCEST, ACTION, SIBLING/STEP_SIBLING.
             - "My dad hits me" -> BULLYING/VIOLENCE, VICTIM_DISCLOSURE, IMPLICATED_CAREGIVER = TRUE.
             
             Student Message: "${message}"
             `,
        });
        return object;
    } catch (error) {
        // FAIL CLOSED (Q-12-001). A model outage, rate-limit, timeout, or schema-parse failure must
        // NOT silently pass an unscanned message as safe — for a child-safety scanner, fail-OPEN is
        // the dangerous direction (the regex fast-path covers only a few phrasings, so most messages
        // depend on this LLM call). Return an UNSAFE assessment so the job stores a durable,
        // DB-queryable "needs human review" flag (safety-scan.ts:80,84-100) instead of nothing.
        //
        // Route it to a NON-notifying resolution, never a caregiver email: category "OTHER" +
        // severity "TIER_3" map to INTERNAL_LOG_ONLY (policy.ts:75), which sits below BOTH the job's
        // PARENT_SUMMARY_* email gate (safety-scan.ts:103) and the delivery-layer hard-stop
        // (isAlertDeliverable, safety-alert.ts), and is excluded from pattern-escalation
        // (safety-scan.ts:34). We MUST NOT auto-notify a caregiver on an UNCLASSIFIED message:
        // implicatedCaregiver / disclosureRisk are genuinely UNKNOWN on a scan error, so we leave them
        // at their non-escalating defaults (false / "LOW") rather than fabricating a hard-stop.
        // category MUST stay "OTHER" — SELF_HARM/VIOLENCE with INTENT/SELF would reach the urgent
        // caregiver-email branch (policy.ts:50-54). (Letting transient errors throw so Inngest retries
        // before falling closed is a roadmap refinement — see ch.12 §7 / ch.24 §5.)
        console.error("Safety Guard Error:", error);
        return {
            isSafe: false,
            severity: "TIER_3",
            category: "OTHER",
            implicatedCaregiver: false,
            reasoning: "Scanner error - needs human review",
            evidenceLevel: "THOUGHT",
            target: "UNKNOWN",
            relationshipToTarget: "OTHER",
            coercion: "NONE",
            ageGap: "UNKNOWN",
            disclosureRisk: "LOW"
        };
    }
}
