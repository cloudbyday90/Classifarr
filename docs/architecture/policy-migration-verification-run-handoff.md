# Policy Migration Verification-Run Handoff

## Status

Implemented for Phase 6R.6 Task 6R.6.4.

This record defines the server-only persisted handoff between bounded migration
verification and the later library-rebuild snapshot gate. It records a compact,
immutable verification receipt; it is not a policy update, rollback snapshot,
replacement command, route action, or browser feature.

## Problem

The migration verification coordinator evaluates representative
classifications in process memory. Its result cannot safely act as durable
authorization for a later snapshot gate: a restart loses it, a later caller
could supply a forged or stale report, and raw samples must not become durable
migration state. A valid `review_required` or `blocked_by_migration_risk`
result must be recorded without being mistaken for replacement authority.

The handoff creates one replay-protected receipt from only the coordinator data
the snapshot gate will later need:

```text
accepted transition fingerprint
  + source provenance and numeric summary
  + verifier status, fingerprint, and numeric difference summary
  + zero-issue audit summaries
  -> immutable verification-run receipt
```

No sample, verifier difference, legacy payload, new policy payload, route,
provider result, browser state, or actor reference is persisted.

## Official Guidance Reviewed

- [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)
  recommends least privilege, deny by default, and authorization checks at the
  resource boundary. The handoff persists only after the coordinator audit
  passes and its result is `ready`; all other outcomes stop before the
  database transaction.
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
  advises recording security-relevant events while excluding or masking
  sensitive information. The receipt preserves compact correlation digests,
  provenance, counts, and statuses, while its contract excludes raw media and
  verifier data; its database table is append-only outside a replace restore.
- [PostgreSQL `INSERT` documentation](https://www.postgresql.org/docs/18/sql-insert.html)
  documents `ON CONFLICT` as the database-level conflict path for a unique
  constraint or index. The repository uses one unique, server-derived
  idempotency key and `ON CONFLICT DO NOTHING`, then reads the existing row to
  distinguish a true replay from an inconsistent conflict.
- [Microsoft Well-Architected safe deployment practices](https://learn.microsoft.com/en-us/azure/well-architected/operational-excellence/safe-deployments)
  recommend small, quality-gated steps with clear stop conditions. Verification
  persistence is one independent gate; snapshot creation remains a later,
  separate transaction boundary.

## Options Considered

### 1. Pass the in-memory verifier report directly to the snapshot gate

Pros:

- No storage migration or repository.
- Fewer modules initially.

Cons:

- A restart loses the only evidence the gate would consume.
- A later caller could supply a forged or stale report.
- Makes replay protection and audit retention ambiguous.

### 2. Persist the full coordinator and verifier report as JSON

Pros:

- Appears convenient for diagnostics.
- Avoids defining a compact receipt schema.

Cons:

- Would retain samples and bounded differences that the snapshot gate does not
  need.
- Couples persistent state to volatile report shapes.
- Broadens the privacy, injection, and schema-migration surface.

### 3. Add receipt columns to the existing rebuild execution gate

Pros:

- Fewer tables.

Cons:

- Conflates pre-snapshot verification with the gate that creates rollback
  evidence.
- Requires a partially materialized execution record before its own
  preconditions are met.
- Makes the later atomic snapshot binding harder to reason about and test.

### 4. Persist a dedicated, immutable, replay-protected verification receipt

Pros:

- Keeps verification evidence separate from snapshot and replacement state.
- Reduces durable content to known-safe fixed fields.
- Supports safe retry and later exact fingerprint binding.
- Records review or risk outcomes without granting replacement authority.

Cons:

- Adds a migration, repository, and compact output contract.
- Requires the next task to make snapshot persistence consume the receipt.

## Final Recommendation Stack

1. Re-run the server-only coordinator from the accepted rebuild inputs; do not
   accept a caller-supplied report as a persistence command.
2. Require the coordinator audit, source audit, verifier audit, transition
   fingerprint, source provenance, source coverage, and verifier fingerprint to
   be valid before building a record.
3. Reduce the result to the fixed receipt schema before the database boundary
   and again before returning it to a caller.
4. Derive the idempotency key from stable bounded fields, including the accepted
   transition and verifier fingerprint; use PostgreSQL uniqueness as the replay
   authority.
5. Make verification receipts append-only. Allow deletion only in the existing
   explicitly marked replace-restore transaction, because they are runtime
   evidence rather than backed-up user configuration.
6. Record a verifier outcome but do not treat any receipt as snapshot,
   replacement, deletion, routing, or browser authority.
7. Bind the next snapshot gate transaction to a matching persisted receipt and
   require `no_migration_differences` there, rather than in this handoff.

## Implementation Outcome

`server/src/services/policyMigrationVerificationRunHandoff.mjs` exports
`createPolicyMigrationVerificationRunHandoff()`. Its
`recordMigrationVerificationRun()` operation invokes the coordinator, audits
the result, enters a transaction only for an audited `ready` result, then
claims one receipt. It returns `persisted` for a new record or `replayed` only
for an exact matching immutable receipt. Insufficient coverage, invalid output,
missing transaction boundaries, conflicts, and persistence failures remain
stable non-persisted statuses.

`server/src/services/policyMigrationVerificationRunContract.mjs` owns the
versioned status vocabulary, strict coordinator reduction, deterministic
idempotency digest, result projection, and output audit. The projection has no
field for raw samples, full verifier reports, differences, policy payloads, or
browser data.

`server/src/services/policyMigrationVerificationRunRepository.mjs` owns the
parameterized `INSERT ... ON CONFLICT DO NOTHING` claim and safe existing-row
lookup. It receives a transaction client from the handoff, so the persistence
boundary remains explicit and can be composed with the later snapshot gate.

`20260729_140000_add_policy_migration_verification_runs.sql` creates the
append-only table, fixed field constraints, unique idempotency index, read
indexes for the later snapshot-gate lookup, and a trigger allowing deletion
only for a marked replace restore. `backupRestore.mjs` marks that narrow
maintenance context before clearing runtime-only receipts.

## Security Outcome

- Coordinator outputs that expose samples, drift from their versioned contract,
  lack an accepted transition, or fail any audit cannot enter persistence.
- The table contains no JSON payload, raw classification, title, metadata,
  legacy behavior, generated intent, verifier difference, provider, route, or
  actor field.
- The repository uses parameterized values and a static table identifier.
- The unique server-derived idempotency key prevents duplicate records during
  concurrent retry; an unexpected existing record is a conflict, not a replay.
- Receipt reads and writes are unavailable to the browser: this task adds no
  route, controller, client API, UI component, provider call, or quota access.
- Snapshot creation, policy replacement, legacy deletion, routing, learning,
  and browser controls are declared false in the handoff contract and audited.

## Verification

Focused server tests cover strict coordinator reduction, raw-output rejection,
receipt projection redaction, new claim, true replay, inconsistent conflict,
insufficient coverage stopping before a transaction, missing transaction
boundaries, persistence failure, backup-restore maintenance deletion, and
migration/fresh-install schema coverage.

The focused suite passes with 8 suites and 40 tests. The authoritative schema
snapshot was regenerated from the migrated local Compose service and a clean
schema-check container.

## Next Task

Phase 6R.6 Task 6R.6.5 is **Library Rebuild Snapshot-Gate Verification
Binding**. It should make the existing snapshot gate load a receipt by the
accepted transition fingerprint inside its transaction, require matching policy,
intent, library, source, verifier fingerprint, and a
`no_migration_differences` verifier status, then create rollback evidence. It
must reject missing, stale, mismatched, review-required, and risk-blocked
receipts without rerunning verification, writing a replacement, routing media,
or exposing a browser control.
