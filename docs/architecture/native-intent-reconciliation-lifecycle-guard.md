# Native Intent Reconciliation Lifecycle Guard

## Status

Implemented for Phase 8R.3.2.4. This component protects deliberate native
authority reversions and backup restores from automatic reconciliation. It does
not add a second policy model or a manual conversion workflow.

## Problem

Native-intent reconciliation is intentionally automatic. That makes two
boundary cases particularly risky:

1. A successful rollback can remove active native authority, making the policy
   look like a conversion candidate again before the operator's decision has
   taken effect.
2. A backup restore can temporarily contain incomplete or mismatched authority
   state while the database transaction and validation work complete.

Both cases need a durable, fail-closed operational guard. The guard must remain
separate from policy meaning, legacy payloads, and user-provided authority.

## Official-Source Research

Research reviewed in June 2026:

- [AWS Builders' Library: Making retries safe with idempotent APIs](https://aws.amazon.com/builders-library/making-retries-safe-with-idempotent-APIs/)
  recommends an explicit durable outcome and idempotent semantics instead of
  assuming a repeated request is safe. A reversion hold records the deliberate
  outcome before another reconciler run may act on the policy.
- [PostgreSQL explicit locking](https://www.postgresql.org/docs/current/explicit-locking.html)
  documents row locks as the mechanism to prevent concurrent writers from
  changing the same row until a transaction completes. Reconciliation checks
  the lifecycle guard after it locks policy authority, closing the discovery to
  write race.
- [OWASP Secrets Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)
  recommends protected, tested recovery operations and auditability. Restore
  validation stores only state IDs, timestamps, and references; no backup
  credential, payload, or exception text is copied into lifecycle controls.

## Options Considered

### Rely On Candidate Discovery Exclusions

Pros:

- No new tables.
- Small code change.

Cons:

- Discovery and final apply are separate operations, so a reversion can race a
  previously discovered candidate.
- A permanent event-based exclusion cannot support an explicit future re-entry.
- Restore has no durable global closed state.

### Add An In-Memory Restore Flag And Timer-Based Hold

Pros:

- Small runtime surface.
- No database migration.

Cons:

- Process restart loses the safeguard.
- Multiple replicas can disagree.
- A timer can silently undo a deliberate rollback without any new operator
  decision.

### Recommended: Durable Policy Hold And Singleton Restore Gate

Pros:

- Reversion and hold write in the same transaction.
- The restore gate blocks discovery before work starts and the write guard
  checks it again under the policy authority lock.
- Explicit administrator re-entry is attributable and auditable.
- Retry scheduling state is recalculated from restored authority rather than
  trusted as current work.

Cons:

- Adds two small operational-control tables and a protected administrative
  re-entry endpoint.
- Requires restore tests to prove schema and authority validation behavior.

## Implemented Design

### Reversion Hold

`policy_native_intent_reconciliation_holds` has at most one row per policy.
An active hold references the `rollback_applied` migration event that created
it. The reversion service writes both records within its existing transaction;
if the hold cannot be persisted, the reversion rolls back.

Candidate discovery excludes active holds. The apply gate also invokes a
policy-local lifecycle guard only after it has locked current policy authority.
That second check protects the interval between discovery and write. A held
policy produces a bounded `rollback_reconciliation_hold` outcome and no native
intent, rollback snapshot, or conversion event is written.

There is no expiry timer. An administrator must explicitly approve re-entry at
`POST /api/policies/:id/native-intent-reconciliation/reentry`. The route derives
the actor identity from the authenticated server context, accepts only a bounded
reason code, requires no active native intent, writes an audit event, and then
releases the hold in one transaction.

### Restore Gate

`policy_native_intent_reconciliation_restore_gates` is a singleton state row.
Before restore writes begin it moves to `restore_in_progress`, so every
reconciliation execution defers before candidate discovery. If restoring or
validating fails, it moves to `requires_maintenance` and remains closed.

After the database restore transaction commits, Classifarr verifies:

- required native-intent and lifecycle tables exist;
- active native-intent integrity is clean; and
- each native intent still agrees with its policy and library relationship.

Only then does the gate return to `ready`. The status returned to callers is a
safe ID, never the restore token, SQL error, backup content, or database detail.

### Backup And Restore Semantics

Backups retain migration events, reconciliation ledger history, and reversion
holds. Holds from pre-guard backups are rehydrated from restored
`rollback_applied` events to preserve an operator rollback decision.

`policy_native_intent_reconciliation_states` is scheduling state, not authority
or historical evidence. Restore discards imported retry and quarantine rows and
clears any existing rows during the restore transaction. The first later
reconciliation pass derives a new candidate fingerprint from current restored
policy authority. It does not resume imported work.

### New Native Policies

Reconciliation continues to load only policies without active native intent.
New policies created natively are therefore excluded before candidate reporting
and never receive a migration rollback snapshot or conversion event. Legacy
policies remain eligible only through the existing server-owned candidate
report while the compatibility window is open.

## Security And Edge Cases

| Risk | Control |
| --- | --- |
| Reconciliation discovers a policy just before rollback | The final write guard checks the active hold after the policy lock. |
| Reversion writes an event but not a hold | Both writes share the reversion transaction; any hold failure rolls back the event and authority change. |
| Restore restarts or validation fails | The durable gate remains `requires_maintenance`; automatic reconciliation fails closed. |
| Imported retry data blocks or retries the wrong policy | Restore discards scheduling state and re-evaluates current authority. |
| Client claims another operator identity | The re-entry route ignores client actor fields and derives the authenticated administrator identity. |
| New native policy enters migration | Candidate discovery requires no active native intent, and apply remains idempotent under authority lock. |

## Verification

- Contract tests cover fail-closed gate normalization and attributable re-entry
  validation.
- Lifecycle service tests cover candidate hold partitioning, final write checks,
  rollback hold persistence, failed restore verification, and transactional
  release.
- Reconciliation execution and apply-gate tests verify restore gates block
  discovery and active holds block the final write without creating conversion
  records.
- Backup restore tests verify hold mapping and rehydration while retry states
  are discarded.
- Migration, fresh-schema, route, integration, and full server tests verify the
  production wiring.

## Result

Automatic reconciliation remains hands-off for eligible legacy policies, but it
cannot override a valid rollback or act during an unverified restore. The next
component is Phase 8R.3.2.5: an operational circuit breaker and emergency stop
for systemic, rather than policy-local, failures.
