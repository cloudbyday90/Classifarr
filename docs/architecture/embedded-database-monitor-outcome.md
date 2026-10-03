# Embedded PostgreSQL Monitor Outcome

Date: 2026-10-02. See the [design, sources and tradeoffs](embedded-database-monitor-design.md).

## Delivered behavior

Three small ESM modules separate the status helper, bounded check and recovery
window. The supervisor tolerates recognized temporary probe failure without
restarting healthy processes, but still drains on concrete identity/process
failure. A cancelled check must finish before any database stop command.
There are no new dependencies, schema changes, privileges or template settings.

## Validation

Focused Windows tests: **183 passed in eleven suites**, including the refreshed
static ownership-review gate. Focused Linux tests: **149 passed in eleven
suites**, none skipped, including the directory-fsync/source-preservation case
that is Linux-only. Both use Node 24.21.0. Unit cases cover identity changes
before/after a probe, missing/denied identity reads, concrete status failure,
cooperative and stuck cancellation, late success, non-renewing deadlines and
application/database shutdown ordering. A diagnostic sink failure cannot turn
an unjoined probe into permission to issue a database stop.

A disposable AMD64 overlay image contains the changed runtime modules on the
previously validated Node 24.21.0/PostgreSQL 18.6 baseline. Image ID:
`sha256:8fb9f2e7c044a15a7672ff1a27b2abc15421b8b13d84a3bea87bcb6595ee5db8`.
This is a local test image, not a release or deployment.

The new real-PostgreSQL rehearsal passed all four scenarios:

1. A real stalled status-helper process times out and is observed exiting.
   A subsequent check recovers without changing the database identity or
   restarting the application child.
2. Repeated helper timeouts exhaust the original fifteen-second grace window,
   log the wait transition once, and drain the application before the database.
3. An actually stopped database fails without receiving transient grace.
4. Host cancellation joins the pending helper before database shutdown.
   Committed sentinel data survives subsequent starts, with `fsync` enabled.

The harness has no network or host database mounts, one CPU, 512 MiB RAM,
128 PIDs, a read-only root and disposable tmpfs storage. It refuses an existing
database. A small real Node child stands in for the application; these checks
do not claim complete product-workload or physical slow-storage coverage.
CI now runs it against the image built by that CI job.

Repeat against a locally built candidate image (the commands create only
disposable test state):

```sh
IMAGE_NAME=classifarr:test npm run docker:smoke:postgres-monitor
IMAGE_NAME=classifarr:test npm run docker:smoke:postgres-startup
IMAGE_NAME=classifarr:test npm run docker:smoke:pgss
```

The previous delayed-start/crash-recovery drill also passed on the same image:
65-second delayed readiness, native live-owner lock refusal, WAL recovery,
startup deadline/cancellation, invalid configuration and Alpine entrypoint
signal forwarding. This was rerun, not carried forward from an older result.

The four existing entrypoint smokes also passed on that final image: fresh
installation without pg_stat_statements runtime files, existing-cluster
recovery, PostgreSQL 17→18 upgrade/config normalization, and explicit diagnostics
for an invalid included configuration.

Broader validation on Windows Node 24.21.0/npm 12.2.0:

- Final backend coverage run: **1,628 suites, 49,738 tests passed**; one existing
  Linux-only test skipped on Windows and passed in the Linux run above. The
  final run used four workers with a 512 MiB worker-idle recycling threshold.
- Frontend coverage: **416 files, 5,912 tests passed**, none skipped.
- Backend line coverage: **90.05%**, branches **85.43%**. Frontend lines:
  **88.09%**, branches **78.92%**. The coverage ratchet passed without lowering
  thresholds.
- Repository lint, backend/frontend type checks, both Knip checks, copyright,
  npm CLI flags, ESM import/mock-shape checks and all 28 tooling tests passed.
- The ownership gate initially rejected changed source hashes. After reviewing
  the controller/supervisor boundaries, their explicit records were refreshed;
  the gate and final complete test run passed. No unresolved inventory writer
  was reclassified as safe or granted new authority.
- Markdown lint checked all **1,773 files** with zero errors; diff whitespace
  checks passed. The final code uses ESM only.

The first coverage run overlapped the final diagnostic-sink safeguard. Its
results were superseded by a complete clean rerun after code changes stopped;
the numbers above describe that final run, not mixed-source coverage.

## Delivery boundaries and next work

GitHub MCP and the saved GitHub CLI login both returned **zero open Classifarr
PRs**. There was no PR available to select, apply or merge.

The existing Classifarr container remained healthy with restart count four.
Only temporary test containers and their synthetic test volumes were removed;
that data is discarded and reproducible. Live data, media, services and saved deployment
configuration were not changed. No version bump or release is created.

Next: bound identity reads and command joining during database adoption and
shutdown. Keep identity refusal and fast-stop semantics, then rehearse the
whole lifecycle under controlled storage delay. Native ARM64 execution and a
same-image loaded release rehearsal remain separate acceptance work.
