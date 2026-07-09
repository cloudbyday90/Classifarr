# Policy Post-Removal Runtime Verification Module Cutover

## Intent

Remove phase-coded names from the post-removal runtime verification component
without changing verification behavior. The verifier remains an evidence
consumer: it proves controlled-removal apply output, reference scan evidence,
runtime checks, and validation evidence before next-batch authorization.

## Official-Source Research

- NIST SP 800-128 treats controlled change and monitoring as part of
  security-focused configuration management. The cutover keeps the rename
  auditable through roadmap, changelog, and focused validation evidence.
- NIST SSDF recommends integrating secure practices throughout development.
  Durable production names reduce future maintenance ambiguity and keep
  verification contracts independent of temporary implementation phases.
- OWASP Logging guidance recommends recording enough event context for later
  monitoring and analysis. The verifier preserves structured status, risk, and
  side-effect fields while removing phase-coded handoff identifiers.
- Git `mv` documents explicit file renames. This cutover uses file moves plus
  import and command updates so Git can track the module boundary change.

Sources:

- NIST SP 800-128:
  <https://csrc.nist.gov/pubs/sp/800/128/upd1/final>
- NIST Secure Software Development Framework:
  <https://csrc.nist.gov/projects/ssdf>
- OWASP Logging Cheat Sheet:
  <https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html>
- Git `mv` documentation:
  <https://git-scm.com/docs/git-mv>

## Recommendations

### Rename The Whole Verification Boundary

The artifact wrapper should not be durable while importing a phase-coded
verifier. Rename the verifier, artifact wrapper, tests, and CLI runner together.

Pros:

- removes phase-coded production imports from the verification component,
- keeps artifact and core verifier vocabulary aligned,
- avoids a second temporary compatibility boundary.

Cons:

- requires downstream import updates in authorization and audit services.

### Preserve Verification Semantics

Keep status IDs and risk IDs semantically identical except for phase-coded
constant prefixes and version strings.

Pros:

- downstream behavior remains stable,
- focused tests stay meaningful,
- migration is reviewable as a naming cutover.

Cons:

- historical docs still mention prior phase labels where needed for context.

### Replace Phase Handoff Fields

Runtime output should use `nextStep.stepId` rather than `nextPhase.phaseId`.

Pros:

- removes temporary roadmap IDs from production payloads,
- keeps handoff intent clear,
- matches prior Phase R6 cutovers.

Cons:

- downstream consumers must read semantic handoff fields if they use them.

## Final Recommendation Stack

1. Rename verifier and artifact services.
2. Rename focused tests and CLI generator.
3. Rename npm runner to `policy:post-removal-verification`.
4. Replace phase-coded constants, builder names, validator names, and versions.
5. Replace `nextPhase` with semantic `nextStep`.
6. Update downstream imports, validation evidence, final audit paths, roadmap,
   and changelog.

## Implementation Outcome

Implemented:

- `policyBuilderPhase8PostRemovalRuntimeVerification.mjs` became
  `policyPostRemovalRuntimeVerification.mjs`.
- `policyBuilderPhase8PostRemovalRuntimeVerificationArtifact.mjs` became
  `policyPostRemovalRuntimeVerificationArtifact.mjs`.
- `policyBuilderPhase8PostRemovalRuntimeVerification.test.mjs` became
  `policyPostRemovalRuntimeVerification.test.mjs`.
- `policyBuilderPhase8PostRemovalRuntimeVerificationArtifact.test.mjs` became
  `policyPostRemovalRuntimeVerificationArtifact.test.mjs`.
- `generate-policy-builder-phase-8r-post-removal-verification.mjs` became
  `generate-policy-post-removal-verification.mjs`.
- `policy:phase8r:post-removal-verification` became
  `policy:post-removal-verification`.
- Contract exports now use `POLICY_POST_REMOVAL_RUNTIME_VERIFICATION_*`,
  `buildPolicyPostRemovalRuntimeVerification`,
  `validatePolicyPostRemovalRuntimeVerification`,
  `buildPolicyPostRemovalRuntimeVerificationArtifact`, and
  `validatePolicyPostRemovalRuntimeVerificationArtifact`.
- Runtime output now emits
  `nextStep.stepId = next_compatibility_removal_batch_authorization`.

## Next Step

Proceed to **Next Compatibility Removal Batch Authorization module naming
cutover**.
