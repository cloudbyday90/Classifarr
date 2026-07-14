# Policy Rollback Snapshot Retention

Status: implemented as the expired rollback-payload retention cleanup.

## Problem

Rollback snapshots temporarily retain enough compatibility-policy data to
support a bounded authority reversion. After the restore window closes, keeping
the complete payload would turn that recovery mechanism into permanent
alternate legacy-policy storage. Deleting the row would remove useful evidence
of the conversion, the snapshot window, the restore path, and its attributable
migration history.

The retention boundary must therefore redact only the expired payload while
preserving the minimal information needed to explain what happened. It must
also avoid racing a reversion command or another cleanup process.

## Official Guidance Reviewed

- [PostgreSQL advisory lock functions](https://www.postgresql.org/docs/current/functions-admin.html)
  document `pg_try_advisory_xact_lock` as an application-defined,
  transaction-level exclusive lock that releases automatically at transaction
  end. Cleanup uses it to prevent concurrent cleanup batches without retaining
  a session lock after failure.
- [PostgreSQL explicit locking](https://www.postgresql.org/docs/current/explicit-locking.html)
  documents that `FOR UPDATE` protects selected rows until transaction end.
  PostgreSQL also documents `SKIP LOCKED` as appropriate for queue-like work
  where avoiding a wait is preferable to blocking an unrelated transaction.
  Cleanup uses both only for a bounded, ordered maintenance batch.
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
  recommends an attributable audit trail for modification and deletion while
  keeping retained data limited to its purpose. The cleanup event stores IDs,
  timestamps, the digest, and source-event reference, never raw snapshot JSON.
- [NIST SP 800-88 Rev. 2](https://csrc.nist.gov/pubs/sp/800/88/r2/final)
  frames sanitization as a sensitivity-appropriate process. Application-level
  redaction is a retention control, not a claim that PostgreSQL MVCC history,
  write-ahead logs, backups, or physical media have been sanitized. Those
  operational copies remain governed by their own backup and disposal policy.

## Recommendations

1. **Redact after the exact expiry boundary.** A snapshot is expired at
   `expires_at <= now`; reversion already fails closed at the same boundary.
2. **Retain a minimal marker, not an empty row.** The redacted JSON stores only
   policy and intent identifiers, snapshot version, lifecycle timestamps,
   restore path, payload digest and byte count, plus bounded source-audit
   identifiers. The original actor and reason remain in the migration-event
   audit record.
3. **Use a transaction-owned global cleanup lock plus row locks.** One cleanup
   invocation obtains `pg_try_advisory_xact_lock`, then selects no more than
   500 expired unredacted rows in stable order with `FOR UPDATE SKIP LOCKED`.
   A row being examined by a reversion command is skipped rather than waited
   on and can be cleaned by a later run.
4. **Redact and audit in one transaction.** Each updated snapshot gets a
   `rollback_snapshot_payload_redacted` event. If either the update or event
   fails, the transaction rolls back and the original payload remains intact.
5. **Keep results and application logs bounded.** Callers receive counts and
   internal snapshot identifiers; raw payload values and database error text
   are never returned or logged by this component.

## Pros And Cons

Pros:

- Expired snapshots cannot remain a permanent alternate copy of legacy policy
  behavior in application storage.
- The recovery record remains attributable and understandable without exposing
  custom signals, preset details, or other payload values.
- Transaction and row locking make concurrent cleanup and reversion behavior
  deterministic and retry-safe.
- Bounded batches keep the maintenance transaction short and predictable.

Cons:

- A redacted snapshot cannot be used for reversion, by design.
- A snapshot locked by another transaction may wait for a later scheduled run
  rather than being forced through immediately.
- Application-level redaction does not purge historical database or backup
  copies; operations must apply their separate retention and disposal policy.
- The audit event type requires a schema migration and a refreshed fresh-install
  schema snapshot.

## Final Recommendation Stack

1. `policyRollbackSnapshotRetentionContract.mjs` owns batch bounds, stable
   payload digesting, minimal-marker construction, and safe result shapes.
2. `policyRollbackSnapshotRetentionPersistence.mjs` owns the transaction lock,
   ordered row locking, update, source-audit lookup, and retention event SQL.
3. `policyRollbackSnapshotRetentionService.mjs` owns atomic orchestration and
   bounded operational logging.
4. `SchedulerRetentionService` runs one daily bounded batch; the cleanup
   service itself owns the transaction-scoped advisory lock.
5. `20260714_090000_add_policy_rollback_snapshot_retention_event.sql` adds the
   audited event type without changing native authority or deleting snapshots.

## Outcome

Expired rollback snapshots now retain only a minimal, digest-backed marker and
their migration-event history. Active native authority, compatibility rows, and
unexpired recovery payloads are untouched. A failed cleanup preserves the full
snapshot because the redaction and audit event are committed atomically.
