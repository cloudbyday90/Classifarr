# Server-backed import recovery history

## Decision

Expose the current administrator's newest 20 retained recovery receipts for one
library, through an on-demand read-only view. Use the existing atomically written
audit receipts, not browser-persisted approval or a second operation ledger.
This lets a user rediscover a committed request after navigation, reload or a
lost response, even when the import no longer needs reconciliation.

History proves only that recovery was recorded. It does not prove import or
backfill completion. Empty, truncated, expired or unavailable history cannot prove
that a request failed. It must never trigger a retry, generate a new request ID,
restore an acknowledgment, or enable a library.

## Contract and boundaries

- `GET /api/libraries/:id/ingestion-reconciliation/history` accepts no query
  parameters. Existing administrator access-session checks, API-key rejection,
  rate limiting and `Cache-Control: no-store` apply.
- In a read-only repeatable-read transaction with a three-second statement limit,
  revalidate the active administrator and library existence. Filter audit rows by
  action, actor and library. A partial compound index supports that exact filter
  and descending receipt-ID order. Read 21 rows to return at most 20 plus `hasMore`.
- Reuse one receipt validator/projector for individual lookup and history. Reject
  unverifiable receipts; expose only receipt/request IDs, library ID, timestamp,
  recorded status and historical handoff mode. No raw metadata, preview revision,
  credentials or stopped-writer approval is returned for replay.
- Retain version-1 maintenance-only receipts and version-2 resume receipts. No
  receipt backfill, new retention duration or cleanup job is introduced. Existing
  audit retention remains authoritative.
- A separate small ESM composable owns on-demand reads and visit invalidation.
  The accessible history disclosure remains available after a warning clears,
  performs no work when closed, and never sends a mutation. Errors clear previous
  results rather than presenting stale history as current evidence.
- Library changes, closing, disposal and obsolete responses invalidate the view.
  Nothing is written to local or session storage. There is no background polling.
- Confirmation requests explicitly opt out of the shared transport's automatic
  network/authentication retries. An ambiguous reply remains unverified; only an
  explicit operator action may check its receipt or retry that same request.

## Options and recommendation stack

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Save pending approval in browser storage | Small change | Stale/session-shared authority; lost on device change | Reject |
| Add another persistent workflow ledger | Tracks uncommitted attempts too | New writes, states, retention and migration burden | Defer |
| List existing validated audit receipts | Atomic evidence already exists; read-only | Cannot prove failure or list expired/uncommitted attempts | Implement |
| Automatically retry when history is empty | Less operator effort | Absence is not proof of rollback | Reject |

Recommended stack: PostgreSQL audit receipts and partial index → bounded ESM
history reader and shared receipt validator → existing admin route boundary →
named client API → on-demand disclosure with concise status and request reference.
Keep current progress separate from the historical handoff.

## Official research

Discovered through online search and read on **2026-10-01** for the requested
September 2026 baseline. These current pages are not verified September archives.

- [PostgreSQL 18 SELECT](https://www.postgresql.org/docs/18/sql-select.html)
  recommends a unique ordering with LIMIT. Receipt ID provides the deterministic
  order; a fixed extra row identifies truncation without a full count.
- [OWASP object-level authorization](https://api-security.owasp.org/editions/2023/en/0xa1-broken-object-level-authorization/)
  requires authorization for objects addressed by an endpoint. Recheck the active
  admin and scope every history query to that actor and the requested library.
- [RFC 9111 caching](https://www.rfc-editor.org/rfc/rfc9111.html)
  specifies `no-store`; it is not itself an authorization or transport-security
  control. Preserve authentication, rate limits and non-persistent client state.
- [RFC 9110 HTTP semantics](https://www.rfc-editor.org/rfc/rfc9110.html)
  conditions automatic retries on known request semantics, not guessed outcomes.
  The server already deduplicates confirmation IDs; we additionally choose
  receipt-first, operator-controlled retries for this reviewed recovery flow.
- [W3C status messages](https://www.w3.org/WAI/WCAG21/Understanding/status-messages)
  supports programmatic loading/result/error feedback without focus movement.
  Use native disclosure/button controls and text, not color alone. Announce the
  result summary, not every receipt as a separate live announcement.

See the separate [outcome document](ingestion-recovery-history-outcome.md) for
tests, limitations and next work.
