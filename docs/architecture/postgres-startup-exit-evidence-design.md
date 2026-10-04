# PostgreSQL startup exit evidence

Date: 2026-10-04. Scope: embedded PostgreSQL startup and isolated failure receipts.

## Problem and contract

The previous routing investigation reproduced an intermittent PostgreSQL startup
exit, but not its native error. Successful reruns do not establish a repair.
`observeEmbeddedChild` already captures the direct child's exit code and signal;
`runEmbeddedDatabaseStartup` discards them when racing readiness against exit.
Consequently a native refusal, signal termination and unexpected clean exit all
produce the same `database_startup_process_exited` report.

Preserve an allowlisted exit tuple on that failure report and through the existing
sanitized container lifecycle collector. Observe only the child actually launched
by this attempt. Do not inspect, signal, adopt or delete anything based on a PID
read from disk. A log observation remains diagnostic, not admission authority.

Prerequisites and bounds:

- This diagnostic portion adds no service, subprocess, disk read, network request,
  retry or persisted state. The separately documented
  [PID-reuse fix](postgres-startup-pid-reuse-design.md) adds bounded preflight reads.
  Fresh installs use the same single startup attempt and readiness criteria.
- Retain the existing absolute startup deadline (default 300 seconds, maximum
  1800), cancellation, and 20-second fast-shutdown join. Do not renew budgets.
- Keep only a mutually exclusive integer exit code in 0–255 with null signal, or
  a null code with a recognized terminating POSIX signal. Reject malformed tuples.
- Include details only for an observed direct-child exit during startup. A failed
  spawn, timeout, cancelled attempt or probe failure must not acquire an invented
  native exit cause. Diagnostic failure must not replace the original failure.
- Success remains native readiness plus a bounded connection probe and identity
  readback. Failure remains failure; no automatic relaunch or PID-lock bypass.
- Retain existing collector byte, line and event limits. Never retain raw errors,
  process arguments, credentials, paths or PostgreSQL log contents in receipts.

## Alternatives and recommendation stack

| Option | Benefit | Cost / limitation | Decision |
| --- | --- | --- | --- |
| Retry until CI passes | Fast green result | Conceals an intermittent failure | Reject as a repair |
| Delete a stale-looking PID file | May permit startup | Can defeat PostgreSQL's competing-server protection | Reject |
| Preserve the already-observed exit tuple | No new I/O; distinguishes refusal from signal termination | Native SQL/configuration errors may still need private logs | Implement |
| Replace the startup supervisor | Could change process layout | Broad change without a reproduced cause | Defer |

Recommended stack: direct-child ownership → native PostgreSQL lock → unchanged
bounded readiness → exact exit evidence on failure → sanitized receipt → verified
fixture cleanup. Next, reproduce the underlying native refusal and test a targeted
repair. Do not conflate this with legacy media-import ownership in the application
database, or with another installation using the same Plex server.

## Official research

Sources discovered through web search and opened on 2026-10-04:

- [PostgreSQL 18 startup](https://www.postgresql.org/docs/18/server-start.html)
  documents the PID-file interlock and retaining server output to diagnose startup
  failures. Resource and socket failures have distinct causes.
- [PostgreSQL 18 shutdown](https://www.postgresql.org/docs/18/server-shutdown.html)
  distinguishes fast shutdown from immediate termination. Forced kill is confined
  to disposable fault injection, never the normal shutdown policy.
- [Node child-process events](https://nodejs.org/download/release/v26.8.2/docs/api/child_process.html)
  documents separate exit code and signal observations and failed-spawn errors.
  This current reference is not the runtime version; tests use pinned Node 24.21.0.
- [Patroni's process implementation](https://github.com/patroni/patroni/blob/v4.1.5/patroni/postgresql/postmaster.py)
  explicitly checks process identity before handling PID reuse. This illustrates
  why blindly removing a lock is unsafe; no Patroni workaround is copied here.

## Verification plan

Unit tests cover clean/nonzero/signalled startup exits, invalid tuples, absent
spawn identity, cancellation and timeout races, no details on successful startup,
and sanitized receipt projection/formatting. Extend the existing disposable
PostgreSQL fixture to distinguish a real lock refusal from an injected signal,
while verifying the live competing server and committed sentinel remain intact.
Rebuild local Compose without cache, run the image fixture and routing rehearsal,
and dump/round-trip the schema only on an isolated database. Record actual results
separately; neither a passing rehearsal nor this patch proves the historical root
cause or authorizes an Unraid deployment.
