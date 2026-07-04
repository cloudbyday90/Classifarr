# Policy Migration Quality Gate Architecture Cutover

## Status

Implemented as the architecture naming cutover for the durable policy migration
quality gate.

This record covers the documentation-level cutover from checkpoint-specific
migration quality-gate language to the durable
`policy.migration_deletion_path.v1` quality boundary. Runtime behavior was
already enforced by `policyMigrationDeletionPath.mjs`; this component keeps that
behavior stable while updating the active design surface and roadmap references
that still used temporary sequencing language.

## Official Guidance Reviewed

- [NIST Secure Software Development Framework SP 800-218](https://csrc.nist.gov/pubs/sp/800/218/final)
  supports secure design, verification, and controlled release practices. The
  quality gate remains deterministic and test-covered before migration planning
  can continue.
- [NIST SP 800-53 Revision 5](https://csrc.nist.gov/pubs/sp/800/53/r5/upd1/final)
  provides security and privacy controls that include contingency, backup,
  recovery, and system integrity considerations. The cutover preserves the
  separation between quality validation and mutation authorization.
- [OWASP Business Logic Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Business_Logic_Security_Cheat_Sheet.html)
  recommends enforcing legal state combinations server-side and testing invalid
  combinations. The migration wrapper continues to reject missing,
  insufficient, and mismatched workflow quality.
- [OWASP Web Security Testing Guide: Business Logic Data Validation](https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/10-Business_Logic_Testing/01-Test_Business_Logic_Data_Validation)
  emphasizes server-side validation of logical data. The quality gate validates
  the workflow handoff at the migration boundary instead of trusting caller
  state.
- [PostgreSQL Backup And Restore](https://www.postgresql.org/docs/current/backup.html)
  documents backup approaches and operational assumptions. The cutover keeps
  rollback and storage readiness separate from quality-gate success.

## Recommendations

1. **Name the active design after the product contract.**
   The active quality-gate design file should be
   `policy-migration-quality-gate.md`, matching the runtime migration/deletion
   boundary instead of a roadmap checkpoint.

2. **Preserve quality-gate behavior exactly.**
   Durable naming must not weaken missing-quality, insufficient-quality,
   mismatched-quality, or sanitized-metadata validation.

3. **Keep quality validation separate from mutation gates.**
   A passing quality gate only proves the workflow handoff is trustworthy enough
   for planning. Rollback, deletion, and storage readiness still decide whether
   mutation may happen.

4. **Keep checkpoint terms in roadmap sequencing only.**
   The roadmap can still explain implementation order, but active architecture
   records should describe durable policy concepts.

5. **Make the next handoff explicit.**
   The next component is the policy engine completion audit architecture cutover
   so the completion gate also uses durable product-domain language.

## Pros And Cons

Pros:

- Removes the old checkpoint-coded active migration quality-gate design file.
- Aligns documentation with `policyMigrationDeletionPath.mjs` and the durable
  migration/deletion contract.
- Keeps the server-owned quality invariant test-covered and behaviorally stable.
- Makes the handoff into completion audit work easier to reason about.

Cons:

- Historical changelog and roadmap sequencing still mention checkpoints where
  they describe release history or implementation order.
- The completion quality-chain record still needs its own naming cutover.

## Final Recommendation Stack

- Active architecture:
  `docs/architecture/policy-migration-quality-gate.md`
- Cutover record:
  `docs/architecture/policy-migration-quality-gate-architecture-cutover.md`
- Runtime migration/deletion service:
  `server/src/services/policyMigrationDeletionPath.mjs`
- Focused tests:
  `server/src/__tests__/services/policyMigrationDeletionPath.test.mjs`
- Workflow dependency:
  `server/src/services/policyOperatorWorkflow.mjs`
- Roadmap owner:
  `docs/architecture/policy-builder-intent-model-roadmap.md`

## Implementation Outcome

- Renamed the active migration quality-gate design record to
  `policy-migration-quality-gate.md`.
- Rewrote the active design record around durable workflow-quality continuity,
  sanitized metadata, migration planning, and mutation-gate separation.
- Updated roadmap links so active documentation points at durable architecture
  records.
- Preserved the existing `policyMigrationDeletionPath.mjs` behavior for
  missing, insufficient, mismatched, and label-free workflow quality.

## Security Outcome

- No deletion, storage migration, routing, provider, learning, readiness,
  workflow, persistence, or authorization behavior changed.
- Migration/deletion planning still blocks when workflow quality is missing,
  insufficient, mismatched, or detached from the embedded workflow context.
- Quality-gate success still cannot authorize deletion, rollback, or native
  storage migration.

## Next Step

Continue with **Policy Engine Completion Audit Architecture Cutover**.
