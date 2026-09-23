# Durable Library Profile Upgrade Queue — Design

## Problem and scope

The previous post-upgrade task rebuilt every active library profile during
startup, while ordinary startup could launch a second whole-installation pass.
That competes with sync and delays readiness. The already deployed
`library_profile_inventory_state` revision table, refresh outbox, and leased
worker provide a safer per-library execution boundary. This change reuses them;
it does not introduce a global orchestrator or modify routing authority.

## Decision

1. Under the existing cross-process post-upgrade lock, write the upgrade task
   ledger row and dirty every eligible library revision in **one transaction**.
   Eligible means a library has inventory or a stored profile. Inactive
   libraries are also dirtied so they are not forgotten when reactivated.
2. The existing inventory planner admits up to 25 dirty libraries per tick.
   The existing outbox worker claims up to 10, uses leases and retry delays,
   and acknowledges only the claimed inventory revision after generation.
   Later source changes remain dirty and receive another refresh.
3. Remove the independent whole-library startup rebuild. The inventory
   trigger and planner own initial and subsequent observed-profile refreshes.
4. Add a new one-time task identity because an earlier release may already
   have recorded the old observation task. Replaying a recorded identity does
   not bump revisions. Historical pending profile tasks use the same handoff.

The ledger means **queued**, not **all profiles regenerated**. The worker's
revision acknowledgement is the per-library completion record. A failed
provider or generation attempt leaves the revision dirty for recovery; the
existing outbox cooldown governs terminal retries.

## Alternatives and trade-offs

| Approach | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Rebuild everything at boot | Immediate if all libraries succeed | Unbounded duplicate work, startup contention, coarse restart state | Retire |
| Add a second upgrade work table and worker | Custom stages and cursors | Duplicates leases, queue admission, retry policy, and operational surfaces | Defer |
| Reuse inventory revision and outbox | Durable per-library work, existing load bounds, no schema change | One set-based seeding transaction still scales with library count; no stage-by-stage verified publication | Adopt |
| Do nothing until a library changes | No upgrade load | Existing profiles could remain on the old observation model indefinitely | Reject |

## Final recommendation stack

Use the PostgreSQL post-upgrade task ledger and existing cross-process lock
for one-time intent, the inventory revision table for per-library source
change state, the existing outbox planner for bounded admission, and its
leased worker for retries and acknowledgement. Keep the UI read-only in this
slice; add accessible status only when a verified progress API exists.

## Safety boundaries

- The new queue code is server-side ESM and accepts only registered task
  metadata as bound SQL parameters; it does not persist media titles or raw
  metadata in the task ledger.
- Task intent and revision changes commit or roll back together. Existing
  outbox uniqueness, row locking, leases, and revision acknowledgements remain
  responsible for concurrent workers and restart recovery.
- Inactive libraries keep pending revisions but are not claimed until active.
  A task-level ledger row is not interpreted as profile freshness.
- No AI call, policy conversion, routing grant, retention change, release, or
  production data backfill is part of this commit.
- There is no UI in this slice. If progress is later surfaced in Command
  Center, W3C status-message guidance calls for programmatically announced
  asynchronous state without taking keyboard focus.

## Official guidance checked September 2026

- [PostgreSQL 18 `INSERT`](https://www.postgresql.org/docs/18/sql-insert.html)
  documents atomic `ON CONFLICT` insert/update behavior, used for idempotent
  revision state changes.
- [PostgreSQL 18 `SELECT`](https://www.postgresql.org/docs/18/sql-select.html)
  describes `SKIP LOCKED` as appropriate for queue-like tables, as used by
  the existing outbox claim path.
- [Amazon Builders' Library: Making retries safe with idempotent APIs](https://aws.amazon.com/builders-library/making-retries-safe-with-idempotent-APIs/)
  motivates recording an idempotency identity and effects atomically.
- [W3C WCAG 2.2 status messages](https://www.w3.org/TR/wcag/#status-messages)
  informs a future accessible progress surface, not a UI change here.

## Follow-up boundary

The next high-value slice is revision-verified profile publication: persist
the source revision alongside the profile, atomically reject a publication
whose source changed during generation, and expose per-library pending,
retrying, and terminal-cooldown counts for operators. Test it on a disposable
old-version snapshot before considering automatic route promotion.
