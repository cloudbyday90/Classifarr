# Policy Compatibility Deletion Recovery Evidence Binding

## Intent

Compatibility-path deletion must not treat a caller-provided
`backupRestoreVerified` boolean as recovery proof. This component creates a
small, non-destructive recovery-evidence artifact from the existing
database-owned backup/restore verification evidence and binds it to one exact
compatibility-deletion execution-plan artifact.

It is intentionally separate from operator approval and final rollback/support
stances:

- recovery is a machine-derived, database-owned verification result;
- approval and final stances are accountable human decisions with named actors;
- checkout and manifest state remain machine observations in the preflight
  artifact.

The component does not read a backup payload, perform a restore, mutate the
database, delete files, write a manifest, invoke Git, or execute a controlled
removal batch.

## Official-Source Research

- PostgreSQL recommends regular backups for valuable data. A deletion gate
  should therefore rely on recorded restore verification rather than an
  unchecked user assertion.
- PostgreSQL Repeatable Read supplies a stable view for a read-only evidence
  collection transaction. The existing backup/restore evidence reader remains
  the authoritative source; this component only binds its bounded output to an
  execution plan.
- NIST SP 800-204D identifies artifact provenance and attestation as supply
  chain controls. The recovery record includes the exact plan fingerprint and
  a deterministic SHA-256 fingerprint, so a downstream consumer can detect a
  detached or altered artifact.
- OWASP logging guidance treats data from other trust zones as untrusted and
  recommends integrity controls and minimal event data. The artifact validates
  all retained fields, exposes neither backup paths nor payloads, and contains
  no new credentials or personal data.

Sources:

- PostgreSQL, [Backup and Restore](https://www.postgresql.org/docs/current/backup.html)
- PostgreSQL, [Transaction Isolation](https://www.postgresql.org/docs/current/transaction-iso.html)
- NIST, [SP 800-204D](https://csrc.nist.gov/pubs/sp/800/204/d/final)
- OWASP, [Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)

## Options Considered

### Retain A Caller-Supplied Boolean

Pros:

- smallest API change;
- easy to construct in a local script.

Cons:

- a caller can assert recovery without a verified database record;
- cannot bind the assertion to the reviewed plan;
- conflates an automated verification fact with a human approval.

### Fold Recovery Into Operator Evidence

Pros:

- one input envelope;
- matches the original gate shape.

Cons:

- incorrectly requires an actor for an automated database fact;
- permits the operator envelope to carry a machine claim;
- makes provenance and retention rules less clear.

### Use A Separate Fingerprint-Bound Database-Owned Artifact

Pros:

- preserves the existing persisted verification evidence as the source of
  recovery authority;
- binds a fresh observation to the exact plan fingerprint;
- rejects pre-plan, future, stale, altered, invalid, and non-verified evidence;
- leaves approval and final stances as explicit human records;
- has no destructive side effects.

Cons:

- the controlled-batch input now carries one more bounded artifact;
- a new observation is required when an execution plan changes.

## Final Recommendation Stack

1. Load the latest record through
   `policyBackupRestoreVerificationEvidence.mjs`; do not use a backup path,
   payload, or user-provided boolean.
2. Build
   `policyCompatibilityDeletionExecutionGateRecoveryEvidence.mjs` after the
   execution-plan artifact exists.
3. Bind the recovery artifact to the exact execution-plan SHA-256 fingerprint
   and give the recovery artifact its own SHA-256 fingerprint.
4. Require a fresh recovery observation and a freshly reread persisted
   verification result, both no earlier than the execution-plan artifact.
5. Have `policyCompatibilityDeletionExecutionGate.mjs` re-evaluate the
   artifact at gate time and reject altered output, cross-plan evidence, or
   non-verified source evidence.
6. Permit only `operatorEvidence.approval` and `operatorEvidence.stances`.
   Reject recovery, checkout, manifest, and other machine claims in that
   envelope.
7. Revalidate the retained recovery artifact at the controlled apply boundary;
   do not turn a ready gate into a deletion operation.

## Implementation Outcome

Implemented:

- Added `policyCompatibilityDeletionExecutionGateRecoveryEvidence.mjs` and a
  dedicated deterministic fingerprint module.
- Upgraded the execution gate contract to v4. It now takes `recoveryEvidence`
  and no longer accepts recovery assertions under `operatorEvidence`.
- Updated controlled-batch construction and controlled-apply gate replay to
  retain and revalidate the recovery artifact.
- Rejected recovery, backup-restore, checkout, manifest, and collector claims
  placed in `operatorEvidence`.
- Added focused coverage for valid source evidence, pre-artifact timestamps,
  non-verified source records, altered recovery artifacts, cross-plan binding,
  and the public batch generator.

Not implemented here:

- no new backup creation or restore operation;
- no live database collector or scheduler;
- no cryptographic signing or cross-host trust service;
- no file, route, test, storage, or Git mutation.

## Next Step

Proceed with **Phase 8R.21, Task 8R.21.1 Completion Audit Artifact
Integrity**. It should require the completion audit to consume the existing
fingerprint-valid next-batch authorization artifact, replay its embedded
runtime evidence and review context, and reject detached or cross-manifest
completion claims before reporting the compatibility-deletion loop complete.
