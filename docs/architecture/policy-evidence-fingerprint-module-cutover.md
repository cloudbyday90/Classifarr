# Policy Evidence Fingerprint Module Cutover

Status: implemented as a Phase 9R.2 durable-domain module cutover.

## Problem

The bounded evidence chain already used a sanitized SHA-256 fingerprint to prove
that downstream intent and learning engines consumed the same evidence
projection. The helper still used a roadmap-phase module name and artifact
version, which kept temporary implementation language inside production code.

## Official Guidance Reviewed

- [NIST Secure Software Development Framework](https://csrc.nist.gov/projects/ssdf)
  supports traceable, reviewable secure software changes. The cutover keeps the
  rename mechanical, records inventory counts, and relies on focused regression
  tests before lowering the naming baseline.
- [OWASP Application Security Verification Standard](https://owasp.org/www-project-application-security-verification-standard/)
  reinforces server-side validation and business-logic integrity. The
  fingerprint validator continues rejecting missing, malformed, mismatched, or
  provenance-drifted evidence handoffs.
- [OpenTelemetry Semantic Conventions](https://opentelemetry.io/docs/concepts/semantic-conventions/)
  favor stable semantic names. The durable helper and artifact version describe
  policy evidence rather than a roadmap phase.
- [W3C Cool URIs Don't Change](https://www.w3.org/Provider/Style/URI)
  argues for persistent identifiers. The artifact contract now uses
  `policy.evidence.fingerprint.v1` so current integrations do not inherit
  temporary phase labels.

## Recommendations

1. Rename the helper from a phase-coded module to
   `policyEvidenceFingerprint.mjs`.
2. Rename the focused test with the same durable product-domain vocabulary.
3. Move the fingerprint artifact version to `policy.evidence.fingerprint.v1`.
4. Preserve the existing SHA-256 digest, trace-attribute, and provenance
   validation behavior.
5. Lower the production naming regression baseline only after the inventory
   proves the rename reduced phase-coded production references.

## Pros And Cons

Pros:

- Removes another phase-coded production module from the evidence chain.
- Keeps evidence fingerprint validation behavior stable.
- Gives downstream engines a durable artifact contract.
- Shrinks the measurable Phase 9R production naming backlog.

Cons:

- Upstream Phase 6R projection contracts still contain phase-coded versions and
  need later durable-name cutovers.
- Docs retain historical phase labels for roadmap traceability.
- The rename requires import updates across the evidence boundary and intent
  engine.

## Final Recommendation Stack

- Evidence fingerprint helper:
  `server/src/services/policyEvidenceFingerprint.mjs`
- Focused tests:
  `server/src/__tests__/services/policyEvidenceFingerprint.test.mjs`
- Consuming boundary:
  `server/src/services/policyEvidenceBoundary.mjs`
- Consuming intent engine:
  `server/src/services/policyBuilderPhase6IntentEngine.mjs`
- Regression guard:
  `server/src/services/policyProductionNamingRegressionAudit.mjs`

## Outcome

The repository inventory validates after this design record is included with:

- total phase-coded references: 16,129,
- production references: 7,470,
- rename candidates: 7,492,
- obsolete migration tooling references: 93.

The production naming regression baseline now uses those counts as maximums.

## Next Step

Continue Phase 9R.2 with the next narrow durable-domain module cutover. The
highest-value target is the Phase 6R evidence boundary itself because it is the
entry point that composes the input gate, evidence projection, fingerprint, and
quality handoff.
