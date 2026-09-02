# Outcome-Weighted Semantic Retrieval Outcome

## Delivered

- Added a focused ESM calibration service for current-library semantic results.
- Bumped the semantic-retrieval protocol to v2 so aggregate proposal cohorts do
  not mix the earlier retrieval behavior with calibrated behavior.
- Added a receipt-gated SQL predicate that admits only authenticated, learning-
  ready `resolved` or `routed` outcomes whose destination still matches the
  synchronized current library item.
- Applied a maximum six-point boost only to results already at 50/100 or above,
  then exposed only a bounded calibrated-match count to advisory evidence.
- Kept raw description, embedding, receipt, actor, and outcome detail outside
  the retrieval result; no UI expansion or new acknowledgement was introduced.
- Added unit coverage for boost, threshold, cap, ordering, and local/remote
  evidence projection.

## Non-goals preserved

This change does not route media, increase a policy score, change automation
thresholds, create a policy, persist a new learned rule, contact an AI provider,
or alter existing libraries. It only improves the evidence supplied to the
already-bounded advisory candidate comparison.

## Validation to run

The implementation is validated with targeted unit tests first, then the
repository's lint, type, documentation, ESM, server, client, schema, security,
and no-cache local Compose checks before commit and push.

## Follow-up

Measure outcome-calibrated and uncalibrated semantic comparisons as separate
aggregate cohorts. That will show whether the bounded boost improves later
operator alignment before any consideration of broader semantic authority.
