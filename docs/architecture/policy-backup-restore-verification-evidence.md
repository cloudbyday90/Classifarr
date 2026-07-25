# Policy Backup/Restore Verification Evidence

Status: implemented as the database-owned recovery evidence boundary for
compatibility-path deletion readiness.

## Intent

Classifarr must distinguish a backup file existing from a backup having been
restored and verified on the current installation. That distinction matters
only for the future destructive compatibility-code deletion path. It does not
add a routine policy-authoring step, a manual conversion dialog, or a normal
automation prerequisite.

The application backup remains the recovery payload. A successful restore now
adds a small database record that proves the restore passed the native authority
checks and is still tied to the currently ready restore gate. Readiness derives
its recovery result from that record rather than accepting a CLI or caller
boolean.

## Official Guidance Reviewed

- [PostgreSQL Backup and Restore](https://www.postgresql.org/docs/current/backup.html)
  describes regular, tested backup and restore procedures. Classifarr records a
  verified restore result, not merely backup-file existence.
- [PostgreSQL Transaction Isolation](https://www.postgresql.org/docs/current/transaction-iso.html)
  describes the stable snapshot provided by `REPEATABLE READ`. The deletion
  evidence bundle reads its source records in the existing read-only
  repeatable-read collection window.
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
  recommends security-relevant audit events while excluding secrets and
  unnecessary sensitive operational data. The record contains only bounded
  status, version, count, and timestamp values.
- [NIST SP 800-34 Rev. 1](https://csrc.nist.gov/pubs/sp/800/34/r1/upd1/final)
  treats recovery planning and testing as part of operational resilience. This
  evidence is a tested-recovery control for a destructive release step.

Research was rechecked on July 25, 2026 against the official sources current
for the June 2026 design window.

## Options Considered

### Caller-Supplied `backupRestoreVerified` Boolean

Pros:

- no schema change,
- simple to pass through a script.

Cons:

- proves only that a caller claimed success,
- can be reused after a later failed restore,
- cannot be coherently collected with the other database evidence.

### Reuse `backup_audit` Alone

Pros:

- preserves existing route-level audit history,
- does not require a dedicated record.

Cons:

- direct service restores do not necessarily create route audit events,
- audit records are not bound to the current native restore gate,
- audit metadata is not the minimal recovery-proof contract.

### Persist Raw Backup Metadata or Payload

Pros:

- supports broad forensic detail.

Cons:

- unnecessarily exposes filenames, paths, and potentially sensitive
  configuration context to a deletion-readiness surface,
- duplicates the encrypted backup's responsibility,
- expands retention and access-control risk.

### Database-Owned Verified Restore Record

Pros:

- generated only after restore validation and gate completion,
- collected with the database-owned readiness evidence,
- fails closed when stale, missing, altered, or disconnected from the active
  restore gate,
- keeps the deletion contract free of raw backup data.

Cons:

- an installation must perform a fresh successful restore before compatibility
  deletion can ever become ready,
- an append-only application-level record is not cryptographic
  non-repudiation against a database superuser.

## Final Recommendation Stack

1. Keep the encrypted application backup as the recovery payload.
2. Validate schema parity and native authority after restore.
3. Complete the native restore gate and write one bounded verification record in
   the same follow-up transaction.
4. Treat a failed verification-record write as a failed restore gate outcome.
5. Collect the record and restore gate through a read-only, repeatable-read
   evidence bundle.
6. Require the latest verification to match the currently ready gate and remain
   within the 24-hour renewal window before deletion planning can claim ready.

## Implementation Outcome

`policy_backup_restore_verifications` is an append-only table. Each row stores:

- the verification contract version,
- restore mode and bounded backup version,
- successful schema-parity and native-authority checks,
- zero policy/library mismatch count,
- verified timestamp.

It deliberately excludes backup filename, filesystem path, archive location,
backup payload, credentials, connection strings, policy payloads, and media
metadata. The database rejects rows that do not represent a fully verified
restore and rejects application-level `UPDATE` or `DELETE` operations. A later
failed restore closes the separate restore gate, so an older verification row
cannot independently make readiness pass.

The implementation is split by responsibility:

- `server/src/services/policyBackupRestoreVerificationPersistence.mjs` validates
  and writes the bounded record.
- `server/src/services/policyBackupRestoreVerificationEvidence.mjs` performs
  read-only, fail-closed evaluation and safe projection.
- `server/src/services/backupService.mjs` persists evidence only after a native
  restore succeeds, and closes the restore lifecycle if that persistence fails.
- `server/src/services/policyCompatibilityDeletionReadiness.mjs` derives its
  recovery confirmation from the evidence contract.
- `server/src/services/policyCompatibilityDeletionExecutionPlanEvidenceBundle.mjs`
  loads the record in its shared database observation window.

The evidence table is intentionally not included in configuration backup/restore
payloads. It describes a verified restore operation on this installation; a
new restore must produce a fresh local verification record after validation.

## Security And Operational Boundaries

- The normal policy runtime remains automatic. This evidence has no influence
  on classification, routing, provider use, quotas, learning, or reconciliation
  scheduling.
- Compatibility-code deletion remains blocked by additional manifest, support,
  approval, and later execution-gate controls.
- The evidence loader selects only the bounded verification fields and the
  restore-gate state. It does not select raw backup or policy data.
- The record is application-append-only. Database-administrator access remains
  privileged infrastructure access and should be protected independently; this
  is not presented as a tamper-proof ledger.
- No automatic restore is introduced. Operators retain control over when a
  restore occurs; the system automatically validates and records its result.

## Verification

Focused tests cover valid, missing, stale, invalid, and gate-disconnected
records; safe query projection; persistence input validation; restore success;
and fail-closed restore behavior when evidence persistence fails. Migration
coverage verifies the schema table, constraints, index, and append-only guard.

## Follow-On

Proceed to **Phase 8R.16, Task 8R.16.1: Execution-Gate Artifact And Evidence
Binding**. Its first component should replace the remaining execution-gate
recovery assertion with this same bounded evidence contract, retain explicit
release approval separately, and avoid creating a second recovery model.
