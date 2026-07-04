# Policy Migration Deletion Path Architecture Cutover

## Status

Implemented as the architecture naming cutover for the durable policy
migration/deletion path.

This record covers the documentation-level cutover from checkpoint-specific
migration/deletion language to the durable
`policy.migration_deletion_path.v1` contract. The runtime service was already
named `policyMigrationDeletionPath.mjs`, so this component keeps behavior stable
while updating the active design surface and runtime-facing labels that still
used temporary sequencing language.

## Official Guidance Reviewed

- [NIST Secure Software Development Framework SP 800-218](https://csrc.nist.gov/pubs/sp/800/218/final)
  supports secure design, verification, and controlled release practices. The
  migration/deletion path remains deterministic and test-covered before any
  removal or storage migration happens.
- [NIST SP 800-53 Revision 5](https://csrc.nist.gov/pubs/sp/800/53/r5/upd1/final)
  provides security and privacy controls that include contingency, backup,
  recovery, and system integrity considerations. The cutover preserves rollback
  snapshots, restore path requirements, and retention windows.
- [OWASP Business Logic Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Business_Logic_Security_Cheat_Sheet.html)
  recommends enforcing legal state combinations server-side and testing invalid
  combinations. The migration wrapper continues to reject invalid workflow and
  quality combinations.
- [PostgreSQL Backup And Restore](https://www.postgresql.org/docs/current/backup.html)
  documents SQL dump, file-system backup, and continuous archiving approaches.
  The migration/deletion path keeps native storage migration blocked until
  rollback assumptions are explicit.

## Recommendations

1. **Name the active design after the product contract.**
   The active design file should be `policy-migration-deletion-path.md`,
   matching the runtime module and `policy.migration_deletion_path.v1`
   contract.

2. **Keep deletion and storage migration behind server gates.**
   Durable naming must not weaken rollback snapshots, restore path, retention,
   native-storage blocker, deletion checklist, or representative comparison
   requirements.

3. **Remove temporary sequencing wording from runtime-facing labels.**
   Runtime labels should identify the policy migration/deletion path and policy
   runtime inventory, not roadmap construction phrases.

4. **Keep checkpoint terms in the roadmap only.**
   Roadmap sections can still sequence work, but active architecture records
   should describe durable policy concepts.

5. **Make the next handoff explicit.**
   The next component is the migration quality-gate architecture cutover so the
   remaining migration hardening record uses durable naming as well.

## Pros And Cons

Pros:

- Removes the old checkpoint-coded active migration/deletion design file.
- Aligns documentation with `policyMigrationDeletionPath.mjs` and
  `policy.migration_deletion_path.v1`.
- Keeps migration/deletion gates, rollback requirements, and native-storage
  blocking stable.
- Preserves the server-owned, quality-gated handoff from policy operator
  workflow into migration planning.

Cons:

- Historical changelog and roadmap sequencing still mention checkpoints where
  they describe release history or implementation order.
- The migration quality-gate design record still needs its own naming cutover.

## Final Recommendation Stack

- Active architecture:
  `docs/architecture/policy-migration-deletion-path.md`
- Cutover record:
  `docs/architecture/policy-migration-deletion-path-architecture-cutover.md`
- Runtime migration/deletion service:
  `server/src/services/policyMigrationDeletionPath.mjs`
- Focused tests:
  `server/src/__tests__/services/policyMigrationDeletionPath.test.mjs`
- Workflow dependency:
  `server/src/services/policyOperatorWorkflow.mjs`
- Roadmap owner:
  `docs/architecture/policy-builder-intent-model-roadmap.md`

## Implementation Outcome

- Renamed the active migration/deletion design record to
  `policy-migration-deletion-path.md`.
- Rewrote the active design record around durable migration/deletion decisions,
  rollback gates, native-storage blocking, bounded workflow provenance, and
  workflow quality continuity.
- Updated runtime-facing labels from temporary sequencing wording to durable
  policy migration/deletion and policy runtime inventory language.
- Updated the module cutover note, roadmap links, quality-gate cross-reference,
  and changelog entry.

## Security Outcome

- No deletion, storage migration, routing, provider, learning, readiness,
  workflow, persistence, or authorization behavior changed.
- The migration/deletion path remains server-owned and blocks deletion planning
  without stable engine contracts, representative comparison, rollback snapshot,
  rollback window, deletion checklist, native-storage blocker, bounded workflow
  provenance, passing workflow audit, and usable workflow quality.

## Next Step

Continue with **Policy Migration Quality Gate Architecture Cutover**.
