# Policy Evidence Hardening

Status: implemented for the v0.47.2-beta line.

## Problem

`Office Romance (2026)` exposed a policy-ranking failure mode:

- The `Family` candidate was RAG-only while the library profile had a hard rating exclusion for `R`.
- The question builder still treated that top-scoring candidate as the primary anchor.
- `Comedy and Standup` gained too much apparent authority from broad `Comedy` signals even though generic comedy is compatible with stand-up, not proof of stand-up placement.
- The persisted RAG trace stored aggregate similarity and match counts, but not enough bounded neighbor evidence to explain why retrieval influenced the decision.

The intended model remains: policies and profiles boost or suppress confidence; they do not deterministically route content by themselves. The missing layer was candidate eligibility: a scoring result can remain visible as evidence while being disallowed as the primary decision anchor.

## Official Source Research

Research date: June 6, 2026.

- [NIST AI Risk Management Framework](https://www.nist.gov/itl/ai-risk-management-framework) recommends managing AI risk through design, development, use, and evaluation practices, with the Generative AI Profile calling out additional human review, tracking, and documentation for higher-risk outputs.
- [OpenTelemetry Semantic Conventions](https://opentelemetry.io/docs/concepts/semantic-conventions/) recommend common operation and data names across traces, metrics, and logs so events can be correlated across the application.
- [OpenTelemetry GenAI Semantic Conventions](https://opentelemetry.io/docs/specs/semconv/gen-ai/) define standardized GenAI signals, spans, events, exceptions, and metrics, but remain in development, so Classifarr should align naming without making storage depend on an unstable schema.
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html) recommends consistent application logging, validating event data from other trust zones, and masking or excluding sensitive data such as tokens, secrets, and unnecessary personal data.
- [PostgreSQL JSON Types](https://www.postgresql.org/docs/current/datatype-json.html) recommends `jsonb` for most JSON workloads because it is decomposed, faster to process, and indexable.
- [pgvector](https://github.com/pgvector/pgvector) documents that approximate vector indexes apply filters after index scanning, which means filtered searches can return fewer relevant rows unless candidate limits, `ef_search`, iterative scans, or partial indexes are tuned.
- [W3C Trace Context](https://www.w3.org/TR/trace-context/) provides a standard trace context model for correlating distributed operations. Classifarr currently uses UUID correlation IDs; the next step is to make those trace-context compatible across HTTP, worker, and RAG paths.

## Recommendations

### 1. Evidence Taxonomy

Classify each policy candidate into explicit evidence classes:

- `identity`: strong preset or learned signal that describes the library's specific identity.
- `multi_source`: corroboration from multiple non-excluded sources.
- `compatibility`: broad match that says the item can fit, but does not prove destination.
- `profile_only`: historical profile affinity without corroboration.
- `rag_only`: retrieval support without deterministic corroboration.
- `negative_conflict`: hard profile exclusion or similar contradiction.

Pros:
- Explains why high score does not always mean high authority.
- Keeps policies advisory and avoids hard-coded library names.
- Supports future metrics around weak anchors and suppressed candidates.

Cons:
- Requires careful test fixtures for borderline libraries.
- Existing presets that relied on generic genre identity may need explicit `semantics: "identity"` when that behavior was intentional.

### 2. Primary Anchor Eligibility

Keep all candidates visible, but suppress candidates from primary anchoring when they have:

- profile hard exclusions,
- weak primary evidence (`compatibility_only`, `profile_only`, `rag_improved`),
- compatibility plus profile only, with no RAG/history/pattern corroboration.

Pros:
- Prevents `RAG-only Family` from becoming the question anchor when profile says `R` is excluded.
- Prevents broad `Comedy` from overpowering a specialized stand-up destination.
- Preserves manual options for user correction.

Cons:
- A genuinely sparse library may ask for manual review more often until it has stronger evidence.

### 3. Second-Pass Adoption Gate

Second-pass RAG and AI rerun results must pass the same candidate eligibility gate before they can replace the baseline result.

Pros:
- Fixes the path where AI rerun selected `Comedy and Standup` after a RAG pass even though policy evidence was weak.
- Keeps model output subordinate to deterministic policy/profile evidence.

Cons:
- Some AI rerun improvements will be retained as diagnostics instead of adopted automatically.

### 4. Bounded RAG Evidence Snapshots

Persist a sanitized snapshot of pass-one and pass-two retrieval evidence:

- title,
- year,
- library ID/name,
- similarity fields,
- per-pass library counts.

Do not persist prompts, full overviews, provider payloads, tokens, secrets, request headers, or raw embeddings.

Pros:
- Makes future incidents diagnosable from History without direct SQL.
- Aligns with OWASP guidance by retaining bounded operational evidence, not sensitive request content.
- Fits current `jsonb` metadata storage without a schema migration.

Cons:
- Adds small metadata payload growth.
- Historical rows do not gain neighbor snapshots until reclassified.

## Final Stack

- Candidate diagnostics now include `evidence_class`, `profile_hard_excluded`, `primary_anchor_eligible`, and `suppression_reasons`.
- Broad generic genre and prefer-only keyword preset signals are compatibility evidence unless explicit semantics override them.
- Policy question candidate ordering promotes eligible candidates ahead of weak or excluded anchors while retaining weak candidates as options.
- Policy recheck and AI rerun adoption are blocked when the selected candidate has a hard profile exclusion or weak primary anchor.
- RAG loop traces now persist bounded `retrieval_evidence` snapshots, copied to `classification_details.rag_evidence` for easier History consumption.
- History detail modal renders the sanitized RAG evidence snapshot alongside profile scoring and targeted re-check trace details.

## Implemented Outcome

For the `Office Romance` failure shape:

- `Family` remains visible as an evidence candidate, but a hard `R` rating profile exclusion marks it `negative_conflict` and ineligible as a primary anchor.
- `Comedy and Standup` can still receive compatibility credit from `Comedy`, but broad comedy evidence alone does not establish stand-up identity and cannot be the primary anchor without stronger corroboration.
- `Movies` can become the first manual-review option when it has eligible corroborated evidence.
- AI rerun cannot replace the baseline with a weak policy anchor just because its confidence improved.

## Follow-Up Design Items

1. Trace context propagation: move from isolated UUID correlation IDs to a W3C-compatible trace context across HTTP requests, queue tasks, RAG retrieval, AI reruns, and final outcomes.
2. Retrieval recall tuning: evaluate pgvector filtered-search recall using production-sized fixtures, then decide whether to tune `ef_search`, enable iterative scans where available, or add partial indexes for high-volume library filters.
3. Preset semantics migration: add an admin audit that identifies presets relying on implicit identity semantics and recommends explicit `semantics: "identity"` or `semantics: "compatibility"` based on observed corrections.
