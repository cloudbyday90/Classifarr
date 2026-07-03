# Policy Builder Phase 6R Migration And Deletion Path

## Status

Implemented as the sixth Phase 6R engine cutline contract.

This slice classifies old policy-builder impact, replay, provider readiness,
TMDB coverage, scoring, write-route, and schema artifacts as one of four
decisions:

```text
keep engine primitive
migration verifier
delete after migration
Phase 8 storage blocker
```

It does not delete code yet, add native intent storage, expose old diagnostics
in the normal product workflow, or run migration against production data.

The compatibility migration-plan builder remains available for focused tests
and inventory work, but new runtime/rebuild callers should use the bounded
migration wrapper. That wrapper requires a successful bounded operator workflow
result before any migration/deletion plan is considered ready. It also requires
the bounded workflow audit to still be passing, so stale or tampered workflow
contracts cannot authorize migration/deletion planning.

## Problem

The re-imagined policy builder cannot keep the old diagnostic UX as a permanent
parallel system. Impact preview, replay preview, provider readiness, TMDB
coverage, and raw scoring can help verify migration, but they should not remain
the operator workflow.

Phase 6R.6 creates a server-owned cutline for migration safety:

```text
compare old behavior
preserve rollback
block Phase 8 storage
delete replaced surfaces after gates pass
```

## Official Guidance Reviewed

- [NIST Secure Software Development Framework](https://csrc.nist.gov/Projects/ssdf)
  supports secure design, verification, and controlled release practices. The
  cutline is deterministic and testable before any deletion or storage migration
  happens.
- [NIST SP 800-53 Revision 5](https://csrc.nist.gov/pubs/sp/800/53/r5/upd1/final)
  includes contingency, backup, recovery, and system integrity control families.
  Phase 6R.6 requires rollback snapshots, a restore path, and an explicit
  retention window.
- [OWASP ASVS](https://owasp.org/www-project-application-security-verification-standard/)
  emphasizes server-side validation and business-logic controls. The migration
  plan blocks client-side diagnostic authority and keeps old diagnostics outside
  the normal workflow.
- [OWASP Business Logic Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Business_Logic_Security_Cheat_Sheet.html)
  recommends enforcing legal state combinations server-side and unit-testing
  cases where individual fields are valid but their combination is not. The
  bounded migration wrapper rejects a successful-looking workflow if its audit
  state is not passing.
- [OpenTelemetry Context Propagation](https://opentelemetry.io/docs/concepts/context-propagation/)
  describes correlating signals across process and network boundaries. The
  migration boundary carries only sanitized workflow fingerprints and audit
  status to connect migration decisions to their source workflow.
- [PostgreSQL Backup And Restore](https://www.postgresql.org/docs/current/backup.html)
  documents backup and restore approaches. The cutline treats schema migration
  as a later Phase 8R operation after rollback gates pass.

## Recommendations

1. **Classify every replaced artifact.**
   Each policy-builder artifact must declare whether it is kept, verifier-only,
   deleted after migration, or blocking Phase 8 storage work.

2. **Keep migration diagnostics out of the normal workflow.**
   Impact preview, replay preview, replay parity, provider readiness, TMDB
   coverage, raw scoring, and related diagnostics can be verifier machinery,
   but not product controls.

3. **Require migration gates before deletion.**
   Deletion requires stable Phase 6R contracts, representative comparison,
   rollback snapshot, rollback window, explicit deletion checklist, and Phase 8
   storage still blocked.

4. **Preserve rollback data for a defined window.**
   The initial contract uses a 30-day rollback retention window. The window is
   explicit so future release work can tune it without weakening the gate.

5. **Block native storage until Phase 8R.**
   Phase 6R proves engine behavior and migration safety. Phase 8R owns native
   schema migration after those gates pass.

6. **Require bounded workflow evidence before migration planning.**
   Migration/deletion planning should consume the bounded Phase 6R.5 workflow
   result so deletion gates cannot be evaluated against stale or mismatched
   evidence, intent, readiness, or workflow state.

## Pros And Cons

Pros:

- Prevents old diagnostic panels from becoming permanent product workflow.
- Gives migration tooling an explicit owner and deletion path.
- Keeps storage migration separated from engine-contract stabilization.
- Requires rollback before any removal.
- Creates a testable inventory for future cleanup and release readiness.
- Prevents migration/deletion readiness from being detached from the bounded
  operator workflow and its evidence provenance.

Cons:

- This slice does not delete the old components or services yet.
- It does not implement the runtime migration verifier endpoint.
- It adds one more server contract before the UI can be simplified.
- The 30-day retention window is a starting contract, not a final release
  policy.
- Existing pure plan builders still exist for compatibility until runtime
  migration paths move onto the bounded wrapper.

## Final Recommendation Stack

- Migration cutline service:
  `server/src/services/policyBuilderPhase6MigrationDeletionPath.mjs`
- Bounded migration wrapper:
  `buildPolicyBuilderPhase6MigrationPlanFromBoundedWorkflow`
- Test module:
  `server/src/__tests__/services/policyBuilderPhase6MigrationDeletionPath.test.mjs`
- Documentation:
  `docs/architecture/policy-builder-phase-6r-migration-deletion-path.md`
- Roadmap owner:
  Phase 6R.6 Migration And Deletion Path in
  `docs/architecture/policy-builder-intent-model-roadmap.md`

## Implemented Contract

The service exports:

- `PHASE6R_MIGRATION_ARTIFACT_DECISION_IDS`
- `PHASE6R_MIGRATION_GATE_IDS`
- `PHASE6R_MIGRATION_VERIFIER_KIND_IDS`
- `PHASE6R_MIGRATION_DELETION_AUDIT_RISK_IDS`
- `listPolicyBuilderPhase6MigrationArtifacts`
- `buildPolicyBuilderPhase6MigrationPlan`
- `buildPolicyBuilderPhase6MigrationPlanFromBoundedWorkflow`
- `validateMigrationArtifact`
- `validatePolicyBuilderPhase6MigrationPlan`
- `buildPolicyBuilderPhase6MigrationDeletionAudit`

Default decisions:

- Keep Phase 6R evidence and intent engines as engine primitives.
- Treat old server-side impact, replay, parity, enrichment eligibility,
  evidence completeness, and TMDB coverage artifacts as migration verifier
  machinery when their deterministic reducers remain useful for parity.
- Mark old client impact/replay panels, preview composables, preview utilities,
  old diagnostic tests, provider-readiness replay helpers, TMDB adapter
  execution helpers, and the pre-6R implementation document for deletion after
  migration gates pass.
- Treat `database/schema/current.sql` as a Phase 8R storage blocker.

Default gates:

- `phase6_engine_contracts_stable`
- `representative_comparison_defined`
- `rollback_snapshot_defined`
- `rollback_window_defined`
- `delete_checklist_defined`
- `native_storage_blocked_until_phase8`

The bounded wrapper returns:

```text
ok
statusId
boundaryContext
plan
migrationAudit
issueCount
issues[]
nextPhase
```

Supported bounded wrapper status IDs:

```text
ready
blocked_by_bounded_workflow
blocked_by_migration_audit
```

The boundary context carries only sanitized workflow metadata:

```text
workflowBoundary.statusId
workflowBoundary.workflowVersion
workflowBoundary.workflowId
workflowBoundary.workflowAuditOk
workflowBoundary.readinessStateId
workflowBoundary.projectionFingerprint
projectionFingerprintMatch
```

## Security Outcome

- No live provider calls or raw provider payloads are required for the cutline.
- Old diagnostics are not allowed in the normal operator workflow.
- Rollback snapshots and restore path are mandatory before migration deletion.
- Native intent storage remains blocked until Phase 8R owns the schema plan.
- The bounded wrapper rejects failed workflow contracts, missing bounded
  provenance, mismatched projection fingerprints, and non-passing bounded
  workflow audits before returning a migration/deletion plan.

## Next Step

Phase 7R.1 Runtime Decision Inventory And Cutline should inventory the runtime
classification, routing, question, and learning paths against the completed
Phase 6R engine contracts.
