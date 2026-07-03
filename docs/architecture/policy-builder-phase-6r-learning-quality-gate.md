# Policy Builder Phase 6R Learning Quality Gate

## Status

Implemented as a Phase 6R.3 hardening slice.

This document covers the bounded handoff between Phase 6R.2 intent inference
and Phase 6R.3 learning eligibility. Learning can only be evaluated after the
bounded intent wrapper and embedded intent draft both carry matching, usable,
label-free evidence quality.

## Problem

Learning is more sensitive than intent projection because it generalizes a
decision into future behavior. A final outcome can be recorded from a manual
decision, but durable learning should not happen when the upstream evidence was
insufficient, missing, or tampered after intent generation.

Phase 6R.3 therefore needs to:

- require successful bounded intent,
- require a passing evidence-fingerprint audit,
- require matching wrapper-versus-intent evidence fingerprints,
- require matching wrapper-versus-intent evidence quality, and
- block insufficient quality before any learning candidate is evaluated.

## Official Guidance Reviewed

- [NIST AI Risk Management Framework](https://www.nist.gov/itl/ai-risk-management-framework)
  emphasizes governed, measured, and managed AI behavior. The learning gate
  treats generalization as a managed risk, not a side effect of a single answer.
- [NIST AI RMF Core](https://airc.nist.gov/airmf-resources/airmf/5-sec-core/)
  frames risk work around Govern, Map, Measure, and Manage functions. Phase
  6R.3 uses reason-coded boundary outcomes so learning decisions are measurable
  and auditable.
- [OWASP Top 10 for Large Language Model Applications](https://owasp.org/www-project-top-10-for-large-language-model-applications/)
  identifies insecure output handling and overreliance risks. The learning gate
  refuses to learn from unchecked or insufficient upstream intent state.
- [OWASP Application Security Verification Standard](https://owasp.org/www-project-application-security-verification-standard/)
  provides a basis for server-side business-logic validation. The learning
  boundary validates workflow state before producing a write-eligible candidate.
- [OpenTelemetry Semantic Conventions](https://opentelemetry.io/docs/concepts/semantic-conventions/)
  recommend stable names for operations and data. The learning boundary carries
  only stable quality status, action, reason IDs, counts, and fingerprints.

## Recommendations

1. **Require quality-gated bounded intent.**
   Runtime and rebuild callers must enter learning through
   `buildPolicyBuilderPhase6LearningDecisionFromBoundedIntent`. The wrapper and
   embedded intent draft must both carry evidence quality.

2. **Block insufficient quality before candidate evaluation.**
   If the upstream quality status is `insufficient`, Phase 6R.3 returns
   `blocked_by_intent_boundary` and does not build a learning decision.

3. **Reject mismatched quality snapshots.**
   The learning guard compares wrapper and intent quality status, action, and
   reason IDs. A mismatch indicates a stale or tampered handoff.

4. **Keep final outcome separate from learning.**
   This gate only controls durable learning eligibility. Manual outcomes can
   still be recorded by the lower-level decision contract when appropriate.

5. **Keep snapshots label-free.**
   The learning boundary carries quality IDs and counts, not raw evidence
   labels, provider payloads, or AI explanation text.

## Pros And Cons

Pros:

- Prevents durable learning from weak or insufficient evidence.
- Gives readiness and future runtime paths one stable quality signal to trust.
- Detects stale/tampered quality handoffs before profile evidence can change.
- Preserves traceability without copying raw labels or provider payloads.
- Keeps final outcome recording distinct from learning permission.

Cons:

- Learning candidates may be blocked more often until identity evidence is
  confirmed.
- The first quality comparison intentionally checks stable quality fields, not
  every diagnostic count.
- Existing low-level learning reducers remain useful for focused tests but are
  not production boundaries.

## Final Recommendation Stack

- Evidence quality source:
  `server/src/services/policyEvidenceQuality.mjs`
- Bounded intent source:
  `server/src/services/policyIntentEngine.mjs`
- Learning quality consumer:
  `server/src/services/policyBuilderPhase6LearningGuard.mjs`
- Focused tests:
  `server/src/__tests__/services/policyBuilderPhase6LearningGuard.test.mjs`
- Design owner:
  `docs/architecture/policy-builder-phase-6r-learning-guard.md`
- Roadmap owner:
  Phase 6R.3 in
  `docs/architecture/policy-builder-intent-model-roadmap.md`

## Implemented Outcome

- Added `missing_intent_evidence_quality`,
  `insufficient_intent_evidence_quality`, and
  `intent_evidence_quality_mismatch` learning audit risks.
- Added sanitized evidence quality to the bounded learning `intentBoundary`.
- Blocked bounded learning when wrapper or embedded intent quality is missing.
- Blocked bounded learning when quality is insufficient.
- Blocked bounded learning when wrapper and embedded intent quality differ.
- Extended the learning audit to reject tampered decisions that carry missing or
  insufficient intent-boundary quality.

## Security Outcome

- Learning remains side-effect-free.
- Durable learning cannot be evaluated from missing or insufficient upstream
  quality.
- Quality metadata is label-free and provider-payload-free.
- The learning boundary validates workflow state before it can mark a candidate
  write-eligible.

## Next Step

Continue with **Phase 6R.4 Automation Readiness quality-gated learning
consumption** so readiness accepts only learning results that came from a
quality-gated bounded intent handoff.
