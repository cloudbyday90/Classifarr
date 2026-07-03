# Policy Builder Phase 6R Migration Quality Gate

## Status

Implemented as a hardening slice on top of Phase 6R.6 Migration And Deletion
Path.

The bounded migration/deletion entry point now requires the sanitized workflow
quality snapshots produced by Phase 6R.5. Migration planning blocks when
workflow quality is missing, insufficient, or mismatched across the bounded
workflow result and the embedded workflow context.

## Problem

Phase 6R.6 classifies old diagnostic artifacts as engine primitives,
migration verifiers, deletion targets, or Phase 8R storage blockers. That
classification must not be detached from the evidence quality that allowed the
operator workflow to render.

Without a migration-side quality check, a caller could pass a successful-looking
bounded workflow result with stripped or drifted quality metadata. That would
let migration/deletion planning proceed from a workflow context that no longer
proves the same evidence quality used by intent, readiness, and the operator
workflow.

## Official Guidance Reviewed

- [NIST Secure Software Development Framework](https://csrc.nist.gov/projects/ssdf)
  recommends integrating secure development practices into the lifecycle. The
  migration boundary keeps quality validation deterministic and testable before
  deletion or storage work can proceed.
- [NIST SP 800-53 Revision 5](https://csrc.nist.gov/pubs/sp/800/53/r5/upd1/final)
  covers contingency planning, backup, recovery, and system integrity controls.
  The migration cutline keeps rollback/storage gates separate from evidence
  quality gates.
- [OWASP Business Logic Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Business_Logic_Security_Cheat_Sheet.html)
  recommends enforcing legal state combinations server-side and testing invalid
  combinations. The migration wrapper now rejects successful-looking workflow
  results when their quality combination is invalid.
- [OWASP Web Security Testing Guide: Business Logic Data Validation](https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/10-Business_Logic_Testing/01-Test_Business_Logic_Data_Validation)
  emphasizes validating logical data directly server-side, not only in the
  frontend. This gate validates workflow quality at the migration boundary.
- [PostgreSQL Backup And Restore](https://www.postgresql.org/docs/current/backup.html)
  describes backup approaches and the need to understand assumptions. This
  slice preserves the existing separation: quality gates decide whether planning
  may proceed, while rollback/storage gates decide when data changes are safe.

## Recommendations

1. **Migration consumes quality-gated workflow only.**
   A migration/deletion plan must not be returned unless the bounded workflow
   result and embedded workflow context retain sanitized quality snapshots.

2. **Treat missing quality as a blocker.**
   Missing quality means the workflow handoff is incomplete; migration should
   stop before artifact decisions can be treated as ready.

3. **Treat insufficient quality as a blocker.**
   Insufficient evidence quality requires more evidence or operator
   confirmation, not deletion or migration planning.

4. **Require quality continuity across workflow contexts.**
   The migration boundary compares quality from the bounded workflow result and
   embedded workflow context so tampered handoffs cannot pass.

5. **Carry only sanitized quality metadata.**
   Migration context may carry quality status, next action, reason IDs, counts,
   and booleans. It must not carry raw evidence labels.

## Pros And Cons

Pros:

- Prevents migration/deletion planning from running on incomplete workflow
  evidence state.
- Keeps the quality contract enforced at every Phase 6R handoff.
- Makes deletion readiness harder to spoof with a successful-looking workflow
  wrapper.
- Gives Phase 7R runtime inventory a clean, quality-gated Phase 6R completion
  boundary.

Cons:

- Adds another invariant to migration fixtures.
- Does not remove old verifier/deletion target code by itself.
- Does not rename phase-coded production modules; Phase 9R owns that after
  replacement behavior is proven.

## Final Recommendation Stack

- Workflow quality source:
  `server/src/services/policyOperatorWorkflow.mjs`
- Migration boundary:
  `server/src/services/policyBuilderPhase6MigrationDeletionPath.mjs`
- Test module:
  `server/src/__tests__/services/policyBuilderPhase6MigrationDeletionPath.test.mjs`
- Existing migration record:
  `docs/architecture/policy-builder-phase-6r-migration-deletion-path.md`
- Roadmap owner:
  Phase 6R.6 in `docs/architecture/policy-builder-intent-model-roadmap.md`

## Implemented Contract

The bounded migration context now includes:

```text
workflowBoundary.quality
workflowBoundary.qualityMatch
```

The bounded migration wrapper blocks with:

```text
missing_bounded_quality
bounded_quality_insufficient
bounded_quality_mismatch
```

The quality check compares sanitized quality snapshots from:

```text
boundedWorkflowResult.boundaryContext
boundedWorkflowResult.workflow.boundaryContext
```

## Security Outcome

- Missing workflow quality cannot authorize migration/deletion planning.
- Insufficient workflow quality cannot authorize migration/deletion planning.
- Drifted workflow quality cannot authorize migration/deletion planning.
- Migration context stays label-free.
- Rollback, deletion, and Phase 8R storage gates remain separate from quality
  gates, so quality success cannot imply safe mutation.

## Next Step

Run the **Phase 6R completion audit** against the quality-gated handoff chain.
That audit should prove evidence, intent, learning, readiness, workflow, and
migration boundaries all reject incomplete quality/provenance before Phase 7R
runtime inventory begins.
