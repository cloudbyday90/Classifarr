# Protected runtime and one-shot restore dispatch

Date: 2026-10-05. Continues [maintenance handoff](selected-maintenance-handoff-design.md).

## Decision and boundary

Connect the real application to the verified selected database under the separate
application OS identity. Add an internal, explicit normal/restore composition:
normal runs schema maintenance before the restricted application; restore runs
only one admitted maintenance operation and stops PostgreSQL after joining it.
Never start a web server, scheduler or provider in the one-shot restore branch.

The caller must hold the migration journal lease and verify the selected database,
identities and protected application directories. This is a reusable integration
component, not production entrypoint activation or an unattended ownership reset.
Existing forced-non-root Compose/Unraid templates keep their compatible path.

## Contract

- Fixed packaged executable, socket, database, runtime role and default writable
  directories; constructed environment, no shell or inherited database secrets.
  Actual separate named OS accounts and exact environment are checked before any
  database/service import. Refuse dotenv files. No caller-selected executable,
  arbitrary path, public mode flag or privileged online broker is added.
- The runtime keeps existing authentication, read-only schema readiness, pinned
  normal-runtime admission and fail-stop on admission loss. It has no DDL or role
  ownership. PostgreSQL peer authentication enforces the OS-to-database mapping.
- Normal runtime is long-lived, with a 1 GiB Node heap and five-connection pool;
  supervisor shutdown owns TERM/KILL and database join ordering. No lifetime cap
  on application logs or accidental maintenance timeout is applied to the server.
- Restore input is a nonempty Buffer of at most 64 MiB, supplied on stdin to the
  existing 180-second one-shot worker. The caller owns and clears it after the
  session finishes. Schema retains its 900-second bound. Existing SQL exclusion,
  durable quarantine, input validation and bounded discarded output remain intact.
- Only clean maintenance completion is success. Cancellation, nonzero exit,
  uncertain process exit or shutdown failure cannot become successful restoration.
  No write replay, retry loop or saved cooldown is introduced. Normal startup
  still requires successful schema assessment after a verified restore.
- Fresh installs need no new work. Optional AI jobs do not affect completion.
  Unknown ingestion ownership remains blocked; existing inventory is preserved.

Custom paths, environment-provided encryption keys, production dispatcher activation
and a restricted restore HTTP handoff remain deferred. This internal default-only
composition is not selected by the saved template, so it cannot silently discard
those existing settings. Complete those compatibility checks before activation.

## Research and options

Official sources discovered through web search and opened on 2026-10-05:

- [PostgreSQL 18 peer authentication](https://www.postgresql.org/docs/18/auth-peer.html)
  uses the kernel-reported local OS identity; a username environment variable alone
  is not an isolation boundary.
- [Node 24 child processes](https://r2.nodejs.org/docs/latest-v24.x/api/child_process.html)
  documents constructed environments, shell-free spawning and exit versus close.
  Drop identity before loading the application and join actual processes.
- [Docker Compose services](https://docs.docker.com/reference/compose-file/services/)
  documents a default ten-second stop grace period. Test unchanged saved profiles;
  do not assume existing installations receive new Compose fields.

| Option | Benefit | Cost / risk |
| --- | --- | --- |
| Keep only the database probe | Smallest change | Does not establish real application compatibility |
| Real restricted runtime plus one-shot restore — selected | Tests actual admission and process ordering | Not yet an operator-facing production conversion |
| Give restore HTTP the database owner identity | Easy reuse | Expands online authority; rejected |
| Activate conversion immediately | Unattended rollout now | Custom settings and writer isolation are not yet fully integrated |

Recommendation stack: real restricted runtime and one-shot restore; compatibility
validation and restricted restore HTTP handoff; production dispatcher; complete
database-enforced ingestion fences; unattended legacy recovery and published-image
upgrade rehearsal. No new UI interaction is introduced in this batch.

## Acceptance

Unit tests must reject bad identity, environment, mode and request before imports
or effects, and prove no runtime after restore, cancellation or maintenance failure.
An isolated real-image fixture must exercise health, authentication, normal-runtime
SQL exclusion, one-shot restore, return to normal mode and joined shutdown while
retaining the original database and migration lease. Record outcomes separately.
