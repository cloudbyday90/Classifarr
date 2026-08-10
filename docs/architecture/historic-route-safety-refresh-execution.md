# Historic Route-Safety Refresh Execution

Status: implemented. This document records the separately authorized command
that executes a reviewed subset of the historic route-safety refresh inventory.

## Problem

An inventory result is necessarily historical: an operator can review it, but
the pending record may be superseded, resolved, retried, or gain a retained
route-safety projection before execution begins. A generic bulk retry accepts
legitimate pending IDs, which is correct for ordinary recovery but too broad
for this remediation. The remediation must neither trust client-supplied
eligibility nor reconstruct an old gate from partial history.

## Research And Recommendations

PostgreSQL documents that `FOR UPDATE` locks selected rows against concurrent
updates and that a row may have changed by the time it is locked. The command
therefore evaluates eligibility after the retry service acquires its existing
row lock, not from a prior inventory snapshot. PostgreSQL also describes
`SKIP LOCKED` as an inconsistent view intended for queue-like consumers, so it
is not used to silently omit an operator-selected record. OWASP identifies
broken function-level authorization as a common API risk and recommends
default-deny, explicit authorization for every administrative function. NIST
AI RMF identifies accountability and transparency as trustworthiness
characteristics; an operator-selected, bounded receipt preserves those limits
without treating AI output as execution authority.

- [PostgreSQL `SELECT` locking clauses](https://www.postgresql.org/docs/current/sql-select.html)
- [PostgreSQL explicit locking](https://www.postgresql.org/docs/current/explicit-locking.html)
- [OWASP API5:2023 Broken Function Level Authorization](https://owasp.org/API-Security/editions/2023/en/0xa5-broken-function-level-authorization/)
- [NIST AI Risk Management Framework](https://www.nist.gov/publications/artificial-intelligence-risk-management-framework-ai-rmf-10)

Options considered:

1. Let the inventory invoke retry automatically.
   - Pros: one operator request.
   - Cons: turns a GET into a mutation, retries every currently listed item,
     and allows a stale report to decide execution. Rejected.
2. Reuse the generic `/api/classification/retry` endpoint with inventory IDs.
   - Pros: no new server code.
   - Cons: the generic endpoint intentionally supports ordinary retry use and
     does not require the historic route-safety condition at queue time.
     Rejected.
3. Add a dedicated, administrator-authorized execution command that delegates
   queueing to the existing retry service after a locked-row eligibility check.
   - Pros: selected IDs only, exact condition, existing idempotence and task
     lineage, minimum new mutation surface, and an inspectable receipt.
   - Cons: requires a second deliberate operator action. Selected.

## Final Recommendation Stack

1. `POST /api/classification/pending/route-safety-refresh/retry` accepts only
   `classificationIds`: one to 50 unique positive IDs. It rejects caller actor,
   task-source, and eligibility fields.
2. Both administrator and existing read-write authorization are required.
   The route derives `user:<id>` server-side and sets `Cache-Control: no-store`.
3. The command passes fixed internal source values and a receipt correlation ID
   to `ClassificationRetryService`; it does not implement its own queue writes.
4. After `ClassificationRetryService` locks the current history row, its
   server-only eligibility hook rebuilds the pending-question answer contract.
   Only `historical_route_safety_details_unavailable` can queue a retry.
5. Existing pending-status and duplicate-task checks still run inside that
   transaction. A changed, completed, duplicate, missing, or no-longer-historic
   record is reported as a bounded skipped result, not queued.
6. The receipt emits only selected ID, queued/skipped/failed status, and fixed
   reason ID. It excludes metadata, policy questions, task IDs, prompts,
   provider output, and learning state. It names only the aggregate count of
   existing metadata-enrichment follow-up tasks queued by the retry flow.
   Queued retries retain the correlation ID in the existing classification
   outcome lineage and a durable, privacy-bounded receipt item that can later
   be reconciled without searching raw history.

## Implemented Outcome

`policyRuntimeHistoricRouteSafetyRefreshEligibility.mjs` centralizes the one
server-owned historic-condition check used by both the read-only inventory and
the write command. `policyRuntimeHistoricRouteSafetyRefreshExecutionService.mjs`
normalizes the selected IDs, supplies the fixed retry context and locked-row
check, and projects a privacy-bounded receipt.

`classificationRouteHistoricRouteSafetyRefreshExecution.mjs` exposes the
command only through the dual administrator and read-write authorization gate.
`executeHistoricRouteSafetyRefresh` is the named client API leaf; no UI flow
automatically submits an inventory plan.

The follow-on read path is documented in [Historic Route-Safety Refresh Receipt
Reconciliation](historic-route-safety-refresh-receipt-reconciliation.md).

## Verification

Focused service tests prove selected-ID bounds, duplicate rejection, receipt
redaction, fail-closed missing retry results, and the historic-condition
eligibility callback. Retry-service tests prove that the callback receives the
locked current row before any task insert. Route tests prove both authorization
gates, server actor derivation, strict body allow-listing, and no-store output.
Client API tests cover the named POST leaf and barrel export.
