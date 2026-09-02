# Outcome-Calibrated Semantic Evaluation Outcome

## Delivered

- Added a modular ESM observation service that derives only
  `outcome_calibrated`, `not_outcome_calibrated`, or `no_semantic_match` from a
  completed bounded semantic lookup.
- Persisted that allow-listed, content-free observation only alongside an
  available semantic-retrieval status in the existing candidate-adjudication
  projection.
- Extended the frozen, opaque proposal-cohort aggregate with two comparable
  arms, while keeping no-match and legacy records outside the comparison.
- Added a conservative 12-resolved-proposals-per-arm human-review floor.
- Kept the report automatic and concise in the existing Statistics disclosure;
  no new Settings control, acknowledgement, raw corpus, model call, learning
  path, policy change, RAG tuning, retry, or routing authority was added.

## Preserved non-goals

This component does not claim that operator alignment is correctness. It does
not expose or retain raw item, library, provider, model, prompt, response,
embedding, similarity, receipt, or actor data. It does not evaluate historic
rows that lack the new observation as if they were uncalibrated.

## Validation

- Focused unit and UI tests cover state derivation, projection allow-listing,
  policy-path propagation, fixed aggregate query fields, bounded inconsistent
  counts, review readiness, and safe client presentation.
- Full workspace validation passed: 1,032 server unit suites / 28,524 tests,
  81 integration suites / 874 tests (one intentional skip), and 315 client
  files / 4,216 tests.
- Root lint, server/client type checks, Markdown lint, static ESM-import and
  test-mock-shape checks, authoritative schema verification, and the production
  client build passed.
- A source-backed diff security review completed with no reportable findings.
  It covered the state derivation, projection, policy-path propagation,
  aggregate query, aggregate evaluator, Statistics presentation, and tests.
  The protected security connector was unavailable because the local
  environment was not signed in, so this was a sequential local review rather
  than an independent connected-service review.
- Local Compose rebuilt without cache, recreated without rebuilding, and became
  healthy. Its `GET /health` response was HTTP 200 with a connected database.
  No release is created by this change.

## Next follow-up

When both aggregate arms reach the review floor, run a separate independently
labelled, time-bounded reference-set study. It should test whether any observed
alignment difference survives cohort, provider, outcome-mix, and selection-bias
review before considering a semantic-calibration adjustment.
