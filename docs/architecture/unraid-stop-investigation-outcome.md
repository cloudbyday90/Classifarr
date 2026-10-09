# Unraid unexpected stop investigation

Date: 2026-10-09. Scope: read-only inspection of the reported production stop.
No production settings, containers, databases or shared providers were changed.

## Findings

- The application recorded `Received SIGTERM, starting graceful shutdown` at
  16:45:22 UTC (12:45:22 PM Eastern). Docker collected that line at 16:45:27 UTC
  and retained a finished time of 16:45:28 UTC.
- The operator restarted the same container at 21:36:24 UTC (5:36:24 PM Eastern),
  consistent with the reported roughly five-hour interruption.
- Its configured Docker restart policy is `no`. It is now running and healthy.
- Current post-restart inspection shows exit code zero and `OOMKilled=false`.
  These are not a durable record of the previous exit and cannot independently
  exclude an earlier OOM event.
- The shutdown-window application search found no heap-fatal message. The
  retained host syslog search found no OOM-kill message. Historical Docker events
  returned no entries for the window; daemon logs did not identify the caller.
- The host stayed up. Its syslog records a container network interface being
  removed at 12:45:30 PM, consistent with the stop, not proof of its initiator.

The evidence supports a signal-driven shutdown, not a demonstrated memory crash.
It does **not** establish whether a person, backup, scheduler, updater or another
supervisor sent the signal. Installed automation alone is not evidence of blame.
Private host identifiers, credentials and raw production logs are not committed.

## Recommendation

First identify or capture the stop initiator. Review the operator's automation
history for this exact window; if history is unavailable, arrange bounded,
redacted Docker event and supervisor logging before the next occurrence.
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

Next item: close the stop-initiator evidence gap, then make the smallest verified
deployment or automation correction. No application crash fix is claimed here.
