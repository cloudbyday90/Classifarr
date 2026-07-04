# Policy Intent Quality Gate Architecture Cutover

Status: implemented as an architecture naming cutover.

## Scope

This cutover renames the active intent quality-gate architecture record from
roadmap-phase language to durable policy-intent language. It does not change the
existing enforcement in `policyIntentEngine.mjs`; the quality gate remains the
server-side check that blocks bounded intent generation when policy evidence
quality is missing or insufficient.

## Official Guidance Reviewed

- [NIST AI Risk Management Framework](https://www.nist.gov/itl/ai-risk-management-framework)
  emphasizes governed, measured, and managed AI system behavior. The quality
  gate makes weak evidence explicit before intent inference can proceed.
- [NIST AI 600-1 Generative AI Profile](https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf)
  highlights lifecycle risk management and provenance. The quality gate keeps
  intent inference tied to generated, source-authorized evidence quality rather
  than provider/model text.
- [OWASP Application Security Verification Standard](https://owasp.org/www-project-application-security-verification-standard/)
  provides a verification baseline for server-side validation and business
  logic. The quality gate treats evidence quality as required workflow state.
- [OpenTelemetry semantic convention naming](https://opentelemetry.io/docs/specs/semconv/general/naming/)
  favors stable semantic names. The gate preserves durable status, reason,
  next-action, and correlation identifiers.

## Recommendations

1. Keep the active architecture file named `policy-intent-quality-gate.md`.
2. Keep quality enforcement inside `policyIntentEngine.mjs`; do not introduce a
   separate runtime path that can infer intent from raw projections.
3. Require successful policy evidence boundary, matching fingerprint audit, and
   generated policy evidence quality before bounded intent inference.
4. Return `blocked_by_evidence_quality` when quality is missing or
   insufficient, with stable reason IDs and next-action IDs.
5. Keep the carried quality snapshot sanitized: IDs, scores, counts, and
   booleans only.
6. Keep phase-coded references only as historical changelog or migration
   traceability, not as active architecture entry points.

## Pros And Cons

Pros:

- Removes the active phase-coded intent quality-gate architecture filename.
- Aligns the quality gate with the durable `policy.intent.v1` contract.
- Preserves the existing server-side blocking behavior and focused tests.
- Gives the learning guard a stable, product-domain quality handoff.

Cons:

- Historical changelog and older design records still mention roadmap phases for
  traceability.
- Learning, readiness, workflow, migration, and runtime quality-gate records
  still need their own durable naming cutovers.
- Conservative quality gating can pause more drafts until identity evidence or
  operator confirmation exists.

## Final Stack

- Active architecture:
  `docs/architecture/policy-intent-quality-gate.md`
- Cutover record:
  `docs/architecture/policy-intent-quality-gate-architecture-cutover.md`
- Intent engine:
  `server/src/services/policyIntentEngine.mjs`
- Evidence quality source:
  `server/src/services/policyEvidenceQuality.mjs`
- Evidence boundary source:
  `server/src/services/policyEvidenceBoundary.mjs`
- Focused tests:
  `server/src/__tests__/services/policyIntentEngine.test.mjs`

## Outcome

The active intent quality-gate architecture record now uses durable
policy-intent language. Existing bounded intent status IDs, quality snapshot,
missing-quality audit risk, insufficient-quality audit risk, and
`blocked_by_evidence_quality` behavior remain unchanged.

## Next Step

Cut over the policy learning guard architecture record so learning eligibility
uses durable product-domain language after the intent quality gate.
