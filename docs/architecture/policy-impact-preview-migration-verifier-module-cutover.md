# Policy Impact Preview Migration Verifier Module Cutover

## Status

Implemented.

This cutover renames the impact-preview migration verifier from temporary
phase-coded module naming to durable product-domain naming:

- Canonical service:
  `server/src/services/policyImpactPreviewMigrationVerifier.mjs`

The route behavior, response mode, validation contract, and non-persistent
execution boundary remain unchanged.

## Problem

Phase-coded service names are useful while sequencing a large refactor, but
they become stale production vocabulary after the phase closes. The impact
preview verifier is still useful migration evidence, so it should remain in the
codebase under a name that describes its product role instead of its temporary
roadmap slice.

## Official-Source Research

- [NIST Secure Software Development Framework](https://csrc.nist.gov/projects/ssdf)
  recommends integrating secure development practices into normal SDLC work.
  This cutover keeps the behavior covered by focused tests while making the
  implementation name match its durable role.
- [NIST SP 800-128](https://csrc.nist.gov/pubs/sp/800/128/upd1/final)
  treats security as part of configuration management. The rename updates
  imports, tests, validation evidence, roadmap references, and changelog text
  together instead of leaving stale references behind.
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
  cautions against exposing unnecessary sensitive data. The verifier continues
  to expose only bounded counts, parity, impact level, and reason codes.
- [Node.js ECMAScript modules](https://nodejs.org/api/esm.html)
  documents ESM as the standard JavaScript module format. The cutover keeps the
  service and tests ESM-only with named exports.

## Recommendations

1. **Use durable module vocabulary.**
   Name the service after its product role:
   `policyImpactPreviewMigrationVerifier.mjs`.

2. **Avoid compatibility aliases.**
   Do not keep the old phase-coded export or a shim, because that would preserve
   the stale production surface.

3. **Keep verifier output bounded.**
   Preserve the existing non-persistent verifier mode and avoid exposing raw
   draft payloads in responses or evidence artifacts.

4. **Update validation evidence.**
   Replace the focused test path and markdown evidence path so storage-closure
   validation proves the current durable module.

## Pros And Cons

Pros:

- Removes phase-coded vocabulary from an imported runtime service.
- Keeps the migration verifier available for current impact-preview route
  behavior.
- Preserves the existing security boundary: no writes, provider calls, Git
  operations, or migrations.
- Reduces future roadmap confusion because the service name remains meaningful
  after the phase closes.

Cons:

- The endpoint path still says `impact-preview` because that is an API/UI
  compatibility concern, not this module-name cleanup.
- The replay migration verifier still needs the same durable-name cutover.

## Final Recommendation Stack

- Service:
  `server/src/services/policyImpactPreviewMigrationVerifier.mjs`
- Test:
  `server/src/__tests__/services/policyImpactPreviewMigrationVerifier.test.mjs`
- Route integration:
  `server/src/routes/policiesRoutePolicyWrite.mjs`
- Validation evidence:
  `server/src/services/policyStorageClosureValidationEvidence.mjs`
- Design evidence:
  `docs/architecture/policy-impact-preview-migration-verifier.md`

## Implementation Outcome

Implemented:

- Renamed the impact migration verifier service and focused test.
- Renamed exported symbols to
  `POLICY_IMPACT_PREVIEW_MIGRATION_VERIFIER_SCHEMA_VERSION` and
  `buildPolicyImpactPreviewMigrationVerifier`.
- Updated policy write routes to import the durable verifier name.
- Updated policy storage closure validation evidence and native-storage test
  reset metadata.
- Updated the roadmap and changelog to point at the durable artifact.

## Security Outcome

- No persistent writes or provider calls were added.
- The verifier still redacts raw draft content and returns only bounded counts,
  deltas, and reason codes.
- No compatibility alias was left behind for the stale phase-coded module name.

## Next Step

Apply the same durable-name cutover to the replay migration verifier.
