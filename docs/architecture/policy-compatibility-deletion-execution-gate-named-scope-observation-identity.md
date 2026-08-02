# Policy Compatibility Deletion Execution-Gate Named-Scope Observation Identity

## Status

Complete. This document records Phase 3R, Task 3R.10.14.

## Decision

Preflight evidence now observes an approved manifest entry by a deterministic
server-derived identity instead of treating a repository path as the full
identity. The collection and gate remain read-only. The existing controlled
path-removal component explicitly refuses named test scopes and cannot turn
one into a whole-file operation.

## Problem

The candidate-target adapter can produce four legitimate named test scopes in
two retained test files. The preflight collector recorded only `{ index, path,
statusId }`, and the execution-gate attestation rejected repeated paths as
duplicates. That made safe, exact shared-file entries impossible to complete
while still leaving a path-only removal component as the next boundary.

## Research

OWASP recommends re-deriving security-relevant values on the server, enforcing
explicit workflow states, and rejecting replayed or invalid steps. Transaction
authorization guidance also requires binding authorization to the exact data
being acted on rather than to a broad proxy. NIST SSDF recommends incorporating
these secure-design practices into the implemented and tested software
lifecycle.

- [OWASP Business Logic Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Business_Logic_Security_Cheat_Sheet.html)
- [OWASP Transaction Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Transaction_Authorization_Cheat_Sheet.html)
- [NIST SP 800-218 Secure Software Development Framework](https://csrc.nist.gov/pubs/sp/800/218/final)

## Options Considered

### Keep path-only observations

Pros: no schema change and simple reporting.

Cons: treats independent scopes in a retained file as duplicates and cannot
prove which approved scope was observed. Rejected.

### Use an operator-provided scope label

Pros: readable and superficially specific.

Cons: the label is caller-controlled, may drift from source, and does not bind
the action, fragments, or no-whole-file-deletion boundary. Rejected.

### Derive canonical identities from approved manifest entries

Pros: exact scope binding, deterministic output, collision-resistant named
scope identity, backward-compatible file observations, and fail-closed
duplicate detection.

Cons: versioned artifacts must be regenerated and opaque hashes need the
manifest for interpretation. Selected.

## Final Recommendation Stack

1. Derive the identity from the approved execution-plan manifest on the
   server. File entries use `file_path:<canonical path>` to preserve legacy
   path-only observation behavior.
2. Derive named-scope identities as SHA-256 hashes of the canonical action,
   category, path, target kind, component, dependencies, source fragments,
   test-name fragments, deletion intent, and explicit no-whole-file-deletion
   boundary.
3. Require an exact identity in every named-scope observation. Legacy file
   observations may omit it, but any supplied value must match the derived
   identity.
4. Fail closed on an invalid identity, duplicate file path, duplicate exact
   scope identity, stale evidence, fingerprint mismatch, or changed approval
   state.
5. Keep named scopes outside `policyControlledCompatibilityPathRemoval` until a
   separate scope-aware removal component can re-read and safely edit only the
   approved source scope.

## Implementation

`policyCompatibilityDeletionPreflightManifestObservationIdentity.mjs` is the
single ESM identity module. The preflight collector emits the identity with each
manifest observation. Artifact construction and execution-gate attestation
independently rederive the expected identity from the current approved
execution-plan artifact.

The following versioned contracts advance together:

- Preflight evidence artifact: v3
- Preflight evidence artifact fingerprint: v2
- Preflight attestation: v2
- Deletion execution gate: v5
- Preflight evidence collector outcome: v2

The preflight artifact fingerprint covers the retained observation identities.
The execution-plan artifact fingerprint, artifact freshness checks, recovery
evidence, final stances, and operator approval remain independent gate
requirements.

## Security Invariants

- Caller-provided observation identities are never authoritative; the service
  derives the expected identity from the fingerprint-validated artifact.
- Multiple named scopes may share one file only when their canonical identities
  differ.
- Repeated exact file or named-scope entries block the preflight gate.
- File system and Git tracking checks remain path based and read-only.
- The path-removal selector refuses named-scope manifest entries, so this task
  neither deletes files nor grants scope-edit authority.

## Validation

Focused server validation covers canonical identity stability, distinct shared
file scopes, missing or altered identities, duplicate exact scopes, collector
output, execution-gate admission, and explicit file-removal refusal.

## Next Task

Phase 3R, Task 3R.10.15: Compatibility Deletion Controlled-Removal
Scope-Aware Execution Adapter. Build a separate review-only adapter that accepts
only fingerprint-bound named-scope identities and produces an exact dry-run
source edit. It must reject missing, ambiguous, stale, or changed source scopes
and must not write or delete anything.
