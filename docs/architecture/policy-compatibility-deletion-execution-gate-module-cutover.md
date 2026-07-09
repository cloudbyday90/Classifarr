# Policy Compatibility Deletion Execution Gate Module Cutover

Status: implemented.

## Intent

Rename the compatibility deletion execution-gate component from phase-coded
names to durable policy-domain names while preserving the final, side-effect-free
preflight contract that must pass before controlled compatibility removal.

## Official Guidance Reviewed

- [Git status documentation](https://git-scm.com/docs/git-status) defines
  working tree status inspection. The contract keeps worktree cleanliness as an
  input confirmation and does not run Git commands itself.
- [NIST SP 800-218 Secure Software Development Framework](https://csrc.nist.gov/pubs/sp/800/218/final)
  recommends integrating secure software development practices into the SDLC.
  The gate keeps compatibility removal as an evidence-backed software change.
- [OWASP API Security API9:2023 Improper Inventory Management](https://owasp.org/API-Security/editions/2023/en/0xa9-improper-inventory-management/)
  warns that undocumented or stale surfaces increase risk. The gate requires a
  current manifest so removed compatibility paths match the approved inventory.
- [NIST SP 800-34 Rev. 1 Contingency Planning Guide](https://csrc.nist.gov/pubs/sp/800/34/r1/upd1/final)
  supports contingency planning and recovery validation. The gate requires
  fresh backup/restore evidence and final recovery stance before removal can
  proceed.
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
  recommends application-level security logging and audit context. The gate
  keeps bounded status, final-check, risk, side-effect, and next-step output.

## Recommendations

1. **Use durable module names.**
   Rename the service, focused test, and design record to
   `policyCompatibilityDeletionExecutionGate.mjs`,
   `policyCompatibilityDeletionExecutionGate.test.mjs`, and
   `policy-compatibility-deletion-execution-gate.md`.

2. **Use durable exported contracts.**
   Rename phase-coded constants and helpers to
   `POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_*`,
   `buildPolicyCompatibilityDeletionExecutionGate`, and
   `validatePolicyCompatibilityDeletionExecutionGate`.

3. **Replace phase handoffs with next-step handoffs.**
   Runtime output should expose `nextStep.stepId =
   controlled_compatibility_path_removal` instead of `nextPhase.phaseId`.

4. **Keep the gate non-destructive.**
   The gate should approve or block controlled removal, not delete files,
   archive files, remove routes, remove tests, write manifests, mutate storage,
   or run Git commands.

5. **Require final preflight evidence.**
   The gate should require a ready execution plan, clean worktree confirmation,
   fresh backup/restore evidence, named operator approval, final rollback and
   support stances, and manifest freshness.

## Pros And Cons

Pros:

- Removes phase-coded production names from the execution-gate service and
  downstream imports.
- Preserves a final non-destructive approval boundary before controlled removal.
- Keeps worktree, recovery, approval, and manifest freshness explicit.
- Makes runtime handoff semantic and stable after phase work is complete.
- Keeps audit output bounded and testable.

Cons:

- Downstream controlled-removal modules still carry their own phase-coded names
  until their scoped cutovers are completed.
- The gate depends on externally gathered worktree and backup evidence instead
  of running those commands itself.
- Actual deletion remains intentionally out of scope for this component.

## Final Recommendation Stack

- Durable service:
  `server/src/services/policyCompatibilityDeletionExecutionGate.mjs`
- Durable focused test:
  `server/src/__tests__/services/policyCompatibilityDeletionExecutionGate.test.mjs`
- Durable design record:
  `docs/architecture/policy-compatibility-deletion-execution-gate.md`
- Upstream input:
  `server/src/services/policyCompatibilityDeletionExecutionPlan.mjs`
- Downstream consumers:
  controlled compatibility path removal, controlled removal batch artifact, and
  controlled apply artifact modules.

## Implementation Outcome

- Renamed the service, focused test, and architecture record to durable
  policy-domain names.
- Renamed exported constants, builder, validator, and payload version to durable
  policy-domain names.
- Replaced `nextPhase.phaseId = 8r_17` with
  `nextStep.stepId = controlled_compatibility_path_removal`.
- Updated controlled-removal, batch-artifact, apply-artifact, roadmap, and
  evidence-map references.
- Preserved execution-plan readiness validation, worktree blocker,
  backup/restore freshness checks, operator approval checks, rollback/support
  finality checks, manifest freshness checks, risk-count validation, and
  no-side-effect guarantees.

## Next High-Value Item

Proceed to **Controlled Compatibility Path Removal module naming cutover**.
That component consumes this execution-gate contract and still carries
phase-coded production service/test names.
