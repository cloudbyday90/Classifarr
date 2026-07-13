# Policy Library Rebuild Replacement Gate

## Status

Implemented on 2026-07-12 as Task 7R.7.2. The gate replaces one active native
intent only after the same accepted rebuild has a persisted rollback snapshot
and a no-difference migration verifier result. It keeps legacy rows intact;
legacy deletion remains a separate, later decision.

## Problem

The rollback-snapshot gate proves that an accepted rebuild has a recoverable
starting point, but that alone must not replace an active native intent. A
replacement needs to reject a different proposal, a changed policy or intent,
an expired acceptance, a stale or restored snapshot, verifier differences, and
an already-applied retry. Reconstructing strict runtime constraints from
human-readable labels would also silently change policy behavior.

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

1. Validate the rebuild proposal, accepted transition, and bounded verifier
   report before opening a transaction.
2. Require a no-difference verifier report whose proposal and transition
   fingerprints match the accepted transition.
3. In one transaction, lock the policy, persisted execution gate, active
   original intent, and unexpired unrestored rollback snapshot.
4. Revalidate the acceptance transition at execution time and reject expired,
   mismatched, missing, or non-`snapshot_persisted` execution state.
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
- Replacement gate:
  `server/src/services/policyLibraryRebuildReplacementGate.mjs`
- Focused tests:
  `server/src/__tests__/services/policyLibraryRebuildReplacementContract.test.mjs`
  and
  `server/src/__tests__/services/policyLibraryRebuildReplacementGate.test.mjs`

## Verification

- The contract tests prove typed entries produce a valid native contract and
  that unknown keys or label-only strict constraints are rejected.
- The gate tests cover atomic replacement, terminal idempotency, verifier
  differences, expired execution state, and rollback-safe persistence failure.
- Schema tests require the replacement references, terminal-state constraint,
  index, and migration event type in the Docker-generated schema snapshot.

## Next Component

Implement structured strict-constraint descriptors for rebuild proposals. That
component should preserve exact operator and value semantics from the policy
builder so a deliberately declared hard limit can become a native rule without
any label parsing or inference.
