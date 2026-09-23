# Profile-refresh worker health — outcome

## Delivered

- Added a one-row operational progress table and a modular, validated atomic
  writer for fixed cycle outcomes, last full success, and claim/completion counts.
- Instrumented the existing scheduler without changing planning, claims,
  retries, routing, or profile-publication authority. Telemetry write failure
  does not mask the original worker result.
- Extended the installation-wide readiness snapshot with claimable queue count,
  oldest due age, and bounded worker health. The compact Command Center line
  appears only when automatic profile recovery is overdue.
- Cleared the operational progress row on replace restore and regenerated the
  fresh-install schema snapshot from a disposable local image.
- No release or live-container restart was performed.

## Schema reconciliation finding

An interim snapshot already marked the new migration as applied before the
last-success column was added. Re-dumping that snapshot did not run the altered
migration, so it falsely retained the old table shape. The checked-in snapshot
was reconciled to include the column, and the migration also performs an
idempotent column add for an earlier in-development table. The disposable
schema check now passes. A future gate should replay from the prior released
baseline, rather than trusting a possibly stale current snapshot.

## Verification and limitation

Unit and disposable PostgreSQL integration tests cover the status vocabulary,
privacy boundary, atomic singleton upsert, and read-only queue correlation.
Client tests cover parsing and concise UI presentation. A recent completion
can be for a different request type or library, so the status says that the
worker made progress, not that every overdue library is healthy. There was no
open pull request in `cloudbyday90/Classifarr` when the GitHub connector was
queried; none was merged or copied locally.

Validation on 2026-09-23: backend coverage suite 1,396/1,396 suites and
40,915/40,915 tests passed; integration suite 149 passed and one skipped
(1,718 tests passed); client coverage suite 375/375 files and 5,208/5,208
tests passed. Targeted server and client tests passed after the final
queue-age, last-success, and shared-vocabulary adjustments. Server/client typecheck and lint,
client production build, copyright check, fresh-schema container check, diff
whitespace check, and coverage ratchet passed.
