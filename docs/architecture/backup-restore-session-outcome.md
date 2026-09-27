# Restore session ownership: outcome

Date: 2026-09-27. Scope: restore-only ownership and interrupted-attempt recovery.

Follow-on: see [restore-mode outcomes](restore-maintenance-mode-outcome.md) for
the subsequently implemented restart-based maintenance boundary. This document
retains the validation results and limitations of the session-ownership change.

## Delivered behavior

- A competing restore is rejected before any gate or configuration writes.
- The lock, gate changes, configuration transaction, verification, and final
  completion/receipt transaction share one database connection.
- Connection loss prevents subsequent queries from that owner. Session termination
  rolls back its open transaction. Already committed configuration is not undone.
- A later explicit restore request can reclaim an interrupted, protocol-marked
  attempt after obtaining the exclusive lock. Recovery never marks the database
  ready without the existing verification and completion path.
- Legacy/unknown in-progress gates remain blocked, because they do not prove
  participation in this locking protocol. No time-based ownership stealing occurs.
- Failed failure-recording cannot hide the original restore error. An uncertain
  commit is not automatically replayed. Escaped transaction/session callbacks cannot
  submit later writes through their closed adapters.

The new `backupRestoreSession.mjs` owns connection lifetime and exclusion;
`backupRestoreExecution.mjs` owns the restore/verify/complete workflow. Both are ESM.
The public success shape and in-progress reason remain unchanged. No migration,
dependency addition, settings change, release, live restore, or container rebuild
is part of this change.

## Validation

- Focused unit tests: 231 passed across 23 suites.
- Isolated PostgreSQL backup tests: 73 passed across 5 suites, including 8 new
  session-ownership cases (contention, legacy refusal, recovery, future timestamps,
  rollback, termination, and atomic completion receipts).
- Termination tests target only the connection created inside a disposable suite
  database. No real library metadata or provider configuration is used.
- Full backend regression: 43,639 tests passed across 1,465 suites; line coverage
  90.42%, branch coverage 84.48%. The session module has 100% line coverage.
- Full frontend regression: 5,410 tests passed across 386 files; line coverage
  87.85%, branch coverage 78.07%. Frontend production build passed.
- Coverage ratchet, server/client type checks, server lint, dependency checks
  (normal and production), ESM static-import/mock-shape checks, copyright, changed
  document checks under repository rules, and whitespace checks passed.

Additional audit limits: the repository-wide production naming gate reports 49
pre-existing references across 18 production files. All 18 files were compared with
HEAD and are unchanged by this patch. The product-language, delivery-term and
runtime/release-maintenance audits pass. Strict Markdown checks pass for the two new
documents; README's 4 and CHANGELOG's 16 strict findings are unchanged from HEAD.
Server lint retains its existing non-literal-filename warning in
`captureOperatorCorrectionFrozenPolicy.mjs`. No baselines were weakened.

## Operator implications

If another restore is active, wait for it to finish. After an interrupted attempt
created by this protocol, an explicit retry can establish new ownership. A retry
starts a new restore; it does not resume at an unverified checkpoint or silently
enable routing. Investigate older stuck gates rather than manually deleting them
or assuming that elapsed time proves the prior owner stopped.

Do not interpret this change as permission to restore while ordinary writers are
active. It serializes restore requests only; unrelated queue workers, Discord
handlers, backfills, timers and providers do not yet participate in a global barrier.
Verification remains the existing native-policy/schema checks, not proof of every
platform subsystem or external destination.

## Next recommendation

Implement the full maintenance operating mode, then run a disposable end-to-end
restore drill. Recommended stack: pinned restore session (delivered), dedicated
restore mode with ordinary workers disabled (pending operating-mode choice),
verification followed by a controlled restart and readiness checks.

Dedicated mode provides the clearest initial safety boundary but requires a restart.
An online drain avoids that restart but requires tracking every writer and detached
task before it can be trusted. Neither mode has been enabled or silently substituted
for the existing endpoint. See the separate [design and tradeoffs](backup-restore-session-design.md).

## Pull-request selection

The repository's open-PR search returned no candidates during this work. No closed
PR was substituted, no PR was merged, and no unrelated change was fabricated.
