# Policy Builder Phase 6R Intent Quality Gate

## Status

Implemented as a Phase 6R.2 hardening slice.

This document covers the bounded handoff between Phase 6R.1 evidence quality
and Phase 6R.2 intent inference. The goal is simple: intent can only be inferred
from a successful evidence boundary that includes a generated, label-free
quality assessment. If the evidence is insufficient, the system asks for better
identity evidence or operator confirmation instead of producing policy intent.

## Problem

The evidence engine can know that a destination has some signals without knowing
enough to infer destination meaning. For example, metadata-only genre evidence
or a fresh-but-empty profile can be useful diagnostic context, but it should not
become a policy intent draft.

Phase 6R.2 therefore needs a server-owned quality gate that:

- consumes Phase 6R.1 quality instead of recalculating ad hoc confidence,
- blocks insufficient evidence before intent generation,
- keeps only sanitized quality IDs and counts in the intent boundary, and
- rejects bounded intent drafts that drop the quality snapshot.

## Official Guidance Reviewed

- [NIST AI Risk Management Framework](https://www.nist.gov/itl/ai-risk-management-framework)
  emphasizes governed, measured, and managed AI system behavior. The quality
  gate makes the handoff explicit and auditable instead of letting weak evidence
  become hidden automation state.
- [NIST AI Trustworthiness Characteristics](https://airc.nist.gov/airmf-resources/airmf/3-sec-characteristics/)
  describe reliability, validity, safety, security, accountability, and
  transparency as cross-cutting characteristics. Phase 6R.2 applies those
  characteristics by carrying stable quality reason IDs and refusing
  insufficient evidence handoffs.
- [OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
  recommends validating inputs against allowlisted structure and semantics. The
  intent boundary validates that generated quality exists and is not
  insufficient before accepting bounded evidence.
- [OWASP REST Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html)
  reinforces server-side workflow-state validation. The quality gate treats
  evidence boundary success and evidence quality as required workflow state.
- [OpenTelemetry Semantic Conventions](https://opentelemetry.io/docs/specs/semconv/)
  recommend stable semantic identifiers for correlation. The boundary keeps
  quality status, action, reason IDs, counts, and projection fingerprint data
  without raw evidence labels.

## Recommendations

1. **Require generated quality for bounded intent.**
   Runtime and rebuild callers must use
   `buildPolicyBuilderPhase6IntentDraftFromBoundedEvidence`, which now requires
   a successful Phase 6R.1 result, matching projection fingerprint, and generated
   quality object.

2. **Block insufficient quality before inference.**
   When Phase 6R.1 returns `insufficient`, Phase 6R.2 returns
   `blocked_by_evidence_quality` with reason IDs and next action. It does not
   produce an intent draft.

3. **Keep quality label-free.**
   The intent boundary carries quality IDs, counts, booleans, and scores only.
   It does not carry raw evidence labels, provider payloads, or UI chip text.

4. **Audit tampered bounded drafts.**
   If a bounded intent draft is later validated without a quality snapshot, or
   with insufficient quality, the intent audit rejects it.

5. **Leave direct draft reduction as a diagnostic helper.**
   The lower-level reducer can still build an intent-shaped diagnostic from a
   projection for unit tests and compatibility analysis, but new runtime
   consumers should use the bounded entry point.

## Pros And Cons

Pros:

- Prevents weak metadata or stale profile evidence from becoming destination
  intent.
- Keeps Phase 6R.1 evidence quality as the single source of truth for the
  Phase 6R.2 handoff.
- Gives downstream Phase 6R.3 Learning Guard a deterministic quality status and
  reason set.
- Preserves traceability without exposing raw labels or provider content.
- Makes tampering or partial boundary replay detectable by the intent audit.

Cons:

- More classifications will pause for identity confirmation until enough
  evidence exists.
- The first quality model is intentionally conservative and may need tuning
  after runtime learning signals mature.
- Existing diagnostic helpers still exist, so callers must choose the bounded
  entry point for production paths.

## Final Recommendation Stack

- Evidence quality source:
  `server/src/services/policyBuilderPhase6EvidenceQuality.mjs`
- Intent quality consumer:
  `server/src/services/policyBuilderPhase6IntentEngine.mjs`
- Focused tests:
  `server/src/__tests__/services/policyBuilderPhase6IntentEngine.test.mjs`
- Design owner:
  `docs/architecture/policy-builder-phase-6r-intent-engine.md`
- Roadmap owner:
  Phase 6R.2 in
  `docs/architecture/policy-builder-intent-model-roadmap.md`

## Implemented Outcome

- Added `blocked_by_evidence_quality` to the bounded intent status model.
- Added `missing_evidence_quality` and `insufficient_evidence_quality` audit
  risks.
- Added a sanitized `evidenceBoundary.quality` snapshot to bounded intent
  drafts.
- Blocked bounded intent generation when Phase 6R.1 quality is insufficient.
- Rejected bounded intent drafts that omit or downgrade the quality snapshot
  during audit validation.
- Added intent warnings for direct diagnostic drafts when evidence quality is
  insufficient.

## Security Outcome

- Quality state is generated server-side.
- Evidence labels and provider payloads do not cross the intent boundary.
- The intent boundary validates workflow state before inference.
- Insufficient evidence is handled as a review/action requirement, not as hidden
  policy meaning.

## Next Step

Proceed to **Phase 6R.3 Learning Guard** and require quality-gated bounded
intent before any manual outcome, Discord answer, confirmation, or routing
result can become durable learning.
