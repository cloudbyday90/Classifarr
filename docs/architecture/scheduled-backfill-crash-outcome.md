# Scheduled backfill crash outcome

## Scope

Implements the [crash acceptance design](scheduled-backfill-crash-design.md) with
small ES modules for observation, durable checkpoints and fixed Compose execution.
No production routing, release version or live inventory is changed by the drill.

## Verification

Two real isolated fresh-install/crash/restart runs passed. The final candidate
image was `sha256:746d6b8caf2b4db4fe0b0b871a6e914edfec7385e4f1086bb5455c656e0d4b19`,
with PostgreSQL 18.6 and 296 migrations. After SIGKILL, normal startup completed
exactly one metadata task for each of the four original supported inventory rows,
preserved both ingestion run IDs, acknowledged backfill and produced current
profiles. Music remained excluded and no routing task was created. Owned test
containers, volumes, networks and image tags were removed and cleanup verified.

The focused backend checks passed 93 tests in four suites. Backend unit coverage
passed 45,533 tests in 1,513 suites. Client coverage passed 5,652 tests in 402 files.
The coverage ratchet passed without changing its baseline. Lint, types, docs,
migration/schema integrity, dependency and ownership checks, ESM checks, the four
policy maintenance gates and the production client build passed. PostgreSQL
integration passed 2,181 tests in 190 suites; the existing opt-in AI-provider
Compose suite/test was skipped, not counted as passing.

A fresh-only result is not a published-upgrade result. The full acceptance command
produced a blocked version-3 receipt at preflight: GitHub CLI attestation access
still returns HTTP 401. Its provenance requirement has not been bypassed. No
release is created, and this synthetic scenario is not a media accuracy benchmark.

## Local deployment

After validation, rebuilt with `docker compose build --no-cache` through the smart
Compose wrapper with clean-revision provenance required. Recreated only Classifarr
with `--no-build --force-recreate --wait`. The healthy image is
`sha256:8c2fe703d58e4784b2ef153aa11377e1bce125e720eb62707311fd042aa7625e`,
revision `539fc0bb0a35deadd0ecb5cd7e29b35242493b55`. Subsequent documentation-only
commits record outcomes; they do not change the deployed runtime.

The local migration ledger advanced from 291 to 296. All ten libraries and 6,696
inventory rows remained present. Startup automatically acknowledged all eight
completed ingestion runs; observed metadata work drained without a new classification
task or new WARN/ERROR log. The early healthy window is not sustained-load evidence.
Backup, rollback and resource observations are in the
[resource assessment](runtime-resource-assessment.md).

## Next item

Benchmark resource-aware admission during mixed movie/TV ingestion and backfill;
separate expected waiting from failed work and retain a measurable recovery bound.
