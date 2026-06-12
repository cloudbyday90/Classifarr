# RAG Evidence Quality Gating

Date: 2026-06-12

## Problem

RAG retrieval can surface neighbors that are semantically similar but operationally weak:

- The neighbor may come from an intermediate classification attempt instead of a trusted final outcome.
- The neighbor may have a library id but no resolvable library name.
- The neighbor may support a library that the current item profile explicitly rejects.

Before this change, policy RAG scoring used the top matching neighbor similarity directly. A high-similarity but weak-provenance neighbor could therefore boost a policy candidate even when deterministic profile evidence said the target library was incompatible.

## Official-Source Research

- NIST AI RMF overview: NIST frames AI risk management around trustworthy design, development, use, and evaluation of AI systems. The 2026 NIST page continues to point implementers to AI RMF 1.0, the Playbook, and the Generative AI Profile. https://www.nist.gov/itl/ai-risk-management-framework
- NIST AI RMF Generative AI Profile: NIST calls out grounding and retrieval-augmented generation data sources, verifying RAG data provenance, reviewing sources/citations, documenting data quality, and reassessing risks after RAG implementation. https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf
- OWASP Top 10 for LLM Applications: OWASP identifies training data poisoning, insecure output handling, excessive agency, and overreliance as relevant risks. These map directly to untrusted retrieval neighbors influencing downstream classification decisions without validation. https://owasp.org/www-project-top-10-for-large-language-model-applications/
- PostgreSQL full-text search documentation: PostgreSQL states that relevance is application-specific and that applications may combine built-in ranking with additional factors. That supports combining vector/text similarity with Classifarr-specific provenance/profile quality gates. https://www.postgresql.org/docs/current/textsearch-controls.html
- OpenTelemetry Trace API and semantic conventions: OpenTelemetry treats span context as immutable, and semantic conventions emphasize operation-specific attributes for correlation. This supports persisting bounded quality diagnostics instead of raw prompts, vectors, or unbounded metadata. https://opentelemetry.io/docs/specs/otel/trace/api/ and https://opentelemetry.io/docs/specs/semconv/general/trace/

## Options Considered

### Option A: Filter Weak Neighbors During Retrieval

Pros:

- Keeps weak evidence out of every downstream path.
- Reduces prompt/context clutter.

Cons:

- Hides evidence that is useful for diagnosis.
- Risks silently dropping sparse-library evidence.
- Harder to explain why retrieval recall changed.

### Option B: Lower Global RAG Weight

Pros:

- Simple and low-risk.
- Reduces blast radius from all RAG evidence.

Cons:

- Penalizes high-quality RAG evidence too.
- Does not distinguish trusted final outcomes from intermediate attempts.
- Does not solve profile-conflict cases directly.

### Option C: Quality-Adjusted RAG Scoring

Pros:

- Keeps evidence visible while reducing weak evidence influence.
- Applies policy/profile context where the decision is made.
- Produces bounded diagnostics for History and future audit work.
- Maintains retrieval recall and exact-neighbor observability.

Cons:

- Requires score consumers to use quality-adjusted paths.
- Some legacy paths without profile diagnostics can only apply provenance and library-identity checks.

## Final Recommendation Stack

1. Preserve retrieval recall and evidence snapshots.
2. Add a pure ES module service, `ragEvidenceQualityGate.mjs`, that assigns each neighbor a quality multiplier.
3. Give full credit only to neighbors with:
   - a positive library id and resolved library name,
   - trusted final outcome provenance,
   - no profile hard exclusion or evaluated profile incompatibility for the current policy target.
4. Demote, rather than delete, weak evidence so operators can still inspect why a neighbor was discounted.
5. Persist bounded `rag_evidence_quality` diagnostics inside policy candidate diagnostics.
6. Apply the same provenance/library identity quality score to RAG suggestions and legacy dynamic RAG weight.

## Implemented Outcome

- Added `server/src/services/ragEvidenceQualityGate.mjs`.
- `scoreRAGWithDiagnostics()` now returns quality-adjusted scores and bounded diagnostics.
- Policy evaluation passes profile diagnostics into RAG scoring and stores `candidate_diagnostics.rag_evidence_quality`.
- RAG retriever rows now include classification status so trusted final outcomes can be distinguished from pending/intermediate rows.
- RAG suggestions and dynamic RAG weighting use quality-adjusted similarity.
- Tests cover trusted outcomes, untrusted outcomes, missing library names, profile incompatibility, and hard profile exclusions.

## Security And Privacy Boundaries

- Do not expose embeddings, prompts, provider payloads, raw overviews, or unbounded metadata in diagnostics.
- Only persist bounded neighbor attributes: id/name, status/method, similarity, adjusted score, and reason codes.
- Keep the gate deterministic and local to existing policy/RAG services.
- Treat unknown provenance conservatively in suggestions and dynamic weighting; preserve legacy direct scoring behavior when profile diagnostics are unavailable.

## Next High-Value Design Targets

1. Policy candidate evidence calibration: reduce broad genre over-promotion, especially `Comedy` for specialized destinations like `Comedy and Standup`.
2. Manual outcome learning loop: convert final manual corrections into clean reinforcement signals while excluding intermediate attempts.
3. RAG evidence quality UI: expose quality-adjusted RAG reasons in History so operators can see why a high-similarity neighbor was discounted.
