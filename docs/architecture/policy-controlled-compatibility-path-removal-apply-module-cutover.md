# Policy Controlled Compatibility Path Removal Apply Module Cutover

## Intent

This cutover removes production-facing phase naming from the controlled
compatibility path removal apply contract while preserving the same
adapter-driven apply behavior and side-effect restrictions.

The artifact wrapper and post-removal verifier remain separate tasks. This
keeps the rename scoped to one destructive-boundary contract at a time.

## Official-Source Research

- Git `rm` documents tracked-path removal behavior and dry-run/index controls.
  The apply contract still delegates removal mechanics to an injected adapter
  and does not run Git commands inside the service.
- NIST SP 800-128 frames configuration management as an information-security
  activity for maintaining system integrity. The apply contract still requires
  approved input, confirmation, and result parity.
- NIST SSDF SP 800-218 recommends secure development practices integrated into
  the SDLC. A durable service name and explicit apply evidence reduce future
  ambiguity after the implementation phase is finished.
- OWASP API9:2023 Improper Inventory Management recommends current inventories
  and retirement plans. The apply contract still acts only on a reviewed
  manifest-backed removal batch.

Sources:

- Git `rm` documentation:
  <https://git-scm.com/docs/git-rm>
- NIST SP 800-128:
  <https://csrc.nist.gov/pubs/sp/800/128/upd1/final>
- NIST Secure Software Development Framework SP 800-218:
  <https://csrc.nist.gov/pubs/sp/800/218/final>
- OWASP API9:2023 Improper Inventory Management:
  <https://owasp.org/API-Security/editions/2023/en/0xa9-improper-inventory-management/>

## Recommendations

### Rename Only The Apply Contract

Move the apply service and focused test suite to durable policy names and
update direct consumers to import the new contract.

Pros:

- removes one production phase-coded destructive boundary,
- keeps artifact and post-removal verifier cutovers independently reviewable,
- preserves the existing adapter behavior.

Cons:

- downstream artifact/verifier modules still carry phase-coded names until
  their own cutovers.

### Preserve Adapter-Driven Execution

Do not replace the injected adapter with inline filesystem, storage, or Git
operations during the naming cutover.

Pros:

- keeps behavior deterministic under test,
- prevents hidden destructive changes,
- leaves production deletion mechanics explicit.

Cons:

- deletion still depends on the external adapter implementation.

### Replace Phase Handoff With Semantic Next Step

Emit `nextStep.stepId = post_removal_runtime_verification` instead of a
phase-number handoff.

Pros:

- removes production runtime dependence on phase numbers,
- keeps orchestration language stable after the roadmap phase ends,
- makes downstream routing easier to reason about.

Cons:

- existing tests must assert the semantic handoff instead of `nextPhase`.

## Final Recommendation Stack

1. Rename the apply service, test, version, constants, and validator exports.
2. Update artifact and post-removal imports to use the durable apply contract.
3. Replace runtime `nextPhase` with semantic `nextStep`.
4. Keep adapter execution, confirmation, result parity, and side-effect
   validation unchanged.
5. Verify focused apply, artifact, and post-removal tests.

## Implementation Outcome

Implemented:

- `policyBuilderPhase8ControlledCompatibilityPathRemovalApply.mjs` became
  `policyControlledCompatibilityPathRemovalApply.mjs`.
- `policyBuilderPhase8ControlledCompatibilityPathRemovalApply.test.mjs` became
  `policyControlledCompatibilityPathRemovalApply.test.mjs`.
- The architecture doc became
  `policy-controlled-compatibility-path-removal-apply.md`.
- Contract exports now use
  `POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_*`,
  `applyPolicyControlledCompatibilityPathRemoval`, and
  `validatePolicyControlledCompatibilityPathRemovalApply`.
- Runtime output now emits
  `nextStep.stepId = post_removal_runtime_verification`.
- Downstream apply artifact and post-removal verifier services import the
  durable apply contract without renaming their own module boundaries.

## Next Step

Proceed to **Post-Removal Runtime Verification Artifact module naming
cutover**.
