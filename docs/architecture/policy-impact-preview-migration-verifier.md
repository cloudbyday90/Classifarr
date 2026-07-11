# Policy Impact Preview Migration Verifier

## Status

Implemented as the durable impact-preview migration verifier.

This component preserves the deterministic impact comparison that replaced the
removed `server/src/services/policyIntentImpactPreview.mjs` compatibility path,
but the canonical production module is now
`server/src/services/policyImpactPreviewMigrationVerifier.mjs`.

The `/api/policies/migration-verifier/impact-preview` endpoint is isolated from
normal policy writes and its implementation no longer depends on the old
`policyIntentImpactPreview.mjs` service path.

## Problem

The old implementation path preserved the previous product model: "preview the
impact" as an operator-facing diagnostic panel. The deterministic comparison is
still useful as migration-verification evidence, but phase-coded module names
become misleading after the phase closes. The service needs a durable
product-domain name that describes what it does without binding production code
to a temporary roadmap phase.

## Official-Source Research

- [NIST Secure Software Development Framework](https://csrc.nist.gov/projects/ssdf)
  frames secure development as practices integrated into the SDLC. This cutover
  keeps the same bounded behavior under focused tests while removing misleading
  production naming.
- [NIST SP 800-128](https://csrc.nist.gov/pubs/sp/800/128/upd1/final)
  treats security as part of configuration management. The module rename is a
  controlled configuration change: references, tests, validation evidence, and
  docs are updated together.
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
  warns against exposing unnecessary sensitive data in operational records. The
  verifier continues to return bounded counts and deltas rather than raw draft
  payloads.
- [Node.js ECMAScript modules](https://nodejs.org/api/esm.html)
  document ESM as the standard format for reusable JavaScript modules. The
  verifier remains ESM-only with named exports.

## Recommendations

1. **Use product-domain naming.**
   Keep the verifier as `policyImpactPreviewMigrationVerifier.mjs`, not a
   phase-coded module.

2. **Preserve deterministic comparison behavior.**
   The verifier should compare legacy configuration-view buckets against the
   validated intent draft and return bounded parity and impact metadata.

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

- Keeps deterministic migration comparison available.
- Removes phase-coded production naming from the impact verifier.
- Makes the route behavior clearer: migration verifier, not policy authority.
- Keeps the implementation ESM-only with named exports.

Cons:

- The route endpoint name still contains `impact-preview` until the client
  migration-verifier UI is removed or renamed later.
- Client impact-preview utilities remain for the current optional verifier
  panel.
- Replay composition is still tracked by the separate replay migration verifier.

## Final Recommendation Stack

- Canonical service:
  `server/src/services/policyImpactPreviewMigrationVerifier.mjs`
- Removed service:
  `server/src/services/policyIntentImpactPreview.mjs`
- Route integration:
  `server/src/routes/policiesRouteMigrationVerifier.mjs`
- Verifier composition:
  `server/src/services/policyMigrationVerifierPreviewExecution.mjs`
- Focused service test:
  `server/src/__tests__/services/policyImpactPreviewMigrationVerifier.test.mjs`
- Route coverage:
  `server/src/__tests__/policies-routes.coverage.test.mjs`
- Validation evidence:
  `server/src/services/policyStorageClosureValidationEvidence.mjs`

## Implementation Outcome

Implemented:

- Removed `policyIntentImpactPreview.mjs`.
- Added `policyImpactPreviewMigrationVerifier.mjs`.
- Moved the verifier endpoint out of normal policy writes into the dedicated
  migration-verifier route.
- Replaced the focused service test with
  `policyImpactPreviewMigrationVerifier.test.mjs`.
- Updated route coverage to expect `non_persistent_migration_verifier`.
- Added the verifier test and this design document to policy storage closure
  validation evidence.

## Security Outcome

- No storage, Git, archive, provider, or migration side effects are introduced.
- The verifier returns bounded counts and deltas, not raw draft payloads.
- The verifier is deterministic and uses existing policy configuration plus the
  validated intent draft payload only.
- The old manifest path no longer exists in product code.

## Next Step

Replay-preview migration verification is tracked in
[Policy Replay Preview Migration Verifier](policy-replay-preview-migration-verifier.md).
