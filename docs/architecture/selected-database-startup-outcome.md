# Selected database startup outcome

Date: 2026-10-04. See [design, tradeoffs and official sources](selected-database-startup-design.md).

## Delivered

A small ESM composition now revalidates durable selection inside the existing
supervisor's adoption phase. Cancellation is forwarded and checked before
database launch. Schema maintenance is mandatory before restricted runtime;
the existing supervisor retains monitoring and ordered shutdown responsibilities.

The disposable legacy-copy drill holds the journal lease across this lifecycle,
runs the actual schema maintenance command as the database OS identity, and
checks a committed write using a restricted-role runtime probe. A separate
process attempts the lease while runtime is alive and sends an actual SIGTERM;
the worker verifies the database stopped before leaving its lease scope. Another
startup and the existing read-before-write probe check persistence independently.

Ordinary startup, saved templates, permissions, fresh installs and live library
records remain unchanged. This is not production activation or a new background
daemon. The recovery skill kept unknown ownership blocked; the release-evidence
skill requires the final image to be tested separately from source-only checks.

## Validation

- Focused startup/supervisor/migration checks: seven suites, 155 passing tests
  and one Linux-only filesystem test skipped on Windows.
- Full backend unit suite: 1,681 suites passed; 51,790 tests passed and one
  platform-specific test skipped, in 284.276 seconds.
- Backend lint and type checks, copyright (1,518 files), both dependency-usage
  checks, ESM import/mock-shape checks and Markdown lint (1,884 files) passed.
  One new test helper initially returned from a Promise executor; it was
  corrected and lint rerun successfully, without changing any rule.
- Ownership review passed after reviewing the two modified fixture files and
  four new composition/fixture dependencies. Counts: 19 owned, 264 separately
  coordinated and 502 unresolved. No unresolved writer was reclassified.
- No full client suite, coverage ratchet or published-image upgrade rerun is
  claimed. There is no frontend behavior change; the image's frontend build
  passed.

Clean-source no-cache image build completed from
`61a86995f35c540509fa633bb8b3cc7c10cf80c3`. Exact local Docker image ID:
`sha256:a1ba73361c0ef32d08ec76dc8d1aec54999dda4806c94684065012ab8e74391d`.
The OCI source label matches. This local image ID is not a published registry
digest. The same image passed all 12 core isolation checks, including the new
selected-startup lifecycle inside the legacy migration check. Core duration was
132,969 ms; orchestrator peak RSS was 93,960 KiB, not total container memory.
The new subprocess assertions verified actual schema maintenance, a restricted
runtime write, a competing lease refusal while runtime was alive, real SIGTERM,
confirmed database shutdown before lease release, independent restart and the
unchanged cold source.

Standard forced-non-root `1000:1000`, root-start custom `2345:2345` and Unraid-style
`99:100` profiles all passed unchanged startup, on-demand maintenance, clean
restart and data-preservation checks. Observed stop times, including verification,
were 2,409 ms, 2,361 ms and 2,561 ms within their existing ten-second host budgets.
Unexpected Node exit, database loss and forced host termination recovery passed.
All owned test containers, volumes and image aliases were removed and cleanup
verified; synthetic data is regenerable. The caller image was retained.

### Local replacement and schema snapshot

Recreated only local Docker Desktop's `classifarr` Compose service using that
tested image, without rebuilding it again. The replacement became healthy and
returned HTTP 200 from `/health`. The live Unraid installation and its separate
database were untouched. Subsequent source edits only record these results.

At 159 seconds of PostgreSQL uptime the container remained healthy, with zero
restarts, OOM events or recorded startup errors. There was one existing
`legacy_owner_unknown` warning for Movies (library 5); its six legacy running
markers remained unchanged. Family retained its completed 864-item import.
This is not evidence of completed ownership recovery or metadata backfill.
Node was 24.21.0, PostgreSQL 18.6 and pgvector 0.8.7. The latest resource sample
was 3.52% CPU, 423.1 MiB of the existing 2 GiB memory limit and 48 PIDs. CPU and
PID limits remain unset in this saved local setup; a startup sample is not a
sustained resource bound or a leak test.

After replacement, `dumpSchema` used a disposable, network-isolated PostgreSQL 18
instance from the same image. Loading the current schema, dumping, reloading in
a second fresh database and dumping again produced zero drift. The tracked schema
did not change and no migration was added. The owned scratch container was removed.

## Remaining work

The saved GitHub CLI login returned no open Classifarr PRs on 2026-10-04, so no
random PR could be implemented. No PR merge or release is part of this work.

Next: a fixed-path production start/adopt adapter and capability-aware entrypoint
that preserve forced-non-root compatibility. Complete privileged maintenance and
database-enforced ingestion-writer admission before enabling unattended legacy
recovery. The source database must remain intact; unknown ownership must not be
silenced or replaced with fabricated owners. Recovery ends after import and
metadata backfill, not optional disabled AI work.

The tests use a synthetic PostgreSQL 18 legacy cluster and restricted SQL probe,
not the full application against a published old-image database. No physical
Unraid/Synology, power-loss durability or sustained resource-soak claim is made.
