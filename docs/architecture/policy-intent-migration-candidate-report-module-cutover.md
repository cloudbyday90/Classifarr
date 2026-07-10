# Policy Intent Migration Candidate Report Module Cutover

## Status

Implemented.

This cutover renames the native intent migration candidate report from
temporary phase-coded module naming to durable product-domain naming:

- Canonical service:
  `server/src/services/policyIntentMigrationCandidateReport.mjs`

The dry-run report behavior, candidate status taxonomy, side-effect guardrails,
raw legacy JSON suppression, and conversion-readiness semantics remain intact.

## Problem

The migration candidate report is no longer just a temporary phase artifact. It
is the durable safety gate that explains whether a policy is ready for native
intent conversion. Keeping phase-coded service names, constants, payload
versions, and `nextPhase.phaseId` output would carry stale roadmap vocabulary
into production surfaces after the phase closes.

## Official-Source Research

- [NIST Secure Software Development Framework](https://csrc.nist.gov/projects/ssdf)
  recommends integrating secure development practices into normal SDLC work.
  This cutover keeps behavior covered by focused tests while renaming the
  component to its durable role.
- [NIST SP 800-128](https://csrc.nist.gov/pubs/sp/800/128/upd1/final)
  treats security as part of configuration management. The rename updates the
  service, dependent imports, tests, validation metadata, roadmap, and changelog
  together.
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
  cautions against exposing unnecessary sensitive data. The report continues to
  suppress raw legacy JSON in operator-safe mode.
- [PostgreSQL transactions](https://www.postgresql.org/docs/current/tutorial-transactions.html)
  describe explicit transaction boundaries. The candidate report remains
  read-only and feeds later conversion planning rather than mutating storage.

## Recommendations

1. **Use durable module vocabulary.**
   Name the service after its product role:
   `policyIntentMigrationCandidateReport.mjs`.

2. **Rename public symbols.**
   Use `POLICY_INTENT_MIGRATION_CANDIDATE_*`,
   `buildPolicyIntentMigrationCandidateReport`,
   `buildPolicyIntentMigrationCandidateReportAudit`, and
   `validatePolicyIntentMigrationCandidateReport`.

3. **Replace phase handoffs.**
   Emit `nextStep.stepId = explicit_conversion_workflow` instead of
   `nextPhase.phaseId`.

4. **Avoid compatibility aliases.**
   Do not keep old phase-coded exports or a shim because that would preserve
   the stale production surface.

5. **Keep dry-run safety intact.**
   Preserve bounded output, side-effect rejection, and raw legacy JSON
   suppression.

## Pros And Cons

Pros:

- Removes phase-coded vocabulary from a runtime service used by conversion and
  post-upgrade dry-run paths.
- Keeps candidate readiness behavior stable.
- Preserves the safety boundary before native intent writes.
- Makes the report name meaningful after the roadmap phase closes.

Cons:

- Explicit conversion workflow still has phase-coded naming and remains the
  next cleanup component.
- Historical docs still mention the broader phase sequence as context.

## Final Recommendation Stack

- Service:
  `server/src/services/policyIntentMigrationCandidateReport.mjs`
- Test:
  `server/src/__tests__/services/policyIntentMigrationCandidateReport.test.mjs`
- Conversion consumer:
  `server/src/services/policyIntentConversionWorkflow.mjs`
- Post-upgrade consumer:
  `server/src/services/policyPostUpgradeDryRun.mjs`
- Storage closure evidence:
  `server/src/services/policyStorageClosureEvidenceRun.mjs`
- Design evidence:
  `docs/architecture/policy-intent-migration-candidate-report.md`

## Implementation Outcome

Implemented:

- Renamed the service, focused test, design doc, version string, constants,
  builder, audit builder, and validator to durable policy-intent migration
  candidate names.
- Updated explicit conversion workflow and post-upgrade dry-run imports.
- Updated storage-closure evidence and native-storage test reset metadata.
- Updated roadmap, changelog, and production-name inventory tests.
- Replaced public `nextPhase.phaseId` output with semantic `nextStep.stepId`.

## Security Outcome

- No persistent writes or provider calls were added.
- Candidate reports remain dry-run and bounded.
- Raw legacy JSON remains suppressed unless maintainer mode explicitly enables
  it.
- Validation still rejects storage mutation, unbounded output, missing reasons,
  missing deletion impact, hidden blockers, and raw JSON exposure.

## Next Step

Cut over the explicit conversion workflow naming and remove its phase-coded
payload/version/handoff vocabulary.
