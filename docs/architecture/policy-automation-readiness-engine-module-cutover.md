# Policy Automation Readiness Engine Module Cutover

## Status

Implemented as a durable-domain module cutover for the Phase 6R.4 automation
readiness slice.

The production service now uses:

- `server/src/services/policyAutomationReadinessEngine.mjs`
- `server/src/__tests__/services/policyAutomationReadinessEngine.test.mjs`

## Problem

Automation readiness is a durable policy-engine concept, not a roadmap phase.
It decides whether the current evidence, intent, and learning state is good
enough for automation to proceed, or whether the operator needs to provide a
missing action. Keeping the production module named after Phase 6R would keep
temporary roadmap language in the engine after the re-imagined policy builder
is complete.

## Official Guidance Reviewed

- [NIST Secure Software Development Framework](https://csrc.nist.gov/projects/ssdf)
  frames secure software work as traceable, verified lifecycle practices. This
  cutover is inventory-driven, test-covered, and keeps readiness side-effect
  free.
- [OWASP Application Security Verification Standard](https://owasp.org/www-project-application-security-verification-standard/)
  provides web application verification guidance. The rename preserves
  server-side validation and business-logic boundaries while changing only
  module names, contract names, and local handoff metadata.
- [OpenTelemetry Semantic Conventions](https://opentelemetry.io/docs/concepts/semantic-conventions/)
  favor consistent names for operations and data. The module now uses
  policy-domain automation readiness language instead of roadmap checkpoint
  language.
- [W3C Cool URIs Don't Change](https://www.w3.org/Provider/Style/URI)
  reinforces stable identifiers. Long-lived service names and internal
  contract versions should describe durable product concepts, not delivery
  phases.

## Recommendations

1. **Use policy-domain naming for readiness.**
   The module should be `policyAutomationReadinessEngine` because readiness is
   part of the permanent policy automation vocabulary.

2. **Keep the readiness contract shape but rename its version.**
   The payload remains compatible for direct consumers, but the version should
   be `policy.automation_readiness.v1` instead of a phase-coded string.

3. **Use `nextStep` for local handoff metadata.**
   The readiness engine should return `nextStep.stepId = operator_workflow`.
   Completion audits may translate that step into roadmap checkpoint ids while
   those audits still exist, but readiness itself should not emit phase ids.

4. **Update direct runtime consumers only.**
   This slice should update operator workflow, migration/deletion, and library
   rebuild imports without renaming those larger components in the same change.

5. **Keep readiness deterministic and side-effect free.**
   Readiness can evaluate bounded inputs and return an automation state. It
   must not write policy, refresh profiles, enqueue routing, or call external
   providers.

## Pros And Cons

Pros:

- Removes another phase-coded production module from the policy engine.
- Makes readiness easier to reason about without roadmap context.
- Keeps downstream behavior stable while moving the contract to durable names.
- Preserves the legacy completion audit with a narrow adapter instead of
  pushing phase ids back into the readiness engine.
- Maintains deterministic validation before any future automation step can
  trust readiness.

Cons:

- Direct consumers needed import and contract-version updates.
- Phase 6R operator workflow and Phase 7R runtime components still carry
  roadmap names until their own cutover slices.
- The completion audit still maps durable `nextStep` values back to roadmap
  checkpoints until that audit is retired or renamed.

## Final Recommendation Stack

- Durable service:
  `server/src/services/policyAutomationReadinessEngine.mjs`
- Focused tests:
  `server/src/__tests__/services/policyAutomationReadinessEngine.test.mjs`
- Contract version:
  `policy.automation_readiness.v1`
- Local handoff:
  `nextStep.stepId = operator_workflow`
- Legacy adapter:
  `server/src/services/policyBuilderPhase6CompletionAudit.mjs`
- Roadmap owner:
  `docs/architecture/policy-builder-intent-model-roadmap.md`
- Existing design owner:
  `docs/architecture/policy-builder-phase-6r-readiness-engine.md`

## Implementation Outcome

- Renamed the automation readiness service and focused test to durable
  product-domain paths.
- Replaced exported constants and functions with
  `POLICY_AUTOMATION_READINESS_*` and `buildPolicyAutomationReadiness*` names.
- Moved the readiness contract version to `policy.automation_readiness.v1`.
- Replaced the readiness-local phase handoff with `nextStep`.
- Updated direct server consumers and tests to import the durable module.
- Added a bounded adapter in the legacy Phase 6R completion audit so
  `operator_workflow` still satisfies the current completion checkpoint.

## Security Outcome

- The readiness engine remains server-owned and side-effect free.
- Validation still blocks unknown readiness states, unknown reason ids, missing
  bounded evidence, failed upstream audits, mismatched fingerprints, and
  missing or insufficient evidence-quality snapshots.
- The cutover does not relax authorization, persistence, profile-refresh,
  routing, provider, or migration behavior.
- Focused regression tests cover the reducer, bounded handoff, direct
  consumers, and legacy completion adapter.

## Next Step

Continue with the operator workflow rebuild cutover. It is the next direct
consumer of `policyAutomationReadinessEngine` and still carries roadmap phase
naming in its module, tests, and local completion handoff fields.
