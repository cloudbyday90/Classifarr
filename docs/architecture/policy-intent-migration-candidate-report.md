# Policy Intent Migration Candidate Report

## Status

Implemented as the durable dry-run report for policy intent migration
readiness.

This component evaluates existing legacy policy records against the server
intent contract, unsupported legacy shapes, active-intent authority, and
deletion-impact estimates before any native intent conversion workflow is
allowed to run. It reports routing-target availability and profile freshness as
separate automation-readiness information, rather than treating either as a
reason to leave valid policy intent in legacy storage.

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
- [PostgreSQL `SET TRANSACTION`](https://www.postgresql.org/docs/18/sql-set-transaction.html)
  supports read-only transaction mode for inspection work and explicit
  transaction characteristics for later writes. Candidate reporting remains
  read-only; the separate apply gate owns atomic conversion.
- [PostgreSQL explicit locking](https://www.postgresql.org/docs/current/explicit-locking.html)
  documents row-level locking and deadlock considerations. The apply gate locks
  policy authority in a deterministic transaction; the report takes no write
  locks and does not mutate storage.

## Recommendations

1. **Keep candidate reporting dry-run only.**
   The report must not write native rows, rollback snapshots, migration events,
   or deletion markers.

2. **Use durable product-domain naming.**
   Keep the service as `policyIntentMigrationCandidateReport.mjs` and exported
   symbols under `POLICY_INTENT_MIGRATION_CANDIDATE_*`.

3. **Separate conversion eligibility from automation readiness.**
   Each candidate has one conversion status (`canConvert`) and a separate,
   bounded `automationReadiness` projection (`canAutomate`). A missing route or
   stale observed-library profile blocks automation, not native-intent storage.

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

7. **Persist an honest routing state.**
   A converted policy without an Arr mapping is stored with routing target
   status `missing`, never misrepresented as `configured`. Existing runtime
   readiness controls remain the authority for whether routing can occur.

## Pros And Cons

Pros:

- Operators can understand conversion readiness before storage changes.
- Valid policy intent can leave compatibility storage even when a later routing
  or profile-refresh action remains necessary.
- Storage accurately preserves unmapped destinations as `missing` instead of
  falsely claiming routing readiness.
- Unsupported legacy policies are visible and actionable.
- The report remains the input contract for explicit conversion workflow.
- Sensitive or bulky legacy JSON stays out of normal operator output.
- Runtime imports no longer point at phase-coded service names.

Cons:

- The report does not create native rows or migration events.
- Some policies still require operator work before routing automation can
  proceed.
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
- Runtime automation readiness:
  `server/src/services/policyAutomationReadinessEngine.mjs`
- Conversion/readiness boundary:
  [Policy Intent Conversion And Automation Readiness Separation](policy-intent-conversion-automation-readiness-separation.md)
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
  `policy.intent_migration_candidate_report.v2`.
- Replaced public `nextPhase.phaseId` output with
  `nextStep.stepId = explicit_conversion_workflow`.
- Split candidate conversion eligibility from automation readiness. A valid
  native-intent contract can convert even when routing is unconfigured or the
  library profile needs refresh; those conditions are emitted as explicit,
  bounded automation blockers.
- Updated the post-upgrade apply writer to persist unmapped routing targets as
  `missing` rather than `configured`.
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
  deletion impact, hide conversion or automation blockers, or expose raw legacy
  JSON in operator mode.
- Active native-authority conflicts now block conversion explicitly while clean
  candidate rows retain their existing report shape.
- Missing routing and stale profiles remain fail-closed for automation through
  the distinct automation-readiness contract; this report does not authorize a
  route merely because conversion is safe.

## Next Step

Use the explicit conversion workflow only after an operator selects the
candidate scope and approves a transactional write. Conversion and automation
readiness must remain separate in that workflow and in the eventual operator
surface.
