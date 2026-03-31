# QSF Audit Rules

You are conducting a Quiet Standards Framework (QSF) audit — evaluating a software product against 104 criteria across 7 domains. Your goal is to produce a rigorous, evidence-based scorecard that two independent auditors would agree on.

## Setup

1. Read `qsf-criteria.json` (in this directory) — it contains all 104 criteria with audit instructions, pass conditions, and fail indicators.
2. Confirm with the user: the product URL, the audit mode, and (if source code audit) the repo location.
3. Determine what kind of product this is (SaaS app, marketing site, mobile app, browser extension, desktop app, etc.) — many criteria will be N/A for simpler products.

## Audit Modes

- **Public Surface Audit**: You only have access to the live product URL. Use web browsing, network inspection, and screenshot analysis.
- **Source Code Audit**: You have access to the product's codebase. Use file system tools in addition to live product inspection.
- **Full Audit**: Source access plus an attestation questionnaire for criteria that cannot be externally verified.

## Workflow

### Domain-by-Domain Evaluation

Work through each domain sequentially:

1. **Attention** (23 criteria) — notifications, engagement patterns, interface restraint
2. **Data Sovereignty** (18 criteria) — portability, collection minimalism, security/deletion
3. **Honesty** (16 criteria) — dark patterns, algorithmic transparency, business model
4. **Departure** (12 criteria) — session closure, offboarding, graceful degradation
5. **Respect** (14 criteria) — temporal, contextual, resource respect
6. **Durability** (12 criteria) — accessibility, interoperability, longevity
7. **Governance** (9 criteria) — privacy/legal, communication, ethical commitments

For each criterion:

1. Read the `auditInstructions` field for the specific evidence-gathering method
2. Execute the instructions using available tools (file search, web fetch, code reading)
3. Collect evidence (code snippets, file paths, text excerpts, observations)
4. Evaluate against `passCondition` and `failIndicators`
5. Record your finding with a confidence level

### Confidence Levels

For each criterion, assign one of:
- **High** — Evidence is clear and unambiguous.
- **Medium** — Evidence supports the conclusion but has ambiguity. Auditor should review.
- **Low** — Insufficient evidence or judgment call required. Flag for auditor override.

### Automation Levels

Respect the `automationLevel` field in each criterion:
- **full**: Evaluate and score independently. Present evidence to auditor.
- **assisted**: Evaluate and present evidence, but flag for auditor confirmation before finalizing.
- **manual**: Generate the attestation question. Do not score — mark as "Pending Attestation."

## Scoring Rules

### Must-Pass Criteria (27 total)
- Result is PASS or FAIL. No partial credit.
- A single FAIL means NO certification at any tier.

### Scored Criteria (77 total, 143 max points)
- Award full points if the pass condition is met.
- Award 0 if not met.
- No partial credit on individual criteria.
- Points by weight: 3 pts = significant investment / industry-leading, 2 pts = strong practice, 1 pt = good hygiene.

### N/A Handling
Some criteria have N/A conditions (e.g., "if no algorithmic curation exists, this is N/A"). When N/A:
- Scored criteria: award full points.
- Must-pass criteria: treated as PASS.

This is important for simpler products (marketing sites, static apps) where many features don't exist.

### Domain Minimums
QSF Certified and Exemplary tiers require ≥40% of available scored points in EVERY domain. A product cannot compensate for weak data practices with strong notification design.

### Tier Determination
1. Check must-pass gate: any FAIL → Not Certified
2. Sum scored points across all domains
3. Check domain minimums (for Certified/Exemplary)
4. Assign tier:
   - 114+ points + domain mins → **QSF Exemplary**
   - 86+ points + domain mins → **QSF Certified**
   - 57+ points → **QSF Verified**
   - <57 points → **Not Certified**

## Output

Use `qsf-scorecard-template.md` (in this directory) to produce the final report. Fill in every field. Do not skip criteria — mark unevaluable criteria as "Not Evaluated" with an explanation.

### Attestation Questionnaire
For criteria with `automationLevel: "manual"`, generate a targeted questionnaire grouped by domain. Include the criterion ID, text, specific questions, and a note that false attestation voids certification. Cross-reference all attestation answers against observable evidence and flag contradictions.

## Judgment Guidelines

### When to PASS
- Evidence clearly demonstrates compliance
- No fail indicators present
- The criterion's intent is met, not just its letter

### When to FAIL
- Any fail indicator present
- Pass condition not met
- Intent violated even if letter is technically met

### When to flag for auditor review
- Borderline cases where reasonable people could disagree
- Context-dependent criteria (e.g., "proportionate" resource usage)
- Any must-pass criterion where you are not HIGH confidence on a FAIL
- Novel patterns not covered by fail indicators

## Important Notes

- Be conservative on must-pass criteria. When in doubt, flag for review rather than auto-failing.
- Be precise in evidence collection. Code snippets, file paths, and specific URLs are better than descriptions.
- Do not editorialize in the scorecard. Present evidence and conclusion. Save recommendations for a separate section.
- The auditor has final authority on all scores.
- For large codebases, use parallel agents — one per domain or domain group — to speed up the audit.

## About

The Quiet Standards Framework v1.0 is published by Hi-Low Studio LLC.
Full specification: https://hilowstudio.dev/standards/spec
