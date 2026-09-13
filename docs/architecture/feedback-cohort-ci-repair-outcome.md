# Feedback cohort and CI repair outcome

Date: 2026-09-13

## Implemented

See the [design and researched tradeoffs](feedback-cohort-ci-repair-design.md).

- Learning-feedback capture preserves the exact PostgreSQL transaction timestamp
  as six-digit UTC text. The cutoff is no longer truncated through JavaScript.
- Removed two unused ESM exports without changing either canonical result version.
- Restored the five missing copyright headers reported by CI. The existing SQL
  migration received only a comment; its schema operations are unchanged.
- Added `npm run test:ci:preflight`, using the existing shell-free workspace
  launcher to run copyright and both Knip modes and report every result. The root
  `test:ci` command invokes it before the existing checks.

## Root-cause verification

The latest CI integration failure was not a new metadata-recovery failure: it
exposed a timestamp precision defect in learning-feedback capture. The earlier
CI run had passed database tests but failed Knip. The later CI run failed both.
Release acceptance was blocked by these failed prerequisites, as designed.

A deterministic PostgreSQL regression places four feedback rows at capture time
minus 800 microseconds, minus 1 microsecond, exactly capture time and plus
1 microsecond. With the old implementation, all three eligible rows are lost.
With the fix, the first three are captured and the fourth remains excluded.
Both UTC and America/New_York database sessions are tested. No sleeps, enlarged
cutoff, disabled eligibility check or automatic retry hides the failure.

The deterministic clock is injected only into the integration database's capture
query. The real PostgreSQL query, driver parsing, repeatable-read isolation,
read-only transaction and eligibility view still execute. Production receives no
test clock or new configuration.

## Validation

- Reproduced both missing-header and unused-export reports locally and confirmed
  they match the GitHub job logs.
- Copyright, development Knip and production Knip: passed through local preflight.
- Targeted server regressions: 30 suites, 190 tests passed.
- Targeted PostgreSQL feedback/suggestion lifecycle: 4 suites, 90 tests passed.
- Frontend summary and refresh regressions: 2 suites, 19 tests passed.
- Production policy-route browser smoke: 7 tests passed.
- Server/client type checks and lint, migration/schema integrity, ESM static
  imports and mock shapes, console-spy check, and Markdown lint passed.
- Runtime dependency audits: zero findings for server and client.

- Full PostgreSQL integration: 142 suites / 1,636 tests passed, with one existing
  opt-in suite/test skipped. Full frontend: 368 suites / 5,090 tests passed;
  the later pause-race regression also passed in the final 48-test client group.
- Full backend coverage run: 1,268 suites / 36,672 tests passed; two existing
  numeric-work stress cases hit Jest's default 10-second deadline during parallel
  workspace testing. A diagnostic run with more time reached the expected budget
  rejection. Only these two CPU-heavy tests now have explicit 30-second deadlines.
  Production operation limits, inputs and assertions are unchanged. Both complete
  suites then passed under scoped coverage: 20 tests, 100% lines / 95.31% branches.
  The full 1,270-suite run was not repeated after this test-only deadline change.
- The fresh full server/client coverage ratchet passed without changing baselines.
  The backend full report has 90.09% lines and 82.19% branches; client has 87.64%
  lines and 77.52% branches. Scoped coverage is not substituted for the full report.

## Existing limitation

The separate root production-naming gate still reports 26 existing references
against its zero-debt baseline. This count is unchanged. It is not an executed
failing step in the linked CI workflows. The baseline was not relaxed, and a
passing preflight must not be described as a passing complete root `test:ci` run.

## Delivery boundaries and next item

This CI repair changes no public API, provider configuration, library identity,
classification threshold, SWR behavior or routing authority. The separately
documented [log repair feature](media-sync-actionable-report-outcome.md) does
extend administrator detail responses and reuse SWR. No existing feedback or cohort was
rewritten. This corrects future analyses; previously skipped eligible feedback
remains in the database and can be included by the next analysis within its
existing lookback. No special backfill table or extra user acknowledgement is
needed.

GitHub MCP returned no open Classifarr PRs, so there was no random open PR to
implement locally. No closed PR or unrelated repository was substituted.
No version bump, tag, release or PR merge is part of this repair.

The next product item remains a library-balanced movie/TV benchmark of strict
versus calibrated fallback retrieval using refreshed metadata. Report coverage
and mistakes separately; do not call agreement with existing placements accuracy.
