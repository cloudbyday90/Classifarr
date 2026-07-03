# Policy Builder Phase 7R Runtime Evidence Projection

## Status

Implemented as the second Phase 7R runtime contract.

This slice projects runtime classification inputs into the Phase 6R evidence
bucket vocabulary. It does not change classification behavior, route items,
write learning, call providers, or persist native intent.

## Problem

Runtime classification currently receives evidence from multiple places:

```text
policy signals
library profile
classification history
manual outcomes
RAG neighbors
metadata enrichment
Arr routing
profile freshness
```

Without a single projection, those signals can become competing authorities.
That is the failure mode Phase 7R is trying to remove: broad genre overlap,
unknown-library RAG evidence, stale profiles, and metadata hints can look more
authoritative than they are.

Phase 7R.2 creates a deterministic adapter that maps runtime facts into Phase
6R buckets before automation decisions are allowed to change.

## Official Guidance Reviewed

- [NIST Secure Software Development Framework](https://csrc.nist.gov/pubs/sp/800/218/final)
  supports secure design and verification before behavior changes. This slice
  adds a tested runtime evidence contract before changing classification flow.
- [NIST AI Risk Management Framework](https://www.nist.gov/itl/ai-risk-management-framework)
  emphasizes mapping, measuring, and managing AI system behavior. RAG, AI, and
  metadata inputs remain evidence sources, not final authorities.
- [OWASP ASVS](https://owasp.org/www-project-application-security-verification-standard/)
  emphasizes server-side validation and business-logic controls. The projection
  validates bucket/source/authority relationships server-side.
- [OpenTelemetry Traces](https://opentelemetry.io/docs/concepts/signals/traces/)
  describes bounded trace attributes and events. The projection emits stable
  reason codes and counts without exposing raw provider payloads.

## Recommendations

1. **Reuse Phase 6R buckets.**
   Runtime and rebuild paths should share `identity`, `compatibility`,
   `hard_limit`, `avoid`, `outlier`, `routing`, `freshness`, and
   `insufficient` evidence categories.

2. **Demote weak evidence, do not discard it silently.**
   Low-trust RAG neighbors, unknown-library evidence, stale profile state,
   failed routing, and broad genre overlap should remain visible as bounded
   evidence with demotion reasons.

3. **Keep provider/RAG/AI evidence non-authoritative.**
   Metadata and RAG can support compatibility or insufficiency. They cannot own
   destination identity or durable learning.

4. **Suppress raw payloads.**
   Runtime evidence can include labels, counts, confidence, reason codes, and
   source IDs. It must not expose raw provider payloads, quota state, request
   URLs, prompts, or UI chip language.

5. **Fingerprint sanitized evidence projections.**
   Runtime evidence should emit a stable SHA-256 fingerprint with bounded
   provenance so Phase 7R.3 can bind automation decisions to the exact evidence
   projection it evaluated without carrying raw labels forward.

6. **Verify fingerprint integrity before handoff.**
   Validation should recompute the sanitized projection fingerprint, compare the
   carried fingerprint and provenance, and require trace attributes to mirror
   the same digest. A projection with a stale digest is not a trustworthy input
   for automation even when the evidence entries themselves are valid.

7. **Prepare for automation decisions.**
   The output should explain why automation may later be allowed or blocked,
   but the projection itself should not classify, route, ask, or learn.

## Pros And Cons

Pros:

- Aligns runtime evidence with rebuild/readiness evidence.
- Gives Phase 7R.3 a stable input contract.
- Makes weak RAG, stale profile, failed routing, and broad-genre cases
  explicit.
- Gives automation decisions a stable sanitized evidence identity.
- Detects stale or forged projection fingerprints before runtime decisions can
  consume the projection.
- Avoids live provider calls and raw payload leakage.

Cons:

- Does not yet wire into the active classification pipeline.
- Does not make automation decisions by itself.
- Adds one adapter layer that must be maintained as runtime inputs evolve.
- Fingerprints are diagnostic/provenance aids, not security signatures.
- Strict fingerprint validation means malformed test fixtures and manual debug
  payloads must be regenerated instead of patched by hand.

## Final Recommendation Stack

- Runtime evidence projection:
  `server/src/services/policyBuilderPhase7RuntimeEvidenceProjection.mjs`
- Runtime evidence fingerprint:
  `server/src/services/policyBuilderPhase7RuntimeEvidenceFingerprint.mjs`
- Test module:
  `server/src/__tests__/services/policyBuilderPhase7RuntimeEvidenceProjection.test.mjs`
- Phase 6R evidence vocabulary:
  `server/src/services/policyEvidenceEngine.mjs`
- Documentation:
  `docs/architecture/policy-builder-phase-7r-runtime-evidence-projection.md`
- Roadmap owner:
  Phase 7R.2 Runtime Evidence Projection in
  `docs/architecture/policy-builder-intent-model-roadmap.md`

## Implemented Contract

The service exports:

- `PHASE7R_RUNTIME_EVIDENCE_SOURCE_IDS`
- `PHASE7R_RUNTIME_EVIDENCE_DEMOTION_REASON_IDS`
- `PHASE7R_RUNTIME_EVIDENCE_AUDIT_RISK_IDS`
- `buildPolicyBuilderPhase7RuntimeEvidenceProjection`
- `buildPolicyBuilderPhase7RuntimeEvidenceProjectionAudit`
- `validateRuntimeEvidenceEntry`
- `validatePolicyBuilderPhase7RuntimeEvidenceProjection`

The fingerprint service exports:

- `buildPolicyBuilderPhase7RuntimeEvidenceFingerprint`

Runtime inputs supported:

- library profile evidence,
- operator intent,
- classification final outcomes,
- manual corrections,
- pending answers,
- RAG neighbors,
- metadata signals,
- Arr routing outcomes,
- profile freshness.

Demotion reasons:

- `broad_genre_without_identity`
- `low_trust_rag_neighbor`
- `unknown_library_neighbor`
- `stale_profile`
- `routing_not_proven`
- `raw_payload_suppressed`

Each projection now carries `projectionFingerprint` with:

- SHA-256 fingerprint,
- projection and Phase 6R evidence versions,
- total entry count,
- Phase 6R source ids,
- runtime source ids,
- authority source ids,
- demotion reason ids,
- warning reason ids,
- bucket counts.

The provenance is intentionally bounded and excludes raw evidence labels.

Validation now recomputes the projection fingerprint during the audit and
rejects:

- missing or malformed SHA-256 digests,
- stale digests that no longer match the sanitized projection payload,
- provenance summaries that do not match the recomputed projection,
- trace attributes that do not mirror the carried projection fingerprint.

## Security Outcome

- Projection is deterministic and side-effect-free.
- No live provider lookup is performed.
- Raw provider payloads are suppressed.
- Fingerprint provenance is sanitized and label-free.
- Fingerprint, provenance, and trace attributes are verified together before
  downstream runtime decisions can trust the projection.
- AI/RAG/provider evidence cannot become destination identity by itself.
- Stale profiles and failed routing become insufficient evidence, not silent
  success.

## Next Step

Phase 7R.3 Automation Decision Contract should consume this runtime evidence
projection and define the allowed runtime states for classify, route, ask, skip,
and block behavior.
