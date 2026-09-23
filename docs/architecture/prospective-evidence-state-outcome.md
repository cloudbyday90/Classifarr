# Prospective evidence state: outcome

Date: 2026-09-23. See the separate
[design and recommendation stack](prospective-evidence-state-design.md).

## Implemented

The existing prospective report now includes an additive `evidenceState` object
with one `phase` and bounded `missing` codes. It distinguishes no frozen live
comparisons, pending exact-event outcomes, excluded/unusable outcomes, and
diagnostic paired outcomes. Once outcomes exist, it identifies absent movie,
TV, correction, and company-observed correction coverage separately.

The established `status`, sample/coverage counts, anonymous strata, fixed window,
read-only query, and no-promotion/no-provider/no-routing fields are unchanged.
No production score, confidence threshold, UI, storage schema, or retention
setting changed. The new pure ESM service receives only aggregates.

## Live evidence and verification

The approved local container is healthy, and automatic backfill progressed from
251 movie/TV company observations at the previous deployment check to at least
1,136 during this investigation (729 movie, 407 TV). Thousands of identified
items still await enrichment. There have been no new eligible classifications in
the fixed prospective window starting `2026-09-23T09:03:40Z`, so there are no
captures or exact-event outcomes to score. The present phase is
`awaiting_live_comparisons`, not zero accuracy. No feedback or classification was
fabricated to populate the report.

Focused tests cover every evidence phase, missing coverage for each media type,
corrections with and without complete company evidence, the CLI contract, and the
unchanged promotion boundary. Verification passed:

- Full backend coverage: 1,384 suites / 40,612 tests, with 90.36% statements and
  83.79% branches. Full client coverage: 371 files / 5,174 tests, with 85.62%
  statements and 77.60% branches. The coverage ratchet passed unchanged.
- Focused PostgreSQL exact-event integration: 1 suite / 2 tests. Focused unit and
  CLI tests: 2 suites / 26 tests.
- Server security/test lint and typecheck, dependency-usage checks, ESM checks,
  copyright, documentation lint, whitespace check, and client production build.

The [previous commit's hosted CI](https://github.com/cloudbyday90/Classifarr/actions/runs/35840906933)
passed its build, test, database and release-acceptance jobs. New hosted CI is
separate from this local result. No random PR patch was applied: GitHub returned
an empty open-PR list on repeated checks.

## Next high-value item

Allow ordinary classification and feedback to create a real prospective cohort.
Then assess paired gains and regressions by movie/TV, correction/confirmation,
and selected-library stratum. If the first cohort suggests benefit and has
meaningful company-observed corrections, freeze the decision and validate on a
later disjoint cohort before proposing a reversible company-assisted shortlist.
If routine traffic remains zero, investigate intake health rather than producing
more synthetic samples or changing thresholds.
