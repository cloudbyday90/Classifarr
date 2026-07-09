# Policy Compatibility Deletion Execution Plan Module Cutover

Status: implemented.

## Intent

Rename the compatibility deletion execution-plan component from phase-coded
names to durable policy-domain names while preserving the side-effect-free
manifest contract for compatibility path removal planning.

## Official Guidance Reviewed

- [NIST SP 800-218 Secure Software Development Framework](https://csrc.nist.gov/pubs/sp/800/218/final)
  recommends integrating secure software development practices into the SDLC.
  The cutover keeps compatibility removal as an evidence-backed software
  change, not an implicit cleanup step.
- [OWASP API Security API9:2023 Improper Inventory Management](https://owasp.org/API-Security/editions/2023/en/0xa9-improper-inventory-management/)
  warns that stale versions and undocumented surfaces expand attack surface.
  The execution plan therefore keeps exact compatibility paths inventoried
  before any removal gate can proceed.
- [CISA Secure by Design](https://www.cisa.gov/securebydesign)
  emphasizes secure defaults and reducing unsafe legacy behavior. The durable
  contract keeps replaced compatibility paths on an explicit removal path
  rather than preserving hidden legacy surfaces.
- [NIST SP 800-34 Rev. 1 Contingency Planning Guide](https://csrc.nist.gov/pubs/sp/800/34/r1/upd1/final)
  supports recovery planning and operational resilience. The execution plan
  continues to require rollback or post-window recovery stance before deletion
  can advance to the gate.
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
  recommends security-relevant event logging and useful audit context. The
  execution plan keeps bounded status, risk, manifest, and next-step output.

## Recommendations

1. **Use durable module names.**
   Rename the service, focused test, and design record to
   `policyCompatibilityDeletionExecutionPlan.mjs`,
   `policyCompatibilityDeletionExecutionPlan.test.mjs`, and
   `policy-compatibility-deletion-execution-plan.md`.

2. **Use durable exported contracts.**
   Rename phase-coded constants and helpers to
   `POLICY_COMPATIBILITY_DELETION_EXECUTION_*`,
   `buildPolicyCompatibilityDeletionExecutionPlan`, and
   `validatePolicyCompatibilityDeletionExecutionPlan`.

3. **Replace phase handoffs with next-step handoffs.**
   Runtime output should expose `nextStep.stepId =
   compatibility_deletion_execution_gate` instead of `nextPhase.phaseId`.

4. **Keep execution planning side-effect-free.**
   The module should build a manifest and validation output, not delete files,
   archive files, remove routes, remove tests, write manifests, mutate storage,
   or run Git commands.

5. **Require exact manifest evidence.**
   Every manifest entry should retain an exact path, action ID, deletion
   category, replacement evidence, rollback stance, support stance, and approval
   state before the final gate can proceed.

## Pros And Cons

Pros:

- Removes phase-coded production names from the execution-plan service and
  downstream imports.
- Preserves an explicit inventory of compatibility paths before removal.
- Keeps destructive work behind a later gate with recovery and operator checks.
- Makes runtime handoff semantic and stable after the phase work is complete.
- Keeps the execution plan testable without filesystem, storage, or Git side
  effects.

Cons:

- Downstream controlled-removal modules still carry their own phase-coded names
  until their scoped cutovers are completed.
- Actual deletion remains intentionally out of scope for this component.
- The manifest cannot be ready until replacement evidence and approval metadata
  are complete.

## Final Recommendation Stack

- Durable service:
  `server/src/services/policyCompatibilityDeletionExecutionPlan.mjs`
- Durable focused test:
  `server/src/__tests__/services/policyCompatibilityDeletionExecutionPlan.test.mjs`
- Durable design record:
  `docs/architecture/policy-compatibility-deletion-execution-plan.md`
- Upstream inputs:
  `server/src/services/policyCompatibilityDeletionReadiness.mjs`
  and `server/src/services/policyCompatibilityDeletionGates.mjs`
- Downstream consumers:
  compatibility deletion execution gate, controlled-removal, controlled apply,
  artifact export, batch authorization, and completion-audit modules.

## Implementation Outcome

- Renamed the service, focused test, and architecture record to durable
  policy-domain names.
- Renamed exported constants, builder, validator, and payload version to durable
  policy-domain names.
- Replaced `nextPhase.phaseId = 8r_16` with
  `nextStep.stepId = compatibility_deletion_execution_gate`.
- Updated execution-gate, controlled-removal, controlled-apply,
  artifact-export, batch-authorization, completion-audit, roadmap, and
  evidence-map references.
- Preserved readiness validation, manifest evidence checks, rollback and support
  stance requirements, approval requirements, risk-count validation, and
  no-side-effect guarantees.

## Next High-Value Item

Proceed to **Controlled Compatibility Path Removal module naming cutover**.
That component consumes the execution-plan and execution-gate contracts and
still carries phase-coded production service/test names.
