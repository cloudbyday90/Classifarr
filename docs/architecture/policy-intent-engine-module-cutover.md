# Policy Intent Engine Module Cutover

## Context

Phase 9R production naming work renamed the intent inference engine from a
roadmap-phase module to a durable product-domain module:

- `server/src/services/policyBuilderPhase6IntentEngine.mjs` ->
  `server/src/services/policyIntentEngine.mjs`
- `server/src/__tests__/services/policyBuilderPhase6IntentEngine.test.mjs` ->
  `server/src/__tests__/services/policyIntentEngine.test.mjs`

The engine now owns the production-named intent draft contract
`policy.intent.v1`.

## Official Guidance Reviewed

- NIST Secure Software Development Framework:
  https://csrc.nist.gov/projects/ssdf
- OWASP Application Security Verification Standard:
  https://owasp.org/www-project-application-security-verification-standard/
- OpenTelemetry semantic conventions:
  https://opentelemetry.io/docs/concepts/semantic-conventions/
- W3C Cool URIs:
  https://www.w3.org/Provider/Style/URI

## Recommendations

- Keep intent inference named by the product responsibility, not by the roadmap
  phase that introduced it.
- Keep the intent contract stable and semantic once downstream learning,
  readiness, and runtime rebuild services consume it.
- Keep the engine side-effect-free: it can infer intent, but it cannot write
  durable learning or storage.
- Use a compatibility adapter only in legacy completion gates that still reason
  in phase ids.

## Pros

- Removes the Phase 6R intent-engine name from production imports.
- Gives downstream modules a stable `policy.intent.v1` contract surface.
- Keeps `policyIntentEngine.mjs` free of roadmap handoff fields by using
  `nextStep` instead of `nextPhase`.
- Lowers the production naming regression baseline.

## Cons

- Learning, readiness, workflow, migration, and Phase 7R modules still carry
  their own phase-coded module names and handoff fields. Those require separate
  bounded cutovers.
- The policy engine completion audit now validates the intent engine's semantic
  `nextStep.stepId` handoff directly.

## Final Recommendation Stack

- Server module: `server/src/services/policyIntentEngine.mjs`
- Focused test: `server/src/__tests__/services/policyIntentEngine.test.mjs`
- Intent contract: `policy.intent.v1`
- Completion checkpoint:
  `server/src/services/policyEngineCompletionAudit.mjs`
- Regression guard:
  `server/src/services/policyProductionNamingRegressionAudit.mjs`

## Outcome

- Production naming inventory after cutover:
  - production references: `6857`
  - rename candidates: `6879`
  - obsolete migration tooling references: `93`
- Focused intent/dependent service tests passed.
- The naming regression baseline was lowered to the new inventory counts.

## Next Step

Cut over the learning guard to a durable product-domain module once the intent
engine cutover has passed the full validation suite.
