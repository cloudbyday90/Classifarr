# Policy Evidence Quality Module Cutover

## Status

Implemented as a narrow Phase 9R.2 durable-domain module cutover batch.

## Problem

The evidence quality helper was implemented during the re-imagined engine work
with roadmap-phase naming in the production module, exports, and contract
version. That naming was useful while the component was being built, but it is
not a durable product-domain name.

This cutover moves the helper to durable evidence-quality language while
preserving behavior.

## Official Guidance Reviewed

- [NIST Secure Software Development Framework](https://csrc.nist.gov/projects/ssdf)
  supports traceable, risk-based secure development and secure change control.
  This cutover is mechanical, tested, and backed by naming inventory evidence.
- [OWASP Application Security Verification Standard](https://owasp.org/www-project-application-security-verification-standard/)
  provides a verification basis for application behavior and controls. The
  rename keeps the existing server-side quality gate behavior intact.
- [OpenTelemetry Semantic Conventions](https://opentelemetry.io/docs/concepts/semantic-conventions/)
  encourage stable semantic names. The quality contract version now uses
  product-domain naming.
- [W3C Cool URIs Don't Change](https://www.w3.org/Provider/Style/URI)
  reinforces that durable identifiers should avoid temporary project labels.

## Recommendation

Rename the evidence quality helper from roadmap-phase naming to product-domain
language:

- `policyBuilderPhase6EvidenceQuality.mjs` -> `policyEvidenceQuality.mjs`
- `policyBuilderPhase6EvidenceQuality.test.mjs` ->
  `policyEvidenceQuality.test.mjs`
- `PHASE6R_EVIDENCE_QUALITY_*` -> `POLICY_EVIDENCE_QUALITY_*`
- `buildPolicyBuilderPhase6EvidenceQualityAssessment` ->
  `buildPolicyEvidenceQualityAssessment`
- `validatePolicyBuilderPhase6EvidenceQualityAssessment` ->
  `validatePolicyEvidenceQualityAssessment`
- `phase6r.evidence.quality.v1` -> `policy.evidence.quality.v1`

No compatibility adapter is needed because the helper is an internal server
module and no persisted storage migration depends on the old module path.

## Pros And Cons

Pros:

- Reduces phase-coded production references.
- Makes downstream quality imports product-domain oriented.
- Avoids adding a temporary adapter that would become cleanup work later.
- Keeps behavior covered by the existing Phase 6R quality-gate tests.

Cons:

- Touches several Phase 6R services that import the quality constants.
- Historical docs and tests still mention Phase 6R as migration evidence.
- The rest of the Phase 6R engine modules still need later durable-name
  cutover batches.

## Final Recommendation Stack

- Durable module:
  `server/src/services/policyEvidenceQuality.mjs`
- Focused tests:
  `server/src/__tests__/services/policyEvidenceQuality.test.mjs`
- Regression guard:
  `server/src/services/policyProductionNamingRegressionAudit.mjs`
- Inventory source:
  `scripts/generate-policy-builder-production-name-inventory.mjs`

## Outcome

The repository naming inventory now reports:

- production references: `7514`
- rename candidates: `7536`
- obsolete migration tooling references: `93`

The production naming regression baseline was lowered to those values, so future
changes cannot reintroduce this removed naming debt without an explicit
baseline update.

## Next Step

Continue Phase 9R.2 with another narrow durable-domain module cutover. The next
candidate should be a similarly isolated helper or boundary module where no
public or persisted compatibility adapter is required.
