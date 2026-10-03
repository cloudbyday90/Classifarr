# Loaded Container Shutdown Rehearsal

Reviewed: 2026-10-02. No runtime or deployment configuration change.

## Decision

Test the production entrypoint, Tini, application, scheduler and maintenance
broker together under actual Docker stop deadlines. Keep fault injection in
read-only, test-only fixtures, never in the production services.

The existing isolation drill covers idle stops, identities and a frozen app.
The new focused drill adds a real database-blocked HTTP request and a real
scheduled queue-maintenance assessment in flight at shutdown.

## Scenarios and evidence

| Application | Host timeout | Required result |
| --- | --- | --- |
| Responsive, request blocked until SIGTERM | 10 seconds | Request completes; worker joined; clean database; exit 0 |
| Responsive, request blocked until SIGTERM | 60 seconds | Same checks; no need to consume the full timeout |
| SIGSTOP while request is blocked | 10 seconds | Host kill; exit 137; no clean-stop claim; WAL recovery on restart |
| SIGSTOP while request is blocked | 60 seconds | Supervisor kills stuck app; database stops cleanly; exit 1 |

In every case, verify committed synthetic data survives and uncommitted data
does not. Check PostgreSQL control data offline before restarting, then check
health, recovery logs and the absence of a leftover maintenance worker.

A fixture invokes the already-registered cron task through a one-shot signal.
It does not replace its handler, alter admission or open a second handoff client.
An exclusive lock holds the real setup-status request and the worker's restore
gate read. Freeze the observed worker before its normal lock timeout expires,
so the supervisor must cancel and join it. This tests an interrupted assessment,
**not an admitted VACUUM or a completed repair**. Fresh setup must still refuse
unneeded maintenance; optional AI and media services stay unconfigured.
One disabled synthetic user makes the HTTP result distinguishable from the
route's database-error fallback; no credentials or login are used.

## Isolation and limits

Use a collision-checked random container and volume, a pinned local image ID,
no network, no published ports, a read-only root, a non-root user, dropped
capabilities, and bounded CPU, memory, PIDs, commands and polling. Only the fixed
fixture directory is mounted from the host, read-only. Never mount installation
data, secrets or the Docker socket. Always clean up owned resources, and fail
the drill if cleanup fails. Diagnostic output must identify the failed phase.

These are controlled faults on one local architecture, not physical slow-disk
tests, an ARM64 run, a NAS certification or a loaded release soak. A longer
application deadline cannot override Docker's shorter host deadline.

## Options and recommendation stack

| Option | Benefit | Cost / risk | Decision |
| --- | --- | --- | --- |
| Keep only unit/idle-stop tests | Fast | Misses PID 1 and work-in-flight ordering | Insufficient alone |
| Add fault flags to production services | Easy injection | Adds operational surface and shipping test branches | Reject |
| Disposable real-image rehearsal with mounted fixtures | Exercises actual signal and database boundaries | Extra CI time and Linux dependency | Adopt |
| Require users to edit saved templates | More shutdown time | Does not protect unchanged installations | Do not require |

Recommended stack: retain unit tests → run isolated loaded stops → verify
offline state and restart → repeat on the frozen release image and native ARM64.
Keep 60 seconds as the documented deployment recommendation, while testing the
failure/recovery behavior of older 10-second templates explicitly.

## Official research

- Docker sends the configured stop signal and then SIGKILL after the deadline;
  Linux's default is 10 seconds when no container override is configured.
  [Docker stop](https://docs.docker.com/reference/cli/docker/container/stop/).
- Installing Node signal listeners removes the default exit behavior; signal
  delivery is therefore not evidence that application work has stopped.
  [Node 24 process signals](https://nodejs.org/download/release/v24.20.0/docs/api/process.html#signal-events).
- PostgreSQL fast shutdown aborts active transactions and shuts down cleanly;
  immediate shutdown requires recovery. Verify state rather than inferring it
  from a sent signal. [PostgreSQL shutdown](https://www.postgresql.org/docs/current/server-shutdown.html).
- Keep operator instructions short, explicit and headed by the outcome. No UI
  changes or new WCAG-conformance claim are part of this backend rehearsal.
  [W3C writing guidance](https://www.w3.org/WAI/tips/writing/).

All links were located and checked through web tools, not inferred. Research
describes the available October 2026 documentation, not future releases.
