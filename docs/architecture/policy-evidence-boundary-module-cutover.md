# Policy Evidence Boundary Module Cutover

Status: implemented as a Phase 9R.2 durable-domain module cutover.

## Problem

The bounded evidence boundary is the entry point that adapts policy-builder
input, gates unsafe evidence, builds a sanitized evidence projection, attaches a
stable fingerprint, and returns the handoff consumed by intent inference. Its
old module name and exported symbols still encoded roadmap phase labels, and
the boundary-local handoff used `nextPhase` / `phaseId` even though downstream
runtime code did not consume that field.

## Official Guidance Reviewed

- [NIST Secure Software Development Framework](https://csrc.nist.gov/projects/ssdf)
  recommends secure development practices that are risk-based, traceable, and
  continuously improved. This cutover keeps behavior stable, records the
  design decision, and lowers the regression baseline only after inventory
  validation.
- [OWASP Application Security Verification Standard](https://owasp.org/www-project-application-security-verification-standard/)
  provides an application-security verification baseline. The boundary keeps
  server-side input gating and projection auditing intact while changing names.
- [OpenTelemetry Semantic Conventions](https://opentelemetry.io/docs/concepts/semantic-conventions/)
  favor stable semantic names for long-lived observability and diagnostics.
  The boundary now uses policy-evidence vocabulary instead of roadmap labels.
- [W3C Cool URIs Don't Change](https://www.w3.org/Provider/Style/URI)
  reinforces durable identifiers. The boundary contract is now
  `policy.evidence.boundary.v1`, and its local handoff is `nextStep`.

## Recommendations

1. Rename the boundary module to `policyEvidenceBoundary.mjs`.
2. Rename the focused test to `policyEvidenceBoundary.test.mjs`.
3. Replace boundary exports with product-domain symbols:
   `POLICY_EVIDENCE_BOUNDARY_VERSION`,
   `POLICY_EVIDENCE_BOUNDARY_STATUS_IDS`, `adaptPolicyEvidenceInput`, and
   `buildBoundedPolicyEvidenceProjection`.
4. Move the contract version to `policy.evidence.boundary.v1`.
5. Replace the boundary-local `nextPhase` object with `nextStep` because the
   boundary owns a product workflow handoff, not a roadmap planning handoff.
6. Leave the input gate and projection engine imports in place until their own
   durable module cutovers run.

## Pros And Cons

Pros:

- Removes a high-value phase-coded production module from the evidence chain.
- Makes the boundary contract readable without knowing the roadmap.
- Keeps the existing input-gate, projection, fingerprint, and side-effect
  behavior intact.
- Shrinks the measurable production naming backlog.

Cons:

- The boundary still imports phase-coded input-gate and projection-engine
  modules until those components are renamed.
- Existing Phase 6R docs retain historical labels for traceability.
- Downstream Phase 6R services still contain their own phase-coded contracts and
  need later cutovers.

## Final Recommendation Stack

- Evidence boundary:
  `server/src/services/policyEvidenceBoundary.mjs`
- Focused tests:
  `server/src/__tests__/services/policyEvidenceBoundary.test.mjs`
- Current dependencies:
  `server/src/services/policyEvidenceInputGate.mjs` and
  `server/src/services/policyBuilderPhase6EvidenceEngine.mjs`
- Downstream consumers:
  Phase 6R completion audit and intent/learning/readiness/operator/migration
  tests now import `buildBoundedPolicyEvidenceProjection`.
- Regression guard:
  `server/src/services/policyProductionNamingRegressionAudit.mjs`

## Outcome

The repository inventory validates after this design record is included with:

- total phase-coded references: 16,069,
- production references: 7,446,
- rename candidates: 7,468,
- obsolete migration tooling references: 93.

The production naming regression baseline now uses those production and rename
counts as maximums.

## Next Step

Continue Phase 9R.2 with the next evidence-chain dependency. The highest-value
target is the evidence projection engine because `policyEvidenceBoundary.mjs`
still imports that phase-coded module until it receives a durable name.
