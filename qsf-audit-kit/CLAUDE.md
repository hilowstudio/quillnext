# QSF Audit Kit

This directory contains the Quiet Standards Framework audit system. It enables Claude to conduct a structured, evidence-based audit of any software product against 104 criteria across 7 domains.

## How to Run an Audit

Tell Claude:

> Run a QSF audit on this codebase. Read the audit kit in `qsf-audit-kit/`.

Or for a public-surface audit of a live URL:

> Run a QSF audit on [URL]. Read the audit kit in `qsf-audit-kit/`.

Claude will:
1. Read `qsf-audit-rules.md` for the audit workflow
2. Read `qsf-criteria.json` for all 104 criteria with per-criterion audit instructions
3. Evaluate the product domain by domain
4. Produce a scorecard using `qsf-scorecard-template.md`

## Audit Modes

- **Public Surface Audit** — Claude has only the live URL. Uses web browsing, network inspection, screenshot analysis.
- **Source Code Audit** — Claude has access to the codebase. Reads source files in addition to live inspection.
- **Full Audit** — Source access plus an attestation questionnaire for criteria that cannot be externally verified.

## Files

| File | Purpose |
|---|---|
| `qsf-audit-rules.md` | Audit workflow, scoring rules, judgment guidelines |
| `qsf-criteria.json` | All 104 criteria with audit instructions, pass conditions, and fail indicators |
| `qsf-scorecard-template.md` | Output template for the final audit report |

## About QSF

The Quiet Standards Framework is the first open, auditable, product-level certification standard for attention-respecting software. Published by Hi-Low Studio LLC.

- 104 criteria across 7 domains (Attention, Data Sovereignty, Honesty, Departure, Respect, Durability, Governance)
- 27 must-pass gates — fail any one and certification is denied
- 77 scored criteria totaling 143 points
- 3 tiers: QSF Verified (40%), QSF Certified (60%), QSF Exemplary (80%)

Full specification: https://hilowstudio.dev/standards/spec
