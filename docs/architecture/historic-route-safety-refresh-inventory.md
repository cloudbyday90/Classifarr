# Historic Route-Safety Refresh Inventory

Status: implemented. This document records the bounded operator inventory for
pending decisions that predate the route-safety projection and therefore must
be evaluated again before a destination-changing outcome can be considered.

## Problem

The pending-decision card correctly identifies a historic high-score record
whose original route-safety details were not retained. An operator may need to
locate every affected active record before planning a controlled refresh.
Scanning raw history in a browser or automatically retrying every pending item
would be unsafe: active state can change between inspection and execution, and
unrelated pending records must not be retried because they appear in the same
table.

## Research And Recommendations

PostgreSQL specifies that a `SELECT` with `ORDER BY` and `LIMIT` returns an
ordered subset, while no ordering is promised without `ORDER BY`. Its current
transaction-isolation documentation also states that a repeatable-read
transaction sees a stable committed snapshot, and that read-only transactions
do not need retry handling for serialization conflicts. NIST AI RMF calls for
documented human-AI oversight roles, AI knowledge limits, and accountable
go/no-go decisions. Together, these support a bounded, stable, read-only
operator inventory instead of a speculative historical reconstruction or an
automatic side effect.

- [PostgreSQL `SELECT` documentation](https://www.postgresql.org/docs/current/sql-select.html)
- [PostgreSQL transaction isolation](https://www.postgresql.org/docs/current/transaction-iso.html)
- [NIST AI RMF Core](https://airc.nist.gov/airmf-resources/airmf/5-sec-core/)
- [NIST AI RMF Measure guidance](https://airc.nist.gov/airmf-resources/playbook/measure/)

Options considered:

1. Automatically retry every pending decision with a high score.
   - Pros: no operator inventory is needed.
   - Cons: current state may have changed, unrelated pending work can be
     retried, and the GET request would cause provider and media-server work.
     Rejected.
2. Reuse the broad pending-question cleanup apply operation.
   - Pros: it already has an inventory and an apply path.
   - Cons: it addresses several legacy question-contract conditions and can
     change persisted pending state; it is not a route-safety-specific refresh
     report. Rejected.
3. Add an administrator-only, read-only route-safety inventory with a bounded
   retry plan that invokes no command itself.
   - Pros: exact scope, stable snapshot, reviewable plan, no provider call,
     route, history mutation, or learning write.
   - Cons: operators must explicitly invoke the existing authorized retry
     command after reviewing the plan. Selected.

## Final Recommendation Stack

1. A partial PostgreSQL index over active pending IDs supports ascending,
   keyset-paginated reads without scanning completed history.
2. The inventory uses `REPEATABLE READ READ ONLY`, fetches at most 51 rows,
   and emits at most 50 records. `cursor` is an ID, not an offset.
3. Each record is re-evaluated through the server-owned pending-question answer
   contract. Only the precise
   `historical_route_safety_details_unavailable` status is included.
4. The report allow-lists an item identity, active pending status, fixed reason
   ID, and `retry_classification` action. It excludes metadata, policy
   questions, prompts, provider data, and free-form model output.
5. `GET /api/classification/pending/route-safety-refresh-inventory` requires
   an authenticated administrator and returns `Cache-Control: no-store`. It
   produces a plan only; the existing authorized retry command rechecks live
   state before it queues any retry.

## Implemented Outcome

`policyRuntimeHistoricRouteSafetyRefreshInventory.mjs` provides the bounded
repository read, pure report projection, report validation, and transaction
service. Its `operatorRetryPlan` has a maximum of 50 IDs, an explicit
`not_executed` execution state, and requires a separately authorized command.

`classificationRouteHistoricRouteSafetyRefreshInventory.mjs` exposes that
service only to administrators. The matching client API method is
`getHistoricRouteSafetyRefreshInventory`; it only reads the report and does
not wire an automatic bulk retry into the command center.

The new migration adds
`idx_classification_history_active_pending_refresh_inventory`, a partial index
on active pending IDs. It does not modify existing rows or backfill historic
route-safety data.

## Verification

Focused server tests prove that the report is frozen, omits persisted metadata,
excludes records that retain a real route-safety gate, caps its page, preserves
keyset pagination, and never executes a retry. Route tests prove admin-only
access, bounded query input, and `no-store`. Client API tests prove the named
read path. The migration checker and schema snapshot verify the supporting
partial index.
