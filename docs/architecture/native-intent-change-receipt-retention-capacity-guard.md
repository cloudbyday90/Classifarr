# Native Intent Change Receipt Retention And Capacity Guard

## Status

Implemented as roadmap task **12R.8 Native Intent Change Receipt Retention And
Capacity Guard** on 2026-08-16.

## Problem

Native-intent change receipts make an ambiguous HTTP outcome safe to replay and
support one recent post-reload status lookup. They are intentionally compact,
but still retain an idempotency key, command fingerprint, revision references,
and applied-command identifiers. Leaving that operational state unbounded is a
storage and retention risk; aggressively deleting it would instead weaken exact
replay or the recent recovery hint.

The cleanup cannot add a receipt-history API, expose an operational identifier,
change policy authority, route an item, learn from a policy, or call AI.

## Research

[PostgreSQL's transaction-isolation documentation](https://www.postgresql.org/docs/current/transaction-iso.html)
and [explicit-locking documentation](https://www.postgresql.org/docs/current/explicit-locking.html)
support using a transaction-scoped advisory lock plus `FOR UPDATE SKIP LOCKED`
for one bounded concurrent maintenance batch. PostgreSQL also documents that
indexes speed selective retrieval but add write overhead, so the implementation
adds one narrow chronological B-tree only for the retention query rather than
several overlapping indexes. [PostgreSQL Indexes](https://www.postgresql.org/docs/current/indexes.html)

PostgreSQL automatic vacuuming is enabled by default and handles deleted-tuple
maintenance, so this task issues no privileged `VACUUM` or `VACUUM FULL` from
the application. [PostgreSQL Automatic Vacuuming](https://www.postgresql.org/docs/current/runtime-config-vacuum.html)
[OWASP's Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
also supports retaining operational records only for their defined need while
protecting them from unauthorized modification and deletion.

## Options Considered

| Option | Pros | Cons |
| --- | --- | --- |
| Fixed 30-day replay retention with protected cleanup | Defines a clear operational lifecycle, greatly exceeds the 60-minute recovery read, and limits stored identifiers. | Same-key replay is no longer guaranteed after the window. |
| Delete oldest rows whenever capacity is high | Enforces a hard row ceiling. | Could remove fresh replay or recovery receipts. Rejected. |
| Keep receipts indefinitely | Preserves replay indefinitely. | Leaves operational identifiers and table growth unbounded. Rejected. |
| Browser-managed cleanup or receipt history | Seems convenient for an operator. | Creates client authority and disclosure surfaces. Rejected. |
| Application-only age check | Small implementation. | A caller bug could use the maintenance permit to delete a fresh receipt. Rejected. |

## Decision

The replay guarantee is now explicitly bounded to **30 days**. This remains
substantially longer than the fixed 60-minute, newest-one 12R.7 recovery
window. After 30 days, an old browser-generated key is no longer replayable;
the normal administrator authorization and source-revision check still prevent
it from creating a second revision.

`policyNativeIntentChangeReceiptRetentionService.mjs` owns daily cleanup. It:

1. requires one database transaction and a dedicated transaction-scoped
   advisory lock;
2. counts only aggregate total and expired rows;
3. grants the narrow transaction-local `retention_cleanup` permit only when
   expired rows exist;
4. selects at most 100 expired rows, age ordered, using `FOR UPDATE SKIP
   LOCKED`, and deletes only those selected rows;
5. returns and logs aggregate counts and a `hasMore` signal, never receipt
   IDs, keys, fingerprints, command values, policy content, or history; and
6. runs once daily at 03:17 through the existing scheduler, with no startup,
   HTTP, client, or manual command surface.

The trigger independently accepts `retention_cleanup` only for a row whose
`created_at` is older than 30 days. `replace_restore` and parent-policy
cascade remain separately authorized paths. This defense in depth prevents a
maintenance-query regression from deleting a fresh receipt.

## Capacity Guard

The service reports `within_capacity` below 10,000 rows, `capacity_warning`
from 10,000 rows, and `capacity_critical` from 25,000 rows. It removes only
expired records through its next scheduled batch, and it cannot
remove a protected record merely to meet a capacity number. Remaining pressure
therefore emits a bounded warning for an operator rather than silently reducing
the replay guarantee or rejecting policy changes.

The `(created_at, id)` index serves the chronological count and bounded-delete
shape. PostgreSQL autovacuum owns physical reclamation after deletes; the
application neither performs nor requires a manual vacuum.

## Final Recommendation Stack

1. Keep the fixed 30-day exact-replay contract and the 60-minute recovery
   window separate.
2. Grant the retention permit only inside a lock-protected database
   transaction, with a database-side age guard as the final enforcement point.
3. Delete in small age-ordered `SKIP LOCKED` batches and observe only counts.
4. Treat capacity as a warning guard, never permission to evict a live receipt.
5. Keep cleanup scheduler-owned and private; do not add history, browser
   controls, routing, learning, or AI behavior.
6. Rely on configured PostgreSQL autovacuum for normal post-delete maintenance
   and investigate persistent critical pressure at the deployment layer.

## Verification

Focused tests cover the bounded contract, lock contention, transaction failure,
permit order, `SKIP LOCKED` query shape, capacity states, scheduler delegation,
and no raw receipt projection. PostgreSQL integration coverage proves that the
retention permit cannot delete a fresh receipt, deletes an expired receipt,
leaves the current 12R.7 discovery result intact, and turns an expired replay
into the existing stale-revision outcome instead of creating another intent
revision.
