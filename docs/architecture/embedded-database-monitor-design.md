# Bounded embedded database monitoring

Reviewed: 2026-10-02. Scope: runtime process monitoring after PostgreSQL adoption.

## Decision

Keep one serial monitor. Allow only recognized status-helper timeouts and
temporary process-resource errors a fixed recovery window. Concrete process
death, missing or changed identity, permission errors and unknown failures
still request application drain immediately. Docker retains restart authority.

The previous monitor stopped the application after any failed check. A busy
host could therefore turn a short monitoring failure into an unnecessary
database restart. Retrying every error would instead conceal unsafe ownership
changes. Neither behavior is appropriate.

## Contract

- Check every five seconds after the previous check finishes; never overlap.
- Bound the read-only `pg_ctl status` helper to two seconds and the complete
  identity/status/identity check to three seconds. Cancellation waits up to
  one additional second for completion, including actual helper exit.
- Allow fifteen seconds from the first recognized transient result, measured
  with a monotonic clock. Further failures do not renew that deadline. Clip
  subsequent waits/checks to the remaining budget; reject late success.
- Only `EAGAIN`, `EMFILE`, `ENFILE` from helper creation and explicit probe
  timeout results qualify. Identity reads and other failures are not broadly
  retried. Revalidate the adopted PID, data path and startup epoch after a
  successful helper or recognized transient failure.
- On host shutdown, cancel the check and begin application drain immediately.
  An unjoined check forbids another database command and causes a nonzero
  supervisor exit. Container teardown remains the last-resort boundary.
- Cancellation can kill the owned, read-only status helper, never PostgreSQL.
  Normal database shutdown still uses the existing identity-checked fast stop.

These are event-loop deadlines, not hard real-time guarantees during a frozen
process or kernel I/O stall. A completed status check proves process liveness,
not SQL readiness or successful work. Existing health checks, transaction
errors and work-admission controls remain authoritative during the brief
uncertainty window; this change neither bypasses them nor reports SQL health.

## Modules and compatibility

`embeddedDatabaseStatusProbe.mjs` owns the fixed shell-free helper and its exit.
`embeddedDatabaseProbe.mjs` owns cancellation, joining and failure classification.
`embeddedDatabaseMonitor.mjs` owns the recovery window and transition logs.
The existing controller owns database identity and stop authority; the
supervisor owns application drain ordering.

There are no new dependencies, environment variables, mounts, template edits,
database migrations or API/UI contracts. Existing Compose, Unraid and Synology
installations get the behavior when they deploy the updated image. No service
is restarted internally, and external database mode is unchanged.

## Alternatives and recommendation stack

| Option | Benefit | Cost / risk | Decision |
| --- | --- | --- | --- |
| Stop after every probe error | Smallest policy | Avoidable restart cascades under temporary pressure | Replace |
| Retry every error | Fewer stops | Can conceal death, permission and identity changes | Reject |
| Typed transient grace with bounded join | Tolerates short uncertainty without broadening authority | More lifecycle tests; failure detection can be delayed within the bound | Adopt first |
| Separate SQL readiness policy | Better dependency diagnostics | Broader health/work-admission design; process status alone cannot supply it | Keep existing behavior; review separately |

Recommended stack: fixed helper → bounded check → typed recovery window →
existing ordered drain → host restart policy. Follow up with bounded adoption
and shutdown identity I/O, then a same-image slow-storage/resource rehearsal.

That follow-up should test a stalled identity read, cancellation during
adoption, changed identity before fast stop, and unconfirmed helper exit.
It must preserve the rule that no unverified process is signalled. Also retain
the old-template host-timeout rehearsal: an in-process deadline cannot extend
Docker's configured stop window. [Docker stop behavior](https://docs.docker.com/reference/cli/docker/container/stop/)

## Official guidance

- PostgreSQL documents `pg_ctl status` exit 3 for a server that is not running
  and exit 4 for inaccessible or unspecified data. Neither is treated as a
  transient retry here. [PostgreSQL pg_ctl](https://www.postgresql.org/docs/current/app-pg-ctl.html)
- Kubernetes separates startup, liveness and readiness and warns that poorly
  tuned liveness checks can cause cascading restarts. We apply that distinction,
  not its orchestration implementation. [Probe guidance](https://kubernetes.io/docs/concepts/workloads/pods/probes/)
- Node distinguishes signalling a child from observing its exit. Use a fixed
  executable and argument array without a shell, and join the helper after
  cancellation. [Child processes](https://nodejs.org/api/child_process.html)
- Keep diagnostic transitions concise and provide clear recovery steps rather
  than repeated technical messages. This is documentation guidance, not a new
  UI or a WCAG conformance claim. [W3C writing tips](https://www.w3.org/WAI/tips/writing/),
  [W3C step-by-step instructions](https://www.w3.org/WAI/WCAG2/supplemental/patterns/o4p07-step-instructions/)

These are living official sources checked in October 2026, not frozen historical
snapshots. Validation results are recorded separately in the outcome document.
