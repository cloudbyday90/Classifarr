# Discord delivery review — design

Date: 2026-10-04. Baseline: `1eba7db6`. No release or deployment.

## Decision

Add an administrator-only, on-demand review panel in Discord settings. Show
delivered, unconfirmed and rejected receipts, the affected classification, and
one plain-language next step. Counts describe only the displayed page, not the
installation's delivery rate. Keep technical IDs and timestamps in disclosure
sections. No modal, chart library, polling service or Discord request is needed.

Do **not** ship the previously proposed message-ID reconciliation yet. The
current Message contract makes `nonce` optional; Discord's official repository
also explains that it is not persisted. A later GET of an administrator-supplied
message ID cannot reliably prove which local receipt produced it. Matching a
title, bot and channel is insufficient. This is a correction to the previous
follow-up proposal, not permission to weaken the receipt protocol.

## Contract and bounds

- `GET /api/settings/discord/deliveries?before=<classification-id>` uses the
  existing authenticated admin settings boundary and an explicit admin guard.
  Responses are private, non-cacheable and contain only allowlisted fields.
- Read 26 receipt rows with a primary-key keyset query, return at most 25 plus
  an opaque-to-the-UI decimal cursor. Order by classification ID descending,
  **not** send time. Bound the joined title to 240 characters. Do not scan all
  history, compute global totals or fetch raw metadata, credentials or nonces.
- Validate cursors as positive PostgreSQL BIGINT decimal strings. No arbitrary
  filters, sort expressions, page sizes, URLs or client-supplied SQL.
- At most four reads per handler instance; saturation returns 503 without
  queueing. Each read uses a read-only transaction, 3-second statement timeout
  and 1-second lock timeout. Pool connection admission retains the existing
  database pool bounds and its configured connection-acquisition retries. Queries
  are not replayed; no new retry loop, persistent cooldown or background job is added.
- The browser makes one explicit request at a time, with a 10-second timeout
  and cancellation on unmount. Disable automatic Axios retry/auth replay for
  this call. Failed loads preserve the last displayed page and label it stale.
  Initial settings navigation does not load delivery records automatically.
  Browser cancellation does not claim to cancel server-side pool acquisition;
  the server's read admission stays occupied until its transaction settles.
- Empty/fresh installations need no Discord setup or provider work. The panel
  explains that legacy messages and test/system alerts are outside receipt
  coverage. Disabled or changed settings do not hide historical destinations.

## Outcomes and safety

`delivered` means recorded positive delivery evidence, not that a message still
exists. `rejected` means a recorded provider refusal; suggest checking bot/channel
permissions, without automatically resending. Both `sending` and `uncertain`
display as **Unconfirmed**: a send may still be running, have completed remotely,
or have stopped. Age and page refresh never change that state.

Invalid input returns 400; transient database failure or saturation returns a
sanitized 503; cancellation discards the browser result. Authentication failures
do not become empty success. There are no writes, locks on receipt ownership,
resets, resend endpoints or message-ID claims. Restarts leave existing receipts
unchanged. Reading a record is never a completion signal.

Completion for this slice means the actual admin route, bounded SQL and browser
panel work together with accessible loading/error/empty/stale states. Verify real
isolated PostgreSQL pagination and no mutation, HTTP authorization, keyboard use,
narrow layout, and no unsolicited/retried provider traffic. Update design and
outcome separately; retain the receipt protocol's existing regression coverage.

## Recommendations and tradeoffs

1. **Ship read-only review now.** Low overhead, useful visibility, no duplicate
   notification risk. It cannot resolve an ambiguous historical send by itself.
2. **Next: durable message correlation and scoped verification.** Design a
   persistent, authenticated correlation marker before admitting new sends;
   verify exact message, stored bot and channel with bounded reads. Review how
   edits, missing markers and older messages remain unconfirmed. This adds
   protocol and presentation complexity but enables trustworthy reconciliation.
3. **Then: durable deferral and end-to-end send deadlines.** Preserve evidence-only
   recovery. Do not create a retry loop by clearing old receipts.

## Official sources

Discovered through web search and opened on 2026-10-04:

- [Discord Message API source](https://github.com/discord/discord-api-docs/blob/main/developers/resources/message.mdx): optional nonce and bounded recent-send deduplication, not durable recovery proof.
- [Discord's nonce explanation](https://github.com/discord/discord-api-docs/discussions/3396): historical maintainer explanation of non-persistence, consistent with the current optional-field contract. We do not assume future GET responses retain it.
- [W3C status messages](https://www.w3.org/WAI/WCAG21/Understanding/status-messages): announce load outcomes without moving keyboard focus.
- [W3C table captions and summaries](https://www.w3.org/WAI/tutorials/tables/caption-summary/): explicitly identify scope and relationships. This panel uses a labelled list and definition-list counts instead of squeezing a wide table onto a phone.

Use text labels as well as color, native buttons/disclosures, visible focus and
stable controls. Do not use misleading percentages for a paginated sample.
