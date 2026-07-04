# Policy Evidence Quality Architecture Cutover

Status: implemented as an architecture naming cutover.

## Scope

This cutover renames the active evidence-quality architecture record from
roadmap-phase language to durable policy-evidence language. It does not change
the existing server module, tests, projection integration, or runtime behavior
because those already use durable names:

- `server/src/services/policyEvidenceQuality.mjs`
- `server/src/__tests__/services/policyEvidenceQuality.test.mjs`

The quality helper remains a deterministic, server-generated assessment derived
from the policy evidence projection. It reports compact status, reason IDs,
next-action IDs, counts, and boolean readiness flags without exposing raw
evidence labels, titles, provider payloads, quota state, prompts, or UI copy.

## Official Guidance Reviewed

- [NIST AI Risk Management Framework](https://www.nist.gov/itl/ai-risk-management-framework)
  emphasizes trustworthy AI risk management across govern, map, measure, and
  manage functions. The quality helper provides a bounded measurement layer
  before downstream intent and automation engines act on evidence.
- [NIST AI 600-1 Generative AI Profile](https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf)
  includes provenance and monitoring practices for generated or AI-assisted
  systems. Evidence quality stays tied to source-authorized projection state
  rather than model text or provider payloads.
- [OWASP Application Security Verification Standard](https://owasp.org/www-project-application-security-verification-standard/)
  provides a verification baseline for secure validation and business logic.
  Evidence quality blocks downstream workflows from treating missing identity
  or stale profile state as ready policy authority.
- [OpenTelemetry semantic convention naming](https://opentelemetry.io/docs/specs/semconv/general/naming/)
  favors stable semantic names. The quality contract remains
  `policy.evidence.quality.v1` with stable status, reason, and next-action IDs.

## Recommendations

1. Keep the active architecture file named `policy-evidence-quality.md`.
2. Keep `policy.evidence.quality.v1` as the quality contract version.
3. Generate quality from the evidence projection only; clients and AI outputs
   must not provide or override quality.
4. Keep quality compact and label-free: expose status IDs, reason IDs,
   next-action IDs, counts, scores, and booleans only.
5. Treat missing destination identity as insufficient evidence rather than
   inferring identity from metadata, compatibility, freshness, or routing alone.
6. Treat stale profile and insufficient buckets as review states that require
   refresh or evidence review before downstream automation.
7. Keep phase-coded references only as historical changelog or migration
   traceability, not as active architecture entry points.

## Pros And Cons

Pros:

- Removes the active phase-coded evidence-quality architecture filename.
- Aligns architecture language with the durable helper and contract.
- Preserves the tested deterministic quality assessment behavior.
- Gives downstream engine cutovers a stable, product-domain quality handoff.

Cons:

- Historical changelog and older design records still mention roadmap phases for
  traceability.
- Downstream intent, readiness, learning, workflow, and migration quality-gate
  records still need their own durable naming cutovers.
- Quality remains readiness guidance, not a final classification score.

## Final Stack

- Active architecture:
  `docs/architecture/policy-evidence-quality.md`
- Cutover record:
  `docs/architecture/policy-evidence-quality-architecture-cutover.md`
- Module cutover record:
  `docs/architecture/policy-evidence-quality-module-cutover.md`
- Quality helper:
  `server/src/services/policyEvidenceQuality.mjs`
- Projection integration:
  `server/src/services/policyEvidenceEngine.mjs`
- Focused tests:
  `server/src/__tests__/services/policyEvidenceQuality.test.mjs`
  and
  `server/src/__tests__/services/policyEvidenceEngine.test.mjs`

## Outcome

The active quality architecture record now uses durable policy-evidence
language. The existing server helper, focused tests, contract version, status
IDs, reason IDs, next-action IDs, projection audit validation, and label-leakage
guard remain unchanged.

## Next Step

Cut over the policy intent engine architecture record so downstream intent
generation consumes the durable policy evidence boundary and quality language
instead of roadmap-phase labels.
