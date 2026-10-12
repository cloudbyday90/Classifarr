# Health observation freshness: design

Date: 2026-10-12. Follows [explicit health summaries](system-health-summary-outcome.md).

## Evidence and decision

Health probes save `lastCheck` when they finish, including observed failures.
Queue checks use `timestamp`. System polls a cached endpoint every 30 seconds;
the default heartbeat runs every 15 minutes. The detailed-services endpoint has
a separate 30-second response cache. A new response timestamp proves neither
that the heartbeat ran nor that each returned service was checked recently.
Heartbeat stop retains cached results, and the selected interval is not exposed.

| Option | Benefit | Cost/risk |
| --- | --- | --- |
| Force provider checks on every page poll | Recent responses | More provider traffic and overlapping work; changes admission behavior |
| Expire everything after the 30-second HTTP cache TTL | Simple | Incorrect for normal 15-minute heartbeats |
| Project freshness from check time and actual cadence (chosen) | Honest uncertainty without additional work | Requires explicit historical/effective status and client handling |

## Recommendation stack and contract

1. Add a small pure ESM freshness projector. Use the service's completed-check time,
   never `lastSuccessfulCheck`, cache-read time or response receipt time. For *arr
   instances use each instance's own time, not the group's later completion.
2. The freshness budget is the last configured heartbeat interval plus 30 seconds
   of scheduling grace. Equality with the deadline is expired. This is an
   application policy, not proof a failed or delayed scheduler will recover.
   Expose interval, grace, budget, heartbeat-active flag and evaluation time.
3. Preserve raw cached statuses and database-focused readiness/HTTP semantics.
   Add `effectiveStatus` and `freshness` to detailed observations. The detailed
   service-list status and its aggregate use the effective status. Overdue or
   missing/invalid/future check times become unknown, not healthy or failed.
   Explicit inactive configuration remains inactive; it is not connectivity proof.
4. Retain the last reported result and exact UTC check/deadline for operator
   inspection. Show specific guidance for overdue checks, paused heartbeat and
   unverifiable time. A fresh failed check remains unhealthy; an expired failed
   check becomes unknown while its last reported failure remains visible.
5. Stopping preserves the selected interval; it does not immediately invalidate a
   still-recent observation. Starting replaces the interval (omitted means default).
   Reset/process restart returns to the default. Validate intervals before
   scheduling: internal whole milliseconds 1 second–24 hours; HTTP whole minutes
   1–1,440 (omitted means 15). Reject malformed/overflow values without starting a
   timer or triggering checks. Do not let Node turn them into a 1 ms interval.
6. Client consumes server freshness; no client wall-clock comparison or new timer.
   The existing poll updates it. Missing freshness from an older backend is
   conservatively unknown for active services. Failed polling still labels all
   retained results unavailable. Do not announce a changing timestamp every poll.

No schema, persisted retry budget, ownership lease, provider write, AI request,
automatic recovery, new polling loop or changed readiness probe is introduced.
Existing explicit refresh/start operations retain their existing side effects;
freshness projection itself is pure and cannot trigger them. The existing detailed
endpoint may run provider checks on its cache miss; this change does not expand it.
Restart begins with unknown cache entries and the normal default interval. No work
is backfilled on a fresh installation. Authentication and memory limits remain.

Unknown metadata is not an invitation to retry indefinitely. The operator can
request one existing Refresh action; if checks stay overdue, review heartbeat and
server logs. Configuration-revision fencing and overlapping probe completion
ordering are separate work, not claims made by timestamp freshness.

## Official sources

Discovered and read through MCP on 2026-10-12:

- [Kubernetes Pod conditions](https://kubernetes.io/docs/concepts/workloads/pods/pod-condition/)
  distinguish probe time, transition time and unknown status. Our inference is to
  expose the observation's age separately from response receipt/readiness.
- [Node.js timers](https://nodejs.org/api/timers.html) do not promise exact callback
  timing and coerce invalid/out-of-range delays to 1 ms. Our bounded grace and
  pre-scheduling validation follow from those constraints, not a Node-defined TTL.

## Verification and limits

Test expiry boundaries, missing/invalid/future time, disabled/fresh setup, fresh
failures, last-success versus last-check, repeated reads without timestamp renewal,
configured cadence changes, paused heartbeat, *arr instance timestamps and legacy
clients/servers. Verify no projection I/O, mutation or timer admission on bad input.
Cover both HTTP contracts and real UI status/recovery wording, then fresh coverage,
quality gates, exact no-cache local image, isolated schema dump and read-only local
checks. Record outcome separately. No release, Unraid/Plex/shared Ollama change.

GitHub MCP currently reports zero open PRs; none is available for random selection.
