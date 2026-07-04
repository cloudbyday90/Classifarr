# Policy Learning Guard Architecture Cutover

Status: implemented as an architecture naming cutover.

## Scope

This cutover renames the active learning-guard architecture record from
roadmap-phase language to durable policy-learning language. It also removes one
production-facing runtime audit message that still referred to the learning
guard by roadmap phase.

The existing server guard, focused tests, and contract remain durable:

- `server/src/services/policyLearningGuard.mjs`
- `server/src/__tests__/services/policyLearningGuard.test.mjs`
- `policy.learning_guard.v1`

## Official Guidance Reviewed

- [NIST AI Risk Management Framework](https://www.nist.gov/itl/ai-risk-management-framework)
  emphasizes governed, measured, and managed AI behavior. The learning guard
  keeps generalization explicit, reason-coded, and auditable.
- [NIST AI 600-1 Generative AI Profile](https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf)
  highlights provenance, data quality, and human oversight risks. The learning
  guard blocks AI explanation text and unbounded provider state from durable
  learning.
- [OWASP LLM06:2025 Excessive Agency](https://genai.owasp.org/llmrisk/llm06-sensitive-information-disclosure/)
  describes damaging actions from unexpected, ambiguous, or manipulated model
  output. The learning guard returns decisions only and performs no writes.
- [OWASP Application Security Verification Standard](https://owasp.org/www-project-application-security-verification-standard/)
  provides a verification baseline for server-side validation and business
  logic. The learning guard validates final outcomes, learning tiers, authority
  sources, and bounded intent context before allowing a learning candidate.
- [OpenTelemetry semantic convention naming](https://opentelemetry.io/docs/specs/semconv/general/naming/)
  favors stable semantic names. The guard keeps the durable
  `policy.learning_guard.v1` contract and `nextStep` handoff.

## Recommendations

1. Keep the active architecture file named `policy-learning-guard.md`.
2. Keep learning eligibility side-effect-free; the guard may approve a candidate
   but must not write policy, profile, routing, or learning storage.
3. Require quality-gated bounded intent and matching evidence fingerprint
   snapshots before evaluating durable learning candidates.
4. Keep final outcome and learning separate: resolving an item must not imply
   the system can generalize that outcome.
5. Keep hard-limit learning behind explicit policy edits.
6. Keep phase-coded references only as historical changelog or migration
   traceability, not as active architecture or production-facing messages.

## Pros And Cons

Pros:

- Removes the active phase-coded learning-guard architecture filename.
- Removes a production-facing request-time learning audit message that named the
  guard by roadmap phase.
- Aligns the architecture record with the durable `policy.learning_guard.v1`
  contract.
- Preserves the tested no-write learning eligibility boundary.

Cons:

- Historical changelog and older design records still mention roadmap phases for
  traceability.
- Learning quality-gate, readiness, workflow, migration, and runtime records
  still need their own durable naming cutovers.
- The guard remains conservative: more events may require operator review before
  becoming durable learning.

## Final Stack

- Active architecture:
  `docs/architecture/policy-learning-guard.md`
- Cutover record:
  `docs/architecture/policy-learning-guard-architecture-cutover.md`
- Module cutover record:
  `docs/architecture/policy-learning-guard-module-cutover.md`
- Learning guard:
  `server/src/services/policyLearningGuard.mjs`
- Request-time learning audit consumer:
  `server/src/services/policyRequestTimeLearning.mjs`
- Focused tests:
  `server/src/__tests__/services/policyLearningGuard.test.mjs`
  and
  `server/src/__tests__/services/policyRequestTimeLearning.test.mjs`

## Outcome

The active learning-guard architecture record now uses durable policy-learning
language. The request-time learning audit message now says “policy learning
guard” instead of naming a roadmap phase. The existing server guard, contract
version, learning tiers, audit risks, bounded intent quality checks, fingerprint
checks, side-effect flags, and `nextStep` handoff remain unchanged.

## Next Step

Cut over the policy learning quality-gate architecture record so the handoff
between bounded intent quality and learning eligibility uses durable
product-domain language.
