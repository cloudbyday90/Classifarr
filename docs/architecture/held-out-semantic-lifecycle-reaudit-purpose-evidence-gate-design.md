# Held-out semantic lifecycle re-audit purpose-evidence gate design

Status: implemented on 2026-09-08. Research checked against the linked primary
sources on 2026-09-08.

## Problem

The private audit found 6,641 candidate comparisons, but every active policy's
purpose evidence was inferred from a media-server library profile. The study
correctly excludes that evidence because it is not a retained operator-declared
purpose. A normal lifecycle receipt alone could still schedule the expensive
audit even though its policy-only comparison count must be zero.

The fix must reduce wasted work without making a profile-derived configuration
look like an operator decision, disclosing library or rule values, or advancing
the frozen-study workflow.

## Decision

Add a modular purpose-evidence adapter to the lifecycle re-audit service. It
reuses the established current-intent policy-purpose evidence inventory and
returns only `completePolicyEvidenceCount` and its Boolean derivative. A count
is complete only when a current active authoritative native policy has retained
declared specialized purpose and matching, verifiable normal lifecycle evidence.

The re-audit source is now v2. It includes fixed lifecycle transition counts and
the complete-evidence count. The scheduler runs the existing private eligibility
audit only when both counts are positive. It first stops on a zero lifecycle
count before reading the purpose inventory. It otherwise returns `null` without
writing its cursor or scanning candidates.

```text
aggregate lifecycle receipt ─┐
                             ├─> source v2 ─> both positive? ─> audit v3
complete-purpose inventory ──┘                    │
                                                   └─> stop quietly
```

The adapter invokes no provider, makes no write, exposes no endpoint, and keeps
policy, library, configuration, receipt, and media identity out of the source.
It neither turns inferred profile evidence into declared purpose nor synthesizes
a lifecycle receipt.

## Research basis

W3C recommends publishing provenance and quality information so users and
software can assess reuse; the design retains only the aggregate provenance
needed for the decision. [W3C Data on the Web Best Practices](https://www.w3.org/TR/dwbp/)

W3C PROV-DM distinguishes source entities and activities from their derived
artifacts. Here, durable lifecycle and purpose evidence produce a versioned
aggregate trigger, rather than being treated as semantic truth. [W3C PROV-DM](https://www.w3.org/TR/prov-dm/)

NIST AI RMF Measure calls for repeatable measurement and risk tracking. The
gate records a fixed, reviewable precondition while leaving cohort selection,
labelling, and model evaluation to their existing separate controls. [NIST AI
RMF Measure](https://airc.nist.gov/airmf-resources/playbook/measure/)

OWASP advises minimizing and protecting logged event data. The adapter returns
fixed counts only and does not log inputs or identifiers. [OWASP Logging Cheat
Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)

## Options

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Audit after every normal lifecycle receipt | Simple and fully automatic. | Repeats a private population scan when source eligibility is provably impossible. | Reject |
| Promote profile-inferred purpose to declared purpose | Would make more policies appear eligible. | Misstates provenance and bypasses the study boundary. | Reject |
| Require an operator to trigger an audit | Easy to explain. | Restores the manual dependency the platform is removing. | Reject |
| Gate on the existing aggregate complete-evidence inventory | Prevents impossible audits, reuses one canonical definition, and stays library-agnostic. | Adds one aggregate database read. | Adopt |

## Recommendation stack

1. Require positive normal-lifecycle and complete-purpose-evidence counts before
   an automatic audit.
2. Reuse the existing canonical aggregate inventory; do not duplicate its SQL or
   invent a second definition of complete evidence.
3. Keep the durable source fingerprint, lock, and bounded retry behavior.
4. Preserve the independent-label, readiness, and frozen-study gates.
5. Consider semantic counter-evidence only after measured error supports it;
   ambiguous media must go to review and never automatic routing.

## Non-goals

This change does not create declared purpose, repair policy source provenance,
capture a cohort, collect labels, run readiness or preflight, retrieve semantic
evidence, call an AI service, mutate policy or configuration, or route media.
