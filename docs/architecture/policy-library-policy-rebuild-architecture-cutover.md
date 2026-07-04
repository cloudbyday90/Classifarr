# Policy Library-Derived Policy Rebuild Architecture Cutover

## Status

Implemented on July 4, 2026 as part of production architecture naming
stabilization. This document records the cutover from a roadmap-phase active
design record to the durable policy library-derived policy rebuild contract.

## Goal

Library-derived policy rebuild creates a side-effect-free proposal from observed
library profile evidence, guarded outcomes, explicit operator constraints,
routing configuration, outlier evidence, and profile freshness. The
implementation already used durable module names; this cutover removes the
remaining active design-record dependency on phase-coded naming and aligns the
roadmap with the product contract.

## Official Guidance Reviewed

- [NIST AI Risk Management Framework](https://www.nist.gov/itl/ai-risk-management-framework)
  organizes AI risk work around govern, map, measure, and manage functions.
  This cutover keeps proposal evidence mapped, readiness measured, and
  activation managed through explicit operator and rollback gates.
- [NIST AI RMF Generative AI Profile](https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf)
  helps organizations manage generative-AI risks across the AI lifecycle. This
  cutover preserves source summaries, assumptions, warnings, and bounded
  provenance instead of creating opaque replacement policies.
- [OWASP Top 10 for Large Language Model Applications](https://owasp.org/www-project-top-10-for-large-language-model-applications/)
  identifies excessive agency and overreliance risks. This cutover preserves
  the rule that rebuild proposals cannot activate, replace, delete, persist, or
  write policy directly.
- [Microsoft Guidelines for Human-AI Interaction](https://www.microsoft.com/en-us/haxtoolkit/ai-guidelines/)
  emphasize user control, uncertainty communication, and graceful recovery.
  This cutover keeps operator acceptance and rollback gates explicit before any
  later replacement path can apply a proposal.
- [OpenTelemetry Naming](https://opentelemetry.io/docs/specs/semconv/general/naming/)
  recommends precise, unambiguous, lower-case namespacing. This cutover
  preserves `policy.library_policy_rebuild.v1` and bounded
  `classifarr.policy.rebuild.*` trace naming.

## Recommendations

1. **Use durable library-rebuild naming.** The active design record should be
   `policy-library-policy-rebuild.md`; roadmap-phase names should remain only
   as historical sequencing labels.
2. **Keep proposals side-effect-free.** Rebuild can prepare reviewable intent
   but must not activate, replace, delete, persist, write learning, or route.
3. **Require guarded outcome proof.** Guarded outcomes should affect proposal
   evidence only when they carry sanitized upstream evidence fingerprints and
   valid request-time learning proof.
4. **Keep observed absence non-authoritative.** Missing examples should remain
   warnings, not automatic avoid or exclusion evidence.
5. **Preserve operator and rollback gates.** Explicit operator acceptance and a
   rollback snapshot should remain required before any later replacement path.

## Pros And Cons

Pros:

- Removes active production architecture dependence on roadmap-phase wording.
- Keeps library-derived rebuild constrained to a stable product contract.
- Preserves operator acceptance, rollback, routing readiness, source summaries,
  assumptions, and warnings.
- Keeps migration verifier inputs provenance-bound and reviewable.

Cons:

- This cutover does not make rebuild proposals executable.
- Historical roadmap and changelog records still contain phase-coded sequence
  labels by design.
- Downstream active architecture records need their own cutover passes before
  the runtime chain is fully product-named.

## Final Recommendation Stack

- Library-derived rebuild service:
  `server/src/services/policyLibraryPolicyRebuild.mjs`
- Focused tests:
  `server/src/__tests__/services/policyLibraryPolicyRebuild.test.mjs`
- Evidence dependency:
  `server/src/services/policyEvidenceEngine.mjs`
- Intent dependency:
  `server/src/services/policyIntentEngine.mjs`
- Readiness dependency:
  `server/src/services/policyAutomationReadinessEngine.mjs`
- Active design record:
  `docs/architecture/policy-library-policy-rebuild.md`
- Historical module cutover record:
  `docs/architecture/policy-library-policy-rebuild-module-cutover.md`
- Roadmap:
  `docs/architecture/policy-builder-intent-model-roadmap.md`
- Production naming inventory:
  `scripts/generate-policy-builder-production-name-inventory.mjs`

## Implementation Outcome

- Renamed the active library-derived policy rebuild design record to
  `policy-library-policy-rebuild.md`.
- Updated the active design record to describe the durable library-derived
  policy rebuild contract rather than a phase-local implementation slice.
- Updated roadmap implementation status and module-cutover references to point
  at the durable design record.
- Preserved the existing `policyLibraryPolicyRebuild.mjs` behavior, contract
  version, proposal statuses, trace shape, and validation gates.

## Security Outcome

- Proposal generation remains deterministic and side-effect-free.
- The proposal builder does not call providers, persist proposals, activate,
  replace, delete, write policies, write learning, or route media.
- Observed absence remains warning-only context.
- Guarded outcomes must carry valid request-time learning proof and sanitized
  upstream evidence fingerprints before influencing proposal evidence.
- Trace output remains bounded to reason codes, counts, and fingerprints rather
  than raw evidence, provider payloads, prompts, AI text, replay diagnostics, or
  item titles.

## Next Step

Migration Verifier And Rollback Architecture Cutover should rename the active
migration-verifier and rollback design record to durable product-domain wording
and keep verifier output bound to stable sample-set fingerprints and rollback
requirements.
