# Policy Library-Rebuild Cutover Orchestration

## Status

Implemented for Phase 6R.6 Task 6R.6.7.

This record defines the one server-owned entry point that composes migration
verification, rollback-snapshot persistence, and native replacement for an
accepted library rebuild. It is not a browser or API workflow surface. It does
not expose raw representative classifications, verifier reports, differences,
policy payloads, provider data, quota state, or legacy deletion controls.

## Problem

The preceding services were individually safe but were not a single execution
path. A future caller could invoke the verification handoff, snapshot gate, and
replacement gate in an arbitrary order. Retrying a completed migration also
risked re-entering verification unnecessarily.

The native policy replacement is consequential: it writes native intent,
routing, validation, and migration-event state. The authorizing verification
receipt and rollback snapshot must therefore be server-owned checkpoints, not
data supplied by a browser, a scheduler payload, or a maintenance script.

```text
accepted transition
  -> snapshot-gate probe
       -> current receipt/snapshot exists: reuse it
       -> receipt missing: persist one bounded verification receipt
          -> persist rollback snapshot
  -> transaction-gated native replacement
  -> explicit legacy-deletion-disabled result
```

Any other snapshot result is a terminal stop state. In particular, an invalid,
stale, mismatched, review-required, or risk-blocked receipt never causes the
orchestrator to recompute it or continue to replacement.

## Official Guidance Reviewed

- [OWASP Transaction Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Transaction_Authorization_Cheat_Sheet.html)
  requires transaction authorization, verification data, and allowed state
  transitions to be enforced server-side. The orchestrator accepts only
  server-owned stage outputs and permits the stages in one fixed order.
- [PostgreSQL Explicit Locking](https://www.postgresql.org/docs/17/explicit-locking.html)
  describes row locks that prevent conflicting changes while a transaction is
  in progress. Snapshot and replacement retain their existing short atomic
  transactions and row locks instead of holding a transaction while bounded
  verification reads are performed.
- [Microsoft Well-Architected transient-fault guidance](https://learn.microsoft.com/en-us/azure/well-architected/design-guides/handle-transient-faults)
  recommends idempotent steps and cautions against retrying a broad workflow
  when only one step failed. The rollback-snapshot gate is the durable retry
  checkpoint: a later retry reuses it and does not invoke verification again.
- [Microsoft Well-Architected safe deployment practices](https://learn.microsoft.com/en-us/azure/well-architected/operational-excellence/safe-deployments)
  recommends small quality-gated stages, clear stop conditions, automation,
  and rollback planning. Verification, snapshot, and replacement remain small
  auditable stages; the cutover service supplies their only supported order.

## Options Considered

### 1. Let every server caller sequence the three services

Pros:

- No new composition service.

Cons:

- Ordering, retry, and stop behavior can drift among callers.
- A caller can repeat verification after a snapshot already binds its receipt.
- There is no single bounded execution result for monitoring or automation.

### 2. Rerun verification on every orchestration attempt

Pros:

- Produces a fresh comparison.

Cons:

- Repeats completed work and may observe a different representative set.
- Makes retry behavior dependent on current history rather than the persisted
  receipt that authorized the snapshot.
- Couples read-only verification to an otherwise completed write workflow.

### 3. One large database transaction over verification, snapshot, and replacement

Pros:

- A single transaction boundary appears simple.

Cons:

- Holds locks while representative evidence is read and verified.
- Increases contention and deadlock risk.
- Blurs read-only verification with native write authority and complicates
  retry/rollback behavior.

### 4. Server-owned orchestrator with a snapshot-gate retry checkpoint

Pros:

- Provides one fixed server-only sequence with compact outcome states.
- Reuses an existing validated receipt/snapshot before considering verification.
- Preserves the existing short snapshot and replacement transactions.
- Makes routing possible only in the replacement stage and leaves deletion
  explicitly disabled.

Cons:

- Adds a small composition contract and focused tests.
- A concurrent first attempt can still perform duplicate read-only comparison
  before the receipt repository's idempotency claim resolves; no duplicate
  snapshot or native replacement write is permitted.

## Final Recommendation Stack

1. Use `createPolicyLibraryRebuildCutoverOrchestrator()` only from future
   trusted server automation; do not add a browser control or request route.
2. Probe `persistPolicyLibraryRebuildRollbackSnapshot()` first. A valid
   existing receipt/snapshot is the retry checkpoint and skips verification.
3. Invoke `recordMigrationVerificationRun()` only when the snapshot gate's
   fixed `verification_run_missing` result shows that no durable receipt is
   available. Do not recompute invalid or review-required evidence.
4. Retry the snapshot gate once after a persisted or replayed, audited handoff;
   stop on every other verification or snapshot result.
5. Call `applyPolicyLibraryRebuildReplacement()` only after a valid persisted
   or reused snapshot. Keep all routing inside that existing replacement
   transaction.
6. Project only version, status, bounded checkpoint names, fixed stop
   reason IDs, compact execution/receipt identifiers, and boolean side effects.
   Treat raw verification output or unexpected stage side effects as a failed
   orchestration result.
7. Keep `policyDeleted` and `legacyDeletionAuthorized` false. A separate
   readiness gate must establish removal evidence before any deletion work.

## Implementation Outcome

`server/src/services/policyLibraryRebuildCutoverContract.mjs` owns the
versioned compact result, validation, prohibited-output checks, stop-state
vocabulary, and audit result. Successful results require the exact gate,
replacement, snapshot, transition, proposal, and verification receipt
identifiers/fingerprints needed for audit, but not their raw content.

`server/src/services/policyLibraryRebuildCutoverOrchestrator.mjs` supplies the
factory-backed server workflow. It probes the snapshot gate before calling the
verification handoff, calls the handoff only for the missing-receipt condition,
then invokes replacement only after a valid snapshot result. Each dependency is
injected at factory construction for focused tests; runtime callers cannot
provide a browser-controlled database client or replacement callback.

The implementation does not add a route, scheduler registration, UI control,
database migration, provider call, quota read, legacy deletion action, or raw
verification persistence.

## Security And Reliability Outcome

- Authorization and sequencing remain server-side and fail closed.
- Caller input is cloned before asynchronous stage calls so a caller cannot
  mutate its proposal or transition between checkpoints.
- A completed receipt/snapshot is reused; invalid receipt evidence stops rather
  than being silently replaced with a fresh verification attempt.
- Snapshot and replacement retain their existing transaction-scoped locks;
  routing is not performed by the handoff, snapshot, or orchestrator.
- The compact orchestration result cannot report legacy deletion authority or
  a browser control and rejects unsafe stage-side-effect declarations.
- Receipt persistence and native replacement continue to use their independent
  database uniqueness and transaction safeguards, making retries safe even if
  an earlier process stopped between checkpoints.

## Verification

Focused server tests cover:

- missing-receipt handoff followed by snapshot and replacement;
- retry reuse of an existing snapshot without rerunning verification;
- invalid persisted evidence stopping before handoff/replacement;
- verification and snapshot stop states;
- unsafe stage-side-effect rejection;
- compact result validation and the explicit no-legacy-deletion audit.

## Next Task

Phase 6R.6 Task 6R.6.8 should be **Library Rebuild Legacy-Path Deletion
Readiness Gate**. It should define and persist only the bounded evidence that
would permit deletion in a later release: completed native cutover, valid
receipt/snapshot provenance, explicit rollback-window disposition, runtime
authority confirmation, removal inventory, and an independent final audit. It
must not delete, hide, archive, route, or expose a browser control.
