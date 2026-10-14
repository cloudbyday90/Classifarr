# First-time AI verification pending-backfill outcome

Date: 14 October 2026. Unreleased; no version bump or release.

## Findings and implementation

Unraid had scheduled invocations before the administrator's manual verification,
but retained no waiting reason. Their millisecond duration and absence of a saved
probe show that an invocation finishing did not mean verification ran. The exact
historical blocker is unknown. Discovery-job collisions at the minute boundary
are a reproducible risk, not a proven historical cause.

The [design](ai-readiness-pending-backfill-design.md) is implemented with staggered
minute opportunities, a configuration-bound singleton waiting observation, and
read-only status presentation. Missing evidence remains the pending-work marker;
any saved test ends this sweep. Memory, inventory, ownership, manual-result
precedence and configuration checks remain unchanged. No page visit or extra
approval is needed for this first test.

The UI distinguishes display refresh, background observation and saved test time.
It does not start work while rendering. Waiting logs use a bounded fixed-reason
map because the existing info logger does not implement deduplication options.
Diagnostic storage or logging failure cannot change the capability result.

## Validation

- Focused backend and tool-contract rerun: 7 suites, 116 tests passed, including
  the changed worker/projection and unchanged Knip/ownership contracts.
- Isolated PostgreSQL and real HTTP handler: 11 tests passed. Covered persisted
  waits, repeat-write throttling, stale settings, concurrent/manual winners,
  settings/shutdown races, saved failed verdicts and read-only status responses.
  This handler fixture does not claim new authentication middleware coverage.
- Focused frontend: 2 suites, 35 tests passed.
- Schema generated from an isolated, network-disabled PostgreSQL 18 container
  with the new migration; its temporary container and data were cleaned up.
- Type checking, dependency preflight, migration/schema integrity and ESM gates
  passed. Ownership review covers only the changed worker, scheduler, diagnostic
  modules and empty migration/schema addition; existing unresolved ownership
  debt remains unresolved. No safety baseline was relaxed.

Full coverage, immutable-image rehearsal, local replacement and final source
references will be recorded after those checks complete. Initial parallel test
runs hit Knip startup and client ESLint-hook timeouts; no assertion or timeout
limit was weakened. The ownership gate also correctly rejected unreviewed source
drift before the explicit review recorded above.

## Scope and next item

The current open-PR search returned zero, so no PR was selected or merged.
Unraid, Plex and the shared Ollama server were not changed. This work does not
retest old failed/expired results or guarantee admission under sustained load.

The separate [reviewed-repair retry design](queue-repair-automation-design.md)
and [outcome](queue-repair-automation-outcome.md) specify persistent explicit
consent, cancellation, cooldowns and preserved attempt limits. That automation
is not enabled. Next implement its consent/claim/cancel repository and prove
concurrent PostgreSQL behavior before connecting a worker or enrollment UI.
