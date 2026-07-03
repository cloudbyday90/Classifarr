# Policy Learning Guard Module Cutover

## Status

Implemented as a durable-domain module cutover for the Phase 6R.3 learning
guard slice.

The production service now uses:

- `server/src/services/policyLearningGuard.mjs`
- `server/src/__tests__/services/policyLearningGuard.test.mjs`

## Problem

The learning guard is a durable policy concept, not a roadmap phase. It decides
whether a resolved operator, request, routing, or Discord outcome may become
durable learning. Keeping the production module named after a roadmap phase
would make the engine harder to reason about after the rebuild is complete and
would keep phase-coded fields in local handoff contracts.

## Official Guidance Reviewed

- [NIST Secure Software Development Framework](https://csrc.nist.gov/projects/ssdf)
  frames secure software work as traceable practices integrated into the
  lifecycle. This cutover stays inventory-driven, reviewable, and covered by
  focused regression tests.
- [OWASP Application Security Verification Standard](https://owasp.org/www-project-application-security-verification-standard/)
  provides a basis for verifying web application security controls. The rename
  preserves server-side validation, business-logic boundaries, and auditability
  while changing only names and local handoff shape.
- [OpenTelemetry Semantic Conventions](https://opentelemetry.io/docs/concepts/semantic-conventions/)
  recommend common names for operations and data. The module now uses
  product-domain learning guard language instead of roadmap phase language.
- [W3C Cool URIs Don't Change](https://www.w3.org/Provider/Style/URI)
  reinforces stable identifiers. Long-lived module names and internal contract
  versions should describe durable product concepts, not temporary delivery
  phases.

## Recommendations

1. **Use policy-domain naming for the guard.**
   The module should be `policyLearningGuard` because the behavior belongs to
   the permanent policy engine vocabulary.

2. **Keep the decision contract stable but rename its version.**
   The learning decision payload remains the same shape, but the version should
   be `policy.learning_guard.v1` instead of a phase-coded contract string.

3. **Use `nextStep` for local handoff metadata.**
   The learning guard should return `nextStep.stepId = automation_readiness`.
   Legacy completion audits may map that step to roadmap checkpoint ids, but
   the guard itself should not export phase ids.

4. **Update direct runtime consumers only.**
   This cutover should update imports and version checks in readiness, library
   rebuild, and request-time learning consumers without renaming those larger
   components in the same slice.

5. **Keep the operation side-effect free.**
   The learning guard still returns decisions only. It does not write policy,
   update profiles, enqueue refreshes, or execute routing.

## Pros And Cons

Pros:

- Removes one more phase-coded production module from the policy engine.
- Makes learning eligibility easier to understand without roadmap context.
- Keeps downstream behavior unchanged while moving local contracts to durable
  names.
- Gives the legacy completion audit a narrow adapter instead of pushing phase
  ids back into the learning guard.
- Preserves the existing security boundary: deterministic validation first,
  no direct learning writes.

Cons:

- Direct consumers needed import and contract-version updates.
- Existing Phase 6R and Phase 7R components still contain roadmap names until
  their own cutover slices.
- The legacy completion audit still maps durable `nextStep` values back to
  phase checkpoints until the audit itself is retired or renamed.

## Final Recommendation Stack

- Durable service:
  `server/src/services/policyLearningGuard.mjs`
- Focused tests:
  `server/src/__tests__/services/policyLearningGuard.test.mjs`
- Contract version:
  `policy.learning_guard.v1`
- Local handoff:
  `nextStep.stepId = automation_readiness`
- Legacy adapter:
  `server/src/services/policyBuilderPhase6CompletionAudit.mjs`
- Roadmap owner:
  `docs/architecture/policy-builder-intent-model-roadmap.md`
- Existing design owner:
  `docs/architecture/policy-builder-phase-6r-learning-guard.md`

## Implementation Outcome

- Renamed the learning guard service and focused test to durable product-domain
  paths.
- Replaced exported constants and functions with `POLICY_LEARNING_*` and
  `buildPolicyLearning*` names.
- Moved the learning decision contract version to `policy.learning_guard.v1`.
- Replaced the guard-local phase handoff with `nextStep`.
- Updated direct server consumers and tests to import the durable module.
- Added a bounded adapter in the legacy Phase 6R completion audit so
  `automation_readiness` still satisfies the current completion checkpoint.

## Security Outcome

- The guard remains server-owned and side-effect free.
- Validation still blocks unknown decisions, unknown tiers, direct writes,
  hard-limit writes without explicit policy edits, and missing bounded intent
  evidence quality.
- The cutover does not relax authorization, persistence, profile-refresh, or
  routing behavior.
- Focused regression tests cover the decision reducer, bounded handoff, direct
  consumers, and legacy completion adapter.

## Next Step

Continue with the automation readiness engine cutover. It is the next direct
consumer of `policyLearningGuard` and still carries roadmap phase naming in its
module, constants, tests, and local handoff fields.
