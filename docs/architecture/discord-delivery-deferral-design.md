# Discord delivery deferral and deadlines

Date: 2026-10-04. Scope: initial classification alerts and explicit delivery
verification. No release, live sends, deployment or automatic replay worker.

## Problem and decision

The existing per-request timeout does not bound Discord SDK queue waits. A 429
also loses its delay on process restart, and is indistinguishable from an
uncertain write in delivery receipts.

Use a queue-free, single-attempt POST adapter with the installed SDK's message
serializer. Preserve embed builders, buttons, mention policy and receipt markers.
Do not resolve attachments or follow redirects. Keep a durable, installation-wide
provider cooldown shared by initial sends and explicit verification reads.

## Admission and state contract

- Fresh or disabled installations start no worker or timer. Existing saved
  configuration, classification state and bot/channel checks still govern sends.
- A known cooldown blocks admission before creating a receipt. A later cooldown
  or a fully received HTTP 429 records `deferred`, not `uncertain`.
- Only deferred receipts may be admitted again, on a subsequent normal caller
  invocation. Require identical bot, channel, kind, configuration fingerprint and
  previous classification/clarification state. Reuse the same nonce; allow at
  most three admitted attempts. Never reset budgets or backfill legacy proof.
- A timeout, connection failure, oversized/incomplete body, server error or lost
  database acknowledgement remains uncertain. No automatic POST retry. A known
  400/401/403/404 is rejected. Positive delivery evidence still wins over failure.
- Eight sends per process, no queue. One POST per admitted attempt; 15 seconds
  across its headers/body, 256 KiB response and serialized payload limits. Caller
  cancellation and client shutdown abort actual I/O. Database transactions retain 5-second statement
  and 2-second lock limits, outside HTTP. These are separate database bounds, not
  a claim that the entire notification preparation path finishes in 15 seconds.
- One cooldown row bounds storage. All scopes conservatively share the longest
  observed delay, with a 60-second minimum. Missing/invalid 429 delay pauses
  indefinitely rather than guessing. Configuration changes do not clear it.
  Already admitted concurrent requests can finish; this is not a global quota
  reservation or a limiter for test alerts, edits or other SDK callers.
- HTTP occurs outside transactions. Serialize receipt claims with the existing
  parent-row lock. Fence deferral completion by nonce and admitted attempt number.
  Persist provider delay before marking a receipt safe to retry. A crash before
  that commit leaves the receipt held, never falsely safe.
- Persist no token, message payload or provider response body in the new state.
  The fingerprint is a SHA-256 digest of the existing configuration contract.
  Logs use fixed reasons. Completion still requires a confirmed message ID;
  deferred is not delivered and the review screen must say so in text.

## Alternatives and recommendation stack

| Choice | Benefit | Cost |
| --- | --- | --- |
| SDK sleeping/retrying | Less custom transport | Hidden waits and uncertain POST replay boundaries |
| Queue-free POST + durable cooldown (chosen) | Bounded I/O and explicit safe retry evidence | Small adapter; conservative cross-channel waiting |
| Full durable outbox worker | Eventually delivers deferred work automatically | Payload retention, lifecycle and stale-intent policies need a separate design |

Recommended stack: existing receipt admission, bounded serializer/POST adapter,
shared durable cooldown, evidence-gated re-admission, existing passive/manual
confirmation, accessible deferred status. Next: preparation/read admission and
proactive exhausted-bucket observations, then a bounded outbox dispatcher without
replaying uncertain receipts.

## Sources checked on 2026-10-04

- [Discord rate limits](https://docs.discord.com/developers/topics/rate-limits):
  discover delays from headers/body; limits differ by route/resource/global scope.
- [Discord messages](https://docs.discord.com/developers/resources/message):
  nonce deduplication is recent-window protection, not durable exactly-once proof.
- [discord.js MessagePayload](https://discord.js.org/docs/packages/discord.js/14.25.1/MessagePayload%3AClass):
  use the SDK serializer without its send queue; installed implementation reviewed.
- [Node 24 globals](https://nodejs.org/download/release/latest-v24.x/docs/api/globals.html):
  fetch and AbortSignal support actual request cancellation.
- [HTTP semantics](https://www.rfc-editor.org/rfc/rfc9110.html): non-idempotent
  operations need evidence before retry, not merely a transport error.
- [PostgreSQL INSERT](https://www.postgresql.org/docs/current/sql-insert.html):
  atomic conflict handling for monotonic cooldown persistence.
- [W3C status messages](https://www.w3.org/WAI/WCAG21/Understanding/status-messages):
  retain status text and announcements; do not communicate deferral by color alone.

## Required evidence

Real loopback POST tests for serialization, 429, redirects, malformed/oversized
responses, cancellation, stalled bodies and exactly one POST. Isolated PostgreSQL
tests for cooldown persistence, competing claims, exhausted budgets, stale intent,
legacy receipts and late completion. Upgrade replay/fresh-schema round trip,
client status tests, and affected repository quality gates. No production I/O.
