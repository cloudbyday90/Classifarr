# Policy Replay Preview Migration Verifier Module Cutover

## Status

Implemented.

This cutover renames the replay-preview migration verifier from temporary
phase-coded module naming to durable product-domain naming:

- Canonical service:
  `server/src/services/policyReplayPreviewMigrationVerifier.mjs`

The route behavior, replay sample query, response mode, diagnostics contract,
and non-persistent execution boundary remain unchanged.

## Problem

Phase-coded service names are useful while sequencing a large refactor, but
they become stale production vocabulary after the phase closes. The replay
preview verifier is still useful migration evidence, so it should remain under
a durable product-domain name that describes what it does.

## Official-Source Research

- [NIST Secure Software Development Framework](https://csrc.nist.gov/projects/ssdf)
  recommends integrating secure development practices into normal SDLC work.
  This cutover keeps the same bounded behavior under focused tests while making
  the implementation name match its durable role.
- [NIST SP 800-128](https://csrc.nist.gov/pubs/sp/800/128/upd1/final)
  treats security as part of configuration management. The rename updates
  runtime imports, diagnostics imports, tests, validation evidence, roadmap
  references, and changelog text together.
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
  cautions against exposing unnecessary sensitive data. The verifier continues
  to sanitize representative samples and expose only bounded replay metadata.
- [Node.js ECMAScript modules](https://nodejs.org/api/esm.html)
  documents ESM as the standard JavaScript module format. The cutover keeps the
  service and tests ESM-only with named exports.

## Recommendations

1. **Use durable module vocabulary.**
   Name the service after its product role:
   `policyReplayPreviewMigrationVerifier.mjs`.

2. **Rename public symbols.**
   Use `buildPolicyReplayPreviewMigrationVerifier`,
   `buildPolicyReplayPreviewMigrationSampleQuery`,
   `normalizePolicyReplayPreviewMigrationLimit`, and
   `sanitizePolicyReplayPreviewMigrationSample`.

3. **Avoid compatibility aliases.**
   Do not keep old phase-coded exports or a shim, because that would preserve
   the stale production surface.

4. **Keep the replay boundary read-only.**
   Preserve disabled execution flags for classification, providers, AI,
   persistence, cache mutation, and Arr writes.

## Pros And Cons

Pros:

- Removes phase-coded vocabulary from replay runtime code.
- Keeps route and diagnostics behavior stable.
- Preserves bounded, parameterized sample reads.
- Keeps representative sample output sanitized.
- Reduces future roadmap confusion because the service name remains meaningful
  after the phase closes.

Cons:

- The endpoint path still says `replay-preview` because that remains a client
  and API compatibility concern.
- Broader UI simplification remains a separate product workflow task.

## Final Recommendation Stack

- Service:
  `server/src/services/policyReplayPreviewMigrationVerifier.mjs`
- Test:
  `server/src/__tests__/policyReplayPreviewMigrationVerifier.test.mjs`
- Route integration:
  `server/src/routes/policiesRouteMigrationVerifier.mjs`
- Dependent diagnostics:
  `server/src/services/policyIntentReplaySampleDiagnostics.mjs`
- Validation evidence:
  `server/src/services/policyStorageClosureValidationEvidence.mjs`
- Design evidence:
  `docs/architecture/policy-replay-preview-migration-verifier.md`

## Implementation Outcome

Implemented:

- Renamed the replay migration verifier service and focused test.
- Renamed exported constants and builder/normalizer/sanitizer functions to
  durable replay-preview migration verifier names.
- Updated policy write routes and replay sample diagnostics to import the
  durable names.
- Updated policy storage closure validation evidence and native-storage test
  reset metadata.
- Updated the roadmap and changelog to point at the durable artifact.

## Security Outcome

- No persistent writes or provider calls were added.
- The verifier still caps sample limits and uses parameterized sample queries.
- The verifier still redacts raw metadata identifiers and internal reasoning
  from representative sample output.
- No compatibility alias was left behind for the stale phase-coded module name.

## Next Step

Run the final stale-reference scan for phase-coded replay verifier names, then
refresh the policy storage closure validation evidence if the cleanup remains
clean.
