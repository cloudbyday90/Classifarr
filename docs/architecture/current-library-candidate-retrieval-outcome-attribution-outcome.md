# Current-Library Candidate-Retrieval Outcome Attribution Outcome

Status: Implemented (unreleased)

Date: 2026-08-30

## Intended Outcome

This component turns the existing operator resolution into one bounded
aggregate fact: whether the selection remained inside the policy-owned
candidate set. It will make the Candidate Retrieval Statistics view useful for
separating a candidate-set gap from an AI disagreement without exposing or
retaining new routing identities.

## Delivery Boundaries

- Use modular ES modules for the contract/projection and aggregate metrics.
- Calculate membership only at the validated server-side resolution boundary.
- Preserve the existing policy and routing authority model.
- Do not backfill historic rows or add a raw event table.
- Extend only the existing authenticated, read-only metrics endpoint and view.

## Open Pull Request Check

The GitHub Pull Requests API returned zero open pull requests for
`cloudbyday90/Classifarr` on 2026-08-30. There is no open PR to implement
locally without inventing work.

## Delivered Implementation

- `currentLibraryCandidateRetrievalOutcomeAttribution.mjs` independently owns
  the versioned membership calculation and persistence projection.
- `clarificationPolicyResolution.mjs` derives the result only after the
  fingerprint-bound runtime-question answer has passed server validation.
- `classificationOutcomeService.mjs` strips the transient attribution from the
  mutable outcome path and persists only its allow-listed version/status pair.
- The existing aggregate statistics query and Candidate Retrieval view expose
  counts only; the UI adds no control and clearly limits the interpretation.

## Validation Completed

- Focused attribution, persistence, metrics, statistics-route, and resolution
  coverage passed: 8 suites and 102 tests.
- Full server unit coverage passed: 897 suites and 25,842 tests.
- Server integration coverage passed: 75 suites and 867 tests (one explicitly
  skipped suite/test).
- Full client coverage passed: 253 files and 3,689 tests, including the
  read-only candidate-set explanation and no-control assertion.
- Repository type checking, lint, documentation lint, migration integrity,
  authoritative schema snapshot, static-ESM, and copyright checks passed.
- The exact parameterized aggregate query was prepared and executed against
  local Compose PostgreSQL. Its zero-observation row matches the known local
  absence of telemetry and operator-resolution cohort data.
- A complete local security diff review found zero reportable findings. It
  reviewed attribution derivation, resolution/persistence, aggregate SQL,
  client rendering, telemetry compatibility, tests, and documentation. The
  Codex Security Access connector was unavailable, so protected-output access
  could not be independently verified; that did not affect local review.

## Resulting Recommendation Stack

1. Review `changed_outside_candidates` first; it identifies a candidate-set
   policy-review opportunity, not an AI or lexical-retrieval defect.
2. If outside-candidate selections are low but broader chooser selections are
   common, inspect deterministic candidate ranking and policy evidence.
3. Consider semantic retrieval only after a representative attributed cohort
   demonstrates a recall problem that those deterministic checks cannot
   explain.
