# Policy Compatibility Deletion Gates Module Cutover

Status: implemented.

## Intent

Rename the compatibility deletion-gate component from phase-coded names to
durable policy-domain names while preserving the fail-closed deletion-readiness
contract for removed legacy compatibility code.

## Official Guidance Reviewed

- [NIST SP 800-218 Secure Software Development Framework](https://csrc.nist.gov/pubs/sp/800/218/final)
  recommends secure software practices, risk tracking, and evidence-backed
  change control throughout the SDLC.
- [OWASP API Security API9:2023 Improper Inventory Management](https://owasp.org/API-Security/editions/2023/en/0xa9-improper-inventory-management/)
  warns that stale or deprecated surfaces increase risk when they are not
  inventoried and decommissioned intentionally.
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
  recommends logging security-relevant events. The contract keeps an audit
  helper with bounded readiness, blocker, coverage, and next-step fields.
- [CISA Secure by Design](https://www.cisa.gov/securebydesign)
  emphasizes reducing unsafe legacy behavior and designing systems that make
  secure defaults easier to maintain.
- [NIST SP 800-34 Rev. 1 Contingency Planning Guide](https://csrc.nist.gov/pubs/sp/800/34/r1/upd1/final)
  supports requiring backup, restore, and recovery evidence before high-impact
  removal work proceeds.
- [PostgreSQL Constraints](https://www.postgresql.org/docs/current/ddl-constraints.html)
  describes database constraints as integrity controls. The deletion gates keep
  code-removal readiness deterministic while later storage migration work can
  enforce equivalent integrity at the schema layer.

## Recommendations

1. **Use durable module names.**
   Rename the service, focused test, and design record to
   `policyCompatibilityDeletionGates.mjs`,
   `policyCompatibilityDeletionGates.test.mjs`, and
   `policy-compatibility-deletion-gates.md`.

2. **Use durable exported contracts.**
   Rename phase-coded constants and helpers to
   `POLICY_COMPATIBILITY_DELETION_*`,
   `buildPolicyCompatibilityDeletionGates`,
   `validatePolicyCompatibilityDeletionGates`, and
   `buildPolicyCompatibilityDeletionGatesAudit`.

3. **Replace phase handoffs with next-step handoffs.**
   Runtime output should expose `nextStep.stepId =
   backup_restore_post_upgrade_safety` instead of `nextPhase.phaseId`.

4. **Preserve fail-closed deletion readiness.**
   Deletion remains blocked unless unconverted policy count is zero, support
   stance is explicit, compatibility inventory is present, required coverage is
   provided, and the deletion policy rejects permanent dual-model preservation.

5. **Keep this contract side-effect-free.**
   The module should plan and audit deletion readiness, not delete files,
   archive files, remove routes, remove tests, or mutate storage.

## Pros And Cons

Pros:

- Removes phase-coded production names from the deletion-gate service and
  downstream consumers.
- Keeps compatibility removal as an explicit, auditable readiness decision.
- Preserves fail-closed behavior for unconverted policies and missing coverage.
- Makes the next component handoff semantic instead of phase-numbered.
- Keeps removal planning separate from destructive execution.

Cons:

- Downstream compatibility-removal modules still carry their own phase-coded
  names until their scoped cutover components are completed.
- Actual file deletion remains intentionally out of scope for this component.
- Historical Phase 8R evidence inventory still uses phase labels until its
  evidence-run cutover is reached.

## Final Recommendation Stack

- Durable service:
  `server/src/services/policyCompatibilityDeletionGates.mjs`
- Durable focused test:
  `server/src/__tests__/services/policyCompatibilityDeletionGates.test.mjs`
- Durable design record:
  `docs/architecture/policy-compatibility-deletion-gates.md`
- Downstream consumers updated:
  `server/src/services/policyBuilderPhase8CompatibilityPathDeletionReadiness.mjs`
  and
  `server/src/services/policyBuilderPhase8CompatibilityPathDeletionExecutionPlan.mjs`
- Evidence-map and reset references:
  `server/src/services/policyBuilderPhase8CompletionEvidenceRun.mjs`
  and `server/src/services/policyNativeStorageTestReset.mjs`

## Implementation Outcome

- Renamed the service, focused test, and architecture record to durable
  policy-domain names.
- Renamed exported constants, builder, validator, audit helper, and payload
  version to durable policy-domain names.
- Replaced `nextPhase.phaseId = 8r_8` with
  `nextStep.stepId = backup_restore_post_upgrade_safety`.
- Updated deletion-readiness, execution-plan, controlled-removal, execution
  artifact, evidence-map, and storage-reset references.
- Preserved deletion categories, replacement coverage requirements, explicit
  support stance requirements, unconverted-policy blockers, compatibility
  inventory validation, and no-side-effect validation.

## Next High-Value Item

Proceed to **Compatibility Path Deletion Readiness module naming cutover**. That
component is the first downstream consumer of the durable deletion-gate service
and still carries phase-coded production service/test names.
