# Bounded Embedded PostgreSQL Startup

Date: 2026-10-02. Scope: embedded PostgreSQL 18 startup before application handoff.

## Finding and decision

The entrypoint used `pg_ctl start` with its implicit 60-second wait, followed by
a separate readiness loop. It also unlinked `postmaster.pid` unconditionally for
existing clusters. Slow startup could exhaust the first wait while PostgreSQL
was still working. Removing the native lock was unnecessary and could bypass a
useful check against competing postmasters.

Use one directly owned PostgreSQL child, one finite readiness budget and native
lock handling. The default is 300 seconds; an optional 1–1800-second setting
overrides it. This is an engineering default, not a PostgreSQL-prescribed duration.
It improves tolerance without pretending to fix slow or failing storage.

## Official-source research

Sources discovered through web search and checked on 2026-10-02:

- [PostgreSQL pg_ctl](https://www.postgresql.org/docs/current/app-pg-ctl.html):
  the usual timeout is 60 seconds; a failed wait can leave startup continuing in
  the background. Dispatch alone is not evidence of readiness.
- [PostgreSQL server startup](https://www.postgresql.org/docs/18/server-start.html):
  direct non-root invocation is supported, and the PID file protects the cluster
  against competing server instances. Its systemd example disables startup
  timeouts for potentially long crash recovery. This embedded-container policy
  deliberately retains a finite configurable wait; it does not claim every
  valid recovery will finish within that limit.
- [PostgreSQL shutdown](https://www.postgresql.org/docs/18/server-shutdown.html):
  SIGINT requests fast shutdown and joins child processes. Avoid SIGKILL for the
  database; normal lifecycle handling should retain durability.
- [PostgreSQL startup logging](https://www.postgresql.org/docs/18/runtime-config-logging.html):
  `log_startup_progress_interval` exposes long-running startup operations, normally
  at ten-second intervals. Logs aid diagnosis; they do not prove readiness.
- [PostgreSQL pg_isready](https://www.postgresql.org/docs/current/app-pg-isready.html):
  distinguish accepting, rejecting, no-response and invalid-attempt exit statuses.
  Connection readiness alone is not an authentication or schema-migration check.
- [Docker stop behavior](https://docs.docker.com/reference/cli/docker/container/stop/):
  host shutdown deadlines can force SIGKILL. Application code cannot extend a
  Docker daemon's stop timeout or rewrite saved deployment settings.
- [W3C concise writing](https://www.w3.org/WAI/tips/writing/) and
  [step-by-step instructions](https://www.w3.org/WAI/WCAG2/supplemental/patterns/o4p07-step-instructions/):
  use recognizable states and short next steps. Applied to documentation and
  diagnostic messages, not a new UI or a claim of WCAG conformance.

## Options and tradeoffs

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Only raise pg_ctl timeout | Small change | Weak direct-child ownership and cancellation; separate waits remain | Not sufficient |
| Wait indefinitely or renew on each log | Accommodates very slow recovery | An unhealthy disk can hold startup forever; logs are not liveness proof | Reject |
| Own one process and use an absolute deadline | Bounded work, direct cancellation, native locking, unchanged templates | Adds a small startup adapter and lifecycle tests; very slow recovery can still time out | Adopt |
| Rewrite the complete entrypoint as a supervisor | Could unify all startup phases | Much larger change spanning upgrades, permissions and schema import | Defer |

## Implementation and safety contract

Recommendation stack, in order:

1. `embeddedDatabaseStartup.mjs`: deterministic orchestration, validated deadline,
   monotonic elapsed time, cancellation and bounded cleanup.
2. `embeddedDatabaseStartupProcess.mjs`: fixed PostgreSQL 18 executable, fixed
   cluster path, bounded PID-file reads and local readiness probes. No shell
   interpolation or caller-supplied executable, cluster path or SQL.
3. `runEmbeddedDatabaseStartup.mjs`: short-lived non-root entrypoint helper,
   configuration preflight, signal handlers and structured status messages.
4. Existing shell startup and runtime supervisor: forward host cancellation,
   wait for readiness, then retain the existing application/maintenance lifecycle.
5. Disposable integration checks in normal Docker CI, not an optional skipped test.

The child runs with today's shared database identity. Root templates use su-exec;
forced-non-root templates keep their actual identity. There is no new resident
service, permission escalation, sidecar or required Compose field. PostgreSQL is
detached with file-backed logs so it survives the short helper's successful exit.

Readiness requires the launched PID, valid native cluster identity, port 5432,
native `ready` state, a successful local `pg_isready`, and matching identity on
readback. A different PID is never adopted or signalled. The native postmaster
must claim its own lock or exit. Permission/configuration errors remain failures;
connection rejection, no response and bounded probe timeouts remain waiting.

One-second polling is sequential. A probe has a two-second subprocess bound;
the overall deadline also interrupts pending reads/probes. Late success is
rejected. Waiting states report on transitions and every 15 seconds, without
extending the budget. Native PostgreSQL logs carry the recovery details.

On cancellation, process exit or deadline failure, no application handoff occurs.
The helper aborts pending probes, sends SIGINT only to its live owned child, and
joins for at most 20 seconds. Unconfirmed shutdown is reported explicitly and
exits failure; there is no SIGKILL escalation for PostgreSQL. A readiness helper
may be killed to enforce its own timeout. Failed container teardown is still
ultimately controlled by Docker, not by this promise of cooperative shutdown.

No inventory, routing, AI-readiness or library-ownership records change. There is
no migration, `pg_resetwal`, PID-file deletion or relaxation of fsync/checksums.
Raw subprocess errors/environment values are not added to structured messages;
the existing PostgreSQL diagnostic log remains the operator's detailed source.

## Boundaries and follow-up

The startup deadline excludes initdb, pg_upgrade, checksum conversion, schema
import and migrations. It cannot preempt blocked synchronous OS operations or
guarantee a clean shutdown from uninterruptible kernel I/O. Host health checks
still report application unavailability during recovery; never mark an unready
application healthy merely to placate an auto-healer.

Next, apply the same distinction between confirmed process death and temporary
probe unavailability to the **runtime database monitor**, with a finite grace
window and identity-preserving shutdown. Keep that change separate: the current
runtime monitor still treats a failed status probe as fatal. Follow with an
isolated slow-I/O rehearsal and the small PostgreSQL client dependency update.
