# Source recovery fairness: outcome

Date: 2026-09-26. Unreleased; no release or deployment.

## Delivered

Fresh identity recovery now selects across source pages instead of spending its
budget on the first eight failures. The bounded ES-module planner ranks eligible
items by persisted attempt time: never attempted first, then oldest attempted,
with a stable source-key tie-break. The sync workflow owns buffering, cached-proof
reuse, final claims, persistence, and ordinary unresolved-item accounting.

The previous commit's lazy Command Center route and isolated rehearsal logging
remain intact. This change completes its documented recovery-fairness follow-up;
it does not add another dashboard or independent background queue.

No migration, dependency, public API, routing change, AI request, or larger retry
allowance was required. The existing eight-attempt budget and daily cooldown
remain. Successful proof reuse remains available during capture; fresh attempts
wait until source pages, collections and pruning complete successfully.

## Measured result

Each synthetic library contains 100 conflicted items. Thirteen eligible cycles
keep stable source order and simulate a provider outage. All provider requests
fail intentionally: this measures access to recovery, **not repair accuracy**.

| Scheduler | Distinct movies attempted | Distinct TV items attempted | Attempts per library | Limit per sync |
| --- | --- | --- | --- | --- |
| Previous source-order admission probe | 8 / 100 | 8 / 100 | 104 | 8 |
| New streamed workflow, PostgreSQL claims | 100 / 100 | 100 / 100 | 104 | 8 |

The baseline is the preceding commit's deterministic probe, not a new PostgreSQL
baseline run. The new test captures ten-item pages through the real observation
store, uses actual claim/outcome SQL, recreates scheduling objects each cycle,
and verifies cumulative distinct coverage after every cycle. Test SQL moves the
retry boundary into the past between cycles; production uses the database clock.
No test changes production cooldowns or calls real metadata providers.

A separate disposable PostgreSQL container verifies a real database restart
after a claim but before provider IO. The test checks a changed postmaster start
time, preserved cooldown, and—after eligibility returns—priority for eight
unattempted items over the interrupted attempt. Only synthetic test data is used;
the application container and persistent volumes are untouched.

## Validation

- Targeted unit tests: 119 passed across six suites. The new planner/workflow
  modules have 100% statement, line and function coverage and 95.77% branch
  coverage in the focused report.
- PostgreSQL integration: 22 tests passed across two suites, covering both
  movie/TV fairness benchmarks, actual restart, concurrent claims, stale evidence,
  superseded captures, inactive/deleted items, outcome fencing, and transactional
  rollback of failed repairs. Positive movie/TV cases commit verified repairs,
  reject changed-source controls, and reuse persisted receipts on a subsequent
  capture without another TMDb request.
- Sync fault tests verify that page, collection and pruning failures spend no
  fresh retry budget. Successful multi-page syncs without source totals retain
  correct processed/total counts, and final unresolved counts include the
  deferred candidates exactly once.
- Cached-proof reuse, failed persistence, bounded buffering, deterministic ties,
  duplicate-source replacement, cooldown/malformed priorities, and once-only
  drain are covered without real provider IO.
- Type checking and repository lint passed. Security lint retains the existing
  unrelated filesystem warning in `captureOperatorCorrectionFrozenPolicy.mjs`.
- The isolated library-profile upgrade rehearsal passed with eight synthetic
  movie/TV probes separated and two ambiguity controls retained. This is a
  regression check, not a measurement of classification accuracy.
- Documentation lint, copyright, static ESM imports, test mock shapes, and
  production dependency checks passed.
- Full frontend regression: 5,410 tests passed across 386 files; 85.83% statements,
  78.07% branches, 85.33% functions, and 87.85% lines. The frontend is unchanged.
- Full backend regression: 43,457 tests passed across 1,460 suites; 90.39%
  statements/lines, 84.44% branches, and 92.27% functions.
- The coverage ratchet passed with both current full reports. No coverage
  thresholds or baselines were changed.

## Boundaries and follow-up

GitHub MCP returned no open PRs for `cloudbyday90/Classifarr`; none could be
randomly selected or implemented. No closed/unrelated PR was substituted or
merged. No release, version bump, application rebuild, or live recovery ran.

Retained observation bounds and recurring successful scans still constrain
fairness. Continuous new/changed evidence can delay older work. Races can leave
unused slots; they never authorize extra attempts or bypass proof checks.
This is not a provider-wide rate limiter or a guaranteed completion date.

Follow-up implemented in the [recovery handoff outcome](source-recovery-handoff-outcome.md).
The originally recommended **provider-return recovery canary** uses the existing services.
In an isolated database, start with mixed movie/TV conflicts during an outage,
restore synthetic matching provider/source responses, and verify the whole path:
repair receipt → inventory metadata backfill → refreshed library profile.
Include a changed-source control that remains unresolved. Assert that reruns do
not duplicate backfill, unresolved inputs never enter learning, and routing/AI
budgets remain unchanged. This closes the recovery-to-learning handoff rather
than adding more status panels; it does not authorize live provider repairs.

See the [design and official research](source-recovery-fairness-design.md) for
pros/cons and the recommended stack: PostgreSQL evidence and guarded claims,
bounded streaming admission, the existing verifier, and modular sync integration.
