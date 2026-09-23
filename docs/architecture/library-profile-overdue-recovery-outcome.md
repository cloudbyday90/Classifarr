# Library profile overdue recovery — outcome

## Implemented

- Added a modular, fixed-vocabulary recovery assessment with a 15-minute
  diagnostic grace for due planning, due queue claims, and expired leases.
- Extended the installation-wide, single-statement upgrade snapshot with
  overdue counts, while keeping its source-identity and profile totals intact.
- Added the matching reason to the bounded per-library snapshot and a compact
  Command Center line only when overdue work exists. The detail disclosure
  explains the automatic path; a persistent signal points to worker health.
- Kept all retry and publication writes in the pre-existing durable planner
  and worker. No schema change, release, provider request, route-confidence
  change, or live-container restart is part of this change.

## Verification and caveats

Unit tests cover the timing boundary, all three reason codes, paused and clean
libraries, server contract, and client parsing. The disposable PostgreSQL
integration test confirms that reading the assessment does not enqueue work
and that the normal planner clears a synthetic overdue condition. Overdue
means the normal due clock is old enough to warrant attention, not that a
specific service failure has been proven. The per-library list remains a
200-library window; installation-wide counts are complete.

Validation on 2026-09-23: backend coverage suite 1,395/1,395 suites and
40,880/40,880 tests passed; integration suite 149 passed and one skipped
(1,717 tests passed); client coverage suite 375/375 files and 5,207/5,207
tests passed. Server typecheck, server/client lint, client production build,
copyright check, diff whitespace check, and the coverage ratchet passed.

The GitHub repository had no open pull requests when checked through the
GitHub connector on 2026-09-23, so there was no random open PR to implement or
merge locally in this pass.

## Recommendation

Keep the single durable recovery writer and treat the new read-only signal as
an operations diagnostic. Next, correlate the overdue reasons with a bounded
last-tick/queue-health assessment before considering any new automation.
