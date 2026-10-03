# Bounded Database Adoption and Shutdown

Reviewed: 2026-10-02. Builds on the bounded runtime monitor.

## Decision

Bound the complete adoption and shutdown operations, not just subprocess waits.
Adoption gets five seconds; shutdown gets twenty-five seconds. Each may spend
one additional second joining cancelled work. These fixed budgets do not renew
after partial progress and are not new deployment settings.

Adoption means verifying the embedded PostgreSQL process before supervising it;
it is not library-ingestion ownership or permission to recover a legacy writer.

## Safety contract

- Read only the fixed PID file, with a 2 KiB limit and regular-file checks.
  On Linux, do not follow a final symlink or block opening a FIFO. Check the
  cancellation signal before and after each asynchronous filesystem operation;
  always attempt to close an acquired file handle.
- Commit the adopted PID/path/startup-epoch identity only after the bounded
  read/status/read sequence succeeds. No late read can grant ownership.
- Serialize controller calls. Failed adoption/shutdown invalidates that
  controller; late completion cannot revive it or start another command.
- Propagate host shutdown into pending adoption. Do not start application or
  maintenance work after cancellation, and do not blindly stop an unadopted DB.
- Keep PostgreSQL fast shutdown and its twenty-second native wait. Bound the
  helper to twenty-two seconds; join actual helper exit/closed output before
  proceeding. Require clean control data and an absent PID file before reporting
  clean shutdown; a reappeared PID file is not assumed to belong to us.
- Cancel only the owned helper, never send SIGKILL directly to PostgreSQL.
  A timed-out stop can already have signalled the server, so timeout means
  **unconfirmed**, not rollback, clean stop or permission to retry.
- Bound helper output, use fixed executables/arguments, no shell and no secrets
  in helper environments. Diagnostic exceptions cannot interrupt cleanup.

An OS request can remain blocked after JavaScript cancellation. If joining
fails, report uncertainty and exit nonzero; no further database command is
authorized. Timers are event-loop bounds, not hard real-time kernel guarantees.
The host's stop deadline still takes precedence.

This keeps the existing same-user trust and PID-file identity model. It is not
new privilege separation or a kernel-held process-identity fence.

## Modules

`embeddedDatabaseOperation.mjs` provides the non-renewing deadline and join.
`embeddedDatabaseIdentityFile.mjs` provides the bounded fixed-path read.
`embeddedDatabaseShutdownCommand.mjs` accepts only stop/control-data operations.
The existing controller retains identity authority and serializes operations;
the existing supervisor retains application/maintenance drain ordering.
Runtime probe grace policy and PostgreSQL startup behavior remain unchanged.

## Options and recommendation stack

| Option | Benefit | Cost / risk | Decision |
| --- | --- | --- | --- |
| Keep command-only timeouts | Least code | Filesystem reads and cancellation can still wait indefinitely | Replace |
| Race a timer and abandon work | Fast return | Late work may issue commands or grant authority | Reject |
| Deadline, cancellation, bounded join and terminal state | Bounds waiting without granting uncertain ownership | More lifecycle tests; uncertainty can require host teardown | Adopt |
| Force-kill PostgreSQL to meet a deadline | Shorter apparent stop | Skips clean shutdown and requires recovery | Reject |

Recommended stack: bounded identity read → verified adoption → existing runtime
monitor → drain application/maintenance → identity-checked fast stop → clean
control-data confirmation. No new services, privileges, dependencies, schema
changes, mounts or Compose/Unraid/Synology template edits are required.

## Official sources

- PostgreSQL says a timed-out `pg_ctl` operation may continue in the background;
  it is not proof of completion. [pg_ctl](https://www.postgresql.org/docs/current/app-pg-ctl.html)
- Preserve fast shutdown and avoid direct SIGKILL of the database process.
  [PostgreSQL shutdown](https://www.postgresql.org/docs/18/server-shutdown.html)
- Node distinguishes sent signals from process exit and stream closure.
  [Child processes](https://nodejs.org/api/child_process.html)
- File cancellation cannot interrupt every OS request. File flags and size
  bounds complement, not replace, deadline/join handling.
  [Node filesystem documentation](https://nodejs.org/download/release/v24.20.0/docs/api/fs.html)
- A container's configured stop timeout may be shorter than the application's
  budgets. This image does not change that host setting.
  [Docker stop](https://docs.docker.com/reference/cli/docker/container/stop/)
- Keep operator messages concise and recovery steps explicit. This is writing
  guidance, not a new UI or WCAG conformance claim.
  [W3C writing guidance](https://www.w3.org/WAI/tips/writing/)

These are official sources discovered and checked in October 2026. Validation
must include stalled reads, late results, host cancellation, helper exit versus
signal delivery, real PostgreSQL shutdown, and committed-data preservation.
Injected filesystem delays do not prove performance on physical slow storage.
