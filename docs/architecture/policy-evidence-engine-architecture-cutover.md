# Policy Evidence Engine Architecture Cutover

Status: implemented.

## Scope

This cutover removes the roadmap-phase architecture path from the policy
evidence engine while preserving the existing server module, tests, evidence
projection contract, summary contract, quality contract, and boundary behavior.

This cutover does not change runtime classification, learning, routing, native
storage, provider calls, TMDB calls, AI calls, UI behavior, database schema, or
Arr writes.

## Official Guidance Reviewed

- NIST AI Risk Management Framework:
  https://www.nist.gov/itl/ai-risk-management-framework
- NIST Secure Software Development Framework:
  https://csrc.nist.gov/pubs/sp/800/218/final
- OWASP Input Validation Cheat Sheet:
  https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html
- OWASP Application Security Verification Standard:
  https://owasp.org/www-project-application-security-verification-standard/
- OpenTelemetry semantic convention naming:
  https://opentelemetry.io/docs/specs/semconv/general/naming/

## Recommendations

1. Keep the engine name tied to the durable product contract:
   `policy.evidence.*`.
2. Keep projection generation deterministic, offline, and side-effect-free.
3. Keep source authority and prohibited payload rules in server-owned
   vocabulary, not UI state.
4. Keep trace attributes stable and semantic while avoiding raw provider or
   user-specific values.
5. Treat roadmap-phase references as documentation history, not active engine
   contract names.

## Pros And Cons

Pros:

- Removes the phase-coded evidence-engine architecture path from the active
  runtime handoff.
- Keeps downstream modules pointed at `policyEvidenceEngine.mjs` and
  `policy.evidence.*` contracts.
- Preserves the existing audit coverage for live provider calls, raw payload
  leakage, source authority, summaries, fingerprints, and quality.

Cons:

- Evidence boundary, quality, and downstream intent/readiness documents still
  need separate durable naming cutovers.
- Historical changelog and roadmap entries still mention older phase labels as
  release history.
- Runtime classification integration remains separate follow-up work.

## Final Recommendation Stack

- Architecture record: `docs/architecture/policy-evidence-engine.md`
- Server module: `server/src/services/policyEvidenceEngine.mjs`
- Focused tests: `server/src/__tests__/services/policyEvidenceEngine.test.mjs`
- Quality module: `server/src/services/policyEvidenceQuality.mjs`
- Boundary module: `server/src/services/policyEvidenceBoundary.mjs`
- Regression guard: `server/src/services/policyProductionNamingRegressionAudit.mjs`

## Outcome

The active policy evidence engine architecture record now uses
`docs/architecture/policy-evidence-engine.md`, the roadmap points to the durable
artifact, and the implementation continues to expose the existing
`policy.evidence.v1`, `policy.evidence.summary.v1`, and generated quality
contracts unchanged.

## Next Step

Cut over the policy evidence input gate and boundary architecture records so
the complete evidence-engine handoff is described by durable product-domain
documents before policy intent engine work resumes.
