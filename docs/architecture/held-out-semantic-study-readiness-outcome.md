# Held-out Semantic Study Readiness Outcome

Status: implemented on 2026-09-08. See the separate
[design](held-out-semantic-study-readiness-design.md) for research, tradeoffs,
and the recommendation stack.

## Outcome

Classifarr now publishes a versioned, passive, aggregate-only held-out study
readiness report. It distinguishes an absent normal lifecycle receipt from an
absent complete declared-purpose evidence chain and exposes an available state
only when both aggregate prerequisites are positive.

The report makes the current deferred state understandable without manual
library inspection: the prior private audit had 6,641 candidates but zero
policy-only eligible comparisons because profile-inferred purpose did not meet
the retained-purpose boundary. The report never promotes that profile evidence
to declared purpose.

The administrator-only endpoint is rate-limited and `no-store`; the browser
normalizer rejects unexpected versions, contradictory counts/statuses, or any
projection claiming configuration, identity, cohort, label, selection, or
routing authority. Authorization precedes rate limiting, preventing anonymous
requests from consuming an administrator view's quota. The reconciliation page
presents the valid aggregate state without moving focus.

## Boundaries preserved

- No library, policy, intent, receipt, configuration, provider, rule value,
  media, prompt, response, RAG, or classification history is returned.
- The report does not schedule the audit or persist state.
- `eligibility_audit_available` is a prerequisite only. It is not an eligible
  cohort, independently labelled evaluation, accuracy result, semantic
  decision, or routing permission.
- The existing lifecycle re-audit gate remains the sole automatic audit path.

## Validation

Focused server contract, service, and route tests cover all deferment states,
the available state, malformed projections, source-read failure, administrator
authorization, no-store caching, and rate limiting. Client tests cover the
closed normalizer and named API call. Server and client type checks pass.

## Next item

Passively wait for normal native authoring to produce complete current-purpose
and lifecycle provenance. When the readiness report becomes
`eligibility_audit_available`, the existing receipt-triggered audit may run.
Only a balanced real 24–32-case eligible cohort can advance to independent
labels, adjudication, readiness, and frozen-study preflight. Semantic
counter-evidence remains deferred until measured error supports it, and it may
only refer ambiguous media for review.
