# Image-index repair visibility outcome

## Delivered

System now includes an Image search maintenance card with a labeled three-part
index checklist, status, automatic attempts, cooldown boundary and one next step.
It distinguishes waiting, running, verified, needs review, not needed and
unavailable. The new administrator-only GET `/api/stats/image-index-progress`
has no input dimensions or mutation counterpart.

The ESM implementation separates database observation, pure state projection,
route authorization, client API, presentation copy and the Vue card. Existing
worker limits, scheduler, schema, identities and deployment templates are unchanged.
The existing large System view gains only a component import and mount.

## Verification

- Focused backend tests: 41 passed, covering projection, connection failures,
  deadlines, concurrent-read coalescing, authorization and parameter rejection.
- Focused frontend tests: 37 passed, covering API calls, presentation, manual
  refresh, in-flight suppression, stale-success removal and unmount handling.
- Real PostgreSQL tests: 4 passed. They verify catalog flags, cooldown and budget
  preservation, failed/pruned tasks, unexpected definitions and cancellation of
  an actual concurrent index build. No observation enqueues or resets work.
- Chromium browser test passed with keyboard refresh and desktop, 390px and
  320px screenshots; the screenshots were visually inspected. The test asserts
  no API writes. Refresh uses `aria-disabled` plus a guarded handler to retain
  keyboard focus while suppressing duplicate requests.
- Full frontend coverage: 412 suites and 5,835 tests passed; statement coverage
  86.14%, branch coverage 78.80%, function coverage 85.59%, line coverage 88.05%.
- Lint, type checks, documentation lint, production build, CI preflight,
  naming/language/delivery/runtime-maintenance gates and ESM checks passed.
- Full backend coverage: 1,595 suites and 48,792 tests passed, with one existing
  skipped test. Statement/line coverage is 90.01%, branch coverage 85.29%, and
  function coverage 91.70%. The combined coverage ratchet passed without changing
  thresholds. The new backend report, projection and route have 100% line/function
  coverage; the observation service has 92.30% branch coverage and the projection
  and route have 100% branch coverage.

## Recommendations and tradeoffs

Use the existing bounded worker plus exact catalog inspection and the durable
episode ledger, exposed through a read-only administrator report. This improves
diagnosis without expanding repair authority, adding a deployment dependency,
or inventing a completion percentage. Manual refresh avoids another timer but
does not provide continuous progress updates.

Catalog verification establishes index readiness, not media-placement accuracy
or attribution of success to a particular queue job. Live build activity can
also come from an administrator; the UI attributes it to PostgreSQL, not to a
specific worker. Database statistics and transactional reads are observations
within a short window, not a durable event history. Cooldown expiry is only a
lower bound; readiness and attempt limits still apply. Restricted statistics
visibility does not justify inferring a running build from a queue claim.

The ownership review adds one explicitly read-only service classification;
existing unresolved writer debt is not waived. W3C-informed labels, a polite
status region and focus retention are tested, but this is not a complete WCAG audit.
Research links and alternative comparisons are in the
[design document](image-index-progress-design.md).

## PR and deployment scope

GitHub MCP search and the saved GitHub CLI login both returned no open PRs for
`cloudbyday90/Classifarr` on 1 October 2026. No PR was selected, applied or merged.
No release, version bump, tag or live-container update is part of this change.
Tests use mocks or disposable PostgreSQL data, never a configured media provider.

## Next item

Extend the existing resource-study tooling to measure the bounded worker on
representative large synthetic embedding tables:
build completion, peak memory, database waits and interrupted-build recovery.
Use those measurements to decide whether the current execution budget is adequate;
do not automatically raise retry limits or reset exhausted repair episodes.
