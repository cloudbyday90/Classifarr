# Policy Builder Phase 6R Intent Engine

## Status

Implemented as the second Phase 6R engine contract.

This slice consumes Phase 6R evidence projection and produces proposed
destination intent. It does not persist policy intent, create learning,
execute routing, call providers, or replace runtime classification paths. New
runtime and rebuild callers should use the bounded intent entry point, which
requires the Phase 6R.1 evidence boundary result and carries the evidence
projection fingerprint forward. July 2026 hardening makes that handoff stricter:
the intent boundary now validates that the evidence projection fingerprint,
trace attributes, and sanitized provenance still match the bounded evidence
projection before producing an intent draft. It also consumes the Phase 6R.1
evidence quality assessment and blocks intent inference when evidence quality is
insufficient.

## Problem

Classifarr needs to move from policy-builder diagnostics to destination meaning.
The evidence engine answers what Classifarr knows. The intent engine answers
what that evidence can safely suggest as policy intent.

The important boundary is authority:

- observed media-server evidence can suggest,
- metadata can support,
- final outcomes can inform,
- starter templates can seed,
- only operator-declared intent can define durable hard limits and avoid rules.

## Official Guidance Reviewed

- [NIST AI Risk Management Framework](https://www.nist.gov/itl/ai-risk-management-framework)
  frames AI risk management around governed, measured, and managed system
  behavior. The intent engine therefore records assumptions, warnings, and
  confidence reason codes instead of silently promoting inferred evidence.
- [NIST Generative AI Profile](https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf)
  highlights provenance, reliability, and lifecycle risk management for
  generative AI. Phase 6R.2 keeps model/provider output outside durable policy
  authority and requires deterministic validation.
- [OWASP Top 10 for Large Language Model Applications](https://owasp.org/www-project-top-10-for-large-language-model-applications/)
  identifies insecure output handling and overreliance risks. Classifarr should
  not let AI or provider suggestions directly create policy meaning.
- [OWASP ASVS](https://owasp.org/www-project-application-security-verification-standard/)
  provides a basis for verifying application security controls, including
  server-side validation and business-logic controls. The intent engine is
  server-owned and auditable.
- [OWASP Top 10 for Large Language Model Applications](https://owasp.org/www-project-top-10-for-large-language-model-applications/)
  identifies output validation and overreliance as core LLM risks. The bounded
  intent entry point treats evidence as validated server data and blocks failed
  evidence-boundary handoffs before intent inference.
- [OpenTelemetry Semantic Conventions](https://opentelemetry.io/docs/concepts/semantic-conventions/)
  recommend stable attribute names for operations and data. The intent engine
  preserves the Phase 6R.1 projection fingerprint and trace attributes so later
  telemetry can correlate which bounded evidence produced an intent draft
  without exposing raw evidence labels.

## Recommendations

1. **Keep intent proposal separate from persistence.**
   The output is a proposal, not a write model. Phase 8R will own native
   storage after engine contracts stabilize.

2. **Use the Phase 6R evidence buckets as the only input model.**
   The intent engine should not read replay, impact preview, provider payload,
   TMDB coverage, UI chip state, or raw legacy preset payloads.

3. **Demote unsupported broad genre identity.**
   A broad genre such as `Animation` can be helpful evidence by itself, but it
   becomes `belongs_here` only when the operator declares it or specific
   supporting identity evidence also exists.

4. **Treat absence as review, not exclusion.**
   Missing, stale, or conflicting evidence creates `ask_when` entries and
   warnings. It must not create `avoid` or hard-limit entries.

5. **Keep constraints operator-owned.**
   `hard_limits` and `avoid` entries must come from operator-declared intent.

6. **Make confidence explainable.**
   Confidence is a simple bounded signal with reason codes. It is not a hidden
   policy score and should not become runtime authorization by itself.

7. **Require bounded evidence for new callers.**
   `buildPolicyBuilderPhase6IntentDraftFromBoundedEvidence` consumes the
   Phase 6R.1 boundary result, rejects failed evidence boundaries, requires the
   projection fingerprint, and attaches a sanitized evidence-boundary snapshot
   to the intent draft.

8. **Validate evidence handoff integrity.**
   The intent boundary recomputes the Phase 6R.1 projection fingerprint audit
   before producing intent. A stale, malformed, or tampered fingerprint blocks
   intent generation.

9. **Consume generated evidence quality before inference.**
   Bounded intent generation requires the Phase 6R.1 quality object. Missing or
   insufficient quality returns `blocked_by_evidence_quality` with stable reason
   IDs and a next action instead of producing policy intent.

## Pros And Cons

Pros:

- Converts evidence into a product-facing destination meaning contract.
- Keeps inferred evidence, declared constraints, and review triggers separate.
- Stops provider metadata from defining destination identity.
- Provides a clean handoff into Phase 6R.3 Learning Guard.
- Creates an executable audit for future changes.
- Prevents new runtime/rebuild callers from bypassing Phase 6R.1 input and
  projection audits.
- Carries deterministic evidence provenance into intent without leaking raw
  evidence labels in the boundary snapshot.
- Prevents stale or tampered evidence correlation handles from becoming intent
  provenance.
- Prevents insufficient evidence quality from becoming intent while preserving a
  sanitized reason/action snapshot for downstream review.

Cons:

- The initial confidence calculation is intentionally simple.
- It does not yet merge or compare legacy preset intent contracts.
- It does not persist native intent storage.
- It does not run runtime classification or Arr routing.
- The older direct draft reducer remains for unit-level compatibility and must
  not be used as a runtime boundary.
- Conservative quality gating can pause more drafts until identity evidence or
  operator confirmation exists.

## Final Recommendation Stack

- Evidence input:
  `server/src/services/policyBuilderPhase6EvidenceEngine.mjs`
- Bounded evidence boundary:
  `server/src/services/policyEvidenceBoundary.mjs`
- Intent engine:
  `server/src/services/policyBuilderPhase6IntentEngine.mjs`
- Test module:
  `server/src/__tests__/services/policyBuilderPhase6IntentEngine.test.mjs`
- Documentation:
  `docs/architecture/policy-builder-phase-6r-intent-engine.md`
- Quality-gate outcome:
  `docs/architecture/policy-builder-phase-6r-intent-quality-gate.md`
- Roadmap owner:
  Phase 6R.2 Intent Engine in
  `docs/architecture/policy-builder-intent-model-roadmap.md`

## Implemented Contract

The intent draft shape is:

```text
version
source
belongs_here[]
helpful_matches[]
hard_limits[]
avoid[]
ask_when[]
routing_target[]
confidence
assumptions[]
warnings[]
learningSideEffects[]
bridgeCompatibility
evidenceBoundary
```

For bounded intent drafts, `evidenceBoundary` also includes a sanitized
`quality` snapshot:

```text
version
statusId
score
nextActionId
reasonIds[]
counts
hasIdentityEvidence
hasDeclaredIdentityEvidence
hasObservedIdentityEvidence
hasStaleProfileEvidence
```

Each intent entry keeps:

```text
fieldId
key
label
value
evidenceBucketId
evidenceSourceId
authoritySourceId
reasonCode
evidenceCount
evidenceConfidence
inferred
operatorDeclared
```

The contract intentionally keeps `learningSideEffects` empty. Phase 6R.3 owns
the decision of whether an outcome or answer can become durable learning.

For bounded runtime/rebuild callers, the intent service returns:

```text
ok
statusId
evidenceBoundary
intent
intentAudit
issueCount
issues
nextPhase
```

The bounded status IDs are:

```text
ready
blocked_by_evidence_boundary
blocked_by_evidence_quality
blocked_by_intent_audit
```

## Security Outcome

- Intent proposals are generated server-side.
- Raw provider payloads are not read by this layer.
- Metadata evidence is demoted away from destination identity.
- Broad genre identity requires operator declaration or specific support.
- Observed absence creates review warnings only.
- Hard limits and avoid rules require durable operator-declared authority.
- Legacy templates remain draft seeds and compatibility bridge inputs only.
- New callers can require a successful evidence boundary and projection
  fingerprint before intent inference.
- Bounded intent generation rejects evidence fingerprints that no longer match
  the returned evidence projection, trace attributes, or sanitized provenance.
- The intent draft carries a compact evidence-boundary snapshot for traceability
  without raw provider payloads or evidence labels in the boundary metadata.
- Bounded intent generation requires generated evidence quality and rejects
  missing or insufficient quality before producing a draft.
- The intent audit rejects bounded drafts that later omit the quality snapshot
  or carry insufficient quality.

## Next Step

Proceed to **Phase 6R.3 Learning Guard**. That component should require
quality-gated bounded intent before manual outcomes, Discord answers,
confirmations, routing outcomes, and request choices can become durable
learning, exact-item memory, profile evidence, or outcome history only.
