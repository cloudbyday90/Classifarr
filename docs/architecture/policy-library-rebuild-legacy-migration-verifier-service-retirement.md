# Policy Library-Rebuild Legacy Migration-Verifier Service Retirement

## Status

Implemented as Phase 6R.6 Task 6R.6.11.3.

The legacy migration-verifier HTTP route, impact/replay services, enrichment
helpers, and focused tests were already removed in prior controlled changes.
This task completes their retirement by removing all absent paths from the live
migration-deletion ledger and making the ledger test fail when a current entry
does not resolve in the repository.

`policyMigrationVerifierRollback.mjs` remains. It is not an HTTP route or
browser feature: active conversion, migration coordination, runtime audits,
metrics, and test-reset contracts consume it for bounded acceptance, rollback,
and provenance checks.

## Problem

The live deletion ledger still listed 33 route, service, and test paths that no
longer existed. Its downstream inventory therefore could produce a nominal
repository-retirement proposal for source that was already gone. That is an
inventory and security-control defect, not a reason to delete the active
rollback verifier.

## Official Guidance Reviewed

- [OWASP API9:2023 Improper Inventory Management](https://owasp.org/API-Security/editions/2023/en/0xa9-improper-inventory-management/)
  calls for accurate endpoint and service inventories with retirement plans.
- [NIST SP 800-218 Secure Software Development Framework](https://csrc.nist.gov/pubs/sp/800/218/final)
  recommends integrating secure development practices to reduce vulnerabilities
  and prevent recurrence.
- [Microsoft safe-deployment guidance](https://learn.microsoft.com/en-us/azure/well-architected/operational-excellence/safe-deployments)
  recommends validating inactivity, preserving rollback capability, cleaning
  residual references, and using independent quality gates for decommissioning.
- [Microsoft resource-hardening guidance](https://learn.microsoft.com/en-us/azure/well-architected/security/harden-resources)
  recommends keeping an asset inventory current and removing extraneous attack
  surface through a safe decommissioning process.

## Options Considered

### 1. Retain absent verifier paths in the live ledger

Pros:

- Preserves a historical list beside the current plan.

Cons:

- Produces retirement proposals for impossible source removals.
- Makes inventory-derived safety evidence unreliable.

### 2. Delete `policyMigrationVerifierRollback.mjs`

Pros:

- Removes a migration-named module.

Cons:

- Breaks active conversion, coordinator, metrics, completion-audit, and
  rollback-provenance contracts.
- Removes a server-side safety gate without a replacement.

### 3. Retire only absent legacy paths and preserve the active rollback contract

Pros:

- Makes the live inventory truthful and prevents stale paths from returning.
- Reduces retired API/service surface without weakening cutover safety.
- Keeps controlled removal fixtures available for future, genuinely present
  candidates while the default inventory fails closed at zero candidates.

Cons:

- Historical retirement evidence is read from dedicated documents and Git
  history rather than the live inventory.
- The retained rollback contract needs a later redesign only when its current
  consumers have a tested replacement.

## Final Recommendation Stack

1. Keep live inventories limited to source that currently exists.
2. Treat a zero-candidate default removal inventory as fail-closed: there is no
   new repository-removal action to authorize.
3. Preserve explicit synthetic candidates in focused tests so the controlled
   final-removal workflow remains covered independently of repository state.
4. Keep `policyMigrationVerifierRollback` as a server-internal, bounded safety
   primitive until all active consumers move to a replacement contract.
5. Preserve retired route/service history in dedicated architecture records and
   version control, not current runtime inventories.

## Implementation Outcome

- Removed 33 absent legacy migration-verifier route, service, and test paths
  from `policyMigrationDeletionPath.mjs`.
- Kept only the current evidence engine, intent engine, and native-storage
  schema blocker in the live deletion ledger.
- Added a repository-root filesystem assertion for every default ledger path.
- Updated controlled-retirement tests to use explicit synthetic candidates;
  the default zero-candidate path remains blocked and non-executing.

No HTTP endpoint, policy write, database mutation, media-server operation,
provider call, scheduler job, browser control, or runtime repository-write
capability was added.

## Verification

- Focused migration, rollback, deletion-readiness, final-removal, and global
  retirement-gate tests validate both current zero-candidate and explicit
  candidate behavior.
- The legacy migration-verifier route is absent from the server route tree.
- The current ledger resolves every default path from the repository root.

## Next Task

Phase 7R.1, Runtime Decision Inventory And Cutline, is the next roadmap item.
Re-evaluate the current runtime classification, routing, question, learning,
queue, and retry artifacts against their declared authority before changing
runtime behavior. Preserve the active rollback verifier while it has live
conversion and runtime consumers.
