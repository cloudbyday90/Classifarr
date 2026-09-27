# Disposable restore recovery drill

## Decision

Add one repeatable, local Compose drill for the current candidate image. It uses
the real Node entrypoint, authenticated restore HTTP API, production backup
services and PostgreSQL. It never connects to the installed application.

The earlier restore-mode change established ownership and startup safeguards.
Unit tests and database session tests alone cannot demonstrate that these survive
an abruptly killed application process. This drill closes that specific gap.

## Safety boundaries

- Fixed Compose file; a fresh randomly named project; no command-line overrides.
- No published ports, host mounts, Docker socket mount or external networks.
- An internal network connects only the drill and its disposable PostgreSQL.
- Fresh database, random credentials, synthetic administrator and configuration.
- Refuse a nonempty database or an unexpected database name/host before seeding.
- Build the candidate from this checkout. Never retag, restart or reuse the live
  Classifarr container, its image tag, its backups or its data volume.
- Bound process waits and HTTP requests. Kill only child processes created by the
  drill. Tear down only its generated Compose project, including scratch volumes.
- Reports contain named checks and outcomes, not passwords, tokens or backup data.

## Scenario

1. Load the repository's full current schema and apply pending migrations; seed
   synthetic configuration and create a backup with the production exporter.
2. Start the real entrypoint in restore mode. Check authentication, restricted
   APIs and maintenance health.
3. Hold a database table lock late in the configuration transaction. Send a real
   restore request and wait for PostgreSQL to prove it is blocked by that lock.
4. Kill the owning Node process with SIGKILL. Verify the transaction rolled back,
   no success receipt appeared and the durable gate still blocks normal startup.
5. Start a new restore process and explicitly retry the same backup. Verify
   restored values, the ready gate and the durable verification receipt.
6. Confirm restore mode remains maintenance-only after success. Stop it, start
   normal mode and prove health plus rejection of a new restore in normal mode.
7. Remove the disposable containers, volumes and project network on success or
   failure. Cleanup failure must also fail the command.

No production fault hooks, sleep-based guesses about transaction timing, or
changes to routing/reconciliation authority are required.

## Official research, checked 2026-09-27

- [Docker project names](https://docs.docker.com/compose/how-tos/project-name/)
  document environment isolation: pass a unique project explicitly.
- [Docker networks](https://docs.docker.com/reference/compose-file/networks/)
  document `internal: true`: use it and omit host port publication. Build-time
  dependency downloads are outside this runtime network boundary.
- [PostgreSQL SQL dumps](https://www.postgresql.org/docs/18/backup-dump.html)
  distinguish logical backups from physical storage recovery. A Classifarr
  configuration restore is narrower still; this drill is not a full-database
  disaster-recovery or PostgreSQL major-version upgrade test.
- [PostgreSQL blocking-session inspection](https://www.postgresql.org/docs/18/functions-info.html)
  defines `pg_blocking_pids`: use the exact blocking session and SQL operation to
  establish the interruption point, rather than an arbitrary sleep.
- [Node child processes](https://nodejs.org/api/child_process.html) document direct
  executable/argument spawning, signals and timeouts. Use `shell: false`, fixed
  arguments and bounded child lifetimes, avoiding shell interpolation.
- [W3C status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages)
  support unambiguous programmatically available outcomes. This command reports
  explicit text/JSON check names, not color-only success. No UI changes or new
  WCAG conformance claim are made; a future UI must expose these statuses accessibly.

## Options and recommendation stack

| Option | Advantages | Costs / limits | Decision |
| --- | --- | --- | --- |
| More mocked tests | Fast, targeted regressions | Cannot prove process death and restart behavior | Keep as first layer |
| Disposable current-candidate drill | Real HTTP, database, locks and Node restart; no live data | Docker build/time; synthetic scenario only | Implement now |
| Published-image upgrade and recovery matrix | Verifies installation entrypoint and supported upgrade paths | Requires immutable image provenance and version-specific fixtures | Next layer |
| Live restore experiment | Real installation context | Unnecessary operational and data-loss risk | Do not use for development |

Final stack: focused ESM contracts → real PostgreSQL tests → this isolated
candidate recovery drill → immutable published-image upgrade matrix. Do not add
another orchestrator or workflow dependency for this bounded test.

## Acceptance and limits

All named checks and cleanup must pass before the command succeeds. An HTTP 200
alone is insufficient: persisted configuration, gate and receipt are checked.
This tests abrupt Node death during an uncommitted configuration transaction,
not host power loss, disk corruption, network partitions, every commit boundary,
or a browser interaction. The production shell entrypoint's bundled PostgreSQL
initialization/upgrade is outside this external-PostgreSQL drill.

See [execution outcome](restore-recovery-drill-outcome.md) for measured results.
