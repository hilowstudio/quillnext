# QSF Audit Scorecard

## Audit Information

| Field | Value |
|---|---|
| **Product** | [Product Name] |
| **URL** | [Product URL] |
| **Audit Date** | [YYYY-MM-DD] |
| **Audit Mode** | [Public Surface / Source Code / Full] |
| **Auditor** | [Name / LLM-assisted] |
| **QSF Version** | 1.0 |

---

## Result Summary

| | Result |
|---|---|
| **Must-Pass Gate** | [PASS / FAIL — X of 27 passed] |
| **Total Scored Points** | [X of 143] |
| **Domain Minimums Met** | [Yes / No — list any failing domains] |
| **Certification Tier** | [Not Certified / QSF Verified / QSF Certified / QSF Exemplary] |

---

## Domain Summary

| Domain | Must-Pass | Scored | Available | % | Min Met? |
|---|---|---|---|---|---|
| 01 Attention | X/6 | X | 27 | X% | [Y/N] |
| 02 Data Sovereignty | X/5 | X | 27 | X% | [Y/N] |
| 03 Honesty | X/5 | X | 22 | X% | [Y/N] |
| 04 Departure | X/4 | X | 15 | X% | [Y/N] |
| 05 Respect | X/3 | X | 19 | X% | [Y/N] |
| 06 Durability | X/3 | X | 17 | X% | [Y/N] |
| 07 Governance | X/1 | X | 16 | X% | [Y/N] |
| **Total** | **X/27** | **X** | **143** | **X%** | |

---

## Detailed Findings

For each criterion, record:

```
**[ID]** [Must-Pass / X pts]
- **Result:** [PASS / FAIL / N/A]
- **Confidence:** [High / Medium / Low]
- **Evidence:** [Code snippets, file paths, URLs, observations]
- **Notes:** [Context, caveats, auditor flags]
```

### Domain 01: Attention

#### 1A. Notification Architecture
[ATT-01 through ATT-08]

#### 1B. Engagement Pattern Prohibition
[ATT-09 through ATT-15]

#### 1C. Interface Restraint
[ATT-16 through ATT-23]

---

### Domain 02: Data Sovereignty

#### 2A. Data Portability
[DAT-01 through DAT-06]

#### 2B. Data Collection Minimalism
[DAT-07 through DAT-12]

#### 2C. Data Security & Deletion
[DAT-13 through DAT-18]

---

### Domain 03: Honesty

#### 3A. Dark Pattern Prohibition
[HON-01 through HON-08]

#### 3B. Algorithmic Transparency
[HON-09 through HON-12]

#### 3C. Business Model Transparency
[HON-13 through HON-16]

---

### Domain 04: Departure

#### 4A. Session Closure
[DEP-01 through DEP-04]

#### 4B. Account Offboarding
[DEP-05 through DEP-08]

#### 4C. Graceful Degradation
[DEP-09 through DEP-12]

---

### Domain 05: Respect

#### 5A. Temporal Respect
[RES-01 through RES-05]

#### 5B. Contextual Intelligence
[RES-06 through RES-10]

#### 5C. Resource Respect
[RES-11 through RES-14]

---

### Domain 06: Durability

#### 6A. Accessibility
[DUR-01 through DUR-06]

#### 6B. Standards & Interoperability
[DUR-07 through DUR-09]

#### 6C. Longevity
[DUR-10 through DUR-12]

---

### Domain 07: Governance

#### 7A. Privacy & Legal Clarity
[GOV-01 through GOV-04]

#### 7B. User Communication
[GOV-05 through GOV-07]

#### 7C. Ethical Commitments
[GOV-08 through GOV-09]

---

## Attestation Questionnaire

*For criteria with automationLevel: "manual". To be completed by the product team.*

| # | Criterion | Question | Response |
|---|---|---|---|
| 1 | DAT-13 | Is sensitive user data encrypted at rest? What algorithm and key length? How are keys managed? | [Pending] |
| 2 | DAT-16 | What is your backup retention policy after user deletion? Max days to complete purge? | [Pending] |
| 3 | DEP-03 | Does the application send re-engagement emails? Minimum delay after last activity? | [Pending] |
| 4 | DEP-12 | Have any updates in the last 12 months removed features or changed the interface substantially? | [Pending] |
| 5 | GOV-03 | How are users notified of material policy changes? Pre-effective-date? Change summary included? | [Pending] |
| 6 | GOV-07 | What is the stated support response time? What % of requests meet that target? | [Pending] |
| 7 | HON-15 | Have any previously free features been moved behind a paywall in the last 24 months? | [Pending] |

*False attestation voids certification. Answers are cross-referenced against observable evidence.*

---

## Attestation Cross-Reference

| Attestation | Observable Evidence | Consistent? | Notes |
|---|---|---|---|
| [Claim] | [Observation] | [Yes / No / Unable to verify] | [Details] |

---

## Flagged for Auditor Review

| Criterion | Finding | Confidence | Reason for Flag |
|---|---|---|---|
| [ID] | [PASS/FAIL] | [Medium/Low] | [Why this needs human judgment] |

---

## Recommendations

### Must-Fix (Blocks Certification)
1. [Criterion]: [What needs to change]

### High Priority (High-Value Points)
1. [Criterion]: [What needs to change, estimated effort]

### Quick Wins (Low Effort)
1. [Criterion]: [What needs to change]

---

*Audit conducted using the Quiet Standards Framework v1.0, published by Hi-Low Studio LLC.*
*Full specification: https://hilowstudio.dev/standards/spec*
