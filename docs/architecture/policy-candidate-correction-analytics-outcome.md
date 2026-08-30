# Policy Candidate Correction Analytics Outcome

## Status

Implemented locally and verified on the unreleased branch. No release is
created by this work.

## Delivered Components

- `policyCandidateCorrectionSignalSnapshot.mjs` creates a versioned,
  content-free original-evidence snapshot when ranked policy candidates are
  persisted.
- `policyCandidateCorrectionOutcomeAttribution.mjs` pairs that snapshot with a
  server-validated confirmation or destination-change status at resolution
  time.
- Focused repository, metrics, and service modules build a completed-UTC-day,
  aggregate-only report. A migration adds a version-scoped timestamp index.
- The authenticated Statistics page has a new **Correction Analytics** tab
  with an accessible monitoring status and semantic aggregate tables.
- The client API follows the existing named ESM leaf-module convention and the
  presentation layer validates the version, fixed dimensions, numeric counts,
  and summary consistency before rendering.

## Test Outcome

Focused tests cover the snapshot projection, persisted-field exclusion,
validated outcome attribution, static aggregate query, report aggregation,
route bounds, API exports, client normalization, accessibility roles, and tab
integration.

The implementation deliberately proves that the *new snapshot* contains no
test catalog title or policy term. Existing history diagnostics have their own
separate retention behavior and are not broadened by this feature.

## Pull Request Check

GitHub was queried for open pull requests in `cloudbyday90/Classifarr` before
implementation. There were no open pull requests, so no random PR could be
implemented locally. No closed, merged, or inferred PR was substituted.

## Follow-on Outcome

Uncertainty-aware calibration readiness is now implemented as a separate
aggregate-only companion. It applies a fixed minimum cohort and a 95% Wilson
interval to changed-selection rates by score-margin band and evidence state,
without proposing an automatic policy, RAG, AI, or routing change. See
[Policy Candidate Correction Calibration-Readiness Design](policy-candidate-correction-calibration-readiness-design.md)
and its [outcome](policy-candidate-correction-calibration-readiness-outcome.md).
