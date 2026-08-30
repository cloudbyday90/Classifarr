# Current-Library Candidate-Retrieval Policy-Review Readiness Design

Status: Implemented (unreleased)

Date: 2026-08-30

## Decision

Classifarr will derive one fixed, advisory-only policy-review readiness signal
from the existing aggregate candidate-set outcome attribution. It identifies
when enough applicable operator decisions exist to review the deterministic
candidate set, and when selections outside that set are material enough to
warrant that review.

The signal does not diagnose the root cause, invoke AI, alter retrieval,
change a policy, queue work, learn from an outcome, or route media. It is an
operator decision aid only.

## Evidence And Research Basis

- The NIST AI RMF Measure function calls for documented context, measurement,
  and feedback that can inform ongoing risk management. An aggregate,
  purpose-limited outcome signal provides feedback without making an automated
  decision. [NIST AI RMF Core](https://airc.nist.gov/airmf-resources/airmf/5-sec-core/)
- OpenTelemetry's Metrics SDK warns that each unique attribute combination
  adds cardinality. The report keeps a fixed status vocabulary and aggregate
  counters rather than adding item, library, policy, actor, or destination
  dimensions. [OpenTelemetry Metrics SDK](https://opentelemetry.io/docs/specs/otel/metrics/sdk/)
- W3C's status-message guidance recommends a polite `role="status"` region
  for important dynamic application state and explicit `aria-atomic="true"`
  when the complete message provides necessary context. The Statistics panel
  follows that pattern without moving focus or using an interrupting alert.
  [W3C ARIA22](https://www.w3.org/WAI/WCAG22/Techniques/aria/ARIA22.html)

## Existing Evidence

The preceding attribution component records only whether a validated operator
resolution stayed inside the server-owned runtime candidate set. It already
excludes `routed_not_applicable` from selection-rate calculations because that
outcome does not represent a candidate choice. The existing aggregate endpoint
therefore has the exact content-free inputs needed for a readiness decision.

This component does not claim that an outside selection proves an AI, lexical
retrieval, metadata, or policy bug. It is a prompt to inspect deterministic
candidate eligibility, declared scope, and ranking evidence before considering
semantic retrieval.

## Readiness Contract

The new pure ES module receives only two aggregate counts:

- bounded-candidate selections; and
- broader-chooser selections outside the bounded candidate set.

It calculates applicable decisions as their sum and returns only a version,
allow-listed status ID, counts, and fixed thresholds. `routed_not_applicable`
and unattributed historical outcomes are intentionally excluded.

| Status ID | Condition | Operator meaning |
| --- | --- | --- |
| `insufficient_data` | Fewer than 20 applicable decisions | Continue normal review; do not infer a candidate-set issue. |
| `candidate_set_supported` | At least 20 decisions without a material outside rate | Current evidence does not yet support a candidate-set review. |
| `candidate_set_review_recommended` | At least 20 decisions, at least 3 outside selections, and at least a 15% outside rate | Review deterministic candidate eligibility, declared library scope, and ranking evidence. |

The thresholds intentionally match the completed candidate-bound verification
drift guard's conservative minimum count, minimum event count, and minimum
rate. They are an operational review floor, not a confidence interval or an
automatic remediation criterion.

## Alternatives

| Option | Benefits | Costs / risks | Decision |
| --- | --- | --- | --- |
| Show only raw attribution counters | No additional policy | Leaves the operator to infer a rate from too little data | Reject |
| Automatically broaden candidate retrieval or alter policy at a threshold | Faster apparent response | Turns coarse aggregate telemetry into routing/policy authority | Reject |
| Persist destination, policy, or item identities for drill-down | Rich investigation | Enlarges the privacy and retention surface | Reject |
| Fixed aggregate readiness signal with human review | Clear evidence threshold, content-free, testable, reversible | Cannot provide row-level diagnosis | Adopt |

## Security And Authority Boundaries

- The module accepts no request input, identity, free text, model output, or
  routing value; its safe-integer normalization preserves count invariants.
- The existing authenticated read-only endpoint remains the only delivery
  channel and retains its fixed 1-30 complete-UTC-day window.
- The response adds no library, media, policy, candidate, destination, actor,
  provider, model, prompt, response, timestamp, or error details.
- Client messages are mapped from an allow-listed status ID. No server or
  provider text is rendered.
- The UI contains no command, policy editor, retry, or route control. A
  recommended review cannot itself change system state.

## Final Recommendation Stack

1. Collect validated candidate-set attribution for a representative cohort.
2. Use the readiness signal to determine when its aggregate evidence is worth
   reviewing, while excluding non-selection outcomes.
3. When review is recommended, inspect deterministic policy eligibility,
   library scope, and ranking evidence first.
4. Consider semantic retrieval or RAG only if that review cannot explain a
   persistent outside-candidate rate.
