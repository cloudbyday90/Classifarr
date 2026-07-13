# Policy Library Rebuild Snapshot Gate

## Status

Implemented on 2026-07-12 as the persisted rollback-evidence boundary. Enrolled
in the runtime/rebuild completion audit on 2026-07-13.

## Problem

An accepted library rebuild and a no-difference migration comparison do not by
themselves make replacement safe. Before the active native intent can change,
the system needs one current, policy-owned rollback snapshot and a durable
execution record. That record must remain valid if a client retries, the
acceptance expires, the proposal changes, another request races it, or a later
transaction fails.

The snapshot boundary must persist recovery evidence only. It must not grant
replacement authority, run a provider, or trust a client-supplied snapshot,
event, actor, or terminal execution state.

## Research

- [OWASP Transaction Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Transaction_Authorization_Cheat_Sheet.html)
  recommends server-side transaction verification, controlled state
  transitions, protected transaction data, an execution-time final gate,
  bounded authorization lifetime, and unique authorization for each operation.
- [OWASP Business Logic Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Business_Logic_Security_Cheat_Sheet.html)
  recommends explicit server-side state machines, atomic check-then-act
  behavior, idempotency for non-idempotent work, and written, tested
  invariants.
- [PostgreSQL Explicit Locking](https://www.postgresql.org/docs/current/explicit-locking.html)
  documents row-level locking and the need to account for lock conflicts and
  deadlocks. The gate locks a small, consistent set of current records instead
  of taking a broad table lock.
- [OWASP Security Logging and Monitoring](https://devguide.owasp.org/en/04-design/02-web-app-checklist/09-logging-monitoring/)
  recommends recording state-tampering events while avoiding sensitive values
  and log-injection risk. The execution result exposes bounded identifiers,
  fingerprints, and reason codes rather than raw policy or provider payloads.

## Options Considered

### Keep rollback context in the acceptance response

Pros:

- No additional persistence flow.
- Fewer database writes.

Cons:

- A stale or modified client response could be replayed as recovery evidence.
- Concurrent requests cannot establish a single current snapshot.
- A failed later replacement cannot prove which policy state was recoverable.

### Persist rollback evidence and replacement in one unbounded request

Pros:

- Fewer named boundaries.
- A short call sequence.

Cons:

- Combines recovery proof with the behavior-changing action.
- Makes it difficult to inspect or retry a snapshot-safe stopped state.
- Encourages callers to treat acceptance as replacement authorization.

### Persist a transaction-gated snapshot before replacement

Pros:

- Gives each accepted rebuild exactly one current, policy-owned recovery point.
- Supports idempotent retries without duplicate snapshots or events.
- Separates recovery evidence from native intent replacement authority.
- Revalidates the accepted transition under locks at the moment of persistence.

Cons:

- Requires dedicated execution-state, rollback-snapshot, and event records.
- A correctly accepted rebuild can still stop at `snapshot_persisted` until the
  independent replacement gate proves all remaining conditions.

## Final Recommendation Stack

1. Validate and deep-clone the accepted transition and rebuild proposal before
   database work so caller-owned objects cannot mutate during authorization.
2. Open one transaction and lock the current policy and active native intent in
   a stable order.
3. Revalidate acceptance expiry, policy identity, proposal fingerprint, and
   rollback-plan fingerprint after those locks are held.
4. Expire older active execution gates, return an existing matching execution
   idempotently, and reject a competing active execution.
5. Create the execution gate, authoritative rollback snapshot, and migration
   event in the same transaction; mark the gate `snapshot_persisted` only after
   all three writes succeed.
6. Return only bounded ids, SHA-256 fingerprints, state, and reason codes. Set
   `canApplyReplacement` to `false` on every snapshot result.
7. Require the independent replacement gate to revalidate this persisted state,
   the current acceptance transition, and the migration-verifier result before
   it writes a replacement native intent.

## Security Boundaries

- Clients cannot choose a snapshot id, event id, execution state, or replacement
  state.
- Snapshot persistence accepts a current server-validated transition only; raw
  approval flags and rollback objects are not authority.
- The transaction rejects stale policy or active-intent context, expired
  acceptance, replayed mismatched keys, and competing active executions.
- The boundary never stores or returns raw policy configuration, provider
  responses, prompts, embeddings, actor identifiers, or unbounded diagnostics.
- A transaction failure returns a blocked, rolled-back result and never leaves
  partial execution state as successful recovery evidence.

## Implementation

- Snapshot gate and persistence flow:
  `server/src/services/policyLibraryRebuildSnapshotGate.mjs`
- Accepted-transition contract:
  `server/src/services/policyLibraryRebuildAcceptanceTransition.mjs`
- Database migration:
  `database/migrations/20260712_120000_add_policy_library_rebuild_execution_gates.sql`
- Focused verification:
  `server/src/__tests__/services/policyLibraryRebuildSnapshotGate.test.mjs`
- Completion audit enrollment:
  `server/src/services/policyRuntimeCompletionAudit.mjs`

## Verification

- Focused tests cover successful persistence, terminal idempotency, expired or
  stale acceptance, mismatched policy/intent context, competing executions, and
  rollback of partial persistence failures.
- The completion audit requires this design record, service, focused test,
  passing local gate audit, and the `library_rebuild_replacement_gate` handoff.
- The runtime/rebuild test-reset audit requires direct focused-test ownership of
  the snapshot gate before completion can pass.

## Outcome

Accepted rebuilds now have a durable recovery boundary before behavior changes:

```text
accepted transition
  -> transaction-gated rollback snapshot and event
  -> snapshot_persisted (replacement still forbidden)
  -> independent replacement gate
```

The next component is the native replacement gate, followed by structured
strict-constraint preservation and runtime/rebuild completion verification.
