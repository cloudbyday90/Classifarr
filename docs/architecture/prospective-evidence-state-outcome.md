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

## Approved local deployment

The user approved rebuilding and restarting the local `classifarr` container.
The prior image (`sha256:de73e6f74e12e7d88dd61031aee5c497e313b8bdf1f5b405b7e1aa36f9d6e523`)
is retained as `classifarr:rollback-20260923-evidence`. No other container was
recreated, no persistent volume was removed, and there was no schema migration.

Built the image from code/documentation commit `846541ff32bb9bab91dad1ff5eb98160f5ab8c12`.
The local image is `sha256:b86a33f1475a8473a1828865ecbb72755b105d7ddcf3fd85217b5dbe6a18548c`.
An isolated container smoke check verified ESM loading and the empty-cohort state
before restart. The Compose restart finished healthy with zero restarts. HTTP
`/health` returned 200 and connected-database status; unauthenticated access to
the detailed observation-health API returned 401.

The real deployed report for the same starting boundary and a cutoff of
`2026-09-23T09:25:35.259Z` returned `captured: 0`, `sampleSize: 0`,
`evidenceState.phase: awaiting_live_comparisons`, `promotionAllowed: false`,
`providerCalls: 0`, and `routingChanges: 0`. This is still a wait for genuine
classification traffic, not a measured model result.

## Next high-value item

Allow ordinary classification and feedback to create a real prospective cohort.
Then assess paired gains and regressions by movie/TV, correction/confirmation,
and selected-library stratum. If the first cohort suggests benefit and has
meaningful company-observed corrections, freeze the decision and validate on a
later disjoint cohort before proposing a reversible company-assisted shortlist.
If routine traffic remains zero, investigate intake health rather than producing
more synthetic samples or changing thresholds.
