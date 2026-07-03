# Policy Builder Phase 6R Completion Audit

## Status

Implemented as the Phase 6R completion gate.

This audit proves that the re-imagined Phase 6R contracts are present,
documented, tested, internally chained, quality-gated, and migration-gated
before Phase 7R runtime work starts.

## Problem

Phase 6R intentionally deconstructed the old policy-builder direction. That
means completion cannot be inferred from passing isolated tests or from the
presence of a few architecture records. The platform needs a single current-
state audit that answers:

```text
Are all Phase 6R engine contracts implemented, tested, documented, and safe to
use as the boundary for runtime automation?
```

The audit also verifies that old replay, impact, provider, TMDB, and scoring
diagnostics have explicit cutline decisions instead of silently remaining as
normal operator workflow.

## Official Guidance Reviewed

- [NIST Secure Software Development Framework](https://csrc.nist.gov/pubs/sp/800/218/final)
  supports verification, release integrity, and secure change control. The
  completion audit requires each component to have a service, test, architecture
  record, and passing component audit.
- [NIST AI Risk Management Framework](https://www.nist.gov/itl/ai-risk-management-framework)
  emphasizes governed, measured, and managed AI behavior. The audit keeps Phase
  6R reason-coded, testable, and explicit before runtime automation uses it.
- [OWASP ASVS](https://owasp.org/www-project-application-security-verification-standard/)
  emphasizes server-side validation, business logic controls, and secure
  configuration. The completion audit is server-owned and rejects diagnostic
  surfaces in the normal workflow.
- [OWASP Business Logic Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Business_Logic_Security_Cheat_Sheet.html)
  emphasizes enforcing intended workflow sequencing server-side. The completion
  audit now rejects quality gaps and drift across the Phase 6R handoff chain
  instead of trusting that earlier component gates were called correctly.
- [PostgreSQL Backup And Restore](https://www.postgresql.org/docs/current/backup.html)
  documents backup and restore practices. The audit verifies that Phase 8R
  storage migration remains blocked until Phase 6R migration gates pass.

## Recommendations

1. **Require one completion record per Phase 6R component.**
   Each component must have a stable id, label, architecture document, service,
   test, evidence summary, and expected next phase.

2. **Aggregate actual component audits.**
   Completion should call the evidence, intent, learning, readiness, workflow,
   and migration audit functions instead of duplicating their logic.

3. **Prove the bounded chain composes.**
   Completion should build a deterministic evidence -> intent -> learning ->
   readiness -> workflow -> migration chain and fail when a bounded step fails,
   a nested bounded audit is missing or non-passing, evidence projection
   fingerprints drift, quality snapshots are missing/insufficient/mismatched,
   or raw evidence labels leak into boundary provenance.

4. **Treat 6R.0 as a real gate.**
   The artifact inventory and cutline must verify that legacy impact/replay/
   provider/TMDB/scoring artifacts have migration or deletion decisions.

5. **Verify files exist.**
   Completion records should fail when their documented service, test, or
   architecture record is missing.

6. **Keep Phase 8R blocked.**
   Native intent storage remains out of scope until the Phase 6R completion and
   migration gates prove stable.

## Pros And Cons

Pros:

- Gives a concrete proof point before Phase 7R begins.
- Catches missing docs, tests, services, and broken phase sequencing.
- Catches broken bounded handoffs before Phase 7R runtime work depends on them.
- Catches quality handoff drift before runtime automation trusts the chain.
- Prevents old replay/TMDB diagnostics from surviving without a cutline.
- Makes Phase 6R completion repeatable in CI or release workflows later.

Cons:

- Adds another server-side audit contract.
- Does not remove legacy diagnostic code by itself.
- Does not prove live runtime data quality; Phase 7R still inventories those
  paths against the completed contracts.
- Does not execute Phase 7R runtime migration or Phase 8R native storage work.

## Final Recommendation Stack

- Completion audit service:
  `server/src/services/policyBuilderPhase6CompletionAudit.mjs`
- Completion audit tests:
  `server/src/__tests__/services/policyBuilderPhase6CompletionAudit.test.mjs`
- Migration cutline input:
  `server/src/services/policyMigrationDeletionPath.mjs`
- Documentation:
  `docs/architecture/policy-builder-phase-6r-completion-audit.md`
- Roadmap owner:
  Phase 6R completion gate in
  `docs/architecture/policy-builder-intent-model-roadmap.md`

## Implemented Contract

The service exports:

- `PHASE6R_COMPLETION_COMPONENT_IDS`
- `PHASE6R_COMPLETION_RISK_IDS`
- `buildPolicyBuilderPhase6ArtifactInventoryCutlineAudit`
- `buildPolicyBuilderPhase6BoundedChainCompletionAudit`
- `buildPolicyBuilderPhase6CompletionAudit`
- `listPolicyBuilderPhase6CompletionComponents`
- `listPolicyBuilderPhase6RequiredLegacyCutlineArtifacts`
- `validatePhase6CompletionRecord`
- `validatePhase6ComponentCompletion`

The default audit checks:

- 6R.0 artifact inventory and cutline.
- 6R.1 evidence engine.
- 6R.2 intent engine.
- 6R.3 learning guard.
- 6R.4 automation readiness engine.
- 6R.5 operator workflow rebuild.
- 6R.6 migration and deletion path.
- End-to-end bounded handoff from evidence boundary through migration plan.
- End-to-end evidence-quality continuity from evidence boundary through
  migration plan.
- Nested bounded audit health for every successful handoff:
  - evidence projection audit,
  - evidence projection-fingerprint audit,
  - intent audit,
  - carried evidence-fingerprint audit,
  - learning audit,
  - readiness audit,
  - workflow audit,
  - migration/deletion audit.
- Shared sanitized evidence projection fingerprint across bounded handoffs.
- Matching usable evidence-quality snapshots across bounded handoffs.
- Boundary provenance that excludes raw operator/library evidence labels.

## Security Outcome

- Completion is server-owned and deterministic.
- Component docs, services, and tests must exist.
- A bounded step cannot count as complete unless its nested audit checks are
  still passing.
- Bounded handoffs must share sanitized provenance instead of raw evidence
  labels.
- Bounded handoffs must carry matching usable quality snapshots, so no runtime
  path can skip the evidence quality gate while still passing completion.
- Legacy diagnostics cannot remain in normal operator workflow.
- Phase 8R storage migration remains blocked until the migration gates pass.

## Next Step

Phase 7R.1 Runtime Decision Inventory And Cutline should now inventory runtime
classification, routing, question, and learning paths against the completed
Phase 6R contracts.
