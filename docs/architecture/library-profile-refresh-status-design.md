# Library profile refresh status — design

## Problem and decision

The inventory revision and outbox worker introduced a safe automatic refresh,
but operators could not tell whether a particular library was waiting,
processing, cooling down after failure, or already verified. A timestamp or
percentage would be misleading: the inventory may change while work runs, and
an old profile may exist without revision provenance.

Add an administrator-only, read-only snapshot endpoint and a compact Command
Center summary in the existing Libraries panel. It observes work; it never
starts a refresh, changes routing authority, or asks the operator to approve a
library's contents.

## Options and trade-offs

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Infer progress from profile age | Cheap | A recent profile can be stale; legacy profiles have no provenance | Reject |
| Report a percentage from queue rows | Familiar display | Moving inventory and retry timing make the denominator unstable | Reject |
| Add another persistent progress ledger | Can record history | More write paths, cleanup, and reconciliation with the existing outbox | Reject for this slice |
| Derive a bounded snapshot from revision, profile, and outbox state | Uses authoritative existing state; no writes | A snapshot can change immediately; a large installation needs a bounded window | Adopt |

## Contract and safety

- `GET /api/libraries/profile-refresh-status` requires administrator access,
  rejects query controls, is rate-limited, and sends `Cache-Control: no-store`
  even when the administrator-role check denies access. It does not expose item titles, descriptions,
  provider identifiers, credentials, or raw queue failures.
- One SQL statement observes the inventory state, stored profile revision,
  current inventory membership, and latest inventory-change outbox row under
  PostgreSQL's statement snapshot. It orders dirty libraries first, then by
  library ID; materializing the selected 201-row window bounds the inventory
  and outbox lookups. It returns at most 200 libraries plus a truncation flag. The
  count is explicitly a window count if truncated, not a fleet-wide total.
- Revisions are serialized as decimal strings and compared with `BigInt` in
  memory, avoiding JavaScript safe-integer loss. An existing profile with no
  revision is **unverified**, not current. An empty library without a profile
  is **no inventory**, not a completed profile. A dirty inactive library is
  **paused**, not failed. Expired leases are not reported as active work.
- The client validates the version, bounded row shape, and fixed status IDs,
  then discards revision details before rendering. It polls at most once per
  minute while visible, coalesces overlapping reads, and clears a stale
  snapshot on failure. Access denial hides the widget.
- The initial view is one short status line. Per-library entries use a native
  `<details>` disclosure. Status changes use `role="status"` without stealing
  keyboard focus. The Libraries panel receives a keyboard-operable toggle.
  There is no progress meter or percent because there is no meaningful fixed
  completion range.

## Recommendation stack

Keep the existing inventory trigger → revision state → bounded planner →
leased worker → revision-verified publication. Add this bounded, no-store
observation endpoint and small disclosure UI above the existing library list.
Do not introduce a second orchestrator, user acknowledgement, polling while
hidden, or new routing authority. Next validate upgrade and refresh progression
on a disposable pre-upgrade database snapshot before changing production
classification behavior.

## Official guidance checked September 2026

These are living sources checked for this change, not archived snapshots of a
particular date:

- [PostgreSQL 18 transaction isolation](https://www.postgresql.org/docs/18/transaction-iso.html)
  describes the statement-level snapshot under Read Committed.
- [PostgreSQL 18 `SELECT`](https://www.postgresql.org/docs/18/sql-select.html)
  documents deterministic ordering with `ORDER BY` and bounded `LIMIT`.
- [PostgreSQL 18 `WITH` queries](https://www.postgresql.org/docs/18/queries-with.html)
  documents `MATERIALIZED` as a way to preserve a separately calculated
  selected window before the more expensive joins.
- [RFC 9111 HTTP caching](https://www.rfc-editor.org/rfc/rfc9111.html)
  defines `no-store` for responses that must not be stored by caches.
- [W3C WCAG 2.2 status messages](https://www.w3.org/TR/wcag/#status-messages)
  supports announcing changes without moving focus.
- [W3C WAI-ARIA meter pattern](https://www.w3.org/WAI/ARIA/apg/patterns/meter/)
  requires a meaningful range; this asynchronous, moving-target workflow has
  none, so the UI uses categorical status instead.
