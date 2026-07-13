# Policy Migration Verifier And Rollback Path

## Status

Implemented as a durable migration-verifier and rollback contract.

This contract compares a library-derived rebuild proposal against sanitized legacy
behavior samples, emits only migration-relevant differences, and binds the
comparison to both a stable sample-set fingerprint and a verified rebuild
acceptance transition. The transition binds the proposal, policy context,
rollback-window plan, manual approval, and short-lived approval window. The
verifier does not apply policy replacement, create rollback snapshots, delete
legacy paths, write learning, or expose raw replay/provider payloads.

This checkpoint also makes the verifier prove that its embedded rebuild
proposal validation is current. Reports recompute proposal validation during
verification and bind sample-set provenance to guarded-outcome fingerprint and
request-proof counts from the embedded rebuild proposal.

Verifier construction now separates raw rebuild input from the validated
proposal reducer. The reducer validates the rebuild proposal before any sample
comparison, fingerprinting, or rollback-gate derivation.

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
sample-set provenance
rollback snapshot readiness
legacy deletion criteria
```

## Official Guidance Reviewed

- [NIST Secure Software Development Framework](https://csrc.nist.gov/projects/ssdf)
  emphasizes secure release, verification, and tested changes. The migration
  verifier uses deterministic checks before any replacement path can apply a
  proposal.
- [NIST Generative AI Profile](https://www.nist.gov/publications/artificial-intelligence-risk-management-framework-generative-artificial-intelligence)
  emphasizes governed measurement and lifecycle risk controls for generative AI
  systems. The verifier keeps proposal validation, sample-set provenance,
  operator acceptance, rollback state, and deletion readiness separate.
- [NIST SP 800-53 Revision 5](https://csrc.nist.gov/pubs/sp/800/53/r5/upd1/final)
  includes contingency, backup, recovery, and system integrity controls. The
  verifier requires rollback snapshots, restore paths, and retention criteria
  before replacement or deletion.
- [OWASP Application Security Verification Standard](https://owasp.org/www-project-application-security-verification-standard/)
  emphasizes server-side verification and business logic controls. The report
  validates acceptance, rollback, deletion, and side-effect gates server-side,
  and recomputes authoritative validation rather than trusting stale client or
  integration-provided validation flags.
- [OWASP Top 10 for Large Language Model Applications](https://owasp.org/www-project-top-10-for-large-language-model-applications/)
  highlights insecure output handling, excessive agency, and overreliance. The
  verifier validates bounded comparison output before any downstream
  replacement can act on it.
- [Microsoft safe deployment practices](https://learn.microsoft.com/en-us/devops/operate/safe-deployment-practices)
  emphasize quality signals, controlled exposure, automation, and rollback. The
  verifier report is a quality signal that must pass before replacement and
  deletion gates advance.
- [Microsoft Azure Well-Architected safe deployments](https://learn.microsoft.com/en-us/azure/well-architected/operational-excellence/safe-deployments)
  recommends failure-detection mechanisms, versioning, and rollback/roll-forward
  guardrails. The verifier records a comparison fingerprint and requires a
  rollback restore path before apply can be considered.
- [PostgreSQL Backup And Restore](https://www.postgresql.org/docs/current/backup.html)
  documents backup and restore responsibilities. The verifier treats rollback as
  an explicit precondition before replacement instead of an operator memory
  step.
- [OpenTelemetry Naming](https://opentelemetry.io/docs/specs/semconv/general/naming/)
  recommends lower-case namespacing, snake_case multi-word name components, and
  precise unambiguous names. The verifier payload versions now use
  `policy.migration_verifier.v1` and
  `policy.migration_verifier_sample_set_fingerprint.v1`.

## Recommendation

Use a server-owned migration verifier report between rebuild proposals and any
future replacement operation.

The report should answer:

```text
Is the rebuild proposal valid?
Which exact sanitized comparison sample set was verified?
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
- Binds verifier output to a stable sanitized sample-set fingerprint so stale or
  tampered comparisons cannot silently pass.
- Blocks legacy deletion until native intent storage is stable and verifier
  differences are resolved.
- Keeps report output bounded and free of raw provider/replay payloads.

Cons:

- Requires representative comparison samples from later integration work.
- Does not execute replacement or deletion; those remain later gated slices.
- Conservative deletion criteria mean old paths remain until Phase 8R stability
  is proven.
- Sample-set fingerprints add another validation gate that integration code must
  preserve when wiring real comparison samples.
- Verifier integrations must preserve both the report fingerprint and its
  bounded proposal provenance, including guarded-outcome request-proof counts.

## Final Recommendation Stack

1. Consume a valid library-derived rebuild proposal.
2. Consume sanitized representative legacy/proposed comparison samples.
3. Generate a stable SHA-256 sample-set fingerprint from normalized samples,
   verifier options, and bounded rebuild proposal evidence metadata.
4. Mirror that fingerprint into bounded trace attributes.
5. Recompute rebuild proposal validation during report validation and reject
   stale or missing proposal-validation proof.
6. Bind sample-set provenance to the embedded rebuild proposal version, status,
   guarded-outcome fingerprint counts, and request-proof counts.
7. Emit only these migration-relevant difference types:
   - `destination_change`,
   - `newly_blocked_item`,
   - `newly_review_required_item`,
   - `route_readiness_change`,
   - `evidence_confidence_change`.
8. Bound emitted differences with a configured maximum.
9. Suppress raw payloads, prompts, embeddings, and provider payloads.
10. Require a current, verified manual acceptance transition before comparison.
11. Require a same-policy rollback-window plan and restore path before
    comparison; require a later persisted snapshot before replacement.
12. Define deletion criteria for old preset/custom-signal runtime paths:
   - native intent storage stable,
   - verifier passed,
   - rollback snapshot created,
   - rollback window active,
   - delete checklist approved,
   - legacy artifacts classified,
   - custom-signal replacement defined.
13. Leave all replacement, deletion, rollback creation, learning, and routing
   writes disabled in this verifier.
14. Use a raw runtime adapter or a validated rebuild proposal reducer; do not
    infer authority from a proposal version field alone.

## Implemented Files

- Migration verifier and rollback contract:
  `server/src/services/policyMigrationVerifierRollback.mjs`
- Focused tests:
  `server/src/__tests__/services/policyMigrationVerifierRollback.test.mjs`
- Rebuild proposal dependency:
  `server/src/services/policyLibraryPolicyRebuild.mjs`
- Migration verifier proposal-boundary outcome:
  `docs/architecture/policy-migration-verifier-proposal-boundary.md`
- Migration/deletion plan dependency:
  `server/src/services/policyMigrationDeletionPath.mjs`
- Roadmap owner:
  Migration Verifier And Rollback Path in
  `docs/architecture/policy-builder-intent-model-roadmap.md`

## Implemented Contract

The service exports:

- `POLICY_MIGRATION_DELETION_CRITERION_IDS`
- `POLICY_MIGRATION_DIFFERENCE_TYPE_IDS`
- `POLICY_MIGRATION_VERIFIER_AUDIT_RISK_IDS`
- `POLICY_MIGRATION_VERIFIER_REASON_IDS`
- `POLICY_MIGRATION_VERIFIER_STATUS_IDS`
- `buildPolicyMigrationVerifierReportFromRebuildProposal`
- `buildPolicyMigrationVerifierReportFromRuntimeInput`
- `buildPolicyMigrationVerifierAudit`
- `validatePolicyMigrationVerifierReport`

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
- The verifier carries a SHA-256 sample-set fingerprint with bounded provenance:
  sample count, raw-payload suppression flag, verifier options, proposal
  version/status, sanitized proposal evidence digests, guarded-outcome
  fingerprint counts, and guarded-outcome request-proof counts.
- Report validation recomputes the embedded rebuild proposal validation and
  rejects missing or stale proposal-validation proof.
- The verifier rejects raw `operatorAccepted` and `rollbackSnapshot` fields.
  It accepts only a current acceptance transition whose proposal and rollback
  fingerprints match the embedded decision artifacts.
- Verifier reports are comparison-only: `canApplyReplacement` remains false
  until a later transactional path persists a rollback snapshot and replay key.
- The decision-only verifier reducer rejects raw rebuild input and requires a
  valid rebuild proposal before comparing samples or deriving rollback gates.
- Report validation rejects sample-set provenance that no longer matches the
  embedded proposal summary.
- Trace attributes must carry the same sample-set fingerprint as the report.
- The verifier cannot become a normal policy-authoring surface.
- The verifier cannot activate, replace, delete, write learning, write routing,
  or create rollback snapshots.

## Test Coverage

The focused test suite verifies:

- no-difference reports can apply only with operator acceptance and rollback,
- emitted differences are bounded and migration-relevant,
- sample-set fingerprints are stable for equivalent normalized comparison
  inputs and change when comparison behavior changes,
- sample-set fingerprints are mirrored into trace attributes,
- missing, malformed, or mismatched sample-set fingerprints fail validation,
- missing or stale proposal-validation proof fails validation,
- sample-set provenance drift against guarded-outcome request-proof counts fails
  validation,
- raw payloads are suppressed,
- replacement cannot apply without acceptance and rollback,
- verifier output cannot become normal policy-authoring UI,
- side effects fail validation,
- legacy deletion is blocked before native intent storage stability or verifier
  pass,
- deletion readiness is true only when all criteria are met,
- the component audit points to `nextStep.stepId = runtime_metrics_trace`.

## Outcome

The migration verifier gives replacement review this shape:

```text
rebuild proposal + sanitized comparison samples
  -> stable sample-set fingerprint + bounded provenance
  -> bounded migration verifier report
  -> application gate requires acceptance + rollback
  -> deletion readiness requires native storage stability + verifier pass
  -> no direct side effects
```

This establishes the safety boundary needed before any later replacement or
legacy deletion work.

## Next Step

Runtime Metrics And Decision Trace should convert runtime/rebuild outcomes into
bounded counters and trace attributes without exposing provider payloads,
prompts, embeddings, or diagnostic internals.
