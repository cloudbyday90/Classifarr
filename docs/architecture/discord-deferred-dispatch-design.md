# Discord deferred delivery dispatcher — design

Date: 2026-10-04. Starting revision: `32f915e6`. No release or deployment.

## Decision and scope

Automatically retry new classification, confidence and pending notifications only
after durable evidence says the previous attempt did not send: the existing
provider gate refused admission, or Discord returned HTTP 429. Keep the existing
three-attempt receipt budget. Never replay `sending`, uncertain, rejected,
delivered or legacy receipts merely because time has passed.

Persist the exact serialized message beside initial receipt admission. This is a
bounded retry buffer, not an at-least-once outbox: a crash after admission remains
uncertain even if it occurred before HTTP. Completion still requires a validated
Discord message ID or independent positive receipt evidence.

This first dispatcher covers receipts that reach durable send admission. Channel
lookup/preparation failures and cooldown refusals before receipt creation remain
outside it. Do not reconstruct old notification content from current media data.

## Contract

- Store only the supported message body, nonce and configuration ID, never bot
  credentials, provider response bodies or request headers. Media titles,
  descriptions and configured mentions are private application data: the buffer
  has the same database access/backup boundary as classification history.
- Maximum serialized body: 64 KiB; maximum retained entries: 1,000 installation
  wide. A transactional admission lock enforces capacity. When full/busy, the
  original single attempt can proceed but gets no automatic retry buffer.
- Payload expires after 24 hours. Successful completion or permanent/unknown
  failure removes it immediately; scheduled bounded cleanup removes expired and
  stale payloads. Downtime can delay physical deletion, never extend eligibility.
  Receipts remain for audit and duplicate protection; backups have their own
  retention. No old payload is invented during migration.
- A scheduler-owned worker checks once per minute, processes at most four items
  serially with a 45-second run signal, and cleans at most 100 buffer rows. No
  provider traffic without an initialized, enabled bot and a due eligible item.
  Fresh/disabled installs have no delivery work. No extra idle timer or service.
- PostgreSQL short transactions retain the parent-first receipt lock order.
  Concurrent claimers recheck state under that lock; only one can move a deferred
  receipt to sending. HTTP stays outside the transaction. No expiring lease can
  authorize replay. Shared persisted cooldown remains authoritative, including
  indefinite holds when a provider delay cannot be interpreted safely.
- Before retry, check exact configuration fingerprint, bot, channel, notification
  kind, history status and clarification status. Changed configuration/decision,
  deleted configuration, exhausted budget or expired body cancels buffer use.
  Preserve the receipt and existing history; do not undo user decisions.
- Stop aborts the worker's actual request signal. Bot replacement also aborts its
  client lifetime. Cancellation after admission stays conservative/uncertain;
  no reset of attempt counts. An already admitted call may finish after a settings
  change; positive delivery evidence is still recorded.
- Failed reads/commits cannot authorize HTTP. A lost admission acknowledgement
  can strand an unsent receipt, but cannot duplicate it. Repeat only bounded local
  completion writes after a known successful send.
- Logs contain fixed outcome names and aggregate counts, never message bodies or
  raw exceptions. The existing admin-only read endpoint gains `retryQueued`, a
  Boolean showing an unexpired deferred buffer with remaining attempt budget.
  It is a saved-state snapshot, not a guarantee that current settings permit the
  next attempt. The panel explains that distinction; no status-view-triggered
  provider HTTP, resend action or polling is added.

## Alternatives and recommendation stack

1. **Receipt + bounded retained body + scheduler + shared gate (chosen):** survives
   restarts and recovers confirmed throttling without a broker or template change.
   Costs short-lived content storage and up to a minute of scheduling delay.
2. Rebuild a message from history: less storage, but changed policy/buttons/mentions
   can misrepresent the original intent. Rejected for this step.
3. Retry every stale receipt: better apparent delivery rate, but duplicate writes
   after ambiguous failures. Rejected; nonce enforcement is not a durable guarantee.

Next: capture intent before channel lookup/provider preparation, with an explicit
bounded queue admission result and operator-visible cancellation/expiry reasons.
This dispatcher does not claim lossless notification delivery.

## Official research

Retrieved 2026-10-04; these are current retrieved documents, not an archived
end-of-month snapshot.

- [Discord rate limits](https://github.com/discord/discord-api-docs/blob/main/developers/topics/rate-limits.mdx):
  use provider retry/reset signals; limits are dynamic.
- [Discord messages](https://docs.discord.com/developers/resources/message):
  `enforce_nonce` deduplicates only recent messages, not arbitrary restart windows.
- [PostgreSQL 18 SELECT](https://www.postgresql.org/docs/18/sql-select.html):
  row locks serialize claims; `SKIP LOCKED` is useful for queue consumers but is
  not a general consistency guarantee. Existing parent-first locking is retained.
- [AWS transactional outbox](https://docs.aws.amazon.com/en_en/prescriptive-guidance/latest/cloud-design-patterns/transactional-outbox.html):
  transactionally associate durable intent with database state; account for
  duplicates rather than assuming the dispatcher makes external writes atomic.
- [AWS retry limits](https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/rel_mitigate_interaction_failure_limit_retries.html):
  cap retries and queued work. Here provider cooldown and a finite total attempt
  budget replace immediate retries; unknown writes are never retried.
- [W3C status messages](https://www.w3.org/WAI/WCAG21/Understanding/status-messages):
  retain programmatically exposed loading/results status and visible text instead
  of relying on color or moving focus. This change preserves the existing status
  region, focus behavior and user-requested refresh.
