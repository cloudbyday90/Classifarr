# Durable enrichment retry scheduling

## Decision and scope

Persist retry eligibility in PostgreSQL, rather than relying on a process-local
timer. Retain the existing claim token, deadline, source checks and transactional
result writes. This is a scheduling change, not authority to take over unknown
legacy workers or to change media routing. Movies and TV remain supported; music
remains excluded. No release or live deployment is part of this change.

## Findings

The queue currently has attempts but no next-attempt timestamp. A five-second
wake-up is lost on restart and a six-hour fallback delays otherwise eligible
work. Manual processing can revisit a failed item immediately. OMDb also retries
inside its transport wrapper, multiplying queue-level attempts. Monthly Tavily
eligibility is derived from last_attempt_at, which claiming a row overwrites.
That can postpone a subsequent non-quota failure until another month.

## Design

- Store next_attempt_at on each retry. New ordinary work is immediately eligible;
  migration preserves existing attempts, claims, inventory and terminal states.
- Keep two durable dependency cooldowns: OMDb and web search. Historical Tavily
  and current web-search rows share the latter, matching the current router.
  Cooldowns only postpone work; they never grant ownership or shorten another
  worker's cooldown.
- Check due time and cooldown in the atomic SKIP LOCKED claim. Check current
  provider availability before each network operation. Missing configuration or
  quota waits without consuming the item's failure budget.
- Persist capped exponential backoff with jitter after failures; provider-wide
  transient failures stop the batch and cool down the dependency. Honor supplied
  retry delays within the adapter's existing bounded delay contract.
- Use the existing advisory-lock scheduler every minute, with bounded batches,
  as the restart-safe wake-up. Configuration/quota readiness is rechecked on due
  work; no event delivery is required for progress. Keep the coalesced five-second
  notification as an optimization, not a correctness requirement.
- Queue-owned OMDb lookups get one transport attempt per lookup. Other OMDb
  consumers retain their existing transport policy. Provider routing/fallback
  remains bounded by the configured route candidates.
- Store an explicit UTC monthly due time and clear the historical monthly marker
  when a due row is claimed. Do not reset ordinary failed attempts on enqueue.
- Pending/deferred statistics include durable waits. Existing API shapes remain
  unchanged; pending does not mean a request is currently running.

## Alternatives and tradeoffs

| Option | Benefit | Cost / limitation |
| --- | --- | --- |
| In-memory delayed timers | Small implementation | Restart loses wake-up and delay authority |
| PostgreSQL due times + existing scheduler | Transactional, restart-safe, no new infrastructure | Up to one scheduler interval of wake-up latency; indexed DB polling |
| New broker/workflow engine | Rich delayed delivery and orchestration | Extra operational system and migration; still needs source/write fencing |

Recommendation: existing Node ESM services, PostgreSQL due times and cooldowns,
existing scheduler and provider router, Jest + real PostgreSQL regression tests.
Do not introduce a broker merely to replace a timer.

## Research reviewed September 29, 2026

- [AWS retry guidance](https://docs.aws.amazon.com/wellarchitected/latest/framework/rel_mitigate_interaction_failure_limit_retries.html): bound retries, distinguish failures, use backoff/jitter and avoid multiplying retry layers.
- [PostgreSQL 18 SELECT](https://www.postgresql.org/docs/18/sql-select.html): SKIP LOCKED is appropriate for competing queue consumers, not a general consistency guarantee.
- [HTTP semantics](https://www.rfc-editor.org/rfc/rfc9110.html): Retry-After represents a delay before a subsequent request.
- [Tavily errors](https://help.tavily.com/articles/8645538886-understanding-http-errors): request throttling, plan limits and authentication errors are distinct conditions.
- [W3C status messages](https://www.w3.org/WAI/WCAG21/Understanding/status-messages): waiting and progress must be understandable without moving focus. This change corrects existing waiting-state copy without adding live announcements or a new UI; accessible review controls remain unchanged.

These sources support the principles; batch sizes and timing bounds are local
engineering choices, not requirements of those standards.

## Acceptance

Test restart-equivalent reconstruction, early/manual retry exclusion, readiness
loss between items, month rollover followed by a non-quota failure, competing
claims, cooldown rollback with failed persistence, exhausted budgets, source
changes and unknown legacy owners. Use mocked providers; no paid requests or
live library mutation is necessary.
