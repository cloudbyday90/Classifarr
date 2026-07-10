# Policy Evidence Quality Module Cutover

## Status

Implemented as a narrow durable-domain module cutover batch.

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
- Keeps behavior covered by the existing evidence quality and downstream
  quality-gate tests.

Cons:

- Touches several downstream services that import the quality constants.
- Historical docs and tests still mention roadmap phases as migration evidence.
- Remaining downstream engine architecture records still need later durable-name
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

The evidence quality helper now uses durable product-domain names:

- `server/src/services/policyEvidenceQuality.mjs`
- `server/src/__tests__/services/policyEvidenceQuality.test.mjs`
- `POLICY_EVIDENCE_QUALITY_*`
- `buildPolicyEvidenceQualityAssessment`
- `validatePolicyEvidenceQualityAssessment`
- `policy.evidence.quality.v1`

Follow-up validation confirmed the active evidence-quality module, focused
test, active architecture record, architecture cutover record, and module
cutover record no longer contain roadmap-phase tokens. Repository-wide
production naming inventory remains valid, so future changes cannot reintroduce
phase-coded production naming debt without an explicit baseline update.

## Next Step

Continue with the policy evidence quality architecture cutover so the active
design record uses the same durable vocabulary as the module and tests.
