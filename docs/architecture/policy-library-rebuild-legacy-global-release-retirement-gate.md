# Policy Library-Rebuild Legacy Global Release Retirement Gate

## Status

Implemented for Phase 6R.6 Task 6R.6.10.

This record defines the deployment-scoped, server-owned aggregation gate that
precedes a proposed repository retirement change. It reads current enabled
policies and rebuilds every per-library final-removal plan in one transaction.
The result is compact, non-executing, and cannot delete source files, modify a
repository, mutate runtime policy state, route media, schedule work, or expose
a browser control.

## Problem

A valid final-removal plan proves only one library rebuild has completed with
fresh cutover evidence. Repository paths are shared by all deployment tenants,
so a release decision needs proof that every currently enabled policy has
reached the same bounded state against one current source inventory.

Neither an individual policy nor a runtime service can authorize a
version-controlled source deletion. The gate must therefore produce a release
state that binds the enabled-policy inventory, compact per-policy plan results,
and source-inventory fingerprint without returning paths or granting mutation
authority.

```text
one shared-lock transaction
  -> enabled policy inventory in ascending policy order
  -> one current legacy-path removal inventory
  -> fresh readiness and final-removal plan for every enabled policy
  -> compact release-state fingerprints and counts
  -> repository-retirement proposal only
  -> separate version-controlled removal change
```

## Official Guidance Reviewed

- [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)
  recommends least privilege, deny-by-default behavior, and authorization at
  the action boundary. The aggregate result explicitly keeps all execution,
  repository-mutation, and runtime-deletion permissions false.
- [NIST SP 800-128](https://csrc.nist.gov/pubs/sp/800/128/upd1/final)
  frames security-focused configuration management as controlled, monitored
  current state. The gate rebuilds release state from current database evidence
  and a current source inventory rather than accepting retained plan results.
- [Microsoft Well-Architected safe deployment practices](https://learn.microsoft.com/en-us/azure/well-architected/operational-excellence/safe-deployments)
  recommends small, quality-gated changes with health checks and recovery. The
  gate is a quality boundary before one separately reviewed repository change;
  it is not a production deletion mechanism.
- [Microsoft Well-Architected secure development lifecycle guidance](https://learn.microsoft.com/en-us/azure/well-architected/security/secure-development-lifecycle)
  recommends trusted build controls and reducing production attack surface.
  Source retirement remains in version control and CI, where review, test, and
  rollback operate, rather than being exposed through a live server process.

## Options Considered

### 1. Treat one ready library plan as a global deletion decision

Pros:

- Fewest reads and simplest implementation.

Cons:

- Does not prove the state of every enabled policy.
- Lets tenant-specific runtime evidence stand in for a release-wide decision.

### 2. Trust a previously stored deployment summary

Pros:

- Avoids recomputing plans.

Cons:

- The policy set, cutover state, or removal inventory can drift.
- Makes retained summary data long-lived retirement authority.

### 3. Let the server remove repository paths after a ready aggregate gate

Pros:

- Appears fully automated.

Cons:

- A running deployment should not hold source-repository write authority.
- It bypasses normal review, CI, release health checks, and source rollback.

### 4. Rebuild a compact global gate and hand off only to a repository proposal

Pros:

- Covers every current enabled policy in deterministic lock order.
- Binds all plans to one current removal inventory and verifiable release-state
  fingerprints.
- Fails closed for empty, malformed, duplicate, missing, unexpected, invalid,
  unready, or inventory-mismatched policy plans.
- Keeps runtime and repository authority separate.

Cons:

- Performs compact reads for every enabled policy.
- Requires a separate version-controlled removal change after a ready result.

## Final Recommendation Stack

1. Lock and read the current enabled-policy inventory in ascending policy ID
   order within one transaction.
2. Build one current, path-redacted removal inventory for that transaction.
3. Rebuild 6R.6.8 readiness and 6R.6.9 final-removal plans for every enabled
   policy with the same evaluation timestamp and inventory.
4. Require exactly one valid, ready final-removal plan per policy and exact
   inventory version, status, candidate count, fingerprint, and validation
   agreement.
5. Hash compact policy and plan summaries with the compact removal inventory to
   create a release-state fingerprint. Do not return raw paths or evidence.
6. Expose only `ready_for_repository_retirement_proposal`, never a deletion or
   mutation authorization.
7. Perform any legacy-path deletion only in a separately reviewed,
   version-controlled change validated by CI and deploy health checks.

## Implementation Outcome

`server/src/services/policyLibraryRebuildLegacyGlobalReleaseRetirementGate.mjs`
owns the versioned global contract, release-state fingerprinting, risk/status
vocabulary, compact counters, and validation. It rejects any output that grants
execution, repository mutation, or runtime deletion permission, exposes source
paths, or fails to bind its release-state fingerprint.

`server/src/services/policyLibraryRebuildLegacyGlobalReleaseRetirementRepository.mjs`
owns the parameterized enabled-policy query. It uses `FOR SHARE` and ascending
policy ID ordering so the aggregate evaluation does not combine policy
inventory changes with a different cutover view.

`server/src/services/policyLibraryRebuildLegacyGlobalReleaseRetirementGateService.mjs`
owns the single transaction. It reads the policy inventory once, creates one
removal inventory, then rebuilds each policy plan sequentially using the
existing shared-lock evidence reader. A dependency or database failure produces
only a blocked evidence-boundary result.

No route, API handler, UI component, database migration, scheduler, provider
request, filesystem mutation, source-code deletion, or browser control was
added.

## Security And Reliability Outcome

- The service cannot perform a destructive action: all returned authorization
  and mutation flags remain false.
- Empty enabled-policy inventory is blocked rather than interpreted as evidence
  that all historical policies converted successfully.
- Duplicate and malformed policy contexts, missing plans, unexpected plans,
  invalid plans, and inventory mismatch fail closed.
- Current-state locks and one timestamp avoid combining plan evidence from
  different aggregate evaluation windows.
- The output contains counts and SHA-256 fingerprints only; it omits policy
  names, raw evidence, source candidates, and repository paths.
- The service is platform-agnostic: it depends only on Classifarr policy state
  and its static server-owned inventory, not local library names or operator
  setup.

## Verification

Focused server tests cover:

- a ready aggregate for two enabled policies;
- missing policy-plan coverage and changed-inventory rejection;
- forged repository-mutation and release-state fingerprint rejection;
- deterministic enabled-policy shared-lock query behavior; and
- one transaction that evaluates every policy in order plus the database-error
  fail-closed path.

## Next Task

Phase 6R.6 Task 6R.6.11 is **Library Rebuild Legacy-Path Controlled Repository
Retirement**. It should use a ready global gate only as a release prerequisite
for one small, version-controlled deletion change. The task must remove the
now-replaced artifacts and their unreachable references/tests/docs together,
retain no runtime deletion capability, and require the normal repository test,
security, and deployment-health gates.
