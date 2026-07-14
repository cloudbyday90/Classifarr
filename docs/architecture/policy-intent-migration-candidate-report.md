# Policy Intent Migration Candidate Report

## Status

Implemented as the durable dry-run report for policy intent migration
readiness.

This component evaluates existing legacy policy records against the server
intent contract, routing target availability, profile freshness, unsupported
legacy shapes, and deletion-impact estimates before any native intent
conversion workflow is allowed to run.

## Problem

Native intent storage should not be applied blindly. Before conversion workflow,
runtime read path, or post-upgrade apply gates can act on policy storage,
Classifarr needs a dry-run report that tells operators which existing policies
can safely convert and which require review.

The old module name tied this durable product role to a temporary roadmap phase.
The behavior remains valuable after that phase closes, so the canonical module
is now `server/src/services/policyIntentMigrationCandidateReport.mjs`.

## Official-Source Research

- [NIST Secure Software Development Framework](https://csrc.nist.gov/projects/ssdf)
  recommends integrating secure development practices into normal SDLC work.
  This cutover keeps the same dry-run behavior under focused tests while
  removing stale production naming.
- [NIST SP 800-128](https://csrc.nist.gov/pubs/sp/800/128/upd1/final)
  treats security as part of configuration management. The rename updates
  service imports, dependent conversion and post-upgrade paths, tests, storage
  closure evidence, roadmap references, and changelog text together.
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
  cautions against exposing unnecessary sensitive data. The report continues to
  suppress raw legacy JSON unless maintainer mode explicitly requests it.
- [PostgreSQL transactions](https://www.postgresql.org/docs/current/tutorial-transactions.html)
  describe explicit transaction boundaries for grouped changes. This report
  remains dry-run only and feeds later explicit conversion planning rather than
  mutating storage itself.

## Recommendations

1. **Keep candidate reporting dry-run only.**
   The report must not write native rows, rollback snapshots, migration events,
   or deletion markers.

2. **Use durable product-domain naming.**
   Keep the service as `policyIntentMigrationCandidateReport.mjs` and exported
   symbols under `POLICY_INTENT_MIGRATION_CANDIDATE_*`.

3. **Classify every emitted policy explicitly.**
   Each candidate should have one readiness state and bounded reasons.

4. **Suppress raw legacy JSON by default.**
   Operator output must not include raw legacy policy payloads. Maintainer mode
   can opt in explicitly for local tooling.

5. **Use semantic handoff metadata.**
   The report should emit `nextStep.stepId = explicit_conversion_workflow`
   rather than a temporary phase identifier.

6. **Compose active-authority eligibility before readiness.**
   Use the active-intent integrity report to block only affected policies with
   bounded conflict state and count metadata. Do not expose native intent
   payloads or convert/report repairable data as part of candidate reporting.

## Pros And Cons

Pros:

- Operators can understand conversion readiness before storage changes.
- Unsupported legacy policies are visible and actionable.
- The report remains the input contract for explicit conversion workflow.
- Sensitive or bulky legacy JSON stays out of normal operator output.
- Runtime imports no longer point at phase-coded service names.

Cons:

- The report does not create native rows or migration events.
- Some policies still require operator cleanup before conversion can proceed.
- Downstream conversion workflow remains a separate phase-coded component until
  its own cutover.

## Final Recommendation Stack

- Report service:
  `server/src/services/policyIntentMigrationCandidateReport.mjs`
- Focused service test:
  `server/src/__tests__/services/policyIntentMigrationCandidateReport.test.mjs`
- Dependent conversion workflow:
  `server/src/services/policyIntentConversionWorkflow.mjs`
- Dependent post-upgrade dry run:
  `server/src/services/policyPostUpgradeDryRun.mjs`
- Candidate authority eligibility:
  `server/src/services/policyCandidateAuthorityEligibility.mjs`
- Authority eligibility design:
  [Policy Candidate Authority Eligibility](policy-candidate-authority-eligibility.md)
- Validation evidence:
  `server/src/services/policyStorageClosureEvidenceRun.mjs`

## Implementation Outcome

Implemented:

- Renamed the candidate report service and focused test to durable
  policy-intent migration names.
- Renamed exported constants, builder, validator, and audit functions to
  `POLICY_INTENT_MIGRATION_CANDIDATE_*` and
  `buildPolicyIntentMigrationCandidateReport*`.
- Replaced the phase-coded payload version with
  `policy.intent_migration_candidate_report.v1`.
- Replaced public `nextPhase.phaseId` output with
  `nextStep.stepId = explicit_conversion_workflow`.
- Updated explicit conversion workflow, post-upgrade dry run, storage-closure
  evidence, native-storage test reset metadata, roadmap, and changelog
  references.

## Security Outcome

- No persistent writes, provider calls, Git operations, migrations, rollback
  snapshots, or deletion actions were added.
- Report output remains bounded by max policy, reason, and unsupported-signal
  limits.
- Raw legacy JSON remains suppressed outside explicit maintainer mode.
- Validation still rejects reports that mutate storage, omit reasons, omit
  deletion impact, hide blockers behind generic statuses, or expose raw legacy
  JSON in operator mode.
- Active native-authority conflicts now block conversion explicitly while clean
  candidate rows retain their existing report shape.

## Next Step

Cut over the explicit conversion workflow component to durable product-domain
naming.
