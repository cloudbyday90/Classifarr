# Recovery progress and startup readiness: outcome

## Delivered

The [design](inventory-recovery-progress-design.md) captures credential-wakeup,
queue-admission, provider-start and persisted-recovery milestones on the current
source case. The Metadata recovery view adds a visual stage breakdown, measured
recovery percentage, elapsed-time medians with denominators and one next step.
Existing pause, pagination, access revocation and on-demand Plex links remain.

Four scheduled inventory-learning services now wait before expensive work when
configuration or inventory is absent, ingestion is active, or foreground work is
due/running. Readiness resumes automatically through existing scheduler ticks.
The prior NULL retry-time busy-check gap is fixed. Recovery and ingestion remain
enabled; no retry cooldown, identity, routing or model approval was weakened.

## Validation

Validation on 2026-09-27:

- Frontend coverage run: 391 files, 5,506 tests passed.
- Full PostgreSQL integration run: 180 suites, 2,026 tests passed; one existing
  test/suite remains skipped.
- Chromium recovery-view check passed: visible counts and percentage, keyboard
  operation, pause/manual refresh, narrow viewport, access revocation and zero writes.
- Disposable production image built; fresh schema round-trip, migration naming
  and schema integrity checks passed. Backend/frontend type checks, lint, ESM
  guards, dependency-use checks, copyright and documentation checks passed.
- Backend unit/coverage rerun: 1,488 suites, 44,433 tests passed. The coverage
  ratchet passed for both workspaces without changing thresholds or baselines.

Security lint retains one pre-existing nonliteral-filename warning in
`captureOperatorCorrectionFrozenPolicy.mjs`; no new warning or error was introduced.

The initial full run exposed outdated temporary-table/trigger-count fixtures and
an asynchronous PostgreSQL advisory-lock-release race in a test. The fixtures now
match the schema and the disconnect test observes lock release before attempting
reacquisition. A CPU-heavy geometry test timed out under competing builds/test
runs and passed unchanged in isolation (five tests, 19.8 seconds); its timeout and
production work limits were not loosened.

All database/provider fixtures are synthetic. The live container and its private
data are not used or replaced. A separate disposable image verifies schema and
production build behavior. No dependency upgrade or version bump is included.

GitHub MCP found no open repository PR to select on 2026-09-27. No closed PR was
substituted and no PR was merged.

## Limits and next component

The chart is a bounded, retained current-case cohort, not a historical conversion
funnel or library-wide success rate. It starts collecting prospectively. Readiness
polls are cheap admission checks, not a promise that the platform is globally idle.

Next: add restart-recovery evidence for ingestion ownership. Reconcile stale
running/collecting markers against durable job ownership, expose the owning
blocker and verify recovery with an interrupted-first-import rehearsal. Do not
clear markers solely because they are old, and do not add another generic retry
loop. This closes the most important remaining fresh-install liveness question.

Acceptance checks for that next component:

- Interrupt the first paged import, restart, and resume from durable progress
  without duplicate items or enabling learning before ingestion completes.
- Distinguish an abandoned owner from a live replica; never steal active work
  or declare an incomplete capture complete solely to unblock learning.
- Show the blocking job and its recovery state, then prove automatic learning
  resumption without manual database edits or routing changes.
