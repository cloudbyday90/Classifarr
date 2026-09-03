# Current-Inventory Semantic Study Snapshot Outcome

## Status

Implemented locally on 2026-09-03. No release, tag, API route, database
migration, or Settings control was created.

## Delivered

- Added modular ESM contracts, reducer, and scorer for a redacted
  current-inventory semantic study snapshot.
- The reducer retains only policy candidate count, retrieval availability, and
  leader/strongest-alternative relevance. It deliberately strips titles,
  descriptions, library and media IDs, provider/model data, prompts, vectors,
  and responses.
- Extended the existing fingerprint-bound snapshot adapter so the normal
  readiness evaluator and frozen-study preflight can consume either the
  original synthetic-vector study document or the new real-retrieval document.
- Added focused tests for strongest-alternative selection, unavailable
  retrieval, strict unknown-field rejection, report redaction, adapter
  binding, and a full 24-case frozen-study preflight.

## Result

The new document closes the evidence-format gap: an authorized study can now
measure the actual retrieval that compares a request synopsis with the current
library inventory. It still has no live authority. In particular, it does not
make an item less likely to route, call a provider, or override the deterministic
policy result.

## Local Validation

- Focused server tests: 6 suites / 15 tests passed.
- The 24-case current-inventory document reached only
  `ready_for_human_study_review` in an all-correct synthetic control test;
  the returned authority still sets automatic routing and policy-change
  eligibility to `false`.
- Existing synthetic snapshot adapter and offline evaluation tests remained
  green.

## Next Item

Run a real independently labelled 24–32 case study through this format, with
the exact candidate-scoped model/retrieval cohort frozen by the existing
preflight. If its error profile is acceptable, the next engineering item is a
narrow semantic counter-evidence policy experiment that moves only a proven
broad-policy conflict into bounded candidate comparison or operator review.
