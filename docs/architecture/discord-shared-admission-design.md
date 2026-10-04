# Discord shared HTTP admission

## Decision — 2026-10-04

Extend the existing persisted cooldown to bot-authenticated SDK calls as well as
receipt sends and verification reads. Observe exhausted limits on successful
responses. Keep interaction-token requests outside the bot cooldown. Do not add a
dispatcher, change templates, or replay uncertain writes.

## Contract

- No startup polling or new background service. Fresh and disabled installations
  do nothing until an existing authorized caller requests Discord work.
- One process-shared gate admits at most 16 HTTP operations, without a waiting
  queue. Recheck the database immediately before HTTP; already admitted requests
  may overlap. This is not a distributed quota reservation.
- Keep the existing installation-wide cooldown, minimum 60 seconds, monotonic
  database deadlines and indefinite hold for an invalid delay. Bot configuration
  changes do not erase it. No credentials, bucket tokens or URLs are stored.
- A 429 is deferred only after its delay is saved. An exhausted successful
  response saves `X-RateLimit-Reset-After` without consuming its response body.
  A failed observation save cannot turn a known successful write into a failure.
  Error responses can exhaust quota too: retain their observed limits without
  replacing the original refusal status with an observation-persistence error.
- Retain at most one merged pending observation per process on save failure.
  Subsequent bot calls attempt one bounded save before admission; otherwise they
  fail closed. A newer observation must not be cleared by an older save. Log one
  fixed warning per unsaved episode. No timers or retry loops repair this state.
- A crash before a failed save is repaired loses that in-memory observation;
  previously persisted holds survive. Do not claim atomicity between Discord and
  PostgreSQL. HTTP never runs inside a database transaction.
- SDK requests have a 15-second cancellation budget including queue wait and
  retries, and at most 16 outstanding requests per client. Actual HTTP and body
  reads receive the abort signal. Database settlement remains subject to existing
  pool/transaction timeouts; the cancellation budget is not a SQL kill switch.
  The installed SDK can miss a cancellation that predates its queue listener.
  That promise may settle after the bounded head request; the gate checks the
  signal again at the HTTP boundary and cannot send the cancelled request.
- SDK preemptive throttling rejects with a fixed error instead of waiting or
  silently replaying a POST. SDK HTTP 429 responses do not enter its retry loop.
  Reads retain bounded transport retries within the overall request budget.
  The gate observes original bot response headers, then removes the SDK-only
  remaining/reset-after scheduling inputs from the adapter response. Otherwise
  the installed SDK creates an orphan bucket sleep before its rejection callback.
  Payload and other headers are preserved. The SDK's short global backstop still
  exists; this is not a claim to eliminate all SDK timers or Gateway activity.
- Interaction/webhook-token requests (`auth: false`, no Bot authorization) keep
  independent provider limits and do not read or extend the bot cooldown. Their
  429 responses reject without automatic replay. Their queue, time and body bounds
  still apply. Gateway connections and attachment preparation are not HTTP queue
  work and are not covered by this budget.
  Non-bot webhook bucket timers remain SDK-owned; these are not persisted bot
  admission state. This change does not replace Discord's entire rate scheduler.
- Existing receipt state, nonce, configuration fingerprint and three-attempt
  budget remain authoritative. Only proven unsent work may be retried by an
  existing caller. Cancellation or ambiguous transport errors are not proof of
  non-delivery. Permanent refusal remains distinct from a rate limit.

## Alternatives and recommendation stack

| Option | Benefit | Cost / decision |
| --- | --- | --- |
| Shared persisted admission | Restart-safe coordination of known limits | Conservative: unrelated bot routes can pause; implement now |
| SDK-only limits | Detailed in-memory bucket handling | Independent clients and restarts lose coordination; insufficient alone |
| Full distributed bucket scheduler | Better throughput and fairness | More schema, token scoping and replay complexity; defer until measured need |
| Automatic outbox | Eventually sends proven-unsent work | Requires durable scheduling, config fencing and bounded dispatch; next step |

Use shared admission, bounded SDK calls and honest positive-result handling now.
Then design automatic dispatch for proven-unsent receipts. Do not auto-replay
uncertain or legacy unmarked notifications.

## Validation and completion

Add real loopback SDK tests for cross-client/native holds, exhausted success,
save failure, queue cancellation, shutdown, interaction exemption and no 429
replay. Use isolated PostgreSQL tests for durable gate sharing. Include race,
capacity, cancellation and sanitized-error unit tests. Run backend checks and
coverage, root documentation/static gates and the coverage ratchet. Completion
means tested source committed and pushed to main, not deployed or released.

## Official research

Retrieved 2026-10-04 through web search/open; installed SDK source checked against
the documented API, without relying on unreleased main-only options.

- [Discord rate limits](https://docs.discord.com/developers/topics/rate-limits):
  dynamic headers, fractional seconds, per-resource limits and interaction
  exemption from the bot global limit. The broad installation pause is our
  conservative application policy, not Discord's bucket model.
- [discord.js REST options](https://discord.js.org/docs/packages/discord.js/14.26.5/RESTOptions:Interface):
  supported request hook, timeout, retries and preemptive rejection callback.
- [HTTP semantics, RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html):
  non-idempotent retry requires evidence that the original request was not applied.
- [Node 24 globals](https://nodejs.org/download/release/latest-v24.x/docs/api/globals.html):
  compose cancellation with AbortSignal and propagate it to actual I/O.

No browser interaction changes are needed; retain existing accessible delivery
statuses. No schema or Compose update is required.
