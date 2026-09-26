# Zero-inference evaluation window progression: outcome

## Implemented

September 25, 2026. The [design](zero-inference-window-progression-design.md)
addresses the scheduling coupling identified after commit `0e28288f`.

- A small ESM progression service accepts only strict current reports for fully
  accounted 25-item-or-tail windows. Automatic decisions and exact cached responses
  can complete a window without a capture allowance. Invalid cached responses
  remain measured failures; missing/unavailable evidence does not become success.
- The existing automatic worker rechecks current evidence and cursor ownership
  under its shared admission lock and deadline. Only candidates for advancement
  incur this additional bounded snapshot read.
- The repository saves report, history and guarded cursor movement together.
  Revision plus offset comparisons prevent duplicate, late and wraparound saves
  from advancing twice. A transaction failure leaves all three unchanged.
- Pending unpublished capture and unrelated publication markers remain intact.
  Matching published progress can be consumed; existing expiry/future-clock
  retention rules still apply. Checkpoints are not deleted merely to unblock work.
- Disabled/exhausted inference budgets, reservations, quota date, capture status
  and cooldown stay unchanged. No provider client, routing operation, training,
  public API change or database migration is introduced by progression.
- Existing movie/TV scope, frozen-cohort bounds, history retention, admin-only
  aggregate reads and nonpersistent pausable SWR summary remain unchanged.

## Verification

Focused validation completed:

- Eight backend suites / 148 tests passed, covering current and legacy reports,
  automatic/mixed/cached/invalid outcomes, partial/empty/tail/shrunken windows,
  input drift, cancellation and transition validation.
- Three PostgreSQL suites / 36 tests passed. These include ten concurrent attempts
  advancing once, restart and wraparound fencing, configuration changes, retained
  unpublished checkpoints, matched publication consumption, retention expiry,
  exhausted allowances and forced transactional failure.
- A real isolated-worker/database fixture with capture disabled evaluated 25
  cached pairs, resumed at the remaining 23 missing pairs after restart, and then
  wrapped only after those responses were supplied synthetically. Invalid output
  stayed invalid in history. Movie/TV cohort, library items and policies were
  unchanged; an inserted music item was excluded.
- Existing enabled-capture interruption recovery still passes: attempts stay
  charged, responses resume from checkpoints, evaluation consumes the completed
  publication, and the next capture uses the new cursor without double rotation.

Full frozen-patch checks completed:

- Backend: 1,440 suites / 42,662 tests passed. Statements/lines 90.35%, branches
  84.21%, functions 92.22%. Both new progression services have 100% statements,
  lines, branches and functions covered in the unit run.
- PostgreSQL: 163 suites / 1,891 tests passed, with one existing suite/test skipped.
- Frontend: 383 files / 5,338 tests passed. Statements 85.73%, branches 77.84%,
  functions 85.30%, lines 87.79%. The combined coverage ratchet passed.
- Chromium: existing keyboard-pause, mobile disclosure and access-loss clearing
  scenario passed. No UI change was necessary.
- Production client build, type checks, development/production dependency checks,
  copyright, static ESM imports, migration/schema validation and docs lint passed.
- Lint passed with the pre-existing nonliteral-path warning in
  `captureOperatorCorrectionFrozenPolicy.mjs`; no new warning was introduced.

All evaluation data is synthetic; no live inference, routing, library mutation or
container deployment is part of this work. No classification-quality gain is
inferred from these tests.

## Recommendations and tradeoffs

Retain ESM services → existing isolated replay/admission → PostgreSQL transactional
publication → protected aggregate API → nonpersistent Vue SWR. This keeps durable
progress close to evidence and avoids a new queue or authorization path. The cost
is a second bounded snapshot read for completed windows and conservative blocking
when unpublished capture or missing evidence remains.

Official PostgreSQL locking, AWS retry/idempotency and W3C auto-update guidance,
with discovered source URLs and project-specific rationale, is recorded in the
design. The existing keyboard pause and disclosure remain the accessibility
boundary; automatic evaluation is not permission to change UI focus or routing.

There is no schema upgrade or release. Older binaries can read the unchanged
cursor/report contracts, but do not implement the new zero-inference progression.
Use normal deployment backups; do not delete retained evidence on upgrade.

## Next component: coverage-first, inference-free sweep

Follow-up implementation and verification are now recorded in the
[inference-free coverage sweep outcome](inference-free-coverage-sweep-outcome.md).
The rationale and acceptance criteria below describe the handoff from this change.

The next useful step is a **bounded coverage planner across the frozen cohort**.
This change intentionally holds an incomplete window. Consequently, a missing
response near the beginning can still hide later deterministic or already cached
opportunities. Increasing inference budgets is not a sound workaround.

Acceptance criteria for the next component:

1. Visit every window of the existing at-most-300-item movie/TV cohort over bounded
   worker ticks, with zero inference and zero routing writes. Music stays excluded.
2. Separate diagnostic sweep progress from resumable AI capture ownership. Retain
   unfinished request checkpoints and do not silently rotate them away.
3. Persist bounded evidence gaps by revision and distinguish actionable missing
   cache, unsupported paths and invalid output. Do not claim gaps as completed
   pairs or use successful-only filtering to inflate quality.
4. Prove restart, source/configuration drift, retention, cancellation and concurrent
   worker behavior with a cohort containing early misses and later complete cases.
5. Use the resulting coverage/gap evidence to select one measurable AI experiment
   with independent labels. Reuse the current summary rather than add another panel.

## PR and release scope

Two GitHub MCP queries for open PRs in `cloudbyday90/Classifarr` returned an empty
list on September 25, 2026. No PR was available to select randomly or implement.
No PR was merged or closed. No release, tag, version bump or live deployment was
performed.
