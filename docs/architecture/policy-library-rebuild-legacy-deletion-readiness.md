# Policy Library-Rebuild Legacy Deletion Readiness

## Status

Implemented for Phase 6R.6 Task 6R.6.8.

This record defines a read-only, server-owned readiness artifact for a later
legacy-path final-removal audit. It does not delete, hide, archive, route,
persist a readiness flag, schedule work, or expose a browser control.

## Problem

Native replacement alone is not sufficient evidence to remove compatibility
code. Removal could become irreversible while rollback remains available, a
replacement could have been reverted, immutable verification provenance could
be mismatched, or the active runtime authority could no longer be the intent
created by the rebuild.

Persisting a `ready_to_delete` flag would create a time-of-check/time-of-use
gap: the flag could survive a later rollback, authority change, or inventory
update. The deletion decision needs a small current-state artifact, not a
second durable authorization system.

```text
library policy (FOR SHARE)
  -> replacement-applied execution gate (FOR SHARE)
  -> exact immutable verification receipt (FOR SHARE)
  -> exact rollback snapshot (FOR SHARE)
  -> exact replacement event provenance (FOR SHARE)
  -> current semantic native authority (FOR SHARE)
  -> static removal-inventory summary
  -> transient readiness artifact or explicit blocked status
```

The repository acquires dependency locks in the same policy-first order as
rebuild writers. It returns only identifiers, fingerprints, states, counts,
and timestamps required to evaluate the gate. Raw rollback payloads,
representative samples, verifier differences, artifact paths, and full event
metadata are never returned.

## Official Guidance Reviewed

- [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)
  recommends least privilege, deny-by-default behavior, and validating
  authorization on every request. This component authorizes nothing: missing
  or conflicting evidence is blocked, and a later removal action must perform
  its own fresh check.
- [NIST SP 800-128, Guide for Security-Focused Configuration Management](https://csrc.nist.gov/pubs/sp/800/128/upd1/final)
  treats configuration inventory, security impact analysis, testing, and
  approval as controlled change prerequisites. The compact inventory fingerprint
  identifies the removal set without treating documentation as a mutation plan.
- [Microsoft Well-Architected Safe Deployment Practices](https://learn.microsoft.com/en-us/azure/well-architected/operational-excellence/safe-deployments)
  recommends small quality-gated stages, health checks, and recovery paths.
  Completed cutover, rollback expiry/redaction, runtime authority, and a
  removal inventory are therefore independent gates rather than one broad
  migration success flag.

## Options Considered

### 1. Reuse the release-wide compatibility deletion gate

Pros:

- Existing release evidence and inventory code can be reused.

Cons:

- Its release-wide scope does not prove a particular library rebuild's native
  replacement or rollback disposition.
- It could allow one library's evidence to be confused with another's.

### 2. Persist a per-rebuild deletion-ready flag

Pros:

- Simple to query later.

Cons:

- The flag becomes stale after a rollback, authority change, or inventory
  update.
- It creates a durable authorization broader than the evidence used to derive
  it.

### 3. Delete compatibility paths directly after cutover

Pros:

- Fewer intermediate artifacts.

Cons:

- Removes recovery options while the explicit rollback window remains open.
- Does not prove that cutover receipt, snapshot, event, and active authority
  agree.

### 4. Read-only per-rebuild evidence gate

Pros:

- Binds exact completed cutover identifiers and fingerprints to runtime
  authority.
- Fails closed for unavailable, stale, restored, conflicting, or incomplete
  evidence.
- Requires a closed rollback window with the payload redacted.
- Produces no durable deletion authorization and no side effect.

Cons:

- A later final-removal audit must load and verify the evidence again.
- Adds small repository, contract, and service modules with focused tests.

## Final Recommendation Stack

1. Build the deletion-candidate inventory only from the server-owned migration
   deletion path. Return its version, count, and SHA-256 fingerprint, never
   candidate paths or an execution instruction.
2. Load the library policy, replacement gate, receipt, rollback snapshot,
   replacement event, and semantic native authority inside one short,
   shared-lock transaction.
3. Require `replacement_applied` and exact agreement among policy, library,
   original intent, replacement intent, receipt ID/fingerprint, snapshot ID,
   event ID, transition fingerprint, and verifier fingerprint.
4. Treat a rollback snapshot as removal-ready only when it is expired,
   un-restored, and its payload has been redacted. An open window, a restored
   snapshot, or expired unredacted payload blocks the gate.
5. Require exactly one current active semantic native intent and require its ID
   to equal the replacement intent ID.
6. Return a transient artifact marked only `ready_for_final_removal_audit`.
   It is not `ready_to_delete`; its audit explicitly reports
   `legacyDeletionAuthorized: false`.
7. Require the next task to re-evaluate this artifact within its own controlled
   final-removal audit before any removal operation is even planned.

## Implementation Outcome

`server/src/services/policyLibraryRebuildLegacyRemovalInventory.mjs` builds and
validates the static removal-inventory summary. It hashes normalized candidate
metadata while suppressing candidates and rejects normal-workflow or
side-effect declarations.

`server/src/services/policyLibraryRebuildLegacyDeletionReadinessRepository.mjs`
loads compact persisted provenance with parameterized SQL and `FOR SHARE` row
locks. Its policy-first lock order matches replacement writers, avoiding a
mixed read across two cutover states.

`server/src/services/policyLibraryRebuildLegacyDeletionReadiness.mjs` owns the
versioned status, risk vocabulary, rollback disposition, sanitization, and
audit contract. A valid result requires a no-difference receipt, a closed and
redacted rollback snapshot, and exactly one matching semantic native authority.

`server/src/services/policyLibraryRebuildLegacyDeletionReadinessService.mjs`
is the factory-backed server entry point. It performs one transaction-scoped
evidence read and never persists its output. A database or inventory error is a
blocked evidence-boundary result.

No route, UI control, migration, scheduler, provider request, quota check,
legacy deletion, route mutation, or browser diagnostic was added.

## Security And Reliability Outcome

- Missing, malformed, mismatched, restored, active-window, or unredacted
  evidence is fail-closed.
- The replacement event must repeat the gate's exact receipt and rollback
  provenance, preventing a detached event from establishing removal readiness.
- The gate requires semantic native authority, not merely an active intent
  header.
- The inventory is compact and non-executable; it cannot carry file paths or a
  normal-workflow diagnostic surface into a runtime result.
- A readiness artifact is neither persisted nor a deletion authorization, so a
  future action cannot rely on stale evidence.

## Verification

Focused server tests cover:

- compact removal inventory creation and unsafe-output rejection;
- matching completed cutover evidence with closed/redacted rollback;
- rollback-window, verification-provenance, authority, and inventory blocks;
- forged ready-result rejection;
- parameterized shared-lock evidence reads with no mutation SQL; and
- service transaction use and fail-closed dependency failures.

## Next Task

Phase 6R.6 Task 6R.6.9 is **Library Rebuild Legacy-Path Final-Removal Audit**.
It should consume only a freshly evaluated 6R.6.8 artifact and current source
inventory to produce a non-executing, controlled removal plan. It must not
delete, hide, archive, route, or add a browser control.
