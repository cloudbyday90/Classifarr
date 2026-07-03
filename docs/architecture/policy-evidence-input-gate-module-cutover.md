# Policy Evidence Input Gate Module Cutover

Status: implemented as a Phase 9R.2 durable-domain module cutover.

## Problem

The evidence input gate is the first server-side boundary for policy evidence.
It rejects unknown sections, raw provider payloads, live lookup markers,
transient quota/cooldown state, UI diagnostic labels, and replay/impact payloads
before evidence projection runs. The module and exported contract still used
roadmap-phase names, so the newly durable `policyEvidenceBoundary.mjs` still had
to import phase-coded production code.

## Official Guidance Reviewed

- [NIST Secure Software Development Framework](https://csrc.nist.gov/projects/ssdf)
  supports traceable secure development changes. This cutover is narrow,
  documented, and validated by focused tests plus the naming inventory.
- [OWASP Application Security Verification Standard](https://owasp.org/www-project-application-security-verification-standard/)
  provides a verification baseline for server-side validation and business
  logic. The input gate continues to reject unsafe evidence payloads.
- [OpenTelemetry Semantic Conventions](https://opentelemetry.io/docs/concepts/semantic-conventions/)
  favor stable semantic names. The contract now uses policy-evidence vocabulary
  instead of a roadmap phase label.
- [W3C Cool URIs Don't Change](https://www.w3.org/Provider/Style/URI)
  reinforces durable identifiers. The input-gate contract is now
  `policy.evidence.input_gate.v1`.

## Recommendations

1. Rename the module to `policyEvidenceInputGate.mjs`.
2. Rename the focused test to `policyEvidenceInputGate.test.mjs`.
3. Replace exported phase-coded symbols with:
   `POLICY_EVIDENCE_INPUT_GATE_VERSION`,
   `POLICY_EVIDENCE_INPUT_SECTION_IDS`,
   `POLICY_EVIDENCE_INPUT_GATE_RISK_IDS`,
   `buildPolicyEvidenceInputGate`, `buildPolicyEvidenceInputGateAudit`,
   `getPolicyEvidenceInputSection`, `listPolicyEvidenceInputSections`, and
   `validatePolicyEvidenceInputSection`.
4. Move the contract version to `policy.evidence.input_gate.v1`.
5. Replace the input-gate audit's local `nextPhase` handoff with `nextStep`.
6. Leave evidence source IDs imported from the current projection engine until
   the projection engine receives its own durable module cutover.

## Pros And Cons

Pros:

- Removes another phase-coded production module from the evidence chain.
- Keeps the unsafe-payload guard behavior intact.
- Lets `policyEvidenceBoundary.mjs` depend on a durable input-gate module.
- Shrinks the measurable production naming backlog.

Cons:

- The input gate still depends on source IDs from the phase-coded projection
  engine until that engine is renamed.
- Phase 6R documentation remains as historical implementation traceability.
- Downstream Phase 6R services still contain their own phase-coded contracts and
  need separate cutovers.

## Final Recommendation Stack

- Evidence input gate:
  `server/src/services/policyEvidenceInputGate.mjs`
- Focused tests:
  `server/src/__tests__/services/policyEvidenceInputGate.test.mjs`
- Consuming boundary:
  `server/src/services/policyEvidenceBoundary.mjs`
- Current source-id dependency:
  `server/src/services/policyEvidenceEngine.mjs`
- Regression guard:
  `server/src/services/policyProductionNamingRegressionAudit.mjs`

## Outcome

The repository inventory validates after this design record is included with:

- total phase-coded references: 15,974,
- production references: 7,390,
- rename candidates: 7,412,
- obsolete migration tooling references: 93.

The production naming regression baseline now uses those production and rename
counts as maximums.

## Next Step

Continue Phase 9R.2 with the evidence projection engine cutover. That is the
remaining phase-coded evidence-chain dependency imported by
`policyEvidenceBoundary.mjs`.
