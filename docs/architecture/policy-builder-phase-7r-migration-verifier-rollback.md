# Policy Builder Phase 7R Migration Verifier And Rollback Path

## Status

Implemented as the seventh Phase 7R runtime/rebuild contract.

This slice compares a Phase 7R.6 library-derived rebuild proposal against
sanitized legacy behavior samples, emits only migration-relevant differences,
and enforces operator acceptance, rollback snapshot, and legacy deletion gates.
It does not apply policy replacement, create rollback snapshots, delete legacy
paths, write learning, or expose raw replay/provider payloads.

## Problem

Classifarr can now generate a reviewable policy proposal from observed library
application. That does not make replacement safe by itself. Operators need to
know whether the generated intent would materially change behavior before the
platform replaces old preset/custom-signal paths.

The verifier must focus on migration risk, not become another diagnostic UI:

```text
destination changes
newly blocked items
newly review-required items
route-readiness changes
evidence-confidence changes
rollback snapshot readiness
legacy deletion criteria
```

## Official Guidance Reviewed

- [NIST Secure Software Development Framework](https://csrc.nist.gov/Projects/ssdf)
  emphasizes secure release, verification, and tested changes. Phase 7R.7 uses
  a deterministic verifier before any replacement path can apply a proposal.
- [NIST SP 800-53 Revision 5](https://csrc.nist.gov/pubs/sp/800/53/r5/upd1/final)
  includes contingency, backup, recovery, and system integrity controls. The
  verifier requires rollback snapshots, restore paths, and retention criteria
  before replacement or deletion.
- [OWASP Application Security Verification Standard](https://owasp.org/www-project-application-security-verification-standard/)
  emphasizes server-side verification and business logic controls. The report
  validates acceptance, rollback, deletion, and side-effect gates server-side.
- [PostgreSQL Backup And Restore](https://www.postgresql.org/docs/current/backup.html)
  documents backup and restore responsibilities. Phase 7R.7 treats rollback as
  an explicit precondition before replacement instead of an operator memory
  step.

## Recommendation

Use a server-owned migration verifier report between rebuild proposals and any
future replacement operation.

The report should answer:

```text
Is the rebuild proposal valid?
Which representative items change destination?
Which items become blocked or review-required?
Does route readiness change?
Does evidence confidence materially change?
Is the output bounded and sanitized?
Has the operator accepted replacement?
Does a rollback snapshot and restore path exist?
Can legacy paths be deleted yet?
Were any side effects performed?
```

## Pros And Cons

Pros:

- Gives operators migration-relevant risk before accepting replacement.
- Keeps old impact/replay diagnostics out of normal policy authoring.
- Requires rollback before replacement can apply.
- Blocks legacy deletion until Phase 8R native intent is stable and verifier
  differences are resolved.
- Keeps report output bounded and free of raw provider/replay payloads.

Cons:

- Requires representative comparison samples from later integration work.
- Does not execute replacement or deletion; those remain later gated slices.
- Conservative deletion criteria mean old paths remain until Phase 8R stability
  is proven.

## Final Recommendation Stack

1. Consume a valid Phase 7R.6 rebuild proposal.
2. Consume sanitized representative legacy/proposed comparison samples.
3. Emit only these migration-relevant difference types:
   - `destination_change`,
   - `newly_blocked_item`,
   - `newly_review_required_item`,
   - `route_readiness_change`,
   - `evidence_confidence_change`.
4. Bound emitted differences with a configured maximum.
5. Suppress raw payloads, prompts, embeddings, and provider payloads.
6. Require explicit operator acceptance before replacement.
7. Require rollback snapshot and restore path before replacement.
8. Define deletion criteria for old preset/custom-signal runtime paths:
   - Phase 8R native intent stable,
   - verifier passed,
   - rollback snapshot created,
   - rollback window active,
   - delete checklist approved,
   - legacy artifacts classified,
   - custom-signal replacement defined.
9. Leave all replacement, deletion, rollback creation, learning, and routing
   writes disabled in this verifier.

## Implemented Files

- Migration verifier and rollback contract:
  `server/src/services/policyBuilderPhase7MigrationVerifierRollback.mjs`
- Focused tests:
  `server/src/__tests__/services/policyBuilderPhase7MigrationVerifierRollback.test.mjs`
- Rebuild proposal dependency:
  `server/src/services/policyBuilderPhase7LibraryPolicyRebuild.mjs`
- Migration/deletion plan dependency:
  `server/src/services/policyBuilderPhase6MigrationDeletionPath.mjs`
- Roadmap owner:
  Phase 7R.7 Migration Verifier And Rollback Path in
  `docs/architecture/policy-builder-intent-model-roadmap.md`

## Implemented Contract

The service exports:

- `PHASE7R_MIGRATION_DELETION_CRITERION_IDS`
- `PHASE7R_MIGRATION_DIFFERENCE_TYPE_IDS`
- `PHASE7R_MIGRATION_VERIFIER_AUDIT_RISK_IDS`
- `PHASE7R_MIGRATION_VERIFIER_REASON_IDS`
- `PHASE7R_MIGRATION_VERIFIER_STATUS_IDS`
- `buildPolicyBuilderPhase7MigrationVerifierReport`
- `buildPolicyBuilderPhase7MigrationVerifierAudit`
- `validatePolicyBuilderPhase7MigrationVerifierReport`

## Report Statuses

`no_migration_differences`
: Representative samples did not produce migration-relevant differences.

`review_required`
: Differences exist and require operator review before replacement.

`blocked_by_migration_risk`
: At least one sample would become newly blocked, so replacement cannot proceed
  without explicit remediation.

## Security And Data Handling

- The verifier does not call providers.
- The verifier does not run live replay.
- The verifier does not expose raw provider payloads, prompts, or embeddings.
- The verifier output is bounded by `maxDifferences`.
- The verifier cannot become a normal policy-authoring surface.
- The verifier cannot activate, replace, delete, write learning, write routing,
  or create rollback snapshots.

## Test Coverage

The focused test suite verifies:

- no-difference reports can apply only with operator acceptance and rollback,
- emitted differences are bounded and migration-relevant,
- raw payloads are suppressed,
- replacement cannot apply without acceptance and rollback,
- verifier output cannot become normal policy-authoring UI,
- side effects fail validation,
- legacy deletion is blocked before Phase 8 stability or verifier pass,
- deletion readiness is true only when all criteria are met,
- the component audit points to Phase 7R.8.

## Outcome

Phase 7R.7 gives migration this shape:

```text
rebuild proposal + sanitized comparison samples
  -> bounded migration verifier report
  -> application gate requires acceptance + rollback
  -> deletion readiness requires Phase 8 stability + verifier pass
  -> no direct side effects
```

This establishes the safety boundary needed before any later replacement or
legacy deletion work.

## Next Step

Phase 7R.8 Runtime Metrics And Decision Trace should convert the Phase 7R
runtime/rebuild outcomes into bounded counters and trace attributes without
exposing provider payloads, prompts, embeddings, or diagnostic internals.
