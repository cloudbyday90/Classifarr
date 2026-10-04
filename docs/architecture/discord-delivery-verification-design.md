# Administrator Discord delivery verification

Date: 2026-10-04. Scope: local implementation, not deployment or live recovery.

## Decision

Add one explicit **Verify delivery** action beside an unconfirmed, version-one
delivery receipt. The administrator supplies a message ID, not a channel, token,
URL or message body. The backend reads the current bot identity and that one
message in the receipt's recorded channel. It never searches history or sends,
edits or deletes a Discord message.

No work runs on page load, idle installations, disabled configuration, legacy
receipts without correlation markers, rejected sends or already confirmed sends.
The existing passive Gateway confirmation remains available.

## HTTP contract

`POST /api/settings/discord/deliveries/:classificationId/verify` accepts exactly
`{"messageId":"333333333333333333"}`. IDs remain strings: the classification ID
must fit PostgreSQL bigint; the message ID must contain 17–20 decimal digits.
Additional fields, tokens, URLs and raw message objects are rejected.

Successful confirmation returns HTTP 200 with `code: confirmed` and the saved
`messageId`. Invalid input is 400; existing authentication/admin middleware
handles 401/403. Unconfirmed/configuration/proof outcomes are 409 with a fixed
code. Capacity/cooldown/provider throttling returns 429, with `Retry-After` and
`retryAfterSeconds` when a finite delay is known. Database/unexpected failures
return 503 with `verification_unavailable`. Nothing is cached. Cookie-based
requests retain the application's existing CSRF protection; the named client
API supplies that header and disables automatic/auth-refresh replay.

The existing GET review adds only `canVerify`, derived from receipt version and
state. It does not expose the nonce, fetch provider configuration or contact
Discord. Current permissions and configuration are always rechecked by POST.

## Safety and resource contract

- Administrator authentication and strict input validation precede admission.
  Responses are non-cacheable. Saved credentials never reach the browser.
- One active verification per process, no waiting queue. A single PostgreSQL
  guard row admits at most one verification per installation per 60 seconds,
  including across processes and restarts. It records only the latest target and
  fixed outcome, not message content. It is not the send worker's rate limiter.
- Admission commits before network work. Two sequential GETs at most, zero
  retries, a shared ten-second network deadline, 256 KiB per response, redirects
  rejected. Cancellation aborts the transport. No verification timer runs while idle.
- A provider 429 extends the persisted deadline by its Retry-After value. Missing,
  invalid or unrepresentable limits pause verification indefinitely rather than
  guess an earlier retry. This exceptional state requires maintainer review;
  there is deliberately no browser reset that bypasses provider limits.
- SQL uses short transactions, five-second statement and two-second lock
  timeouts. HTTP is never inside a transaction. A crash after admission retains
  the 60-second guard; a crash before saving a newly received provider cooldown
  cannot durably record information the process did not commit. No automatic
  caller retries either case. Durable dispatch/outcome handling is follow-up work.
- Before accepting proof, the saved configuration must still be enabled with
  the same ID, exact database revision, token and recorded channel. Completion
  holds a shared configuration lock and reuses the existing receipt completion
  transaction, preserving newer classification decisions.
- Confirmation requires the requested message ID, original bot and channel,
  classification ID, random receipt nonce and version-one footer marker. Wire
  normalization is applied only to authenticated provider responses. Forwarded, webhook,
  partial and mismatched messages are not proof. A competing valid Gateway
  confirmation remains idempotent; conflicting message IDs cannot overwrite it.

## Outcomes and interface

Confirmed means matching provider evidence was committed locally. A missing
message, missing permissions, changed bot/configuration, timeout, cancellation,
oversized/malformed response or marker mismatch leaves the original receipt
unchanged. A database failure after the read also remains unconfirmed to the
caller; refreshing records resolves an uncertain response after a local commit.
No negative result grants resend permission.

Use a small inline form inside the existing record details, explicit label,
associated help/error, a polite status region and a stable focused submit button.
Show concise fixed messages, never provider error bodies. Update the confirmed
row and page counts without removing the focused form. No polling, extra status
request or browser retry; refreshing other records remains explicit.

## Alternatives and recommendation

| Option | Benefit | Cost |
| --- | --- | --- |
| Keep passive confirmation only | No additional provider reads | Missed events can remain unresolved |
| Explicit single-message verification | Bounded positive proof, no duplicate alert | Administrator needs a message ID and bot read access |
| Search channels or resend uncertain alerts | Less operator input | Unbounded reads or duplicate external effects; rejected |

Recommended stack: existing Vue inline disclosure and named API leaf, small ESM
handler/service/repository/provider reader, existing bounded HTTP response helper
and shared message-proof parser, PostgreSQL admission guard and existing receipt
transaction. No new dependency, service, container or Compose setting.

Next: durable provider deferral and an overall deadline for ordinary Discord
sends, without replaying ambiguous writes.

## Official sources checked 2026-10-04

- [Discord message resource](https://github.com/discord/discord-api-docs/blob/main/developers/resources/message.mdx):
  single-message reads require channel/history access; nonce is optional, so the
  durable marker—not assumed nonce persistence—is required here.
- [Discord rate limits](https://docs.discord.com/developers/topics/rate-limits):
  respect the provider's retry delay and avoid repeated invalid requests.
- [PostgreSQL INSERT](https://www.postgresql.org/docs/current/sql-insert.html):
  conditional conflict handling supports atomic admission under contention.
- [Node.js 24 globals](https://nodejs.org/download/release/latest-v24.x/docs/api/globals.html):
  native fetch and composed abort signals support actual transport cancellation,
  rather than leaving timed-out I/O running behind a raced promise.
- [W3C form labels](https://www.w3.org/WAI/tutorials/forms/labels/) and
  [form notifications](https://www.w3.org/WAI/tutorials/forms/notifications/):
  explicit labels and associated concise feedback.
- [W3C status messages](https://www.w3.org/WAI/WCAG21/Understanding/status-messages):
  announce results without moving focus or adding a modal.

These are retrieved current documents, not an assertion about unpublished
guidance later in October. Tests and observed outcomes belong in the separate
outcome document.
