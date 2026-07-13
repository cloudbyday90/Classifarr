# Policy Library Rebuild Persisted Snapshot Gate

## Status

Implemented on 2026-07-12 as the first stateful component of the migration
verifier and rollback path. It persists rollback evidence for an accepted
library-derived rebuild. It does not replace, activate, delete, route, or learn
policy behavior.

## Problem

An accepted rebuild transition is deliberately a bounded, in-memory contract.
It proves that a manual operator reviewed a specific proposal and rollback plan,
but it cannot prevent a replay after process restart or prove that a rollback
snapshot exists. Passing raw approval flags or snapshot objects to later code
would create a time-of-check/time-of-use gap and allow a client to bypass the
intended workflow.

## Research

- [PostgreSQL transaction isolation](https://www.postgresql.org/docs/current/transaction-iso.html)
  explains that `Read Committed` commands can observe concurrent changes between
  statements, while row locking lets a transaction serialize work on a known
  row. The documentation also requires whole-transaction retries when an
  application chooses serializable isolation and receives `40001`.
- [PostgreSQL explicit locking](https://www.postgresql.org/docs/current/explicit-locking.html)
  documents `SELECT ... FOR UPDATE` row locks and their conflict behavior. The
  gate locks the policy and its active native intent, rather than taking a broad
  table lock.
- [OWASP Transaction Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Transaction_Authorization_Cheat_Sheet.html)
  recommends server-side authorization, server-generated transaction
  verification data, time-bounded approvals, protected transaction data, and a
  final execution control gate.
- [OWASP Business Logic Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Business_Logic_Security_Cheat_Sheet.html)
  recommends persisted server-side state, validated state transitions, replay
  rejection, expiry, and atomic check-then-act behavior for multi-step
  workflows.

## Options Considered

### Store an approval flag in migration-event metadata

Pros:

- No new table.
- Reuses existing audit storage.

Cons:

- Cannot enforce one-time use or one active execution with database constraints.
- Blends workflow state with append-only history.
- Makes a safe replay lookup depend on JSON fields and convention.

### Create a dedicated execution-state table

Pros:

- Unique transition and idempotency keys enforce one-time execution.
- A partial unique index permits only one active snapshot gate per policy.
- Foreign keys connect the state to the policy, active native intent, snapshot,
  and migration event without exposing raw approval credentials.
- Keeps authorization state separate from policy intent and audit history.

Cons:

- Adds one migration and schema-snapshot responsibility.
- Requires explicit lifecycle handling for expiry and later replacement work.

### Replace policy behavior during snapshot persistence

Pros:

- Fewer calls for a future operator workflow.

Cons:

- Couples rollback creation to a destructive transition.
- Prevents the migration verifier from remaining independently reviewable.
- Increases blast radius when snapshot persistence fails or a proposal is stale.

## Final Recommendation Stack

1. Validate the rebuild proposal and acceptance transition on the server.
2. Clone the validated plain-data contracts before awaiting I/O.
3. Start one transaction and lock the matching `library_policies` row and active
   `policy_intents` row with `FOR UPDATE`.
4. Revalidate the transition in the transaction, expire prior approval state,
   and reject any competing active execution for the policy.
5. Insert provisional execution state, then create the authoritative rollback
   snapshot and a redacted migration audit event in the same transaction.
6. Mark the execution state `snapshot_persisted` only when it references both
   writes. Any failure rolls back all three inserts.
7. Use the deterministic acceptance idempotency key to return the existing
   snapshot without a second write.
8. Keep `canApplyReplacement` false. A later component must require this
   persisted gate plus fresh migration verification before it changes policy
   behavior.

## Security And Data Boundaries

- `policy_library_rebuild_execution_gates` stores fingerprints, a hashed actor
  reference, timestamps, and foreign keys. It never stores raw actor IDs,
  prompts, embeddings, provider payloads, or a rebuild proposal payload.
- The rollback snapshot stores the legacy restore payload only in the existing
  protected snapshot table. Gate reports expose identifiers and fingerprints,
  not the payload.
- Application backup restore deletes execution gates before rollback snapshots.
  A restored backup must not revive a stale authorization or make a prior
  acceptance replayable.
- The acceptance window is bounded by the acceptance-transition contract. A
  request after expiry creates no persistent gate or snapshot.
- The database constraints enforce fingerprint shapes, foreign-key ownership,
  terminal snapshot references, unique idempotency, unique transition identity,
  and one active gate per policy.

## Implementation

- Schema migration:
  `database/migrations/20260712_120000_add_policy_library_rebuild_execution_gates.sql`
- Server service:
  `server/src/services/policyLibraryRebuildSnapshotGate.mjs`
- Database persistence service:
  `server/src/services/policyLibraryRebuildSnapshotPersistence.mjs`
- Focused test:
  `server/src/__tests__/services/policyLibraryRebuildSnapshotGate.test.mjs`
- Existing acceptance contract:
  `server/src/services/policyLibraryRebuildAcceptanceTransition.mjs`

## Verification

- The focused service tests cover successful persistence, idempotent replay,
  expired approval, missing transaction support, stale native intent, competing
  execution state, and rollback-safe failure.
- Migration snapshot tests require the table, constraints, and indexes in
  `database/schema/current.sql` after the authoritative container schema dump.
- The full server suite, including integration tests, must run before this
  component is considered complete.

## Next Component

Implement the replacement execution gate. It should consume only a persisted
snapshot gate and a fresh migration-verifier report, verify that both still bind
to the same policy and fingerprints, then perform the replacement atomically.
