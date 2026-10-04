# Durable preset creation: design

Date: 2026-10-04. Starting revision: `40e53720`. Scope: custom preset creation.

## Decision

Use a server-issued save request, owned by the authenticated user. Reserve one
request before creating a preset. Commit the preset and its saved receipt in one
PostgreSQL transaction. Keep the existing unkeyed API for older clients; the new
manager uses the receipt path. Updating an existing preset remains single-attempt
with manual review and is not covered by this creation guarantee.

The recovery-change skill requires an explicit unknown-outcome contract. A missing
GET result cannot establish that an earlier write stopped. Therefore **Check save
status** is a CSRF-protected POST: it locks the request and either confirms its
saved result or closes the still-pending attempt. A delayed create then cannot run.
Opening the page only reads status; it never cancels or replays a save.

All paths below are relative to `/api/presets/custom/save-requests` and use
existing session authentication and CSRF protection. Responses are `no-store`.

| Method/path | Purpose |
| --- | --- |
| `GET /` | Return `{ request: null }` or the actor's unresolved receipt |
| `POST /` | Reserve a new attempt; a busy slot returns 409 |
| `POST /:requestId/complete` | Atomically create once or return the matching saved receipt |
| `POST /:requestId/resolve` | Confirm saved, or cancel pending; repeat safely |

Receipt fields: `requestId`, `state` (`pending`, `saved`, `cancelled`), nullable
`presetId`, and `resolved`. Another user's ID and an expired ID both return 404.

## Lifecycle and bounds

1. GET the authenticated user's one unresolved request. Fresh installs do no work.
2. POST begin reserves a server-generated UUID. A partial unique index admits only
   one unresolved creation per user across tabs and application processes. A busy
   reservation is not handed to a second draft.
3. POST complete locks that request. An unchanged repeat returns its receipt;
   changed normalized content is rejected. Preset insertion and receipt update
   commit together. No provider calls occur in the transaction.
4. POST resolve locks the same row. Saved stays saved; pending becomes cancelled.
   The request leaves the unresolved slot. Both outcomes are durable and repeatable.
   A cancelled or missing request can never create a preset.

Only the authenticated principal supplies ownership; body `created_by` is ignored
on the new path. Responses contain request ID, outcome and preset ID, not stored
drafts or errors. Canonical SHA-256 fingerprints distinguish changed content.
The database retains no duplicate preset payload, credentials or provider output.

Each call has one attempt, a 30-second client timeout, 5-second SQL statement limit,
2-second lock limit and 10-second idle-transaction limit. Payloads are limited to
64 KiB; normalized fields respect schema limits. No worker, timer, network retry,
cooldown or AI service is added. Timeout remains unknown until reconciliation;
it does not mean rollback. Transaction rollback leaves a pending reservation.

Unresolved requests never expire by age. Explicitly resolved receipts are retained
for at least 30 days. Begin opportunistically prunes at most 100 old receipts for
that user, using an indexed query. Missing/expired IDs fail closed; only begin may
issue a new ID. User deletion cascades receipts. Preset deletion clears its ID but
preserves the saved outcome. The UI explains a saved-but-deleted result.

Reloads and new tabs discover the unresolved slot through authenticated GET, so no
browser storage, draft retention or client identity cache is needed. A second tab
may explicitly resolve the shared attempt; the first tab's delayed completion is
then fenced by the cancelled state. New independent drafts are not deduplicated by
name. Database rollback/restore and old unkeyed clients remain outside this guarantee.

## Options and recommendation stack

| Option | Benefit | Cost / limitation |
| --- | --- | --- |
| Manual list review only | No schema change | Cannot prove a delayed create stopped |
| Client UUID and browser journal | Fewer calls | Storage failure, account switching and cross-tab coordination |
| Server reservation + atomic receipt (selected) | Survives reload; cancels delayed writes safely | Extra short requests and small retained rows |
| Background retry worker | Could retry offline | Unnecessary lifecycle and write-replay risk here |

Ship the server reservation and small ESM service first, wire the manager's concise
status action to it, and prove transaction races with isolated PostgreSQL tests.
Keep inline status/error text accessible without moving focus. Next: resume the
separate dependency/tooling review. Revision-aware update receipts need a later
contract for concurrent edits, rather than silently overwriting another draft.

## Official sources checked

Retrieved 2026-10-04 using web search and source retrieval, not guessed links.

- [PostgreSQL 18 INSERT](https://www.postgresql.org/docs/18/sql-insert.html):
  unique conflict handling provides database-level admission under concurrency.
- [PostgreSQL 18 explicit locking](https://www.postgresql.org/docs/18/explicit-locking.html):
  row locks serialize completion and cancellation until their transaction ends.
- [HTTP Semantics, RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html): do not
  automatically retry a non-idempotent operation without a safe semantic contract.
- [Stripe's idempotency design](https://stripe.com/blog/idempotency): stable request
  identity lets a server distinguish retries from independent intent. The explicit
  reservation and cancellation protocol above is our design, not a Stripe standard.
- [W3C status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages): retain
  programmatically exposed status messages and useful error instructions.
- [OWASP authorization](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html):
  enforce resource permissions on each request; an opaque ID is not authorization.
- [OWASP logging](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html):
  keep sensitive inputs and untrusted failure text out of logs. New receipt routes
  replace unexpected errors with a fixed failure code before generic handling.

## Verification plan

Real HTTP and isolated PostgreSQL tests must cover same-request concurrency,
different actors, conflicting drafts, failed insertion rollback, lost response,
new router/process-local state, resolve-before-create, create-before-resolve,
deleted presets, expiry, payload bounds and unchanged legacy calls. Client tests
must cover loading admission, reload recovery, failed status reads, pending state,
late completion, review failures and no automatic replay. No live presets or
production database will be used. Design and measured outcome stay separate.

Ownership baseline review: the new migration only adds receipt storage, indexes
and foreign keys to users/presets. The isolated snapshot adds exactly those objects
and its migration marker; existing ingestion/ownership analysis is unchanged.
Only these two reviewed SQL entries are updated in the compatibility manifest.
