# Embedded database probe diagnostics outcome

Date: 2026-10-09. Implementation baseline: `bce87b3e` on `main`.
No release, production deployment or restart-policy change.

## Implemented

The [design](embedded-probe-diagnostics-design.md) is implemented as a small ESM
collector connected to the existing identity/status probe and supervisor logger.
`database_probe_diagnostic` records correlate the first uncertainty, recovery,
cancellation or terminal failure by episode ID, with last healthy/first failed/
latest probe references. Numeric stage timings, deadline overshoot, join outcome
and supervisor-only resource context contain no raw child output or error payloads.

Existing liveness decisions, deadlines, ownership checks, process shutdown and
memory safeguards remain unchanged. No schema migration or backfill is needed.

## Verification before image build

- 20 targeted suites / 326 tests passed, including the existing supervisor,
  selected-deployment and startup-smoke contracts.
- Slow identity reads before/after status, child spawn/wait, late success,
  cancellation and unjoined operations retain the original failure decisions.
- Episode IDs, first-failure retention, last-healthy references, bounded output,
  ignored late callbacks and throwing diagnostic sinks are covered.
- Backend type checking, scoped ESLint and both Knip checks passed. An initial
  diagnostic-options typing error was corrected before these final checks.
- [Random PR 555](pr-555-node-types-outcome.md) was applied locally and rejected
  by the existing runtime-major guard. Restored dependencies pass 40/40 tooling
  checks; no dependency upgrade or remote PR change is retained.
- The broader suite exposed stale ownership-review fingerprints for the two
  instrumented database adapters and supervisor logger. Reviewed their unchanged
  admission, identity, readiness, shutdown and maintenance authority; amended
  only those three fingerprints and their existing rationales. The offline gate
  now passes with no new writes or production-compatibility claim. No unresolved
  classification or analysis digest was changed.
- Documentation lint, copyright and bootstrap secret scanning passed.

Image build, isolated real PostgreSQL rehearsal, local replacement and schema
dump are pending at this source checkpoint. Their exact artifact and outcomes
will be recorded after execution; unit tests alone do not establish those results.

## Limits and next item

This instruments the known stop trigger; it does not establish why Unraid's
original probe was slow. The next investigation should capture a diagnostic
episode from an approved deployment, correlate its stage/overshoot with host and
PostgreSQL logs, and only then choose a targeted behavior or deployment fix.
Do not increase deadlines or disable safeguards to hide the symptom.

No historical timeout can be reconstructed from new telemetry. Logs survive
ordinary restarts subject to retention, not necessarily container recreation.
