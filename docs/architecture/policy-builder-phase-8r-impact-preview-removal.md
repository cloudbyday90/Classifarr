# Policy Builder Phase 8R Impact Preview Removal

## Status

Implemented as the second current compatibility-path removal slice.

This slice removes the approved manifest path
`server/src/services/policyIntentImpactPreview.mjs` from the product tree and
replaces it with
`server/src/services/policyBuilderPhase8ImpactMigrationVerifier.mjs`.

The `/api/policies/intent/impact-preview` endpoint remains available for the
current migration-verifier UI path, but its implementation no longer depends on
the old `policyIntentImpactPreview.mjs` service path.

## Problem

Phase 8R closure is still blocked while approved compatibility-removal manifest
paths exist. After removing the starter-template mechanics component, the next
remaining path was `policyIntentImpactPreview.mjs`.

The old service name preserved the previous product model: “preview the impact”
as an operator-facing diagnostic panel. The deterministic comparison is still
useful as migration-verification evidence, but it should live under a Phase 8R
name and be treated as a verifier, not a durable policy-authoring engine.

## Official-Source Research

- [NIST SP 800-218 Secure Software Development Framework](https://csrc.nist.gov/pubs/sp/800/218/final)
  recommends integrating secure development practices into the SDLC, including
  change control and verification. This slice keeps behavior covered by focused
  tests while removing the stale path.
- [OWASP API8:2023 Security Misconfiguration](https://owasp.org/API-Security/editions/2023/en/0xa8-security-misconfiguration/)
  includes risks from ad hoc or unnecessary API behavior. The route remains
  bounded and non-persistent while implementation moves to a clearer migration
  verifier.
- [SLSA build requirements](https://slsa.dev/spec/v1.2/build-requirements)
  emphasize artifact integrity and provenance. Phase 8R removal evidence stays
  tied to explicit manifest paths and current validation results.
- [SLSA provenance](https://slsa.dev/spec/v1.2/build-provenance)
  describes verifiable information about how artifacts were produced. The
  renamed verifier makes the provenance of this comparison explicit: it is
  migration evidence, not policy authority.
- [Node.js ECMAScript modules](https://nodejs.org/api/esm.html)
  document ESM as the standard module format for Node.js. The replacement stays
  ESM-only with named exports.

## Recommendations

1. **Delete the stale service path.**
   Remove `policyIntentImpactPreview.mjs` instead of leaving a compatibility
   shim.

2. **Preserve deterministic comparison behavior under a Phase 8R name.**
   The comparison is still useful as migration-verification evidence, so it
   should live in `policyBuilderPhase8ImpactMigrationVerifier.mjs`.

3. **Keep the endpoint non-persistent.**
   The route must not write policy storage, call providers, run migrations, or
   mutate native intent records.

4. **Make the response mode honest.**
   The verifier now reports `non_persistent_migration_verifier`, making the
   response role explicit without exposing raw draft content.

5. **Update focused tests and validation evidence.**
   Route tests and service tests should target the replacement verifier so
   policy storage closure validation proves the current path.

## Pros And Cons

Pros:

- Removes one more approved Phase 8R compatibility manifest path.
- Keeps deterministic migration comparison available.
- Avoids a compatibility shim that would keep the old path alive.
- Makes the route behavior clearer: migration verifier, not policy authority.
- Keeps the implementation ESM-only with named exports.

Cons:

- The route endpoint name still contains `impact-preview` until the client
  migration-verifier UI is removed or renamed later.
- Client impact-preview utilities remain for the current optional verifier
  panel.
- Replay composition is now tracked by the separate Phase 8R replay migration
  verifier removal slice.

## Final Recommendation Stack

- Replacement service:
  `server/src/services/policyBuilderPhase8ImpactMigrationVerifier.mjs`
- Removed service:
  `server/src/services/policyIntentImpactPreview.mjs`
- Route integration:
  `server/src/routes/policiesRoutePolicyWrite.mjs`
- Focused service test:
  `server/src/__tests__/services/policyBuilderPhase8ImpactMigrationVerifier.test.mjs`
- Route coverage:
  `server/src/__tests__/policies-routes.coverage.test.mjs`
- Validation evidence:
  `server/src/services/policyStorageClosureValidationEvidence.mjs`

## Implementation Outcome

Implemented:

- Removed `policyIntentImpactPreview.mjs`.
- Added `policyBuilderPhase8ImpactMigrationVerifier.mjs`.
- Updated policy write routes to call the Phase 8R verifier for both the
  impact-preview endpoint and replay-preview composition.
- Replaced the focused service test with
  `policyBuilderPhase8ImpactMigrationVerifier.test.mjs`.
- Updated route coverage to expect `non_persistent_migration_verifier`.
- Added the verifier test and this design document to policy storage closure
  validation
  evidence.

## Security Outcome

- No storage, Git, archive, provider, or migration side effects are introduced.
- The verifier returns bounded counts and deltas, not raw draft payloads.
- The verifier is deterministic and uses existing policy configuration plus the
  validated intent draft payload only.
- The old manifest path no longer exists in product code.

## Next Step

Replay-preview service removal is tracked in
[Policy Builder Phase 8R Replay Preview Removal](policy-builder-phase-8r-replay-preview-removal.md).
After that slice validates, refresh the final-removal audit and completion
checkpoint evidence.
