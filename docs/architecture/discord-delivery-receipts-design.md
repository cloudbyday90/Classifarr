# Discord delivery receipts

Design date: 2026-10-04. Scope: initial classification notifications only.

## Evidence and decision

Pending, confidence-based and standard notifications currently send before saving
the message ID. Concurrent callers, a lost HTTP reply, or a failed database write
can therefore create duplicate messages. They are alternative presentations of
one initial notification per classification, not three independent deliveries.

Persist a receipt before sending. A classification row lock and unique receipt
key serialize cooperating instances. Send outside the transaction, with a saved
random nonce and `enforceNonce`. Confirm from either the HTTP response or a
matching own-bot Gateway event. An uncertain receipt is never automatically resent.

## Contract

- Admission requires an existing classification, enabled saved Discord settings,
  the current bot token/channel, and the appropriate notification flag. A shared
  settings-row lock preserves that check until admission commits. Pending
  alerts also require a still-pending decision. Legacy message IDs in either the
  dedicated column or metadata suppress a new send without inventing receipts.
- The receipt key is the classification ID, across all three presentations and
  bot/channel changes. Corrected, verified or reclassified records do not start
  new initial alerts. New classification records can have new alerts.
- Receipt states are `sending`, `uncertain`, `rejected`, and `delivered`. Sending
  means admission was committed, not that Discord received anything. A crash or
  lost claim-commit acknowledgement holds that receipt, even if no send occurred.
- One application send per receipt. No elapsed-time takeover, lease reset,
  historical notification backfill, or retry of unknown writes. A confirmed
  400/401/403/404 is rejected; cancellation, shutdown and other failures are
  uncertain. Neither state is automatically retried.
- Channel-message POSTs must not be retried by the SDK after a connection reset
  or 5xx. Other SDK routes retain their existing policy; explicit 429 handling
  remains with the SDK. The nonce is additional protection, not a permanent
  exactly-once guarantee.
- Up to eight active deliveries and eight passive confirmations per process,
  without an added queue. SQL has a five-second statement and two-second lock
  timeout. Existing transport bounds remain 15 seconds per HTTP attempt, 4 MiB
  per response and 16 active requests per client. SDK rate-limit waiting is not
  an end-to-end operation deadline and remains a follow-up.
- A successful response permits at most two database-only completion attempts;
  neither repeats the HTTP send. Completion and the history projection commit
  together. Late completion cannot overwrite a newer clarification decision or
  a different existing history message ID.
- Gateway confirmation requires a valid application nonce, own-bot author,
  stored channel and valid message ID. It performs no HTTP call. Events may be
  missed; missing evidence must not be treated as delivery success.
- Disabled/fresh setups do no work. Settings are rechecked at admission; disabling
  or changing them after admission cannot undo a send already in flight. Positive
  evidence for the old destination can still complete that admitted receipt.
- Receipts contain IDs, timestamps and fixed failure codes, never credentials,
  provider bodies or notification content. They live as long as their history
  record and cascade on its deletion. Existing noncooperating older writers are
  not fenced by this table; mixed-version operation is not an exactly-once claim.

## Alternatives and recommendation stack

| Choice | Benefit | Cost / limitation |
| --- | --- | --- |
| Persistent receipt + nonce + passive confirmation (selected) | Survives caller races/restarts; recovers some lost replies without resending | Unresolved delivery can require review; small schema/service addition |
| Nonce alone | Small change; short-lived provider deduplication | Provider window is only a few minutes; insufficient after restart |
| Automatically retry stale receipts | Better apparent availability | Can duplicate a message whose response was lost; rejected |
| Full outbox/reconciliation worker | Durable deferred scheduling and operator actions | Needs separate retry consent, retention and resource design; deferred |

Order: durable admission, no unsafe SDK replay, evidence-only completion, then
operator-visible reconciliation and bounded caller admission. No UI changes in
this slice; a later status interface must use plain language and distinguish
unknown from failed, rather than showing a misleading success percentage.

## Official sources

Discovered through online search/documentation tools and opened on 2026-10-04:

- [Discord Message API](https://docs.discord.com/developers/resources/message):
  nonce length and recent-message uniqueness checking; no permanent deduplication.
- [Discord rate limits](https://docs.discord.com/developers/topics/rate-limits):
  honor provider rate-limit responses instead of adding independent rapid retries.
- [PostgreSQL 18 INSERT](https://www.postgresql.org/docs/current/sql-insert.html):
  database uniqueness and conflict handling arbitrate concurrent insertions.
- [HTTP semantics, RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html): unsafe
  requests must not be automatically retried without evidence that repetition is safe.

## Verification plan

Use isolated PostgreSQL for concurrent claims, legacy IDs, configuration changes,
late completion, lost commit acknowledgements and migration replay. Use real
loopback HTTP to prove channel-message writes are not replayed after 5xx/reset.
No live Discord messages, production database changes or image deployment.
