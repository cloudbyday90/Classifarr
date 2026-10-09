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

The first full backend run passed 54,809 tests and failed only the stale ownership
record above; the corrected ownership suite passes all 39 tests. The clean full
rerun passed **1,762 suites / 54,810 tests** in 391.744 seconds, with one existing
Linux-only directory-fsync test skipped on this Windows host. No new skip was
introduced, and the skip is not counted as behavioral evidence.

## Image and local evaluation

- Final clean image source: `8a8a4f455d5aa51560d907a7beee10a8a3c8337f`.
- Docker Engine image ID:
  `sha256:c3e1afd39395c40454c3e4d4eae0ef17f969f73ffe36373b6bba9a8e4e5872c3`.
- Built with `docker-compose-smart.mjs build --no-cache --require-provenance`
  using the existing local Compose override and AVX2 selection. The earlier
  no-cache build at `b8eb2743` was superseded after the review-record correction.
- `check-pg-stat-startup-smoke.mjs --runtime-monitor` passed against this exact
  image: a real stalled helper exited on cancellation; recovery retained the
  application and database identity; repeated timeouts consumed the actual
  unchanged 15-second grace period; a truly stopped database failed immediately;
  host cancellation joined its helper before database shutdown. Committed
  sentinel data survived the restart sequence with `fsync` enabled.
- The rehearsal also verifies correlated waiting/recovery/stop diagnostics,
  `status_wait` timeout attribution, first-failure retention and bounded payload
  size. It uses a synthetic small application child and synthetic helper stalls,
  not the full application workload or a recreation of Unraid storage contention.
  It has no external network or production mounts, and its tmpfs container was
  removed successfully.
- Recreated only the local `classifarr` Compose service with the existing data and
  media mounts. At 22:47:26, 22:47:56 and 22:48:26 UTC it reported healthy, HTTP
  200, zero restarts and `OOMKilled=false`. Its supervisor recorded maintenance
  completion and normal supervision, with no probe diagnostic episode in the
  inspected startup window. This is a short startup check, not a sustained soak.
- Ran `check-schema-snapshot-container.mjs --dump` after the rebuild. Fresh
  migrations and schema dump passed; `database/schema/current.sql` is unchanged.
  Verified removal of its disposable container and temporary host data.

Unraid, its restart policy, shared Ollama and the unrelated local Harmoniarr
container were not changed. These checks do not certify a production upgrade.

## Remote checks

For implementation source `8a8a4f45`, OSV, Trivy, Gitleaks, CodeQL and copyright
checks passed. [CI/CD](https://github.com/cloudbyday90/Classifarr/actions/runs/38000703863)
and [resource regression](https://github.com/cloudbyday90/Classifarr/actions/runs/38000703514)
were still running when this record was prepared. Local success is not a claim
that those remaining remote jobs passed. The final documentation-only commit
does not change the tested image's runtime source.

## Limits and next item

This instruments the known stop trigger; it does not establish why Unraid's
original probe was slow. The next investigation should capture a diagnostic
episode from an approved deployment, correlate its stage/overshoot with host and
PostgreSQL logs, and only then choose a targeted behavior or deployment fix.
Do not increase deadlines or disable safeguards to hide the symptom.

No historical timeout can be reconstructed from new telemetry. Logs survive
ordinary restarts subject to retention, not necessarily container recreation.
