# Policy Authorized Outcome Persistence Command

## Status

Implemented as Phase 6R.3.3a. This component creates a pure, auditable write
plan only. It does not open a transaction, query the database, persist an
outcome, write learning evidence, queue refresh work, route media, or call a
provider.

## Problem

The learning intake and guard now produce bounded decisions, but that does not
make a write safe. The legacy manual-correction route can update a
classification outcome and exact-item evidence in separate operations. That
allows state to change between validation and mutation, cannot prove that a
source event was applied only once, and mixes actor permission checks with
learning eligibility.

## Official Guidance Reviewed

Official sources reviewed July 2026 against the requested June 2026 baseline:

- [OWASP Transaction Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Transaction_Authorization_Cheat_Sheet.html)
  requires server-side enforcement, sequential state transitions, protected
  transaction data, and a final authorization control at execution.
- [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)
  recommends deny-by-default authorization and per-request permission checks.
- [OWASP Business Logic Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Business_Logic_Security_Cheat_Sheet.html)
  recommends rechecking ownership and legal server-side state at the time an
  operation acts on an object.
- [PostgreSQL Explicit Locking](https://www.postgresql.org/docs/17/explicit-locking.html)
  documents that `SELECT ... FOR UPDATE` prevents concurrent mutation of the
  locked row until the transaction ends.
- [PostgreSQL INSERT](https://www.postgresql.org/docs/16/sql-insert.html)
  documents unique-constraint conflict handling through `ON CONFLICT`, the
  database primitive selected for source-event idempotency in the next task.

## Design

```text
server-locked current state + revalidated authorization
  + canonical intake + learning-guard decision
  -> policy.authorized_outcome_persistence_command.v1
  -> later transaction executor and idempotency ledger
```

`policyAuthorizedOutcomePersistenceCommand.mjs` revalidates that the bounded
source, source event, item, destination, final outcome, and transaction state
all agree. It requires a server-revalidated actor, a locked current state, and
per-source outcome authority. It allows a learning operation only when the
guard chose an allowlisted candidate tier and the actor separately has
learning-write authority.

The command always separates final outcome from learning. A valid outcome can
remain `outcome_only` when learning was not requested, is blocked by the
guard, or lacks separate learning-write authority. The command reports planned
operations and reason codes, never completed writes.

## Recommendations

1. Construct authorization and current-state input only inside the future
   transaction executor after it locks the persisted classification row.
2. Use the canonical source event as the idempotency key, with a database
   unique constraint rather than an in-memory cache.
3. Revalidate source permission, actor identity, destination, and legal
   current state immediately before writes.
4. Commit final outcome, idempotency receipt, approved learning evidence, and
   any refresh command in one transaction; rollback all of them on failure.
5. Preserve `outcome_only` as a successful result. A denied or ineligible
   learning write must never erase a valid manual resolution.

## Pros And Cons

### Pros

- Defines the exact inputs the future transaction executor must rederive.
- Keeps actor authorization separate from learning eligibility.
- Makes an outcome-only resolution explicit and safe.
- Prevents raw client, Discord, AI, provider, quota, and routing payloads from
  appearing in an authorized write plan.
- Provides focused tamper and missing-lock test coverage before storage work.

### Cons

- This task deliberately creates no durable idempotency receipt yet.
- Existing routes are not adopted until the transaction executor is complete.
- Compatibility and identity evidence have planned operation IDs but no writer
  is enabled until the executor and storage model are separately reviewed.

## Final Recommendation Stack

1. `policyLearningIntakeContract.mjs` validates bounded source input.
2. `policyLearningGuard.mjs` decides whether learning is eligible.
3. `policyAuthorizedOutcomePersistenceCommand.mjs` validates server-derived
   authorization and locked current-state alignment, then emits a pure plan.
4. Phase 6R.3.3b adds an append-only unique source-event ledger.
5. Phase 6R.3.3c adds the transaction executor and adopts manual correction.

## Security Outcome

- No command is admitted without a matching source event and locked state.
- Outcome and learning permissions are independently checked.
- A future caller cannot convert an outcome-only decision into a learning
  operation by changing the returned plan.
- The command has no database, provider, media-server, routing, quota, profile
  refresh, or learning mutation side effect.

## Verification

Unit tests cover an authorized exact-item plan, outcome-only fallback when
learning authority is absent, Discord outcome-only input, missing transaction
lock, source-event and source-permission mismatches, and reported side-effect
tampering.

## Next Step

Proceed to **Phase 6R.3.3b: Source-Event Idempotency Ledger**. Add the
append-only storage migration and repository with a unique source-event key;
do not invoke it from an active route until the transaction executor lands.
