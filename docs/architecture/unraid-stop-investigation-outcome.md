# Unraid unexpected stop investigation

Date: 2026-10-09. Scope: read-only inspection of the reported production stop.
No production settings, containers, databases or shared providers were changed.
The deployed image reports source `7d94ef136c7a4b8d77ab0f4c10e38b271bb98268`
(`v0.49.1-beta` preparation); the relevant probe code matched the investigation
baseline `bce87b3e` before the diagnostic instrumentation below.

## Findings

- The supervisor first recorded `database_probe_waiting` with reason
  `database_probe_timeout` at 16:45:07 UTC. At 16:45:22 UTC it recorded `stopping`
  with reason `database_probe_grace_expired`.
- The application then recorded `Received SIGTERM, starting graceful shutdown` at
  16:45:22 UTC (12:45:22 PM Eastern). Docker collected that line at 16:45:27 UTC
  and retained a finished time of 16:45:28 UTC.
- The operator restarted the same container at 21:36:24 UTC (5:36:24 PM Eastern),
  consistent with the reported roughly five-hour interruption.
- Its configured Docker restart policy is `no`. It is now running and healthy.
- The supervisor recorded `application_stopped`, `database_stopped`, then
  `failed` at 16:45:28 UTC. This identifies the internal stop initiator; the
  application SIGTERM line alone would not identify it.
- Current post-restart inspection shows exit code zero and `OOMKilled=false`.
  These are not a durable record of the previous exit and cannot independently
  exclude an earlier OOM event.
- The shutdown-window application search found no heap-fatal message. The
  retained host syslog search found no OOM-kill message. Historical Docker events
  returned no entries for the window; daemon logs did not identify the caller.
- The host stayed up. Its syslog records a container network interface being
  removed at 12:45:30 PM, consistent with the stop, not proof of its initiator.
- PostgreSQL's own retained log shows a normal checkpoint at 12:42, then the
  supervisor's fast shutdown request at 12:45:28. The shutdown checkpoint took
  about 49 ms and PostgreSQL recorded `database system is shut down`. The next
  startup confirms that clean shutdown time. No FATAL/PANIC was found in the
  inspected shutdown window. This is not evidence that PostgreSQL crashed first.

The direct shutdown cause was the embedded database supervisor exhausting its
uncertainty grace period, not a demonstrated application heap crash or operator
stop. The earlier SIGTERM-only hypothesis is superseded by this supervisor trail.
Private host identifiers, credentials and raw production logs are not committed.

The monitor checks process liveness, not SQL readiness: identity-file reads plus
a `pg_ctl status` child. The child has a two-second deadline; the full check has a
three-second deadline and bounded cancellation/join. An uncertain result starts
a 15-second grace period, after which the supervisor drains the application and
stops the owned database. The incident image's timeout code does not distinguish child
startup/status latency from identity-file latency or event-loop scheduling delay.
The observed shutdown therefore establishes the trigger, not the underlying
source of the probe delay.

Five existing local probe/supervisor suites passed (89 tests). They confirm the
implemented timeout/drain contracts, not a reproduction of the production delay.

## Recommendation

First instrument and reproduce the probe delay: bounded per-stage timing,
deadline overshoot, cancellation/join outcome and host/container resource context.
Correlate PostgreSQL and host logs with the exact uncertainty window. Preserve
the first failure and recovery/stop outcome across restart, without raw payloads.
Do not relax memory safeguards or reset application recovery state.

Separately review whether this deployment should use `unless-stopped` and the
corresponding saved Unraid template setting. It improves recovery after an
unexpected process exit, but deliberately issued Docker stops suppress automatic
restart. A backup or update workflow must reliably start what it stopped, including
its failure path. Changing only the restart policy would not prove this incident
fixed. Deployment changes require a separate approval.

## Sources

Official sources discovered and reviewed on 2026-10-09:

- [Docker restart policies](https://docs.docker.com/engine/containers/start-containers-automatically/):
  `no`, `unless-stopped`, and the manual-stop exception.
- [Docker resource constraints](https://docs.docker.com/engine/containers/resource_constraints/):
  retain OOM protections and distinguish host/container resource pressure.
- [Docker daemon troubleshooting](https://docs.docker.com/engine/daemon/troubleshoot/):
  inspect daemon and host evidence instead of inferring cause from application
  availability alone.
- [PostgreSQL 18 pg_ctl](https://www.postgresql.org/docs/current/app-pg-ctl.html):
  status checks use the data directory and process identity; status code 3 means
  not running. A client-imposed timeout is not that definitive negative result.

Next item: distinguish a genuinely lost database from a slow liveness probe, then
make the smallest verified supervisor or deployment correction. No application
crash fix is claimed here, and no probe deadline was relaxed.

Follow-up: [bounded probe diagnostics](embedded-probe-diagnostics-design.md) now
implements stage attribution without changing the timeout decisions. Its
[separate outcome](embedded-probe-diagnostics-outcome.md) records verification;
this does not retroactively identify the original latency source.
