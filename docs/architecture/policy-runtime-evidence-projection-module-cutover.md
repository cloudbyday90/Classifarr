# Policy Runtime Evidence Projection Module Cutover

## Status

Implemented on July 3, 2026 as part of the production naming stabilization
work. This document records the Phase 7R.2 runtime evidence projection cutover
from roadmap-phase implementation names to durable product-domain module names.

## Goal

Runtime evidence projection is the server-owned contract that turns library
profile, operator intent, history, RAG, metadata, routing, and profile freshness
signals into bounded policy evidence buckets. The implementation already had the
right behavioral shape; the production concern was that the module, exports,
fingerprint helper, contract version, and audit handoff still exposed roadmap
phase names.

This cutover keeps behavior side-effect-free while removing those names from
the production runtime evidence boundary.

## Official Guidance Reviewed

- [NIST SP 800-218, Secure Software Development Framework](https://csrc.nist.gov/pubs/sp/800/218/final)
  recommends integrating secure development practices into the SDLC. This slice
  keeps the rename test-backed and updates the regression inventory so naming
  drift remains measurable.
- [OWASP ASVS](https://owasp.org/www-project-application-security-verification-standard/)
  provides a basis for testing web application security controls. This slice
  keeps server-side validation of evidence source, authority, raw-payload, live
  lookup, and UI-language leakage rules.
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
  warns that log and event data can expose sensitive application details. This
  slice keeps runtime evidence fingerprints label-free and bounded.
- [OpenTelemetry Semantic Conventions](https://opentelemetry.io/docs/concepts/semantic-conventions/)
  recommends common names for operations and data. This slice moves runtime
  evidence versions and exports to product terms.
- [OpenTelemetry Semantic Convention Naming](https://opentelemetry.io/docs/specs/semconv/general/naming/)
  cautions against name reuse ambiguity. This slice uses distinct
  `policy.runtime_evidence_*` names for projection and fingerprint artifacts.

## Recommendations

1. **Use product-domain module names.** Runtime evidence projection should live
   under `policyRuntimeEvidenceProjection.mjs`, with fingerprint logic in
   `policyRuntimeEvidenceFingerprint.mjs`.
2. **Keep the projection contract durable.** The runtime projection version is
   `policy.runtime_evidence_projection.v1`; the fingerprint version is
   `policy.runtime_evidence_fingerprint.v1`.
3. **Use policy evidence terminology.** The runtime projection consumes the
   product evidence model through `evidenceVersion`, not a roadmap-phase
   evidence version field.
4. **Keep local handoffs semantic.** The projection audit now returns
   `nextStep.stepId = automation_decision_contract`; the runtime completion audit validates that semantic step directly.
5. **Preserve security boundaries.** The projection remains deterministic,
   side-effect-free, raw-payload-free, live-lookup-free, and label-free in
   fingerprint provenance.

## Pros And Cons

Pros:

- Removes production references to phase-coded runtime evidence projection and
  fingerprint modules.
- Gives downstream runtime contracts stable product imports.
- Keeps completion-audit compatibility through a small semantic adapter.
- Lowers production naming inventory counts without changing classification
  behavior.

Cons:

- Downstream Phase 7R modules still have their own phase-coded names until
  their dedicated cutover slices.
- Fingerprint consumers needed a small provenance key rename from
  `phase6EvidenceVersion` to `evidenceVersion`.

## Final Recommendation Stack

- Projection service: `server/src/services/policyRuntimeEvidenceProjection.mjs`
- Fingerprint service: `server/src/services/policyRuntimeEvidenceFingerprint.mjs`
- Focused tests:
  `server/src/__tests__/services/policyRuntimeEvidenceProjection.test.mjs`
- Completion adapter:
  `server/src/services/policyRuntimeCompletionAudit.mjs`
- Runtime inventory:
  `server/src/services/policyRuntimeDecisionInventory.mjs`
- Regression guard:
  `server/src/services/policyProductionNamingRegressionAudit.mjs`

## Implementation Outcome

- Renamed the runtime evidence projection and fingerprint modules to durable
  product-domain names.
- Renamed public projection exports to `POLICY_RUNTIME_EVIDENCE_*` and
  `buildPolicyRuntimeEvidence*`.
- Updated the projection contract versions to
  `policy.runtime_evidence_projection.v1` and
  `policy.runtime_evidence_fingerprint.v1`.
- Replaced `phase6EvidenceVersion` provenance with `evidenceVersion`.
- Replaced the projection audit's local `nextPhase` handoff with `nextStep`.
- Updated automation decision, runtime question reduction, runtime decision
  inventory, rebuild-test reset, and completion-audit consumers.

## Security Outcome

- Projection and fingerprint generation remain deterministic and side-effect
  free.
- Raw provider payloads, live lookups, and UI wording remain rejected by the
  projection audit.
- Fingerprint provenance remains bounded to counts, source IDs, authority IDs,
  demotion reasons, and bucket counts, without raw evidence labels.
- Completion-audit compatibility is handled by a semantic next-step adapter
  rather than preserving phase-coded production names.
