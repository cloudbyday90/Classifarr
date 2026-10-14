# Background AI evaluation controls: design

Status: Unreleased, 2026-10-14. No release or production activation is included.

## Decision and prerequisites

Treat local inference as background work, not spending. Add durable **Off**,
**When idle**, and **Scheduled** controls with an explicit daily request safety
limit. Scheduled means a daily UTC window, including windows across midnight;
start is inclusive and end exclusive. A window is an admission window, not a
promise to finish a comparison. Equal start/end times are rejected. UTC avoids
silent changes at daylight-saving transitions. UI labels must say UTC.

Reuse the existing recurring capture worker and private response checkpoints.
Do not introduce a second scheduler or change inference prompts, memory limits,
model identity validation, retention, routing, or automatic first-time Ollama
verification. Fresh installations stay off. Upgrades preserve existing opt-in
and both legacy ceilings; the effective request ceiling is their tighter limit.
An administrator may explicitly replace those ceilings using the new controls.

Normal inventory and policy prerequisites still apply. No eligible prepared
comparison, a disabled configuration, a closed window or exhausted allowance
means no generation. Once enabled, missing eligible responses resume without an
open browser. Completed exact responses are reused, not regenerated on polling.

## Admission, cancellation and recovery

Consent is installation-wide configuration, not a browser-session flag. Protect
GET/PUT with administrator authorization, no-store responses, bounded validation,
rate limiting and optimistic configuration revisions. Status is database-only;
neither a GET nor saving controls performs inference. Preserve cooldowns and
same-day reservation counters across edits, restarts and disable/re-enable.

One heavy job per database, sequential generations, at most five attempted calls
per tick, 200 per UTC day, 20 minutes per capture and the existing 180-second
provider request timeout remain. Reserve before dispatch and recheck the database
window on every reservation. No database transaction spans HTTP inference.

Recheck local foreground readiness before each generation. During capture, a
bounded serial monitor observes configuration revision, window and foreground
readiness; cancellation propagates to HTTP on disable, changes, a closed window,
new foreground work or uncertain admission. Keep the resource permit until work
settles. A provider may continue an already dispatched request after its client
disconnects: never promise remote rollback or refund its reserved attempt.

Transient contention waits for the existing five-minute cooldown. Unknown provider
failures retain the existing hour cooldown. Missing/unsupported models cannot
become eligible through this control. A cancelled or unknown outcome never clears
reservations or invents a successful response. Exact checkpoint identity and
revision fencing remain prerequisites for publication. Database failures fail
closed, with the existing local fallback delay if persistence is unavailable.

## Scope and tradeoffs

| Choice | Benefit | Cost / decision |
| --- | --- | --- |
| Off / idle / UTC window over the current PostgreSQL ledger | Understandable, restart-safe, no new dependency | Idle is local to this installation; selected |
| Unbounded local inference | No daily ceiling to configure | Can monopolize shared hardware or loop on failures; rejected |
| Shared Ollama admission gateway | Can coordinate independent installations | New service, authentication and failure boundaries; next design item |
| Arbitrary cron plus local time zones | Flexible schedules | More validation and DST ambiguity; defer |

Recommended stack: administrator opt-in → daily UTC window when selected → local
foreground readiness and unchanged resource admission → atomic request reservation
→ verified installed local model → exact response checkpoint → replay. Daily
limits are a runaway-work safeguard, not currency or measured token usage.

Local and Unraid use separate databases. Their locks do **not** prevent concurrent
calls to shared Ollama, observe its GPU queue, or provide global foreground
priority. Until provider-wide coordination exists, enable background evaluation
on one installation or deliberately choose non-overlapping windows. Do not change
the shared Ollama server's parallelism or restart it as part of this work.

## Official research

Discovered and opened through MCP search on 2026-10-14:

- [Ollama FAQ](https://docs.ollama.com/faq): concurrent requests and context length
  affect memory use; overloaded queues can reject work. This supports bounded
  sequential background work, not an assumption that local inference is unlimited.
- [node-cron scheduling options](https://www.nodecron.com/scheduling-options.html):
  overlap prevention and timezone controls. Keep the existing non-overlapping
  minute scheduler and evaluate the persisted UTC window at admission.
- [PostgreSQL 18 locks](https://www.postgresql.org/docs/18/view-pg-locks.html):
  advisory locks are database-local. They cannot coordinate two independent
  Classifarr installations sharing an external provider.

## Completion evidence

Require unit boundaries, real PostgreSQL reservation/concurrent-edit/restart
checks and loopback HTTP cancellation checks. Validate administrator access and
read-only status, accessible UI, legacy ceilings and no automatic activation.
Rebuild local Compose without cache, rehearse with synthetic isolated data and
record exact image/source plus any limitations in a separate outcome document.
