# Policy Migration Deletion Path Module Cutover

## Status

Implemented.

This document records the naming and contract cutover for the policy migration
and deletion path. The underlying migration/deletion behavior remains the same:
old policy-builder diagnostics are classified as verifier machinery, deletion
targets, native-storage blockers, or kept policy primitives. The change removes
phase-coded production API names from this component.

## Official Guidance Reviewed

- [NIST Secure Software Development Framework](https://csrc.nist.gov/projects/ssdf)
  supports secure design review, traceable verification, and controlled release
  practices. The cutover keeps the same tested migration gates while improving
  maintainability.
- [OWASP ASVS](https://owasp.org/www-project-application-security-verification-standard/)
  frames secure design as explicit, testable requirements. The module keeps
  server-side validation for legal artifact states, rollback requirements, and
  native-storage blocking.
- [OpenTelemetry Semantic Conventions](https://opentelemetry.io/docs/concepts/semantic-conventions/)
  recommends consistent names that can be standardized across codebases and
  tooling. The cutover uses durable policy-domain names instead of roadmap
  labels.
- [W3C Cool URIs](https://www.w3.org/TR/cooluris/) reinforces stable,
  implementation-independent identifiers. The new contract version and step
  names avoid embedding temporary roadmap numbering.

## Recommendations

1. Keep migration/deletion semantics server-owned and deterministic.
2. Use product-domain names for exported contracts and helpers:
   `policyMigrationDeletionPath`, `POLICY_MIGRATION_*`, and
   `policy.migration_deletion_path.v1`.
3. Keep roadmap phase mapping outside the migration module. The completion
   audit may adapt `nextStep.stepId` to a roadmap phase, but the migration
   module should only expose the product step.
4. Use native-storage language in the contract:
   `nativeStorageMigrationAllowed` and `nativeStorageMigrationBlocked`.
5. Preserve rollback and deletion gates exactly during the rename.

## Pros And Cons

Pros:

- Removes phase-coded production names from the migration/deletion module.
- Keeps behavior stable while making the component easier to reuse after the
  roadmap phases are complete.
- Makes the native-storage blocker explicit without coupling it to a future
  phase number.
- Keeps completion-audit compatibility through an adapter rather than leaking
  phase identifiers back into the module.

Cons:

- Requires downstream test and verifier imports to move in the same commit.
- Existing roadmap docs still use phase labels as planning metadata, so the
  completion audit must retain a temporary mapping layer.

## Final Recommendation Stack

- Durable service:
  `server/src/services/policyMigrationDeletionPath.mjs`
- Focused tests:
  `server/src/__tests__/services/policyMigrationDeletionPath.test.mjs`
- Contract version:
  `policy.migration_deletion_path.v1`
- Handoff field:
  `nextStep.stepId = runtime_decision_inventory`
- Completion checkpoint:
  `server/src/services/policyEngineCompletionAudit.mjs`
- Original design record:
  `docs/architecture/policy-builder-phase-6r-migration-deletion-path.md`

## Outcome

- Renamed the service and focused test from phase-coded file names to durable
  policy-domain names.
- Renamed exported constants and builder functions to `POLICY_MIGRATION_*` and
  `buildPolicyMigrationDeletion*`.
- Replaced `phaseId`/`nextPhase` in the migration module with
  `stepId`/`nextStep`.
- Replaced `phase8StorageMigrationAllowed` and
  `phase8StorageMigrationBlocked` with native-storage field names.
- Added the completion-audit adapter that maps
  `runtime_decision_inventory` to the roadmap phase for legacy completion
  checks.
- Lowered the production naming regression baseline after inventory validation:
  `6231` production references, `6253` rename candidates, and `93` obsolete
  migration-tooling references.

## Security Outcome

- The cutover does not weaken artifact validation, rollback snapshots, restore
  path requirements, retention windows, or deletion gates.
- The normal operator workflow remains isolated from migration diagnostics.
- Native storage migration remains blocked until the migration/deletion gates
  prove the policy engine and rollback path are ready.
