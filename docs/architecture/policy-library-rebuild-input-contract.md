# Policy Library Rebuild Input Contract

## Status

Implemented as the server-owned admission boundary for library-derived policy
rebuild proposals.

## Problem

The rebuild reducer previously accepted caller-shaped library profiles,
freshness, and observed-absence lists alongside a guarded-outcome projection.
That let a structurally valid payload bypass the cached-profile handoff that
already proves profile adaptation, freshness, and evidence-boundary checks.

It also made component audits fabricate empty rebuild and migration inputs. An
audit should verify component wiring or validate a supplied proposal; it must
not invent a library decision.

## Official Guidance Reviewed

- [NIST AI RMF Core](https://airc.nist.gov/airmf-resources/airmf/5-sec-core/)
  calls for documented data selection, system limits, provenance, and defined
  human oversight. The contract records only bounded source summaries and
  preserves the operator-acceptance gate.
- [OWASP Business Logic Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Business_Logic_Security_Cheat_Sheet.html)
  recommends server-owned workflow state and re-deriving security-relevant
  values. Rebuild derives profile evidence from the verified cached handoff
  rather than trusting profile fields in a request-shaped object.
- [OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
  recommends early server-side syntactic and semantic validation. The contract
  allowlists top-level fields, accepts only plain own-data records, bounds
  collections and traversal depth, and rejects raw provider or replay fields.
- [OWASP Secure Code Review Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Secure_Code_Review_Cheat_Sheet.html)
  calls for trust-boundary, workflow-integrity, rollback, and resource-limit
  review. The contract validates matching library identifiers, profile audits,
  guarded-outcome provenance, and no-write behavior before proposal reduction.

## Decision

Use one focused contract before the rebuild reducer:

```text
cached profile handoff + explicit constraints + routing + guarded outcomes
  -> guarded-outcome projection
  -> policy.library_rebuild_input_contract.v1
  -> library-derived rebuild proposal
  -> explicit operator acceptance and rollback gate
```

The contract accepts only:

- a selected library identity;
- a successful `policy.library_profile_evidence_loader.v1` handoff for that
  library;
- canonical operator intent and explicit constraints;
- canonical routing configuration;
- a valid `policy.guarded_outcome_projection.v1` projection, or request-time
  decisions from which it constructs that projection.

It rejects raw `libraryProfile`, `profileFreshness`, `observedAbsences`, raw
learning decisions, mixed raw/projection input, unsafe object shapes, provider
payloads, replay data, and oversized collections. Observed absence comes only
from verified profile evidence and remains review-only.

The contract produces a sanitized `inputContract` summary on every proposal.
The summary binds the selected library to the cached-profile handoff and records
only bounded guarded-outcome accepted, rejected, and ignored counts. Proposal
validation rejects missing or mismatched summaries.

## Pros And Cons

Pros:

- Removes raw library-state fields as alternate rebuild authorities.
- Reuses the existing profile loader, freshness, and profile-evidence audit.
- Makes source provenance and collection limits explicit and testable.
- Preserves the existing bounded evidence, intent, and readiness authorities.
- Stops no-argument component audits from fabricating a policy decision.

Cons:

- Internal callers must obtain the cached profile handoff before invoking a
  rebuild.
- Test and migration fixtures must model the verified handoff rather than a
  convenient raw library-profile object.

## Final Recommendation Stack

1. `policyLibraryProfileEvidenceLoader.mjs` supplies the cached profile
   handoff and freshness state.
2. `policyGuardedOutcomeProjection.mjs` admits only valid request-time learning
   decisions to rebuild evidence.
3. `policyLibraryRebuildInputContract.mjs` validates and canonicalizes rebuild
   inputs without reads, provider calls, quota checks, or writes.
4. `policyLibraryPolicyRebuild.mjs` reduces only the verified contract into a
   review-only proposal.
5. `policyMigrationVerifierRollback.mjs` validates supplied reports without
   creating synthetic rebuild input.
6. Focused contract, rebuild, migration, and runtime-completion tests prevent
   source-boundary regressions.

## Security Outcome

- A caller cannot supply a raw library profile, freshness value, or absence list
  to alter a rebuild proposal.
- A profile handoff must be current or explicitly stale, audited, and for the
  selected library.
- Raw provider, replay, quota, and accessor-backed input is refused before
  proposal construction.
- Guarded outcomes remain bounded and fingerprint/request-proof validated.
- The contract itself has no provider, routing, learning, policy-storage, or
  media-server side effects.

## Implemented Files

- Contract:
  `server/src/services/policyLibraryRebuildInputContract.mjs`
- Proposal integration:
  `server/src/services/policyLibraryPolicyRebuild.mjs`
- Migration audit update:
  `server/src/services/policyMigrationVerifierRollback.mjs`
- Focused tests:
  `server/src/__tests__/services/policyLibraryRebuildInputContract.test.mjs`,
  `server/src/__tests__/services/policyLibraryPolicyRebuild.test.mjs`, and
  `server/src/__tests__/services/policyMigrationVerifierRollback.test.mjs`

## Next Step

Use this contract as the sole input to a read-only rebuild proposal workflow,
then strengthen the proposal acceptance and rollback transition before any
replacement path is allowed.
