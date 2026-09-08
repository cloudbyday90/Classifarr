# Held-out semantic policy source contract design

Status: implemented on 2026-09-08. Research checked against the linked primary
sources on 2026-09-08.

## Problem

The private held-out eligibility audit correctly excluded every inferred
library-profile rule from its study boundary. Its aggregate source receipt then
reported the same ten profile-only policies as `policyWithDeclaredPurposeCount`.
That name could cause an automated consumer to mistake observed library-profile
evidence for retained declared purpose.

A semantic cohort must not be created from that ambiguity. The platform needs a
library- and configuration-agnostic way to distinguish observed purpose evidence
from the subset retained after the provenance screen, without disclosing a
library, policy, rule value, media item, or configuration.

## Decision

Version the source screen and replace the ambiguous declared-purpose count with
a closed policy partition:

- policies with at least one observed purpose rule;
- policies whose observed purpose is profile-only and therefore excluded;
- policies with at least one retained purpose rule; and
- policies with no observed purpose rule.

The screen also retains rule-level aggregate counts for observed, excluded, and
retained evidence. `policyWithoutRetainedPurposeCount` remains a derived count.
The partitions reconcile to `activePolicyCount`, while the rule counts remain
separate because one policy can hold more than one rule.

The enclosing eligibility audit advances to v4 and returns its version in every
complete, truncated, configuration-changed, and failed result. This makes a
consumer reject or branch explicitly on the corrected contract rather than
silently interpreting renamed fields.

```text
active native policy purpose rules
  -> count observed rules without values
  -> remove inferred library-profile rules for the study boundary
  -> classify each policy: absent | profile-only | retained
  -> emit versioned aggregate receipt
  -> keep cohort selection, labels, readiness, frozen-study preflight,
     semantic evidence, and routing disabled
```

## Research basis

W3C Data on the Web Best Practices calls for provenance, quality information,
and explanations for unavailable data so people and software can judge reuse.
The count-only source receipt supplies that explanation without exposing the
underlying configuration. [W3C Data on the Web Best Practices](https://www.w3.org/TR/dwbp/)

NIST's AI RMF Measure guidance supports documented, repeatable measurement
conditions and clear evidence of what a result does and does not establish. A
versioned receipt preserves the study boundary rather than recasting a
profile-derived observation as a declared-policy fact. [NIST AI RMF Measure](https://airc.nist.gov/airmf-resources/playbook/measure/)

OWASP's Secure AI Model Ops guidance recommends governed promotion between
evaluation and production contexts. Keeping this receipt advisory prevents its
aggregate count from becoming semantic, policy, or routing authority. [OWASP
Secure AI Model Ops Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Secure_AI_Model_Ops_Cheat_Sheet.html)

## Options

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Keep `policyWithDeclaredPurposeCount` | No downstream contract change. | Misstates profile-only evidence and can mislead future automation. | Reject |
| Infer declared purpose from profile membership | Could make the cohort appear ready. | Circular evidence; violates the frozen-study boundary. | Reject |
| Return raw policy or rule details | Supports manual diagnosis. | Exposes library/configuration data and increases operational dependency. | Reject |
| Versioned aggregate partition | Explains availability precisely, reconciles counts, and remains privacy-bounded. | Consumers must accept v4 deliberately. | Adopt |

## Recommendation stack

1. Treat observed, profile-only, retained, and absent purpose evidence as
   distinct aggregate states.
2. Require the private audit version before consuming a source-screen result.
3. Keep inferred library-profile evidence excluded from cohort selection.
4. Do not collect labels, invoke readiness or frozen-study preflight, or add
   semantic counter-evidence until a complete 24–32-case cohort exists.
5. If later measured error supports semantic counter-evidence, send ambiguous
   items only to review; never route them automatically.

## Non-goals

This change adds no dependency, migration, endpoint, database write, policy
edit, provider call, semantic retrieval, label collection, AI invocation, or
routing behavior.
