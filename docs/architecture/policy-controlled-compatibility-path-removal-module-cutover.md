# Policy Controlled Compatibility Path Removal Module Cutover

## Intent

This cutover removes production-facing Phase 8R naming from the controlled
compatibility path removal contract while preserving the same side-effect-free
batch selection behavior.

The apply, batch artifact, and post-removal components remain separate tasks.
This keeps the cutover scoped to one boundary and avoids renaming downstream
modules before their contracts are audited.

## Official-Source Research

- NIST SSDF SP 800-218 frames secure software development as practices
  integrated across the SDLC and emphasizes shared vocabulary. A durable module
  name is the vocabulary operators and later services should consume.
- OWASP API9:2023 Improper Inventory Management identifies stale assets,
  missing retirement plans, and outdated documentation as risk drivers. The
  renamed contract still requires manifest-backed path selection before removal.
- NIST SP 800-34 Rev. 1 covers contingency planning and recovery requirements.
  The contract still depends on upstream rollback, backup, and final gate
  evidence before a removal batch can proceed.
- OWASP Logging Cheat Sheet recommends recording enough event context for
  review while avoiding unnecessary or unsafe detail. The contract keeps
  reviewer and reason fields explicit and leaves destructive apply evidence to
  the apply boundary.

Sources:

- NIST Secure Software Development Framework SP 800-218:
  <https://csrc.nist.gov/pubs/sp/800/218/final>
- OWASP API9:2023 Improper Inventory Management:
  <https://owasp.org/API-Security/editions/2023/en/0xa9-improper-inventory-management/>
- NIST SP 800-34 Rev. 1:
  <https://csrc.nist.gov/pubs/sp/800/34/r1/upd1/final>
- OWASP Logging Cheat Sheet:
  <https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html>

## Recommendations

### Rename Only The Removal Contract

Move the controlled removal batch contract to a durable policy name and update
consumers to import that contract.

Pros:

- removes one production phase-coded boundary,
- keeps downstream apply/batch cutovers independently reviewable,
- reduces operator-facing phase leakage in runtime output.

Cons:

- downstream components still carry phase-coded names until their own cutovers.

### Replace Phase Handoff With Semantic Next Step

The contract should emit `nextStep.stepId` rather than `nextPhase.phaseId`.

Pros:

- prevents runtime APIs from exposing implementation phase numbers,
- lets later orchestration route by durable capability,
- keeps test assertions focused on behavior.

Cons:

- downstream tests that expected `nextPhase` must be updated.

### Keep Side-Effect Invariants Unchanged

The rename must not authorize deletion, route removal, storage mutation, or Git
commands.

Pros:

- limits risk to naming/API cleanup,
- preserves the existing safety boundary,
- keeps apply behavior unchanged.

Cons:

- actual compatibility removal still waits for the apply component.

## Final Recommendation Stack

1. Rename the service, test, version, constants, and builder/validator exports.
2. Update downstream imports that consume the controlled removal batch contract.
3. Replace runtime `nextPhase` with semantic `nextStep`.
4. Preserve no-side-effect validation and approved-manifest selection rules.
5. Verify focused removal, apply, batch artifact, and post-removal tests.

## Implementation Outcome

Implemented:

- `policyBuilderPhase8ControlledCompatibilityPathRemoval.mjs` became
  `policyControlledCompatibilityPathRemoval.mjs`.
- `policyBuilderPhase8ControlledCompatibilityPathRemoval.test.mjs` became
  `policyControlledCompatibilityPathRemoval.test.mjs`.
- The architecture doc became
  `policy-controlled-compatibility-path-removal.md`.
- Contract exports now use
  `POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_*`,
  `buildPolicyControlledCompatibilityPathRemoval`, and
  `validatePolicyControlledCompatibilityPathRemoval`.
- Runtime output now emits
  `nextStep.stepId = controlled_compatibility_path_removal_apply`.
- Downstream apply and artifact services import the durable removal batch
  contract without renaming their own module boundaries.

## Next Step

Proceed to **Controlled Removal Apply Artifact module naming cutover**.
