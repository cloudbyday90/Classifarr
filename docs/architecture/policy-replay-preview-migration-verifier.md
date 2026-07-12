# Policy Replay Preview Migration Verifier

## Status

Implemented as the durable replay-preview migration verifier.

This component preserves the bounded representative replay composition that
replaced the removed `server/src/services/policyIntentReplayPreview.mjs`
compatibility path, but the canonical production module is now
`server/src/services/policyReplayPreviewMigrationVerifier.mjs`.

The `/api/policies/migration-verifier/replay-preview` endpoint is isolated from
normal policy writes. Its implementation stays read-only and does not depend on
the removed compatibility service, replay draft-fit scorer, or parity-delta
reporter.

## Problem

The previous verifier name tied production code to a temporary roadmap phase.
That makes sense during a removal slice, but it becomes stale once the product
role is clear: compose a bounded, read-only replay migration verifier. The
module should be named for that role and should not preserve phase-coded
exports or aliases.

## Official-Source Research

- [NIST Secure Software Development Framework](https://csrc.nist.gov/projects/ssdf)
  recommends integrating secure development practices into normal SDLC work.
  This cutover keeps replay verifier behavior covered by focused tests while
  removing stale production naming.
- [NIST SP 800-128](https://csrc.nist.gov/pubs/sp/800/128/upd1/final)
  treats security as part of configuration management. The rename updates
  imports, diagnostics, tests, validation evidence, roadmap references, and
  changelog text together.
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
  cautions against exposing unnecessary sensitive data. The verifier continues
  to sanitize representative samples and exclude raw metadata, TMDB IDs,
  internal reasoning, and request payloads.
- [Node.js ECMAScript modules](https://nodejs.org/api/esm.html)
  documents ESM as the standard format for reusable JavaScript modules. The
  verifier remains ESM-only with named exports.

## Recommendations

1. **Use durable product-domain naming.**
   Keep the module as `policyReplayPreviewMigrationVerifier.mjs`.

2. **Avoid compatibility aliases.**
   Do not keep old phase-coded exports because they would preserve the stale
   production surface.

3. **Preserve bounded replay behavior.**
   Keep representative sample limits capped, input parameterized, and output
   sanitized. Do not recreate raw draft scoring or parity output: those are not
   source-authorized migration evidence.

4. **Keep execution disabled.**
   The verifier must not trigger classification, provider calls, AI calls,
   persistence, cache mutation, or Arr writes.

5. **Update diagnostics and validation evidence.**
   Dependent replay diagnostics should import the durable limit normalizer, and
   storage-closure validation should run the durable focused test.

## Pros And Cons

Pros:

- Removes phase-coded vocabulary from an imported runtime service.
- Keeps bounded representative replay checks available for migration
  verification.
- Preserves the current API/UI compatibility contract.
- Keeps sample reads parameterized and capped.
- Keeps replay output sanitized and non-persistent.

Cons:

- The route endpoint still says `replay-preview` because that is an API/UI
  compatibility concern, not this module-name cleanup.
- Historical roadmap docs still mention the broader phase sequence as context.

## Final Recommendation Stack

- Service:
  `server/src/services/policyReplayPreviewMigrationVerifier.mjs`
- Focused service test:
  `server/src/__tests__/policyReplayPreviewMigrationVerifier.test.mjs`
- Route integration:
  `server/src/routes/policiesRouteMigrationVerifier.mjs`
- Verifier composition:
  `server/src/services/policyMigrationVerifierPreviewExecution.mjs`
- Dependent diagnostics:
  `server/src/services/policyIntentReplaySampleDiagnostics.mjs`
- Validation evidence:
  `server/src/services/policyStorageClosureValidationEvidence.mjs`

## Implementation Outcome

Implemented:

- Removed `policyIntentReplayPreview.mjs`.
- Added `policyReplayPreviewMigrationVerifier.mjs`.
- Moved replay verification out of normal policy writes into the dedicated
  migration-verifier route.
- Updated replay sample diagnostics to import the durable bounded limit
  normalizer.
- Replaced the focused replay service test with
  `policyReplayPreviewMigrationVerifier.test.mjs`.
- Updated route coverage to expect `read_only_replay_migration_verifier`.
- Removed replay draft-fit scoring, policy-engine comparison, execution
  context, and parity delta. The remaining verifier reports only bounded
  read-only sample and migration-support state.
- Added the verifier test and this design document to policy storage closure
  validation evidence.

## Security Outcome

- No storage, Git, archive, provider, AI, persistence, cache mutation, or Arr
  write side effects are introduced.
- Sample query input remains bounded and parameterized.
- Sample output remains sanitized and excludes raw metadata, TMDB IDs, internal
  reasons, and request payloads.
- The verifier keeps explicit execution flags showing no classification run,
  provider call, AI call, persistence, or Arr write happened.
- No compatibility alias was left behind for the stale phase-coded module name.

## Next Step

Run the storage-closure validation evidence and final-removal audit after the
replay verifier cutover is committed.
