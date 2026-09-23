# Operator-outcome calibration: outcome

Date: 2026-09-22. Implements the [design](operator-outcome-calibration-design.md).

## Implemented

`inventoryOutcomeLabels.mjs` reads bounded, eligible, explicitly responded
operator feedback and final-state-matched manual corrections.
`inventoryOutcomeCalibration.mjs` reuses the existing corpus,
metadata/company projection, learned fits and grouped fold planner. It reports
per-media and anonymous per-library paired metrics, with corrections separately
identified. `runInventoryOutcomeCalibration.mjs` is a read-only local CLI:

```text
node server/src/scripts/runInventoryOutcomeCalibration.mjs --seed outcome-study-20260922 --size 300 --folds 3
```

The CLI requires a configured database. It never changes routes or models, and
does not expose raw item or user data. No migration, UI, API contract, new AI
provider, acknowledgement, release or deployment was added.

## Verification and limitations

A synthetic six-library, 300-item grouped study (150 movies, 150 TV items)
exercises company-only gains where the baseline has no differentiating metadata.
It proves benchmark mechanics, not real-world classification improvement.
Unit tests also cover absent companies, conflicting labels, missing inventory,
an empty label pool, cap failure and output redaction. A PostgreSQL integration
test verifies that the actual eligibility view excludes an unanswered row and a
contradictory feedback flag, while a persisted manual correction is admitted.
The read-only CLI was tested with an injected snapshot.

The full backend unit run passed 1,380 suites / 40,478 tests. The subsequent
coverage run passed 1,380 suites / 40,479 tests, including the added CLI
failure/cleanup case. The full PostgreSQL integration run passed 147 suites /
1,703 tests; one pre-existing opt-in provider-fault case remained skipped.
The focused correction SQL test passed again after the timezone change.
Server typecheck, test/security ESLint, both Knip gates, Markdown lint,
copyright, npm-flag and whitespace checks passed. `npm audit --omit=dev`
reported zero vulnerabilities. Fresh server coverage was 90.35% statements
and lines, 83.74% branches and 92.48% functions; the repository coverage
ratchet passed. The client was not changed or rerun in this turn; its existing
coverage artifact supplied the unchanged client values to the ratchet.

The app currently running locally predates the company-observation deployment;
its last measured 300-item sample had zero usable company observations. No
production outcome accuracy or live company benefit is claimed. The design
explicitly keeps `promotionAllowed: false`. No fresh live benchmark was run
against that old image because it would measure unavailable company data, not
the new implementation.

## Next item

Follow-up: the [prospective ranking implementation](prospective-inventory-ranking-outcome.md)
removes the current-membership label bias and captures the existing live
description evidence automatically. The original measurements above describe
the earlier commit; they are not results for the prospective cohort.

After normal deployment and bounded backfill, freeze a prospective operator
feedback cohort and replay the actual semantic-description/RAG and company
ranking together. Separate confirmations from corrections, measure abstention
and regression for every movie/TV library, and promote only with an independent
validation cohort and unchanged identity/eligibility/routing guards. This closes
the gap between a component-level fit diagnostic and Classifarr's desired
content-agnostic end-to-end classification accuracy.
