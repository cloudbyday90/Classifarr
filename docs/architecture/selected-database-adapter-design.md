# Selected database process adapter

Date: 2026-10-04. Continues [selected startup](selected-database-startup-design.md).

## Decision

Add the fixed-path adapter for the separated PostgreSQL process, and stop the
compatible entrypoint before it can recursively chown a protected layout. Reuse
the startup deadline and supervisor; do not add another restart loop. Exercise
the adapter against the actual copied database in the disposable image drill.

The reserved layout is `/app/data/embedded-postgres`: root-owned ancestors and
configuration, a PostgreSQL-owned `candidate` directory and private `socket`
directory. It stays inside the existing appdata mount. No new Compose variable,
mount, API, dependency, schema, or release is required for this increment.

This is not automatic conversion activation. The current entrypoint cannot yet
run this layout safely: when it exists (including a dangling symlink), refuse
startup before provisioning or data writes. Ordinary legacy/fresh installations
without it keep their current behavior. Do not create it manually on a deployment.
The next entrypoint integration must choose the separated path before shared-UID
ownership changes, preserve major-version upgrade handling, and support explicit
non-root compatibility without attempting to manufacture privileges.

## Contract

- Trusted composition must hold the migration lease and reverify durable
  selection before invoking the adapter. The adapter is not an HTTP capability
  and does not choose a database from a request, environment variable, or PID file.
- Validate fixed directories, account separation, PostgreSQL version, protected
  regular configuration files and an empty auto-configuration file. Never follow
  links, accept arbitrary commands, remove a PID file, or repair permissions.
- Start one direct `su-exec`/PostgreSQL child with a constructed environment and
  fixed executable/configuration/socket arguments. Retain the child handle.
  Adopt only that child's matching PID/data-path/start-time identity after its
  native readiness marker; a ready marker is not application/schema readiness.
- One startup budget (300 seconds by default, existing bounded setting supported),
  serial reads and no retry relaunch. Cancellation prevents admission, joins the
  pending operation within one second, then fast-stops the owned child within
  twenty seconds. An unjoined operation or unconfirmed exit remains failure.
- Monitoring checks the retained child and unchanged PID identity. Shutdown
  signals only the direct child, observes exit, checks clean control state and
  absent PID file. No PostgreSQL SIGKILL, guessed PID, fallback or old-copy reuse.
- Normal completion means confirmed database shutdown after runtime/maintenance
  drain. It does not mean import recovery completion. That still means import
  plus metadata, without waiting for disabled optional AI work.
- Configuration/identity failures are permanent for that attempt; cancellation,
  deadline, process death and uncertain cleanup fail the container. Docker owns
  any later restart. No persisted retry budget or background polling is added.

The parent-held lease is not a fence against arbitrary older writers. Protected
production provisioning and database-enforced ingestion admission remain required
before unattended legacy recovery. Preserve the source and all inventory.

## Research and tradeoffs

Official pages discovered through web search and opened on 2026-10-04:

- [PostgreSQL shutdown](https://www.postgresql.org/docs/18/server-shutdown.html):
  SIGINT performs fast shutdown; SIGKILL bypasses normal cleanup. Observe exit
  before treating shutdown as complete.
- [PostgreSQL file locations](https://www.postgresql.org/docs/18/runtime-config-file-locations.html):
  `data_directory` can override `-D`. Pin data/config/HBA/identity locations on the
  command line, not just the working directory.
- [Node 24 child processes](https://r2.nodejs.org/docs/latest-v24.x/api/child_process.html):
  signal delivery and process termination differ. Retain the direct child and
  avoid a shell and inherited executable/configuration overrides.
- [Docker runtime permissions](https://docs.docker.com/engine/containers/run/):
  saved user/capability settings constrain the image. Non-root templates cannot
  silently acquire root provisioning authority.

| Choice | Advantage | Cost / risk |
| --- | --- | --- |
| Adopt any PID named by the candidate file | Less launch code | Does not prove process ownership; unsafe shutdown target |
| Own the direct fixed-path child — selected | Clear launch/cancellation/exit boundary, reusable supervision | Requires protected provisioning and lifecycle integration |
| Activate conversion at the same time | Earlier automation | Would bypass unfinished compatibility and writer-fencing checks |

Recommendation stack: prove this adapter and downgrade guard; implement protected
entrypoint provisioning/selection; finish writer fencing and unattended import
backfill; rehearse published-image upgrades and supported host profiles. This
backend-only change has no new browser interaction or accessibility claim.

## Acceptance

Test malformed/replaced identity, symlinks, unexpected file ownership, inherited
configuration, early/late cancellation, failed launch, shutdown uncertainty and
no concurrent operations. In Linux, use the real adapter for selected startup,
schema maintenance, restricted SQL, SIGTERM and independent data readback. Verify
the compatible entrypoint refuses the reserved layout without changing ownership.
Keep the fixture network-isolated and bounded; no live Unraid data is admitted.
