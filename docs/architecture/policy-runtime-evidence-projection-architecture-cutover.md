# Policy Runtime Evidence Projection Architecture Cutover

## Status

Implemented on July 4, 2026 as part of production architecture naming
stabilization. This document records the cutover from a roadmap-phase active
design record to the durable policy runtime evidence projection contract.

## Goal

Runtime evidence projection is the server-owned boundary that maps current
classification inputs into policy evidence buckets before automation decisions
can act. The implementation already used durable module names; this cutover
removes the remaining active design-record dependency on phase-coded naming and
aligns roadmap references with the product contract.

## Official Guidance Reviewed

- [NIST SP 800-218, Secure Software Development Framework](https://csrc.nist.gov/pubs/sp/800/218/final)
  recommends integrating secure development practices into the SDLC. This
  cutover keeps the evidence boundary documented, test-backed, and verified
  before runtime behavior changes.
- [NIST AI Risk Management Framework](https://www.nist.gov/itl/ai-risk-management-framework)
  frames AI risk work around mapping, measuring, and managing system behavior.
  This cutover keeps AI, RAG, metadata, and history as measured evidence rather
  than destination authority.
- [OWASP Application Security Verification Standard](https://owasp.org/www-project-application-security-verification-standard/)
  provides a basis for testing application security controls. This cutover
  preserves server-side validation for source, authority, raw-payload,
  live-lookup, and UI-language leakage rules.
- [OpenTelemetry Trace Semantic Conventions](https://opentelemetry.io/docs/specs/semconv/general/trace/)
  define common trace attributes for operation diagnostics. This cutover keeps
  runtime evidence trace data bounded to stable reason codes, counts, and
  fingerprints.

## Recommendations

1. **Use durable policy-runtime naming.** The active design record should be
   `policy-runtime-evidence-projection.md`; roadmap-phase names should remain
   only as historical roadmap sequence labels.
2. **Keep evidence projection deterministic.** Runtime evidence must project
   existing inputs only; it must not classify, route, call providers, persist
   learning, or mutate native intent state.
3. **Demote weak evidence explicitly.** Unknown-library neighbors, low-trust
   RAG, stale profiles, failed routing, raw payloads, and unsupported broad
   genre overlap should remain visible with bounded demotion reason codes.
4. **Preserve sanitized provenance.** Automation handoff should carry a stable
   projection fingerprint and bounded provenance, not raw provider payloads,
   prompts, URLs, or UI chip language.
5. **Separate classification success from routing proof.** A completed
   classification is not proof that routing succeeded; routing evidence remains
   its own evidence bucket.

## Pros And Cons

Pros:

- Removes active production architecture dependence on roadmap-phase wording.
- Keeps the runtime evidence projection contract stable for automation and
  question-reduction consumers.
- Preserves the existing side-effect-free runtime service and audit tests.
- Makes weak or untrusted evidence explainable without allowing it to become
  destination authority.

Cons:

- This cutover does not yet wire projection into additional runtime paths.
- Historical roadmap and changelog records still contain phase-coded sequence
  labels by design.
- Downstream active architecture records need their own cutover passes before
  the runtime chain is fully product-named.

## Final Recommendation Stack

- Runtime projection service:
  `server/src/services/policyRuntimeEvidenceProjection.mjs`
- Runtime fingerprint service:
  `server/src/services/policyRuntimeEvidenceFingerprint.mjs`
- Focused tests:
  `server/src/__tests__/services/policyRuntimeEvidenceProjection.test.mjs`
- Active design record:
  `docs/architecture/policy-runtime-evidence-projection.md`
- Historical module cutover record:
  `docs/architecture/policy-runtime-evidence-projection-module-cutover.md`
- Roadmap:
  `docs/architecture/policy-builder-intent-model-roadmap.md`
- Production naming inventory:
  `scripts/generate-policy-builder-production-name-inventory.mjs`

## Implementation Outcome

- Renamed the active runtime evidence projection design record to
  `policy-runtime-evidence-projection.md`.
- Updated the active design record to describe the durable policy runtime
  evidence projection contract rather than a phase-local implementation slice.
- Updated the roadmap implementation status and module-cutover references to
  point at the durable design record.
- Preserved the existing `policyRuntimeEvidenceProjection.mjs` and
  `policyRuntimeEvidenceFingerprint.mjs` behavior.

## Security Outcome

- Projection remains deterministic and side-effect-free.
- No live provider lookup is performed.
- Raw provider payloads remain suppressed.
- Fingerprint provenance remains sanitized and label-free.
- AI, RAG, metadata, and history remain evidence sources, not durable
  destination authority.

## Next Step

Automation Decision Contract Architecture Cutover should rename the active
automation-decision design record to durable product-domain wording and keep
the runtime decision handoff bound to the sanitized evidence projection
fingerprint.
