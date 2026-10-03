# Embedded PostgreSQL Startup Outcome

Date: 2026-10-02. See the [design and tradeoffs](embedded-database-startup-design.md).

## Delivered behavior

The entrypoint now waits for one owned PostgreSQL process using a finite
300-second default budget. It preserves PostgreSQL's native PID lock, reports
wait phases, and forwards cancellation before the application starts. Invalid
timeout configuration fails before directory provisioning. No template change,
new resident worker or optional-service enablement is required.

## Validation

Focused orchestration, process-adapter, CLI, existing database-control,
supervisor and startup-smoke unit tests: **114 passed in eight suites**, none
skipped, on Windows Node 24.21.0. Cases cover delayed readiness, absolute
deadlines, late results, stuck probes, cancellation, invalid settings, changed
identity/port, permissions, probe timeouts and unconfirmed shutdown.

A disposable Linux AMD64 overlay image used the existing production runtime
baseline (Node 24.21.0, PostgreSQL 18.6) plus the changed startup files. This was
not a new release build or a live deployment. The new drill uses no network,
one CPU, 512 MiB RAM, 128 PIDs, a read-only root filesystem and disposable tmpfs
database storage. It refuses an existing database directory.

Final local image ID:
`sha256:dc698fba40136e851dd51c93068bf42798a372662c596d4aff5ec4ba3df1a370`.

Real PostgreSQL checks passed:

- A 65-second process pause exceeded the old default and still became ready
  without launching a replacement. This simulates a startup delay, not disk I/O.
- A competing startup failed without changing or signalling the original live
  postmaster; its native PID file and committed sentinel stayed intact.
- Immediate shutdown followed by WAL recovery preserved committed data, with
  `fsync` still on. Immediate shutdown is disposable fault injection only.
- Deadline expiry and cancellation stopped the owned child; a subsequent start
  preserved the sentinel.
- Invalid PostgreSQL configuration failed before application handoff.
- The actual entrypoint startup function under Alpine sh forwarded TERM and INT
  and waited for the test helper's exit. A first harness attempt tried to execute
  a launcher on noexec tmpfs; the corrected test invokes the installed Node binary
  directly and leaves mount protections unchanged.

The existing four entrypoint smokes also passed: fresh install without
pg_stat_statements runtime files, existing-cluster recovery, PostgreSQL 17→18
upgrade with config normalization, and explicit failure diagnostics for an
invalid included configuration. Both smoke commands now run in Docker CI.

Broader validation on Windows Node 24.21.0/npm 12.2.0:

- Backend unit coverage run: 1,624 suites and 49,641 tests passed; one existing
  Linux directory-fsync test was skipped on Windows. The final focused run above
  also includes the three subsequently added smoke-harness cleanup tests.
- Linux focused rerun: all nine suites and 119 tests passed, none skipped,
  including that directory-fsync/source-preservation test and the final startup
  tests. It used the existing Linux validation image with read-only source mounts,
  one CPU, 1.5 GiB RAM and 256 PIDs; no installation data was mounted.
- Frontend coverage run: all 416 files and 5,912 tests passed, none skipped.
- Coverage ratchet passed without baseline changes. Backend line coverage was
  90.05%, branch coverage 85.42%; frontend line coverage 88.09%, branches 78.92%.
- Repository lint, server/client type checks, both server Knip checks, copyright,
  npm CLI flags, ESM static-import and mock-shape checks passed.
- Inventory ownership gate passed with no new unreviewed drift. Its existing
  unresolved writer paths remain unresolved; this is not production approval.
- Markdown lint checked all 1,771 files with zero errors; shell syntax and staged
  diff whitespace checks passed. New runtime modules use ESM only.

The running Classifarr container stayed healthy with its existing restart count
of four. Disposable smoke containers and database volumes were removed. No
live database shutdown or forced restart was used for validation.

## Delivery and remaining work

GitHub MCP search and the saved GitHub CLI login both returned **zero open
Classifarr PRs**. No random PR was available to implement, and none was merged.
There is no release, version bump, dependency update or live container rebuild.
No production database, media files or saved deployment settings were modified.

Next: harden the runtime database monitor against bounded transient probe
failures, without treating missing identity or confirmed process death as healthy.
Actual sustained slow-storage behavior, native ARM64 execution and the complete
frozen release rehearsal remain separate acceptance work.
