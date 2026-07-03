# Policy Evidence Engine Module Cutover

## Context

Phase 9R production naming work renamed the evidence projection engine from a
roadmap-phase module to a durable product-domain module:

- `server/src/services/policyBuilderPhase6EvidenceEngine.mjs` ->
  `server/src/services/policyEvidenceEngine.mjs`
- `server/src/__tests__/services/policyBuilderPhase6EvidenceEngine.test.mjs` ->
  `server/src/__tests__/services/policyEvidenceEngine.test.mjs`

The engine now owns the production-named evidence projection contract
`policy.evidence.v1` and summary contract `policy.evidence.summary.v1`.

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

- Keep production module names tied to product domains, not roadmap phases.
- Keep contract identifiers stable and semantic once downstream services depend
  on them.
- Preserve deterministic, side-effect-free projection behavior so evidence can
  be tested without live provider, quota, or UI state.
- Use a compatibility adapter only in legacy completion audits that still reason
  in phase terminology.

## Pros

- Removes the largest remaining Phase 6R evidence-engine name from production
  imports.
- Gives downstream modules a stable `policy.evidence.*` contract surface.
- Keeps `policyEvidenceEngine.mjs` free of roadmap handoff fields by using
  `nextStep` instead of `nextPhase`.
- Lowers the production naming regression baseline.

## Cons

- Some Phase 6R and Phase 7R modules still have their own phase-coded names and
  persisted runtime field names. Those require separate bounded cutovers.
- The policy engine completion audit now validates the evidence engine's
  semantic `nextStep.stepId` handoff directly.

## Final Recommendation Stack

- Server module: `server/src/services/policyEvidenceEngine.mjs`
- Focused test: `server/src/__tests__/services/policyEvidenceEngine.test.mjs`
- Evidence contract: `policy.evidence.v1`
- Evidence summary contract: `policy.evidence.summary.v1`
- Completion checkpoint:
  `server/src/services/policyEngineCompletionAudit.mjs`
- Regression guard:
  `server/src/services/policyProductionNamingRegressionAudit.mjs`

## Outcome

- Production naming inventory after cutover:
  - production references: `7024`
  - rename candidates: `7046`
  - obsolete migration tooling references: `93`
- Focused evidence/dependent service tests passed.
- The naming regression baseline was lowered to the new inventory counts.

## Next Step

Cut over the Phase 6R intent engine to a durable product-domain module once the
evidence engine cutover has passed the full validation suite.
