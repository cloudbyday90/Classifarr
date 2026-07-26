# Policy Authorized Outcome Transaction Executor

## Status

Implemented as Phase 6R.3.3c and adopted by Phase 6R.3.3d. The active manual
correction route composes its locked lifecycle transition with this reusable
server-side transaction boundary through one caller-owned transaction client.

## Problem

Canonical intake, the learning guard, the authorized command, and the
source-event receipt are individually safe but do not, by themselves, make a
durable write atomic. A source-specific route could otherwise validate stale
state, write an outcome without its receipt, write learning after the outcome
has committed, or replay an event after a partial failure.

The legacy outcome projection also predates this boundary. It records compact
outcome history, while source-specific lifecycle changes remain the concern of
the later adapter adoption task. The executor must not guess a universal
classification-status transition for every source.

## Official Guidance Reviewed

Official sources reviewed July 26, 2026 against the requested June 2026
baseline:

- [OWASP Transaction Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Transaction_Authorization_Cheat_Sheet.html)
  calls for server-side transaction enforcement and an execution-time
  authorization check.
- [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)
  recommends deny-by-default and validating permissions on every request.
- [OWASP Business Logic Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Business_Logic_Security_Cheat_Sheet.html)
  recommends server-side validation of legal object state at the point an
  operation acts.
- [PostgreSQL Explicit Locking](https://www.postgresql.org/docs/current/explicit-locking.html)
  documents that `SELECT ... FOR UPDATE` prevents concurrent modification of a
  selected row until transaction end.
- [PostgreSQL Transaction Isolation](https://www.postgresql.org/docs/current/transaction-iso.html)
  documents Read Committed visibility and concurrent conflict behavior.
- [PostgreSQL INSERT](https://www.postgresql.org/docs/current/sql-insert.html)
  documents the `ON CONFLICT DO NOTHING` primitive used by the receipt claim.

## Design

```text
canonical intake + pure guard decision + server-only authority context
  -> BEGIN
  -> lock classification, then target library (consistent order)
  -> revalidate actor and destination from locked rows
  -> rebuild the authorized persistence command
  -> claim source-event receipt
  -> persist compact final-outcome projection
  -> execute only allowlisted, implemented learning operation
  -> COMMIT
```

A source adapter may already hold a transaction for a source-specific lifecycle
transition. In that case, `execute({ client })` reuses the provided client
rather than opening a nested transaction; the shared execution path validates
canonical intake again before it locks or writes.

The executor accepts a canonical intake, a pure learning decision, and an
opaque authorization context. It never trusts a prebuilt command or an
authorization object supplied by a caller. The executor's injected
authorization revalidator receives the locked state and returns the
server-derived authority used to build the command.

The executor locks `classification_history` before `libraries`, which is the
only multi-row lock order it owns. It requires an existing, active target
library whose media type matches the locked classification. The library's
locked identifier and name become the command's revalidated destination
snapshot. A renamed, disabled, missing, or incompatible destination blocks the
operation before a receipt is claimed.

`finalOutcome.recorded` remains a statement that the source decision is an
established final outcome, not a claim that this executor has already written
the compact outcome projection. The executor owns the latter side effect and
does not expose a completed-write flag through the pure command.

## Operation Boundaries

- The final-outcome writer records a compact projection through
  `classificationOutcomeService` using the transaction client. A failure is
  converted to an exception so the receipt and all preceding writes roll back.
- The exact-item-memory writer uses only the locked classification's TMDB ID,
  media type, target library, and actor identifier. It never forwards raw
  intake, provider, Discord, AI, question, or route payloads to evidence
  storage.
- Compatibility and identity evidence now use their dedicated writers and
  append a compact refresh-outbox record through the same transaction. The
  profile generator remains outside this boundary until the dedicated worker is
  implemented.
- A replayed receipt performs no new write. A source-event mismatch performs
  no new write and is returned as a rejected execution gate.
- The executor does not select a source-specific lifecycle status such as
  `corrected`, `verified`, or `routed`. Phase 6R.3.3d will provide the manual
  correction adapter in the same transaction rather than hard-coding those
  meanings here.

## Options Considered

### Keep Outcome, Learning, And Receipt as Separate Calls

Pros: minimal change to legacy routes.

Cons: creates partial-write and duplicate-event windows; rejected.

### Make the Executor Infer Every Source Lifecycle Transition

Pros: one service appears to own all writes.

Cons: `resolved` has different operational meanings by source. Inference would
overwrite source-specific behavior and make future adapters unsafe; rejected.

### Generic Transaction Executor With Explicit Implemented Writers

Pros: atomic receipt/outcome/exact-item behavior, source-agnostic locking and
authorization, explicit fail-closed behavior for future writers, and a narrow
adoption seam.

Cons: source adapters must still provide their lifecycle transition in a later
task; selected.

## Final Recommendation Stack

1. Validate canonical intake before opening a transaction.
2. Lock classification and destination in a fixed order.
3. Revalidate actor authority and target viability from locked state.
4. Rebuild, rather than accept, the pure authorized command.
5. Claim the fingerprint-bound source-event receipt inside the same
   transaction.
6. Persist the compact final-outcome projection and only implemented,
   command-approved writers.
7. Roll back on every unavailable writer or persistence failure.
8. Adopt one live source at a time; manual correction is the first consumer.

## Security Outcome

- The executor fails closed when the transaction boundary, locked state,
  destination, revalidated authority, receipt claim, or writer is invalid.
- It never persists raw intake or authorization context in receipts or evidence
  payloads.
- Replayed events cannot repeat outcome or learning side effects.
- A changed source-event payload cannot overwrite the first committed result.

## Verification

Focused tests cover lock order, missing or inactive destinations, media-type
drift, authorization loss, command blocking, exact replay, source-event
mismatch, caller-owned transaction reuse, refresh-backed evidence composition,
and rollback propagation from every writer. The manual correction lifecycle
integration suite verifies this boundary with a durable receipt.

## Next Step

Phase 6R.3.3e.1 now validates the pure refresh command in
[Policy Profile Refresh Command Contract](policy-profile-refresh-command-contract.md).
Phase 6R.3.3e.2 is implemented in
[Policy Compatibility Evidence Writer](policy-compatibility-evidence-writer.md).
Phase 6R.3.3e.4 is implemented in
[Policy Profile Refresh Outbox Persistence](policy-profile-refresh-outbox-persistence.md).
Proceed to **Phase 6R.3.3e.5: Refresh Worker Consumer**. It must consume only
committed refresh records outside this transaction.
