# Policy Builder Phase 8R Replay Preview Removal

## Status

Implemented.

## Scope

Phase 8R removes approved compatibility paths instead of hiding them behind
shims. This slice removes
`server/src/services/policyIntentReplayPreview.mjs` from product/runtime code and
replaces its still-needed bounded replay composition with a Phase 8R migration
verifier service.

The browser replay preview UI and client normalizer are not reworked here. They
remain current product surface until the broader Phase 6R/7R evidence and
operator workflow re-imagination replaces that UI.

## Research Notes

Official sources reviewed:

- NIST SP 800-218 SSDF recommends integrating secure development practices
  across the SDLC, including reviewing design against security requirements and
  using automated verification where practical:
  <https://csrc.nist.gov/pubs/sp/800/218/final>
- OWASP API Security Top 10 API4:2023 calls out resource consumption risks for
  endpoints that can drive CPU, network, storage, or paid-provider use:
  <https://owasp.org/API-Security/editions/2023/en/0x11-t10/>
- SLSA provenance guidance emphasizes traceability of what changed, where it
  came from, and how artifacts were produced:
  <https://slsa.dev/spec/v1.2/build-provenance>
- Node.js documents ECMAScript modules as the standard JavaScript module system
  for reusable code:
  <https://nodejs.org/api/esm.html>

## Recommendations

1. Replace the compatibility service path with a Phase 8R-owned verifier module,
   not a shim.
2. Preserve the read-only replay endpoint contract and side-effect controls
   while the product UI is still present.
3. Keep sample reads bounded and parameterized.
4. Keep provider, AI, persistence, and Arr writes disabled in this verifier.
5. Keep final-removal evidence separate from runtime code so manifest strings in
   tests/control-plane services do not keep product compatibility alive.

## Pros And Cons

Pros:

- Removes the final approved Phase 8R compatibility service path from
  product/runtime code.
- Preserves bounded representative replay checks for migration verification.
- Keeps route behavior deterministic and side-effect-free.
- Avoids carrying a compatibility shim under the deleted name.
- Keeps the implementation ESM-only with named exports.

Cons:

- The route endpoint and browser components still use replay-preview naming
  until the Phase 6R/7R product workflow is reworked.
- Historical Phase 5/6 docs still mention the old replay preview architecture as
  background.
- Control-plane services still list the removed manifest path because final
  removal audits need proof of what was deleted.

## Final Recommendation Stack

- Replacement service:
  `server/src/services/policyBuilderPhase8ReplayMigrationVerifier.mjs`
- Removed service:
  `server/src/services/policyIntentReplayPreview.mjs`
- Route integration:
  `server/src/routes/policiesRoutePolicyWrite.mjs`
- Focused service test:
  `server/src/__tests__/policyBuilderPhase8ReplayMigrationVerifier.test.mjs`
- Dependent diagnostics:
  `server/src/services/policyIntentReplaySampleDiagnostics.mjs`
- Validation evidence:
  `server/src/services/policyStorageClosureValidationEvidence.mjs`

## Implementation Outcome

Implemented:

- Removed `policyIntentReplayPreview.mjs`.
- Added `policyBuilderPhase8ReplayMigrationVerifier.mjs`.
- Updated policy write routes to call the Phase 8R verifier for replay preview
  composition.
- Updated replay sample diagnostics to import the Phase 8R bounded limit
  normalizer.
- Replaced the focused replay service test with
  `policyBuilderPhase8ReplayMigrationVerifier.test.mjs`.
- Updated route coverage to expect `read_only_replay_migration_verifier`.
- Added the verifier test and this design document to policy storage closure
  validation evidence.

## Security Outcome

- No storage, Git, archive, provider, AI, persistence, or Arr write side effects
  are introduced.
- Sample query input is bounded and parameterized.
- Sample output remains sanitized and excludes raw metadata, TMDB IDs, internal
  reasons, and request payloads.
- The verifier keeps explicit execution flags showing no classification run,
  provider call, AI call, persistence, or Arr write happened.
- The old manifest path no longer exists in product/runtime code.

## Next Step

Run the storage-closure final-removal audit against the approved execution manifest and
updated validation evidence. If it reports zero remaining approved manifest
paths and no product/runtime references, proceed to the Phase 8R completion
checkpoint artifact refresh.
