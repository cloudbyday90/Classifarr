# Policy Compatibility Deletion Readiness Module Cutover

Status: implemented.

## Intent

Rename the compatibility deletion-readiness component from phase-coded names to
durable policy-domain names while preserving the side-effect-free readiness
gate that blocks deletion execution planning until runtime cutover, deletion
gates, residual-reference review, and recovery/support confirmations pass.

## Official Guidance Reviewed

- [OWASP API Security API9:2023 Improper Inventory Management](https://owasp.org/API-Security/editions/2023/en/0xa9-improper-inventory-management/)
  warns that stale and poorly inventoried surfaces increase exposure. The
  readiness contract requires residual compatibility references to be reviewed
  before execution planning.
- [CISA Secure by Design](https://www.cisa.gov/securebydesign)
  encourages secure defaults and safer upgrade paths rather than indefinite
  retention of risky legacy behavior.
- [NIST SP 800-218 Secure Software Development Framework](https://csrc.nist.gov/pubs/sp/800/218/final)
  recommends evidence-backed secure software practices across the SDLC. The
  readiness contract treats deletion planning as a gated lifecycle transition.
- [NIST SP 800-34 Rev. 1 Contingency Planning Guide](https://csrc.nist.gov/pubs/sp/800/34/r1/upd1/final)
  supports requiring backup, restore, and recovery evidence before high-impact
  removal work proceeds.
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
  recommends security-relevant event logging. The readiness output keeps
  bounded status, risk, safety-confirmation, and next-step fields that can feed
  audit trails.

## Recommendations

1. **Use durable module names.**
   Rename the service, focused test, and design record to
   `policyCompatibilityDeletionReadiness.mjs`,
   `policyCompatibilityDeletionReadiness.test.mjs`, and
   `policy-compatibility-deletion-readiness.md`.

2. **Use durable exported contracts.**
   Rename phase-coded constants and helpers to
   `POLICY_COMPATIBILITY_DELETION_READINESS_*`,
   `buildPolicyCompatibilityDeletionReadiness`, and
   `validatePolicyCompatibilityDeletionReadiness`.

3. **Replace phase handoffs with next-step handoffs.**
   Runtime output should expose `nextStep.stepId =
   compatibility_deletion_execution_plan` instead of `nextPhase.phaseId`.

4. **Keep readiness as a composition gate.**
   The module should consume native runtime cutover verification and
   compatibility deletion gates rather than duplicating their logic.

5. **Keep this contract side-effect-free.**
   Readiness should report blockers and safety confirmations, not delete files,
   archive files, remove routes, remove tests, write manifests, or mutate
   storage.

## Pros And Cons

Pros:

- Removes phase-coded production names from the deletion-readiness service and
  downstream imports.
- Keeps deletion execution planning blocked until prior gates and recovery
  confirmations pass.
- Preserves residual-reference review so hidden compatibility paths do not
  survive cutover.
- Makes the downstream execution-plan handoff semantic.
- Keeps readiness output deterministic and auditable.

Cons:

- Downstream execution-plan and controlled-removal modules still carry their own
  phase-coded names until their scoped cutovers are completed.
- Readiness remains conservative and cannot pass without explicit backup,
  rollback, diagnostics, and manifest confirmations.
- Actual deletion execution remains out of scope for this component.

## Final Recommendation Stack

- Durable service:
  `server/src/services/policyCompatibilityDeletionReadiness.mjs`
- Durable focused test:
  `server/src/__tests__/services/policyCompatibilityDeletionReadiness.test.mjs`
- Durable design record:
  `docs/architecture/policy-compatibility-deletion-readiness.md`
- Upstream inputs:
  `server/src/services/policyCompatibilityDeletionGates.mjs`
  and `server/src/services/policyNativeRuntimeCutoverVerification.mjs`
- Downstream consumer:
  `server/src/services/policyBuilderPhase8CompatibilityPathDeletionExecutionPlan.mjs`

## Implementation Outcome

- Renamed the service, focused test, and architecture record to durable
  policy-domain names.
- Renamed exported constants, builder, validator, and payload version to durable
  policy-domain names.
- Replaced `nextPhase.phaseId = 8r_15` with
  `nextStep.stepId = compatibility_deletion_execution_plan`.
- Updated execution-plan, controlled-removal, execution-artifact, evidence-map,
  roadmap, and architecture references.
- Preserved cutover validation, deletion-gate validation, residual-reference
  blockers, backup/rollback/diagnostic/manifest confirmations, risk-count
  validation, and no-side-effect guarantees.

## Next High-Value Item

Proceed to **Compatibility Path Deletion Execution Plan module naming cutover**.
That component consumes this readiness contract and still carries phase-coded
production service/test names.
