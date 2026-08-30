# Policy Runtime-Question Score Explanation Design

Status: Implemented (unreleased)

Date: 2026-08-30

## Decision

Classifarr will give an operator a bounded explanation of the deterministic
policy score shown on a pending classification. The explanation answers the
specific question behind a score such as `71/100`: which fixed categories of
evidence contributed, how their active weights were normalized, whether
multiple sources added the formula's corroboration adjustment, and whether an
evidence-safety calibration changed the result.

It remains an explanation of the already-computed policy result. It cannot
select a destination, alter a policy, call AI, retry work, learn from an
outcome, or route media.

## Research Basis

- The NIST AI RMF Measure guidance calls for explanations that are documented,
  validated, and meaningful in context. A bounded formula explanation is more
  auditable than an opaque score while keeping the deterministic policy engine
  as the decision authority. [NIST AI RMF Core](https://airc.nist.gov/airmf-resources/airmf/5-sec-core/)
- The AI RMF Playbook distinguishes transparency, explainability, and
  interpretability, and recommends testing explanations for clarity. The UI
  therefore says what the score represents and what it does not represent; it
  does not present a model rationale as evidence. [NIST AI RMF Playbook](https://airc.nist.gov/docs/AI_RMF_Playbook.pdf)
- W3C states that disclosure widgets already expose expanded/collapsed state;
  their revealed content is not a status message. The score mechanics use a
  native `details` disclosure, leaving polite status regions only for actual
  dynamic result changes. [W3C WCAG 2.2 status-message guidance](https://www.w3.org/WAI/WCAG22/Understanding/status-messages/)
- When dynamic status text is needed elsewhere, W3C's ARIA22 technique uses a
  polite `role="status"` and recommends explicit `aria-atomic="true"` where
  the whole message gives required context. This change adds neither an
  interrupting alert nor a focus change. [W3C ARIA22](https://www.w3.org/WAI/WCAG22/Techniques/aria/ARIA22.html)
- OWASP recommends explicit, minimal response-property selection and schema
  validation rather than serializing internal objects. The presentation is an
  allow-listed contract, not the persisted policy candidate object.
  [OWASP API3:2023](https://owasp.org/API-Security/editions/2023/en/0xa3-broken-object-property-level-authorization/)

## Formula Model

The policy engine already calculates a candidate score as follows:

1. Retain positive deterministic sources with an active policy weight.
2. Normalize those active weights and compute their weighted average.
3. Apply the fixed corroboration multiplier for the number of contributing
   sources.
4. Apply an evidence-safety calibration when the candidate uses weak,
   overlapping, conflicting, or otherwise insufficient evidence.
5. Compare the rounded result with the confirmation and automatic thresholds.

The explanation mirrors those steps using only the policy candidate already
selected by the server. It does not recalculate or replace the routing result.

## Presentation Contract

`policy.runtime_question_score_explanation.v1` contains only:

- the displayed integer score and rounded weighted base score;
- the fixed, bounded corroboration multiplier percentage;
- at most six fixed source IDs, each with an integer evidence score,
  normalized active-weight percentage, and weighted contribution; and
- an allow-listed calibration status with an optional rounded pre-safety score.

The fixed source IDs are declared policy signal or intent, observed library
contents, confirmed classification pattern, similar items (RAG), and prior
confirmed outcomes. The browser maps all labels locally from these IDs.

The browser treats an unknown version, source, calibration status, invalid
number, duplicate source, or empty component list as unavailable. It renders
no partial or untrusted explanation.

## Alternatives

| Option | Benefits | Costs / risks | Decision |
| --- | --- | --- | --- |
| Keep only `71/100` | Small UI | Leaves the operator unable to understand the score | Reject |
| Return raw policy candidate objects | Exact internal detail | Exposes policy/library IDs, terms, diagnostics, and future internal fields | Reject |
| Show model reasoning | Familiar narrative | Probabilistic, potentially sensitive, and not the routing authority | Reject |
| Bounded deterministic formula explanation | Auditable, clear, testable, and authority-preserving | Does not provide item-level policy-term drill-down | Adopt |

## Security And Authority Boundaries

- The standalone ES module accepts only an already-selected candidate and does
  not accept browser input, text, identifiers, or routing values.
- It outputs fixed source and calibration vocabularies plus bounded numbers.
  It never returns policy terms, library or policy IDs, media metadata,
  provider settings, prompts, model output, raw diagnostics, or errors.
- The client independently validates the version, every status and source ID,
  numeric ranges, uniqueness, and maximum component count before rendering.
- The existing server-owned answer fingerprint includes the presentation, but
  the explanation adds no client-controlled action or authority.
- A malformed or historic candidate without valid formula components produces
  no explanation rather than an inferred one.

## Final Recommendation Stack

1. Use the score explanation first when an operator asks why a policy result
   is in the confirmation band rather than automatically routed.
2. Review declared intent/signal evidence, observed contents, patterns, RAG,
   and prior outcomes according to their displayed contribution.
3. Treat a safety calibration as a reason to strengthen deterministic identity
   evidence or narrow overlap, not as a reason to bypass a safeguard.
4. Use the existing aggregate candidate-set readiness signal to decide when a
   broader policy eligibility and scope review is justified.
5. Consider richer semantic retrieval only after deterministic evidence and
   scope cannot explain a persistent, representative candidate-set gap.
