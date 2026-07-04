# Policy Learning Quality Gate Architecture Cutover

Status: implemented as an architecture naming cutover.

## Scope

This cutover renames the active learning quality-gate architecture record from
roadmap-phase language to durable policy-learning language. It does not change
the existing enforcement in `policyLearningGuard.mjs`; the quality gate remains
the server-side check that blocks learning eligibility when bounded intent or
its embedded intent draft lacks matching, usable evidence quality.

## Official Guidance Reviewed

- [NIST AI Risk Management Framework](https://www.nist.gov/itl/ai-risk-management-framework)
  emphasizes governed, measured, and managed AI behavior. The learning quality
  gate treats durable generalization as managed risk, not as a side effect of a
  single answer.
- [NIST AI 600-1 Generative AI Profile](https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf)
  highlights data quality, provenance, and stakeholder feedback. The learning
  gate requires quality evidence that is tied to the bounded intent handoff.
- [OWASP Application Security Verification Standard](https://owasp.org/www-project-application-security-verification-standard/)
  provides a verification baseline for business-logic and workflow-state
  controls. The learning gate validates workflow state before any learning
  candidate can be write-eligible.
- [OWASP Business Logic Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Business_Logic_Security_Cheat_Sheet.html)
  frames business-logic flaws as workflow mismatches. The quality gate prevents
  callers from skipping bounded intent quality before learning.
- [OpenTelemetry semantic convention naming](https://opentelemetry.io/docs/specs/semconv/general/naming/)
  favors stable semantic names. The learning boundary carries stable quality
  status, next-action, reason IDs, counts, and fingerprints.

## Recommendations

1. Keep the active architecture file named `policy-learning-quality-gate.md`.
2. Keep learning quality enforcement inside `policyLearningGuard.mjs`; do not
   introduce a separate runtime path that can learn from raw intent or raw
   evidence projections.
3. Require successful bounded intent, passing fingerprint audit, matching
   wrapper-versus-intent evidence fingerprints, and matching usable quality
   snapshots before learning candidate evaluation.
4. Return a blocked learning boundary when evidence quality is missing,
   insufficient, or mismatched.
5. Keep quality snapshots label-free: status IDs, next-action IDs, reason IDs,
   counts, scores, booleans, and fingerprints only.
6. Keep phase-coded references only as historical changelog or migration
   traceability, not as active architecture entry points.

## Pros And Cons

Pros:

- Removes the active phase-coded learning quality-gate architecture filename.
- Aligns learning eligibility docs with the durable `policy.learning_guard.v1`
  contract.
- Preserves existing server-side blocking behavior and focused tests.
- Makes automation readiness consume a stable policy-learning quality handoff.

Cons:

- Historical changelog and older design records still mention roadmap phases for
  traceability.
- Readiness, workflow, migration, and runtime quality-gate records still need
  their own durable naming cutovers.
- Conservative quality gating can block learning until identity evidence or
  operator confirmation exists.

## Final Stack

- Active architecture:
  `docs/architecture/policy-learning-quality-gate.md`
- Cutover record:
  `docs/architecture/policy-learning-quality-gate-architecture-cutover.md`
- Learning guard:
  `server/src/services/policyLearningGuard.mjs`
- Intent source:
  `server/src/services/policyIntentEngine.mjs`
- Evidence quality source:
  `server/src/services/policyEvidenceQuality.mjs`
- Focused tests:
  `server/src/__tests__/services/policyLearningGuard.test.mjs`

## Outcome

The active learning quality-gate architecture record now uses durable
policy-learning language. Existing learning audit risks, bounded intent quality
snapshot checks, insufficient-quality blocking, mismatched-quality blocking, and
side-effect-free learning decisions remain unchanged.

## Next Step

Cut over the policy automation readiness architecture record so readiness
consumes policy evidence, intent, learning, routing, and freshness using durable
product-domain language.
