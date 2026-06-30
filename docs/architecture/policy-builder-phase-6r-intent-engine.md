# Policy Builder Phase 6R Intent Engine

## Status

Implemented as the second Phase 6R engine contract.

This slice consumes Phase 6R evidence projection and produces proposed
destination intent. It does not persist policy intent, create learning,
execute routing, call providers, or replace runtime classification paths.

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

## Pros And Cons

Pros:

- Converts evidence into a product-facing destination meaning contract.
- Keeps inferred evidence, declared constraints, and review triggers separate.
- Stops provider metadata from defining destination identity.
- Provides a clean handoff into Phase 6R.3 Learning Guard.
- Creates an executable audit for future changes.

Cons:

- The initial confidence calculation is intentionally simple.
- It does not yet merge or compare legacy preset intent contracts.
- It does not persist native intent storage.
- It does not run runtime classification or Arr routing.

## Final Recommendation Stack

- Evidence input:
  `server/src/services/policyBuilderPhase6EvidenceEngine.mjs`
- Intent engine:
  `server/src/services/policyBuilderPhase6IntentEngine.mjs`
- Test module:
  `server/src/__tests__/services/policyBuilderPhase6IntentEngine.test.mjs`
- Documentation:
  `docs/architecture/policy-builder-phase-6r-intent-engine.md`
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

## Security Outcome

- Intent proposals are generated server-side.
- Raw provider payloads are not read by this layer.
- Metadata evidence is demoted away from destination identity.
- Broad genre identity requires operator declaration or specific support.
- Observed absence creates review warnings only.
- Hard limits and avoid rules require durable operator-declared authority.
- Legacy templates remain draft seeds and compatibility bridge inputs only.

## Next Step

Proceed to **Phase 6R.3 Learning Guard**. That component should decide when
manual outcomes, Discord answers, confirmations, routing outcomes, and request
choices can become durable learning, exact-item memory, profile evidence, or
outcome history only.
