# Policy Evidence Boundary Architecture Cutover

Status: implemented as an architecture naming cutover.

## Scope

This cutover renames the active evidence-boundary architecture record from
roadmap-phase language to durable policy-evidence language. It does not change
the existing server module, tests, or runtime behavior because those already use
durable names:

- `server/src/services/policyEvidenceBoundary.mjs`
- `server/src/__tests__/services/policyEvidenceBoundary.test.mjs`

The boundary remains the single server-owned entry point that runs the input
gate, adapts public evidence sections to projection inputs, builds the
projection, audits the projection, creates a sanitized projection fingerprint,
audits that fingerprint, and returns a bounded `nextStep` handoff.

## Official Guidance Reviewed

- [NIST AI Risk Management Framework](https://www.nist.gov/itl/ai-risk-management-framework)
  emphasizes governed, mapped, measured, and managed AI risk. The evidence
  boundary keeps policy evidence provenance and authority explicit before
  downstream AI or automation work consumes it.
- [NIST AI 600-1 Generative AI Profile](https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf)
  calls out content provenance and monitoring. The boundary returns sanitized
  provenance and fingerprints instead of raw provider or model payloads.
- [NIST Secure Software Development Framework](https://csrc.nist.gov/pubs/sp/800/218/final)
  supports traceable secure development practices. This cutover is narrow,
  documented, and validated without changing runtime behavior.
- [OWASP LLM01:2025 Prompt Injection](https://genai.owasp.org/llmrisk/llm01-prompt-injection/)
  treats untrusted model input as a primary LLM risk. The boundary treats AI,
  provider, and UI-derived content as data that must pass deterministic checks.
- [OWASP API4:2023 Unrestricted Resource Consumption](https://owasp.org/API-Security/editions/2023/en/0xa4-unrestricted-resource-consumption/)
  warns about missing limits for resource-consuming operations. The boundary
  performs no live provider calls, quota reads, writes, or background work.
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
  advises excluding sensitive or unnecessary data. The boundary returns risk
  IDs, bounded issue metadata, and sanitized fingerprints, not raw payloads.
- [OWASP Application Security Verification Standard](https://owasp.org/www-project-application-security-verification-standard/)
  provides a verification baseline for server-side validation and business
  logic controls.
- [OpenTelemetry semantic convention naming](https://opentelemetry.io/docs/specs/semconv/general/naming/)
  favors stable semantic names. The boundary preserves durable
  policy-evidence contract names and trace attribute names.
- [NCSC: Prompt injection is not SQL injection](https://www.ncsc.gov.uk/blog-post/prompt-injection-is-not-sql-injection)
  recommends treating LLMs as confusable privileged components. The boundary
  keeps authority in deterministic server code rather than prompt wording.

## Recommendations

1. Keep the active architecture file named `policy-evidence-boundary.md`.
2. Keep the public contract version at `policy.evidence.boundary.v1`.
3. Keep `buildBoundedPolicyEvidenceProjection` as the only supported handoff
   for downstream intent, readiness, learning, runtime, and rebuild work.
4. Preserve bounded diagnostics: status ID, issue count, side-effect flags,
   sanitized fingerprint, sanitized provenance, and `nextStep`.
5. Continue blocking boundary readiness when the input gate, projection audit,
   or fingerprint audit fails.
6. Keep phase-coded references only as historical changelog or migration
   traceability, not as active architecture entry points.

## Pros And Cons

Pros:

- Removes the active phase-coded evidence-boundary architecture filename.
- Aligns architecture language with the existing durable module and contract.
- Preserves the validated no-side-effect input/projection/fingerprint boundary.
- Makes downstream intent and readiness cutovers easier because the upstream
  evidence handoff is now named by product responsibility.

Cons:

- Historical changelog and older design records still mention roadmap phases
  for traceability.
- Downstream intent, readiness, learning, and storage architecture records still
  need their own durable naming cutovers.
- A fingerprint proves handoff equality, not semantic correctness; input and
  projection audits remain authoritative.

## Final Stack

- Active architecture:
  `docs/architecture/policy-evidence-boundary.md`
- Cutover record:
  `docs/architecture/policy-evidence-boundary-architecture-cutover.md`
- Module cutover record:
  `docs/architecture/policy-evidence-boundary-module-cutover.md`
- Boundary service:
  `server/src/services/policyEvidenceBoundary.mjs`
- Input gate:
  `server/src/services/policyEvidenceInputGate.mjs`
- Evidence engine:
  `server/src/services/policyEvidenceEngine.mjs`
- Fingerprint helper:
  `server/src/services/policyEvidenceFingerprint.mjs`
- Focused tests:
  `server/src/__tests__/services/policyEvidenceBoundary.test.mjs`

## Outcome

The active boundary architecture record now uses durable policy-evidence
language. The existing server module, focused tests, contract version, input
gate, projection audit, fingerprint audit, side-effect flags, and `nextStep`
handoff remain unchanged.

## Next Step

Cut over the policy evidence quality architecture record so the active quality
design also uses durable product-domain language before downstream intent
engine architecture cutovers continue.
