# Policy Library-Rebuild Snapshot-Gate Verification Binding

## Status

Implemented for Phase 6R.6 Task 6R.6.5.

This record defines the server-only binding between an accepted library-rebuild transition, its immutable migration verification receipt, and the transaction that creates rollback evidence. It does not rerun verification, replace or delete a policy, route media, call a provider, read quota state, or add a browser/API control.

## Problem

Task 6R.6.4 made bounded verification results durable, but the snapshot gate still created rollback evidence from an accepted transition alone. That left a gap: an old, caller-supplied, incomplete, review-required, or risk-blocked result could be mistaken for authority to advance migration work.

The resulting authorization sequence is now:

```text
current accepted rebuild transition
  + locked policy and active native intent
  + latest immutable verification receipt for that policy context
  + matching transition, source provenance, zero-difference verifier, and audits
  -> execution gate bound to receipt ID and verifier fingerprint
  -> rollback snapshot and migration event
```

Any failed condition stops before an execution gate, rollback snapshot, or migration event is created.

## Official Guidance Reviewed

- [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html) recommends deny-by-default and validating permissions at every resource boundary. The snapshot gate validates the receipt inside its transaction after locking policy and intent, rather than trusting an earlier or caller-held result.
- [PostgreSQL explicit locking documentation](https://www.postgresql.org/docs/17/explicit-locking.html) defines `FOR KEY SHARE` as preventing deletion or key changes to a selected row until the transaction ends. The gate uses it while reading the receipt so the evidence remains present while the gate records its foreign-key binding.
- [Microsoft Well-Architected safe deployment practices](https://learn.microsoft.com/en-us/azure/well-architected/operational-excellence/safe-deployments) recommend independent quality gates, clear stop conditions, and rollback plans. Verification is a separate gate before rollback evidence; receipt failure does not fall through to partial migration state.

## Options Considered

### 1. Accept a caller-supplied verifier report at snapshot time

Pros:

- No receipt lookup or schema change.

Cons:

- A browser or stale server caller could inject, omit, or replace evidence.
- Cannot prove which verification result authorized a persisted snapshot.
- Reintroduces a volatile report as a policy-migration authority.

### 2. Rerun verification inside the snapshot transaction

Pros:

- Produces a fresh comparison immediately before snapshot creation.

Cons:

- Couples a bounded read/comparison workflow to a write transaction.
- Repeats work and changes candidate evidence at authorization time.
- Blurs the independently auditable verification and snapshot boundaries.

### 3. Look up a receipt but do not retain its identity on the execution gate

Pros:

- Fewer execution-gate columns.

Cons:

- A later replacement gate cannot prove which immutable receipt the snapshot consumed.
- Makes retry and audit dependent on a new lookup rather than durable provenance.

### 4. Lock and validate the receipt, then bind its ID and fingerprint to the execution gate

Pros:

- Uses durable, append-only evidence rather than a caller report.
- Maintains one transaction boundary from evidence read through rollback snapshot creation.
- Lets the later replacement gate verify the exact receipt that authorized the snapshot.
- Invalidates active pre-binding gates instead of allowing an unverifiable forward migration.

Cons:

- Adds a small validation module, two execution-gate columns, and a migration.
- Existing active gates without a receipt binding must stop and begin a new verified flow; their rollback snapshots remain available as history.

## Final Recommendation Stack

1. Keep verification runs immutable and separate from execution gates.
2. In the snapshot transaction, lock the current policy and active intent, then load the latest receipt for that policy, intent, and library with `FOR KEY SHARE`.
3. Require an exact accepted-transition fingerprint, source ID, source media type, deterministic order, bounded coverage, valid verifier fingerprint, zero-difference `no_migration_differences` status, and zero-issue source, verifier, and coordinator audits.
4. Bind only the receipt primary key and verifier fingerprint to a newly created execution gate. Do not copy raw samples, differences, policy payloads, provider data, or actor details.
5. Fail closed for missing, mismatched, stale, review-required, risk-blocked, malformed, or audit-invalid evidence before any rollback write.
6. Invalidate active historical gates that lack a receipt binding. Retain their snapshots as audit and rollback history, but do not let them proceed through the forward migration path.

## Implementation Outcome

`server/src/services/policyLibraryRebuildVerificationRunBinding.mjs` owns the transaction-client receipt query, strict fixed-field validation, and safe projection. It reads only the latest contextual receipt and returns only its database ID, verifier fingerprint, and verifier status after validation.

`policyLibraryRebuildSnapshotGate.mjs` now invokes that module after it locks and revalidates the accepted policy/intent context and before it expires or creates execution gates. A rejected receipt returns `blocked_by_verification_run`; it does not create a snapshot, migration event, replacement, route, learning record, or browser control.

`20260729_150000_bind_policy_library_rebuild_verification_runs.sql` adds `verification_run_id` and `verification_run_fingerprint` to `policy_library_rebuild_execution_gates`. It requires the pair for any snapshot-persisting or snapshot-persisted gate, invalidates active gates from before this binding, and indexes the receipt reference. The existing replace restore clears execution gates before runtime verification receipts to respect the new foreign key and append-only maintenance guard.

## Security Outcome

- The browser cannot supply, refresh, or inspect a verification receipt.
- The gate uses parameterized queries with static table names.
- `FOR KEY SHARE` and the foreign key preserve the chosen receipt through snapshot-gate completion.
- Current acceptance is revalidated after policy and intent locks, and receipt staleness is checked against acceptance time.
- A non-zero difference count, truncated difference summary, invalid audit, review-required status, or risk-blocked status cannot create rollback evidence.
- No raw media, verification samples, verifier differences, policy payloads, routing details, provider data, quota state, or actor reference appears in the binding result.

## Verification

Focused server tests cover a valid receipt; missing, mismatched, stale, review-required, and risk-blocked evidence; transaction-held receipt locking; and proof that the snapshot gate does not create an execution gate or rollback snapshot when evidence is missing. Migration and backup-restore tests verify the schema binding and dependency-safe cleanup order.

## Next Task

Phase 6R.6 Task 6R.6.6 is **Library Rebuild Replacement-Gate Receipt Binding**. It should remove the replacement gate's dependence on a caller-supplied verifier report. Inside its transaction, it must lock the execution gate and the receipt recorded by this task, prove their IDs and fingerprints still agree, revalidate the no-difference receipt, and stop before all native-intent, routing, or migration-event writes when that evidence is not current.
