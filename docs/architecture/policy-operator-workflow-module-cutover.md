# Policy Operator Workflow Module Cutover

## Status

Implemented as a durable-domain module cutover for the Phase 6R.5 operator
workflow slice.

The production service now uses:

- `server/src/services/policyOperatorWorkflow.mjs`
- `server/src/__tests__/services/policyOperatorWorkflow.test.mjs`

## Problem

The operator workflow is a durable product concept, not a roadmap phase. It
defines the destination-first policy setup surface that operators should see
after evidence, intent, learning, and readiness have been validated. Keeping
the production module named after Phase 6R would preserve delivery-plan
language in the policy engine after the re-imagined builder is complete.

## Official Guidance Reviewed

- [NIST Secure Software Development Framework](https://csrc.nist.gov/projects/ssdf)
  frames secure software work as traceable, verified lifecycle practices. This
  cutover stays inventory-driven, reviewable, and covered by focused tests.
- [OWASP Application Security Verification Standard](https://owasp.org/www-project-application-security-verification-standard/)
  provides a verification basis for application security controls. The rename
  keeps server-side validation, direct-persistence blocks, and routing
  execution blocks intact.
- [OpenTelemetry Semantic Conventions](https://opentelemetry.io/docs/concepts/semantic-conventions/)
  favor common names for operations and data. The module now uses
  product-domain operator workflow language instead of roadmap checkpoint
  language.
- [W3C Cool URIs Don't Change](https://www.w3.org/Provider/Style/URI)
  reinforces stable identifiers. Long-lived service names and internal
  contract versions should describe durable product concepts, not temporary
  phases.

## Recommendations

1. **Use policy-domain naming for the workflow.**
   The module should be `policyOperatorWorkflow` because the workflow is the
   permanent product surface between server-owned policy decisions and the UI.

2. **Keep the workflow payload stable but rename its version.**
   The workflow payload remains the same shape, but the version should be
   `policy.operator_workflow.v1` instead of a phase-coded contract string.

3. **Use `nextStep` for local handoff metadata.**
   The workflow audit should return `nextStep.stepId = migration_deletion_path`.
   Legacy completion audits may map that step to roadmap checkpoint ids while
   those audits still exist, but the workflow itself should not emit phase ids.

4. **Update direct runtime consumers only.**
   This slice should update completion audit and migration/deletion imports
   without renaming the migration/deletion component in the same change.

5. **Keep workflow behavior side-effect free.**
   The workflow can project sections, statuses, actions, and bounded context.
   It must not persist policy, execute routing, call providers, or expose raw
   diagnostic payloads.

## Pros And Cons

Pros:

- Removes another phase-coded production module from the policy engine.
- Makes the operator workflow easier to reason about without roadmap context.
- Keeps the destination-first section contract stable for the UI.
- Preserves the legacy completion audit through a narrow `nextStep` adapter.
- Maintains existing validation that blocks diagnostic panels, direct writes,
  direct routing execution, and raw payload exposure.

Cons:

- Direct consumers needed import and contract-version updates.
- The migration/deletion component still carries roadmap names until its own
  cutover slice.
- The completion audit still maps durable `nextStep` values back to roadmap
  checkpoints until that audit is retired or renamed.

## Final Recommendation Stack

- Durable service:
  `server/src/services/policyOperatorWorkflow.mjs`
- Focused tests:
  `server/src/__tests__/services/policyOperatorWorkflow.test.mjs`
- Contract version:
  `policy.operator_workflow.v1`
- Local handoff:
  `nextStep.stepId = migration_deletion_path`
- Legacy adapter:
  `server/src/services/policyBuilderPhase6CompletionAudit.mjs`
- Roadmap owner:
  `docs/architecture/policy-builder-intent-model-roadmap.md`
- Existing design owner:
  `docs/architecture/policy-builder-phase-6r-operator-workflow.md`

## Implementation Outcome

- Renamed the operator workflow service and focused test to durable
  product-domain paths.
- Replaced exported constants and functions with
  `POLICY_OPERATOR_WORKFLOW_*` and `buildPolicyOperatorWorkflow*` names.
- Moved the workflow contract version to `policy.operator_workflow.v1`.
- Replaced the workflow-local phase handoff with `nextStep`.
- Updated direct server consumers and tests to import the durable module.
- Added a bounded adapter in the legacy Phase 6R completion audit so
  `migration_deletion_path` still satisfies the current completion checkpoint.

## Security Outcome

- The workflow remains server-owned and side-effect free.
- Validation still blocks missing sections, unknown sections, missing primary
  actions, internal diagnostic language, diagnostic panels in the normal flow,
  editable readiness sections, direct routing execution, direct persistence,
  raw payload exposure, failed upstream audits, and mismatched bounded quality.
- The cutover does not relax authorization, persistence, routing, provider,
  learning, readiness, or migration behavior.
- Focused regression tests cover section contracts, bounded handoff, direct
  consumers, and legacy completion adapter.

## Next Step

Continue with the migration/deletion path cutover. It is the next direct
consumer of `policyOperatorWorkflow` and still carries roadmap phase naming in
its module, tests, version string, and local completion handoff fields.
