# Historic Route-Safety Refresh Receipt Reconciliation

Status: implemented. This document records the durable, read-only receipt
reconciliation path for the controlled historic route-safety retry command.

## Problem

The controlled retry command returns a correlation receipt immediately after it
queues selected work. That response establishes what the command attempted, but
it cannot prove that the queued work later reached a current classification
state. The generic history route can expose more operational detail than this
remediation needs, and a scan of `classification_history.metadata` would become
unreliable and expensive as retained history grows.

The reconciliation path must answer one narrow operator question for every
selected record: was it queued, and what is its current runtime state now? It
must do so without returning metadata, policy questions, task payloads,
provider output, prompts, route details, learning state, or internal task IDs.

## Research And Recommendations

PostgreSQL documents that repeatable-read transactions provide a stable
committed snapshot and that read-only transactions do not encounter
serialization conflicts. That makes a bounded receipt read consistent without
blocking the classification worker. PostgreSQL also recommends targeted
expression indexes when a particular JSON path is queried frequently; this
implementation avoids a history-wide JSON lookup entirely by beginning from the
receipt item and following at most eight primary-key lineage hops. OWASP API1
and API5 require explicit object and function authorization for ID-bearing and
administrative endpoints, while API3 recommends allow-listed response fields
instead of serializing internal objects.

- [PostgreSQL transaction isolation](https://www.postgresql.org/docs/current/transaction-iso.html)
- [PostgreSQL JSON types and targeted expression indexes](https://www.postgresql.org/docs/current/datatype-json.html)
- [OWASP API1:2023 Broken Object Level Authorization](https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/)
- [OWASP API3:2023 Broken Object Property Level Authorization](https://owasp.org/API-Security/editions/2023/en/0xa3-broken-object-property-level-authorization/)
- [OWASP API5:2023 Broken Function Level Authorization](https://owasp.org/API-Security/editions/2023/en/0xa5-broken-function-level-authorization/)

Options considered:

1. Read the generic classification history endpoint after retry.
   - Pros: no new persistence.
   - Cons: it is not receipt-bound, does not preserve a command snapshot, and
     exposes a broader operational projection. Rejected.
2. Search `classification_history.metadata` by correlation ID or retry
   lineage.
   - Pros: no new tables.
   - Cons: JSON shape is not a durable receipt contract, history retention can
     remove queue context, and broad JSON scans are unsuitable for a bounded
     operator read on large installations. Rejected.
3. Persist a compact receipt header and selected item rows, mark each queued
   item in the existing retry transaction, and reconcile from those IDs.
   - Pros: transaction-bound queue evidence, durable command scope, indexed
     primary-key lookup, bounded lineage traversal, and a minimal response.
   - Cons: adds two narrowly scoped tables and a small callback to the retry
     service. Selected.

## Final Recommendation Stack

1. The controlled command creates a UUID receipt header and one `requested`
   item per selected classification before any retry runs. The header stores
   only the server-derived actor ID, selected count, version, and timestamps.
2. After `ClassificationRetryService` inserts a retry task, its server-only
   receipt callback changes that item to `queued` in the same transaction. If
   receipt persistence fails, the task and source-row mutation roll back.
3. After the bounded batch returns, the command records each fixed
   `queued`, `skipped`, or `failed` result and finalizes the header only when
   every selected item is accounted for. An interrupted command remains
   explicitly `incomplete`; it is never reported as successful by inference.
4. `GET /api/classification/pending/route-safety-refresh/receipts/:receiptId`
   requires an authenticated administrator and the server-derived actor that
   created the receipt, validates a canonical UUID, uses `REPEATABLE READ READ
   ONLY`, and sets `Cache-Control: no-store`. A foreign receipt is reported as
   not found; it is a read-only route and does not require write authorization.
5. Reconciliation looks up receipt items by their primary key, checks the
   retained queue row when available, and follows the persisted replacement
   classification ID through at most eight primary-key lineage steps. It does
   not scan or return JSON metadata.
6. The response allow-lists selected classification ID, fixed execution reason
   and status IDs, fixed current-runtime status IDs, aggregate counts, and
   receipt timestamps. It does not return source IDs, replacement IDs, task
   IDs, raw status payloads, metadata, provider data, or policy content.

## Implemented Outcome

`policyRuntimeHistoricRouteSafetyRefreshReceiptRepository.mjs` owns the
transactional header/item writes and bounded reconciliation query.
`policyRuntimeHistoricRouteSafetyRefreshReceiptReconciliationService.mjs`
owns the safe report projection. `ClassificationRetryService` accepts an
internal `retryReceiptRecorder` callback, called after the task insert and
before source history state changes; ordinary retry callers do not provide it.

The receipt report distinguishes command state from runtime state. `skipped`
and `failed` records remain `not_queued` and `retry_failed`; queued records may
be `queue_pending`, `queue_processing`, a concrete current classification
status such as `runtime_routed`, or `current_runtime_not_observed` once the
retained queue task is complete but no successor is available. This is
deliberately conservative: absent evidence is not presented as a successful
route.

`classificationRouteHistoricRouteSafetyRefreshReceipt.mjs` is the protected
actor-bound read endpoint. `getHistoricRouteSafetyRefreshReceipt` is the named
client API leaf. The later [Recent Receipt Resume](historic-route-safety-refresh-recent-receipt-resume.md)
follow-up adds a bounded actor-owned discovery reference without expanding this
report or introducing a retry writer.

## Verification

Focused tests cover receipt creation, in-transaction queue recording,
finalization, bounded recursive lineage lookup, UUID validation, no-store
headers, administrator-only access, status derivation, and response redaction.
Retry-service coverage confirms that the receipt callback is invoked after task
insertion. The migration and schema snapshot cover fresh-install parity.
