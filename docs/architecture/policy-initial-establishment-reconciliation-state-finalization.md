# Initial Establishment Reconciliation-State Finalization

## Status

Implemented on 2026-07-18 for Policy Builder roadmap task 8R.3.2.10.5.

## Problem

An empty policy is intentionally recorded as
`requires_initial_policy_establishment` until an administrator establishes its
first native intent. The initial-establishment transaction previously created
the native authority but left that terminal reconciliation state behind. Since
routine reconciliation reads only unconverted policies, the stale state could
continue to block compatibility-removal readiness forever.

A second race exists when reconciliation selects an unconverted policy before
first establishment commits. Its delayed state persistence must not recreate a
maintenance marker after native authority becomes current.

## Research

[PostgreSQL Transactions](https://www.postgresql.org/docs/current/tutorial-transactions.html)
defines a transaction as an all-or-nothing unit whose intermediate state is not
visible to concurrent transactions. The establishment record, native authority,
rollback snapshot, and terminal-state finalization therefore belong in one
transaction: a finalization failure rolls back the authority transition rather
than leaving partial lifecycle state.

[PostgreSQL Explicit Locking](https://www.postgresql.org/docs/current/explicit-locking.html)
documents that `FOR UPDATE` blocks concurrent writers and lockers of the same
row until transaction end. Classifarr keeps the existing policy-row lock, then
performs a live authority check at reconciliation-state persistence so delayed
candidate snapshots cannot write a stale result after the lock is released.

[OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
recommends event data proportionate to the purpose and sufficient for review,
without collecting unnecessary sensitive values. The outcome exposes only
bounded counts and status IDs; it does not record a declared-rule payload,
idempotency key, actor, routing path, media observation, metadata, RAG result,
or AI output.

## Options

### 1. Leave Terminal State Until A Later Scheduler Pass

Pros:

- No change to the establishment transaction.

Cons:

- The reconciler excludes now-native policies, so the stale state may never be
  reconsidered.
- Compatibility-removal evidence can remain permanently and incorrectly
  blocked.
- A delayed scheduler state write can recreate the stale marker.

Decision: rejected.

### 2. Delete Every Reconciliation State After Establishment

Pros:

- Simple cleanup operation.

Cons:

- Can erase a later, unrelated maintenance state.
- Does not protect against a delayed stale state write from an in-flight
  reconciliation snapshot.

Decision: rejected.

### 3. Finalize The Exact Marker Transactionally And Guard Persistence

Pros:

- Removes only the exact terminal state that first establishment resolves.
- Rolls back the entire authority transition if finalization cannot persist.
- Rechecks semantic native authority during state persistence and clears an
  in-flight stale write after it commits.
- Preserves reconciliation outcomes, migration events, rollback snapshots, and
  unrelated reconciliation holds as durable audit/recovery evidence.
- Requires no schema change and does not start classification, learning,
  routing, or external calls.

Cons:

- Adds one guarded persistence query per reconciliation state write.
- Requires focused lifecycle and race-condition tests.

Decision: adopted.

## Final Recommendation Stack

1. Keep initial establishment administrator-declared and transactionally
   revalidated; observed library content and AI output remain non-authoritative.
2. After the establishment audit record completes, delete only a state matching
   the policy ID, candidate status, outcome, and reason for initial
   establishment.
3. Treat that deletion as part of the same transaction. Any database failure
   rolls back the new authority, snapshot, and establishment record.
4. Make reconciliation state persistence conditionally upsert only when no
   semantically authoritative native intent currently exists.
5. Immediately recheck and clear a stale state after every attempted upsert to
   cover an input snapshot that became outdated while waiting on a concurrent
   establishment transaction.
6. Return bounded counts and stable status IDs only; retain detailed audit
   history in existing migration and reconciliation ledgers.

## Outcome

`policyInitialIntentEstablishmentPersistence.mjs` now finalizes only the
matching `requires_initial_policy_establishment` maintenance marker in the
first-establishment transaction. A cleanup failure returns the existing
bounded rollback result and leaves no partial authority transition.

`nativeIntentReconciliationStatePersistence.mjs` now checks semantic native
authority both while writing and immediately after writing reconciliation state.
An in-flight candidate snapshot is skipped or cleared once authoritative native
intent exists, rather than reintroducing a false maintenance blocker. The
change preserves the existing reconciliation ledger and rollback/reversion
records, and it does not modify schema or start automation.

Focused verification covers successful finalization, exact-match scope,
idempotent replay, rollback on finalization failure, live-authority skip, and
stale-state cleanup.

The existing initial-native-intent-establishment closure component now requires
this design, its persistence paths, and both unit and integration regression
coverage before evidence can claim that component complete.
