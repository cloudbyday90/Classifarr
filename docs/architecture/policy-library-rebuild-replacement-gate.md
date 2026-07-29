# Policy Library Rebuild Replacement Gate

## Status

Implemented on 2026-07-12 as Task 7R.7.2, extended on 2026-07-13 by Task
7R.7.3, and hardened on 2026-07-29 by Phase 6R.6 Task 6R.6.6. The gate
replaces one active native intent only after the same accepted rebuild has a
persisted rollback snapshot and the immutable no-difference verification
receipt bound to that snapshot's execution gate. It keeps legacy rows intact;
legacy deletion remains a separate, later decision.

## Problem

The rollback-snapshot gate proves that an accepted rebuild has a recoverable
starting point, but that alone must not replace an active native intent. A
replacement needs to reject a different proposal, a changed policy or intent,
an expired acceptance, a stale or restored snapshot, missing or invalid receipt
binding, verifier differences, and an already-applied retry. Reconstructing
strict runtime constraints from human-readable labels would also silently
change policy behavior.

## Research

- [PostgreSQL transaction isolation](https://www.postgresql.org/docs/current/transaction-iso.html)
  documents that `Read Committed` uses a new snapshot for each statement and
  that predetermined row updates can safely re-check the locked current row.
- [PostgreSQL explicit locking](https://www.postgresql.org/docs/current/explicit-locking.html)
  documents the conflict behavior of `SELECT ... FOR UPDATE`. The gate locks
  the policy, original intent, execution state, and rollback snapshot in a
  consistent order instead of using a table lock.
- [OWASP Transaction Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Transaction_Authorization_Cheat_Sheet.html)
  recommends server-side transaction authorization, protected transaction
  data, an explicit final gate, and time-bounded authorization.
- [OWASP Business Logic Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Business_Logic_Security_Cheat_Sheet.html)
  recommends explicit state-machine validation, replay handling, expiry, and
  atomic check-then-act authorization for sensitive workflows.

## Options Considered

### Apply directly from the rebuild proposal

Pros:

- Fewer persisted records.
- Simpler call sequence.

Cons:

- Lets an unpersisted acceptance or a changed proposal authorize a write.
- Cannot prove the rollback snapshot was current at replacement time.
- Makes retries indistinguishable from a second replacement attempt.

### Treat label-only evidence as executable constraints

Pros:

- More proposals could move forward automatically.

Cons:

- Labels such as `No NC-17` do not encode the operator, comparison direction,
  or value representation required by a strict runtime rule.
- Guessing a constraint can tighten, loosen, or invert live policy behavior.

### Persist a native replacement from typed, lossless rules only

Pros:

- The database receives a versioned native contract that its runtime read path
  already understands.
- Typed identity, helpful, and avoidance entries map deterministically.
- Ambiguous strict constraints fail closed and can be completed through a
  structured authoring path.
- The terminal gate stores the replacement intent and event for idempotency.

Cons:

- Some otherwise reviewable proposals remain blocked until their hard limits
  carry structured rule semantics.
- Adds an execution-state migration and a dedicated persistence service.

## Final Recommendation Stack

1. Validate only the rebuild proposal and accepted transition before opening a
   transaction; a caller verifier report cannot authorize replacement.
2. In one transaction, lock the policy and persisted execution gate, then lock
   exactly the receipt whose ID is recorded on that gate.
3. Require the recorded receipt ID and verifier fingerprint to match the
   locked receipt, and revalidate its transition, source, status, difference,
   and audit summaries.
4. Revalidate the acceptance transition for a current `snapshot_persisted`
   execution, and reject expired, mismatched, missing, or invalid state before
   replacement writes.
5. Translate only typed rebuild entries into the native contract. Preserve
   current review behavior and routing; never infer strict constraint operators
   from labels.
6. Deactivate the original intent, insert the next active native version and
   its rules, routing target, validation status, and replacement event, then
   mark the execution gate `replacement_applied` in the same transaction.
7. Return the terminal execution on the same idempotency key without writing a
   second native intent. Keep legacy deletion disabled.

## Security Boundaries

- The request cannot supply a snapshot ID, replacement ID, actor ID, or terminal
  state. Those values are read or generated inside the transaction.
- The request cannot supply replacement verification authority. The gate locks
  and validates only the immutable receipt reference already stored on the
  execution gate.
- The gate stores and reports bounded numeric identifiers and SHA-256
  fingerprints, not proposal payloads, provider output, prompts, embeddings,
  or raw operator identifiers.
- A rollback snapshot must be owned by the exact policy and original intent,
  remain unexpired, and not have been restored.
- Accepted transitions are revalidated at execution time. A prior acceptance
  never survives its bounded expiration window.
- The final write leaves legacy policy rows in place. Removing compatibility
  storage is intentionally excluded from this component.

## Implementation

- Schema migration:
  `database/migrations/20260712_130000_add_policy_library_rebuild_replacement_references.sql`
- Typed rebuild-to-native contract:
  `server/src/services/policyLibraryRebuildReplacementContract.mjs`
- Replacement persistence:
  `server/src/services/policyLibraryRebuildReplacementPersistence.mjs`
- Receipt binding:
  `server/src/services/policyLibraryRebuildVerificationRunBinding.mjs`
- Replacement gate:
  `server/src/services/policyLibraryRebuildReplacementGate.mjs`
- Focused tests:
  `server/src/__tests__/services/policyLibraryRebuildReplacementContract.test.mjs`
  and
  `server/src/__tests__/services/policyLibraryRebuildReplacementGate.test.mjs`

## Verification

- The contract tests prove typed entries produce a valid native contract and
  that unknown keys or label-only strict constraints are rejected.
- The gate tests cover atomic replacement, exact receipt locking, terminal
  idempotency, caller report injection, missing/mismatched/review-required
  receipt evidence, expired execution state, and rollback-safe persistence
  failure.
- Schema tests require the replacement references, terminal-state constraint,
  index, and migration event type in the Docker-generated schema snapshot.

## Strict-Constraint Descriptors

Task 7R.7.3 adds a versioned structured descriptor that preserves a deliberate
strict constraint's native signal type, operator, values, mode, and semantics
through the rebuild proposal. Replacement converts only a validated descriptor
into a native hard-limit rule; label-only constraints remain blocked. The
detailed design and verification record is [Policy Library Rebuild
Strict-Constraint Descriptors](policy-library-rebuild-strict-constraint-descriptors.md).

## Current Receipt Binding

The detailed current design and outcome record is [Policy Library-Rebuild
Replacement-Gate Verification Binding](policy-library-rebuild-replacement-gate-verification-binding.md).
It supersedes the historical caller-report authorization described by the
original implementation: current replacement reads only the receipt bound to
the execution gate and persists compact receipt provenance in the migration
event.

## Next Component

Library Rebuild Server-Owned Cutover Orchestration must compose verified
transition, receipt, snapshot, and replacement through one idempotent,
browser-free workflow before any deletion gate is considered.
