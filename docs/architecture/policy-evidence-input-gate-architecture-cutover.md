# Policy Evidence Input Gate Architecture Cutover

Status: implemented as an architecture naming cutover.

## Scope

This cutover renames the active input-gate architecture record from
roadmap-phase language to durable policy-evidence language. It does not change
the existing server module, tests, or runtime behavior because those already use
durable names:

- `server/src/services/policyEvidenceInputGate.mjs`
- `server/src/__tests__/services/policyEvidenceInputGate.test.mjs`

The input gate remains the first server-side evidence boundary. It accepts only
known policy evidence sections, rejects unsafe payload classes, and returns
bounded diagnostics that do not echo raw provider or UI payload values.

## Official Guidance Reviewed

- [NIST AI Risk Management Framework](https://www.nist.gov/itl/ai-risk-management-framework)
  emphasizes governance, mapping, measurement, and management of AI risks. The
  input gate keeps evidence source authority explicit before downstream AI or
  automation components reason over it.
- [NIST Secure Software Development Framework](https://csrc.nist.gov/pubs/sp/800/218/final)
  supports traceable secure development practices. This cutover is narrow,
  documented, tested, and does not alter the validated input boundary behavior.
- [OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
  recommends allow-list validation for structured input. The policy evidence
  input envelope uses explicit section IDs instead of arbitrary top-level
  objects.
- [OWASP REST Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html)
  recommends validating type, range, format, and rejecting unexpected content.
  The gate rejects unknown sections and known unsafe markers before projection.
- [OWASP Application Security Verification Standard](https://owasp.org/www-project-application-security-verification-standard/)
  provides a verification baseline for secure server-side validation and
  business logic controls.
- [OpenTelemetry semantic convention naming](https://opentelemetry.io/docs/specs/semconv/general/naming/)
  favors stable semantic names. The input-gate contract stays on
  `policy.evidence.input_gate.v1`.

## Recommendations

1. Keep the active architecture file named `policy-evidence-input-gate.md`.
2. Keep phase-coded references only as historical changelog or migration
   traceability, not as active architecture entry points.
3. Preserve `policy.evidence.input_gate.v1` as the public contract version.
4. Keep diagnostics bounded to section, path, risk ID, and message; never copy
   raw evidence, provider responses, quota state, or UI labels into gate issues.
5. Treat new evidence sources as explicit contract changes requiring section
   vocabulary, evidence-source mapping, authority-source mapping, tests, and
   roadmap updates.

## Pros And Cons

Pros:

- Removes the active phase-coded input-gate architecture filename.
- Keeps production module and contract names aligned with the product domain.
- Preserves the validated security boundary without runtime churn.
- Makes the next boundary cutover smaller because the input gate now points to
  durable architecture language.

Cons:

- Historical changelog and older design records still mention roadmap phases for
  traceability.
- This does not yet rename downstream intent, readiness, learning, or storage
  architecture records.
- New evidence sections still require deliberate server-side contract work.

## Final Stack

- Active architecture:
  `docs/architecture/policy-evidence-input-gate.md`
- Cutover record:
  `docs/architecture/policy-evidence-input-gate-architecture-cutover.md`
- Module cutover record:
  `docs/architecture/policy-evidence-input-gate-module-cutover.md`
- Server gate:
  `server/src/services/policyEvidenceInputGate.mjs`
- Focused tests:
  `server/src/__tests__/services/policyEvidenceInputGate.test.mjs`
- Consuming boundary:
  `server/src/services/policyEvidenceBoundary.mjs`

## Outcome

The active input-gate architecture record now uses durable policy-evidence
language. The existing server module, test suite, contract version, allowed
section vocabulary, unsafe-marker rejection, and bounded issue reporting remain
unchanged.

## Next Step

Cut over the policy evidence boundary architecture record so the active
boundary design also uses durable product-domain language.
