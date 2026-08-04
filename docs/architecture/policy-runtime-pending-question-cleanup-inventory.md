# Policy Runtime Pending-Question Cleanup Inventory

**Status:** Complete for Phase 5R.7.2

## Purpose

Phase 5R.7.2 provides an administrator-only, read-only inventory of pending
policy questions that Phase 5R.7.1 has classified for cleanup. It gives the
operator bounded action and reason IDs without exposing stored question text,
AI context, answer labels, metadata, or a client-controlled cleanup action.

The inventory does not replace the eventual apply workflow. It does not mutate
classification rows, regenerate questions, resolve outcomes, write learning,
or persist audit rows.

## Research Basis

The implementation follows the following official guidance available at the
June 2026 planning cutline:

- The [OWASP REST Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html)
  recommends endpoint-level access control, method allowlisting, generic error
  handling, and `Cache-Control: no-store` for sensitive REST responses.
- The [OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
  recommends server-side syntactic and semantic allowlist validation. The
  inventory accepts no action, reason, state, or identifier inputs from the
  client and queries only the two pending status values on the server.
- PostgreSQL documents that [repeatable-read transactions](https://www.postgresql.org/docs/17/transaction-iso.html)
  provide a stable snapshot for successive reads, and that
  [`SET TRANSACTION`](https://www.postgresql.org/docs/17/sql-set-transaction.html)
  can set the read-only and isolation characteristics for one transaction.
- [RFC 9111](https://www.rfc-editor.org/rfc/rfc9111.html) specifies that a
  cache must not store a response carrying `Cache-Control: no-store`. It is a
  transport safeguard, not a substitute for authorization.

## Options Considered

### 1. Reuse the ordinary pending-question endpoint

**Pros:** No new route or report type.

**Cons:** That endpoint intentionally exposes an operator-facing question
shape. It is not a bounded migration report and can carry fields this cleanup
workflow must not return.

### 2. Add a client-configurable preview endpoint

**Pros:** Allows ad hoc limits, action filters, and supplied current state.

**Cons:** Lets callers influence a server-authoritative cleanup decision,
complicates auditing, and increases the risk of an unbounded or stale report.

### 3. Server-owned, bounded, read-only inventory

**Pros:** Uses one stable server snapshot, restricts rows to known pending
states, derives all current state in the database, returns only canonical plan
data, and establishes the route contract that the apply task will consume.

**Cons:** The initial 200-record cap can produce a truncated report, and a
later task must add a fresh locked revalidation before any change is applied.

## Decision

Use option 3. The implementation is divided by responsibility:

- [Inventory repository](../../server/src/services/policyRuntimePendingQuestionCleanupInventoryRepository.mjs)
  runs parameterized, bounded queries for pending rows and current library and
  policy state.
- [Inventory report](../../server/src/services/policyRuntimePendingQuestionCleanupInventoryReport.mjs)
  parses persisted state internally, derives current context, invokes the
  Phase 5R.7.1 classifier, aggregates canonical counts, validates the report,
  and recursively freezes the result.
- [Inventory service](../../server/src/services/policyRuntimePendingQuestionCleanupInventoryService.mjs)
  establishes a `REPEATABLE READ READ ONLY` transaction before it performs the
  inventory reads.
- `GET /api/classification/pending-cleanup/inventory` is protected by the
  existing classification admin mount and a second route-level administrator
  check. It accepts no cleanup control fields and responds with
  `Cache-Control: no-store`.
- The central client API exposes `getPendingQuestionCleanupInventory()` without
  adding a UI caller. UI work remains a separate phase.

The repository selects only `awaiting_decision` and `pending_retry` rows. It
reads at most 201 rows, emits at most 200 plans, and marks the result as
truncated when additional pending rows exist. Current active library IDs,
referenced policy enablement, and context timestamps are derived from the same
read-only snapshot. An inactive or missing referenced policy fails closed to a
retry plan; a missing or inactive candidate library is a stale candidate.

## Report Contract

The response contains only:

- report version, mode, and generation timestamp;
- frozen per-record cleanup plans from Phase 5R.7.1;
- aggregate status, action, and reason counts;
- bounded state counts and truncation state; and
- explicit false side-effect indicators and validation results.

It never returns persisted `policy_question`, `metadata`,
`clarification_response`, raw AI rationale, destination labels, library names,
or current-state records. A nonempty legacy response is always treated as
untrusted, including a string or other non-object JSON shape. The response is a
dry-run observation, not an apply receipt and not a durable audit record.

## Security And Migration Properties

- The route independently requires an authenticated administrator, even though
  the parent classification router already has the same admin protection.
- The service uses a read-only transaction and contains no SQL mutation.
- The fixed query limit prevents unbounded response size and bounds the number
  of state lookups.
- Current library and policy state is supplied only by the server. Query-string
  and request-body attempts to supply an action, reason, or current state have
  no effect.
- The plan’s no-learning disposition, strict audit, and deep-frozen report
  prevent the dry-run output from carrying source records or becoming a writer.
- Phase 5R.7.3 must lock and reclassify each selected current row before any
  action, regardless of this snapshot’s result.

## Implementation Outcome

Focused regression coverage verifies administrator access, uncached responses,
ignored client action fields, stable read-only transaction setup, bounded
inventory selection, frozen reports, hidden persisted content, inactive-policy
failure behavior, and unchanged existing classification router factories.

## Follow-on Work

The next task is **Phase 5R.7.3: Transactional Cleanup Apply And Audit
Record**. It will require a new explicit apply request, lock and reclassify
each selected row, and persist a bounded replay-safe audit record. It must not
trust this report as authorization or as a current-state proof.
