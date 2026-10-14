# First-time AI verification: pending work and waiting status

Date: 14 October 2026. Supersedes the scheduling and visibility portions of
[the upgrade-backfill design](ai-readiness-upgrade-backfill-design.md).

## Evidence and scope

Read-only Unraid checks found scheduled invocations before the administrator's
05:33 Eastern manual test, finishing in milliseconds without a saved probe.
Only that manual result was retained in the 30-day outcome aggregate. The old
runner called deferred invocations completed and discarded their reason. We
cannot reconstruct the exact historical blocker. Multiple discovery jobs share
the minute boundary and the same one-at-a-time admission permit; repeated
collision is a reproducible risk, not a proven account of every missed check.

A missing saved capability timestamp already represents durable pending work.
Do not mark it complete on resource refusal, fabricate readiness, clear existing
results, or require browser visibility/another approval. A first-time fixed
capability test is different from retrying a classification or routing request.

## Implementation contract

- Keep startup opportunity after two minutes. Change periodic opportunities to
  second 17 of each minute with 0–10 seconds of jitter and no overlap, avoiding
  the usual second 0/30/45 discovery starts. At most one scheduled check per
  minute plus the single startup opportunity; process single-flight and existing
  PostgreSQL session ownership still bound actual concurrent probes to one.
- Keep all existing inventory/ingestion/queue prerequisites, discovery memory
  reserve, hysteresis, capacity and concurrency safeguards unchanged. No model
  work on an unconfigured/fresh installation. Sustained unsafe conditions may
  still defer work; scheduling is an opportunity, not a guaranteed deadline.
- Existing successful, failed, expired and changed-model checks remain outside
  this missing-result sweep. The first recorded probe verdict stops automatic
  probing. No model pulls, paid fallback, media prompts or routing writes.
- Keep five-second connection and sixty-second generation limits and strict
  response validation. Provider I/O remains outside row transactions. Stop or
  ownership loss prevents publication; saved configuration revision/fingerprint
  and missing-result status are rechecked when saving. A concurrent manual
  verdict wins. Crash before save can repeat the fixed read-like probe, never
  claim exactly-once inference.
- Persist one bounded observation row, tied to configuration revision and hashed
  endpoint/model identity: allowlisted reason, status and observation timestamp.
  It is diagnostic only, not authority or a lease. Store no endpoint, credential,
  model response, media or raw exception. Throttle repeated identical waiting
  observations to five minutes. A failed diagnostic write must not alter the
  capability result. Stale-configuration observations must not overwrite current
  state. A fresh checking observation is not overwritten by a contender's busy
  observation. Old checking observations are shown as pending, not running.
- Read status through the existing saved capability API, with no model call or
  work scheduling. Only current-configuration observations are projected. A
  missing observation means pending without an observed reason, not success.
- Replace ambiguous "Last checked" with "Status refreshed" and identify the
  actual saved test timestamp separately. Explain that background first-time
  verification does not require this page. Fixed, deduplicated worker logs
  distinguish waiting from test completion; generic scheduler completion means
  only an invocation returned, not that a model was tested.

## Recommendation stack and trade-offs

| Choice | Advantage | Cost / limitation | Decision |
| --- | --- | --- | --- |
| Browser-triggered checks | Easy to implement | Requires babysitting; repeats on navigation | Reject |
| Existing five-minute boundary | Lowest query rate | Repeated competition; no waiting evidence | Replace |
| Staggered server sweep + durable waiting observation | Independent of UI; exposes blockers; more opportunities | Up to one cheap admission check/minute; cannot overcome sustained pressure | Implement |
| Bypass resource checks or retest every saved failure | May appear quicker | Shared-provider load, hidden faults, unsafe admission | Reject |

Stack: durable missing timestamp → staggered scheduler → unchanged safety gates
→ fixed structured-output probe → atomic saved verdict → honest read-only status.
Deferred: durable retry of previously failed/stale capability tests and broader
fair queuing across all discovery workers. Observe actual waiting reasons first.

The separately requested [reviewed-repair automation design](queue-repair-automation-design.md)
specifies persistent opt-in consent, cancellation, cooldowns and attempt limits;
it does not authorize this change to enqueue reviewed repairs.

## Official research

Retrieved through MCP search/open on 14 October 2026:

- [node-cron scheduling options](https://www.nodecron.com/scheduling-options.html)
  documents overlap skipping and random delay to spread simultaneous jobs. Our
  selected second, interval and jitter are application-specific choices.
- [Ollama structured outputs](https://ollama.com/blog/structured-outputs)
  describes schema-constrained output and application validation. Retain the
  existing fixed schema probe rather than treating connectivity as capability.
- [PostgreSQL SELECT](https://www.postgresql.org/docs/18/sql-select.html)
  describes row locking; the observation writer uses a short configuration-row
  lock and never holds that transaction across inference.

## Acceptance

Prove deferred-to-ready progression without a browser; restart and competing
workers; manual-result/settings/shutdown races; unchanged memory guards;
configuration-scoped, sanitized, restart-persistent observations; and no model
I/O from the real HTTP status route. Test visible waiting/refresh/test timestamps
and accessibility. Generate the schema using an isolated database, run current
coverage/quality gates, rebuild without cache, rehearse the immutable image and
evaluate only the authorized local Compose deployment. Leave Unraid and shared
Ollama unchanged. Record measured results in a separate outcome document.
