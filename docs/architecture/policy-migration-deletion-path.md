# Policy Migration Deletion Path

## Status

Implemented as the durable policy migration/deletion cutline contract.

This contract classifies old policy-builder impact, replay, provider readiness,
TMDB coverage, scoring, write-route, and schema artifacts as one of four
decisions:

```text
keep engine primitive
migration verifier
delete after migration
native storage blocker
```

It does not delete code yet, add native intent storage, expose old diagnostics
in the normal product workflow, or run migration against production data.

The compatibility migration-plan builder remains available for focused tests
and inventory work, but runtime and rebuild callers should use the bounded
migration wrapper. That wrapper requires a successful bounded operator workflow
result before any migration/deletion plan is considered ready. It also requires
the bounded workflow audit to still be passing, so stale or tampered workflow
contracts cannot authorize migration/deletion planning. The wrapper requires
matching, usable, sanitized workflow quality snapshots before returning the
migration/deletion plan.

## Problem

The re-imagined policy builder cannot keep the old diagnostic UX as a permanent
parallel system. Impact preview, replay preview, provider readiness, TMDB
coverage, and raw scoring can help verify migration, but they should not remain
the operator workflow.

The policy migration/deletion path creates a server-owned cutline for migration
safety:

```text
compare old behavior
preserve rollback
block native storage
delete replaced surfaces after gates pass
```

## Official Guidance Reviewed

- [NIST Secure Software Development Framework SP 800-218](https://csrc.nist.gov/pubs/sp/800/218/final)
  supports secure design, verification, and controlled release practices. The
  migration cutline is deterministic and testable before any deletion or
  storage migration happens.
- [NIST SP 800-53 Revision 5](https://csrc.nist.gov/pubs/sp/800/53/r5/upd1/final)
  provides security and privacy controls that include contingency, backup,
  recovery, and system integrity considerations. The migration path requires
  rollback snapshots, a restore path, and an explicit retention window.
- [OWASP Application Security Verification Standard](https://owasp.org/www-project-application-security-verification-standard/)
  emphasizes server-side validation and business-logic controls. The migration
  plan blocks client-side diagnostic authority and keeps old diagnostics outside
  the normal workflow.
- [OWASP Business Logic Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Business_Logic_Security_Cheat_Sheet.html)
  recommends enforcing legal state combinations server-side and unit-testing
  cases where individual fields are valid but their combination is not. The
  bounded migration wrapper rejects a successful-looking workflow if its audit
  state is not passing.
- [PostgreSQL Backup And Restore](https://www.postgresql.org/docs/current/backup.html)
  documents backup and restore approaches and the need to understand backup
  assumptions. The cutline treats schema migration as a later native-storage
  operation after rollback gates pass.

## Recommendations

1. **Classify every replaced artifact.**
   Each policy-builder artifact must declare whether it is kept, verifier-only,
   deleted after migration, or blocking native storage work.

2. **Keep migration diagnostics out of the normal workflow.**
   Impact preview, replay preview, replay parity, provider readiness, TMDB
   coverage, raw scoring, and related diagnostics can be verifier machinery,
   but not product controls.

3. **Require migration gates before deletion.**
   Deletion requires stable policy engine contracts, representative comparison,
   rollback snapshot, rollback window, explicit deletion checklist, and native
   storage still blocked.

4. **Preserve rollback data for a defined window.**
   The initial contract uses a 30-day rollback retention window. The window is
   explicit so future release work can tune it without weakening the gate.

5. **Block native storage until migration readiness is proven.**
   The engine proves behavior and migration safety first. Native schema
   migration should be owned by a separate storage migration plan after those
   gates pass.

6. **Require bounded workflow evidence before migration planning.**
   Migration/deletion planning should consume the bounded policy operator
   workflow result so deletion gates cannot be evaluated against stale or
   mismatched evidence, intent, readiness, or workflow state.

7. **Require workflow quality before migration planning.**
   Migration/deletion planning should block missing, insufficient, or mismatched
   workflow quality so artifact deletion decisions cannot run on incomplete
   evidence state.

## Pros And Cons

Pros:

- Prevents old diagnostic panels from becoming permanent product workflow.
- Gives migration tooling an explicit owner and deletion path.
- Keeps storage migration separated from engine-contract stabilization.
- Requires rollback before any removal.
- Creates a testable inventory for future cleanup and release readiness.
- Prevents migration/deletion readiness from being detached from the bounded
  operator workflow and its evidence provenance.
- Prevents migration/deletion readiness from being detached from the bounded
  workflow quality that allowed the operator workflow to render.

Cons:

- This contract does not delete the old components or services yet.
- It does not implement a runtime migration verifier endpoint.
- It adds one more server contract before the UI can be simplified.
- The 30-day retention window is a starting contract, not a final release
  policy.
- Existing pure plan builders still exist for compatibility until runtime
  migration paths move onto the bounded wrapper.
- Quality checks add another fixture invariant for bounded migration tests.

## Final Recommendation Stack

- Migration cutline service:
  `server/src/services/policyMigrationDeletionPath.mjs`
- Bounded migration wrapper:
  `buildPolicyMigrationDeletionPlanFromBoundedWorkflow`
- Test module:
  `server/src/__tests__/services/policyMigrationDeletionPath.test.mjs`
- Documentation:
  `docs/architecture/policy-migration-deletion-path.md`
- Quality gate documentation:
  `docs/architecture/policy-migration-quality-gate.md`
- Roadmap owner:
  `docs/architecture/policy-builder-intent-model-roadmap.md`

## Implemented Contract

The service exports:

- `POLICY_MIGRATION_ARTIFACT_DECISION_IDS`
- `POLICY_MIGRATION_GATE_IDS`
- `POLICY_MIGRATION_VERIFIER_KIND_IDS`
- `POLICY_MIGRATION_DELETION_AUDIT_RISK_IDS`
- `listPolicyMigrationDeletionArtifacts`
- `buildPolicyMigrationDeletionPlan`
- `buildPolicyMigrationDeletionPlanFromBoundedWorkflow`
- `validateMigrationArtifact`
- `validatePolicyMigrationDeletionPlan`
- `buildPolicyMigrationDeletionAudit`

Default decisions:

- Keep policy evidence and intent engines as engine primitives.
- Treat old server-side impact, replay, enrichment eligibility, evidence
  completeness, and TMDB coverage artifacts as migration verifier machinery
  only while their bounded outputs remain useful for migration verification.
- Retire replay draft-fit scoring, policy-engine comparison, execution-context,
  and parity-delta artifacts when they duplicate the bounded evidence and
  readiness contracts instead of providing source-authorized migration proof.
- Retire replay provider-readiness, quota/cooldown, selected-provider, and live
  TMDB-preview artifacts from migration verification. Dedicated metadata and
  web-search provider contracts own provider behavior outside this verifier.
- Mark old client impact/replay panels, preview composables, preview utilities,
  old diagnostic tests, provider-readiness replay helpers, TMDB adapter
  execution helpers, and legacy replay execution adapters for deletion after
  migration gates pass.
- Treat `database/schema/current.sql` as a native-storage blocker.

Default gates:

- `policy_engine_contracts_stable`
- `representative_comparison_defined`
- `rollback_snapshot_defined`
- `rollback_window_defined`
- `delete_checklist_defined`
- `native_storage_blocked_until_migration_ready`

The bounded wrapper returns:

```text
ok
statusId
boundaryContext
plan
migrationAudit
issueCount
issues[]
nextStep
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
workflowBoundary.quality
workflowBoundary.qualityMatch
workflowBoundary.projectionFingerprint
projectionFingerprintMatch
```

## Security Outcome

- No live provider calls or raw provider payloads are required for the cutline.
- Old diagnostics are not allowed in the normal operator workflow.
- Rollback snapshots and restore path are mandatory before migration deletion.
- Native intent storage remains blocked until the native storage schema plan
  owns the migration path.
- The bounded wrapper rejects failed workflow contracts, missing bounded
  provenance, mismatched projection fingerprints, and non-passing bounded
  workflow audits before returning a migration/deletion plan.
- The bounded wrapper rejects missing, insufficient, or mismatched sanitized
  workflow quality before returning a migration/deletion plan.

## Next Step

Continue with **Policy Engine Completion Audit Architecture Cutover** so the
completion gate records the durable handoff chain across evidence, intent,
learning, readiness, workflow, and migration boundaries.
