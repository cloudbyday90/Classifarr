# Policy Intent Engine Architecture Cutover

Status: implemented as an architecture naming cutover.

## Scope

This cutover renames the active intent-engine architecture record from
roadmap-phase language to durable policy-intent language. It does not change the
existing server module, focused tests, or runtime behavior because those already
use durable names:

- `server/src/services/policyIntentEngine.mjs`
- `server/src/__tests__/services/policyIntentEngine.test.mjs`

The intent engine remains a side-effect-free proposal engine. It consumes a
successful policy evidence boundary result, verifies the evidence fingerprint
and evidence quality snapshot, then produces a bounded `policy.intent.v1` draft
with `nextStep` pointing at learning eligibility.

## Official Guidance Reviewed

- [NIST AI Risk Management Framework](https://www.nist.gov/itl/ai-risk-management-framework)
  emphasizes valid, reliable, accountable, transparent, explainable, and
  privacy-enhanced AI risk management. The intent engine keeps assumptions,
  warnings, confidence reason codes, and evidence provenance explicit.
- [NIST AI 600-1 Generative AI Profile](https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf)
  frames generative AI risks across lifecycle governance and provenance. The
  intent engine keeps model and provider output outside durable policy
  authority and requires deterministic evidence validation.
- [OWASP LLM01:2025 Prompt Injection](https://genai.owasp.org/llmrisk/llm01-prompt-injection/)
  describes prompt injection as untrusted inputs altering model behavior. The
  intent engine treats AI/provider content as evidence data only after
  deterministic server gates have bounded it.
- [OWASP Application Security Verification Standard](https://owasp.org/www-project-application-security-verification-standard/)
  provides a verification baseline for server-side validation and business
  logic. The intent engine is server-owned, auditable, and side-effect-free.
- [OpenTelemetry semantic convention naming](https://opentelemetry.io/docs/specs/semconv/general/naming/)
  favors stable semantic names. The intent contract remains `policy.intent.v1`
  and carries sanitized evidence correlation details.

## Recommendations

1. Keep the active architecture file named `policy-intent-engine.md`.
2. Keep `policy.intent.v1` as the intent draft contract.
3. Keep bounded intent generation side-effect-free: it may infer intent, but it
   must not write storage, learning, routing, provider state, or classification
   outcomes.
4. Require successful policy evidence boundary, fingerprint audit, and usable
   evidence quality before producing bounded intent.
5. Keep hard limits and avoid rules operator-owned; inferred or metadata-derived
   evidence can suggest, but cannot become durable blocking authority.
6. Keep phase-coded references only as historical changelog or migration
   traceability, not as active architecture entry points.

## Pros And Cons

Pros:

- Removes the active phase-coded intent-engine architecture filename.
- Aligns architecture language with the durable `policyIntentEngine.mjs`
  contract.
- Preserves bounded evidence, quality, fingerprint, and no-side-effect guards.
- Gives learning, readiness, workflow, and migration cutovers a stable
  policy-intent handoff.

Cons:

- Historical changelog and older design records still mention roadmap phases for
  traceability.
- Downstream learning, readiness, workflow, migration, and runtime architecture
  records still need their own durable naming cutovers.
- The direct draft reducer remains available for unit-level compatibility and
  must not become a runtime boundary.

## Final Stack

- Active architecture:
  `docs/architecture/policy-intent-engine.md`
- Cutover record:
  `docs/architecture/policy-intent-engine-architecture-cutover.md`
- Module cutover record:
  `docs/architecture/policy-intent-engine-module-cutover.md`
- Intent engine:
  `server/src/services/policyIntentEngine.mjs`
- Evidence boundary:
  `server/src/services/policyEvidenceBoundary.mjs`
- Evidence quality:
  `server/src/services/policyEvidenceQuality.mjs`
- Focused tests:
  `server/src/__tests__/services/policyIntentEngine.test.mjs`

## Outcome

The active intent-engine architecture record now uses durable policy-intent
language. The existing server module, focused tests, contract version, bounded
status IDs, evidence quality gate, fingerprint audit, durable-authority audit,
and `nextStep` handoff remain unchanged.

## Next Step

Cut over the policy intent quality-gate architecture record so the bounded
handoff between policy evidence quality and intent generation uses durable
product-domain language.
