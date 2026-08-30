# Policy Candidate Contrastive Retrieval Design

Status: Implemented (unreleased)

Date: 2026-08-30

## Decision

Classifarr already performs a bounded current-library lookup for some AI
candidate-adjudication requests. That lookup can use lexical catalog evidence,
but it is not a safe, visible cross-check for every pending policy decision:
confirmation decisions can bypass the adjudication-only context and lexical
matches do not establish that two titles identify the same media item.

This change adds an independent contrastive identity check. It compares only a
server-retained TMDb ID against the two or three policy-ranked, active,
same-media-type candidate libraries. It returns a fixed result that says
whether the exact identity is present only in the leading candidate, only in an
alternative, in more than one candidate, or in none. It is always advisory.

The result does not mean that a new item should route to a library that already
contains it. It says only that current synchronized inventory is supporting,
counter, shared, or neutral evidence for the leading candidate.

## Architecture

```text
policy-ranked pending candidates + retained TMDb ID
  -> policyCandidateContrastiveRetrievalContract.mjs
  -> one parameterized exact inventory query
  -> policyCandidateContrastiveEvidence.mjs
  -> fixed persisted projection
  -> runtime-question decision presentation
  -> client allow-list and short accessible status
```

The contract owns membership, ordering, maximum size, active status, and media
type. Metadata contributes only a positive TMDb identifier; missing identity
does not fall back to a title, overview, vector, or AI query.

| Result | Meaning | Operator action |
| --- | --- | --- |
| `leading_identity_match` | Only the leading candidate contains the exact ID | Treat as supporting existing-association evidence, not an automatic route. |
| `alternative_identity_match` | An alternative contains the exact ID and the leader does not | Treat as counter-evidence; compare alternatives before confirming. |
| `shared_identity_match` | More than one candidate contains the exact ID | Inventory is non-discriminating. |
| `no_candidate_identity_match` | No candidate contains the exact ID | Inventory is neutral for a newly arriving item. |
| `identity_unverified` | No retained TMDb ID | Do not infer identity from title similarity. |
| `retrieval_unavailable` | Bounded database read did not complete | No fallback or routing change is permitted. |

`not_applicable` is retained for non-pending or single-candidate flows and is
not displayed as a review card.

## Research Basis

- PostgreSQL documents `plainto_tsquery` as a transformation for unformatted
  text, while this implementation deliberately avoids full-text matching
  altogether. Exact numeric identity is more precise for contrastive evidence
  and prevents an item title from becoming query syntax or a semantic claim.
  [PostgreSQL text-search controls](https://www.postgresql.org/docs/current/textsearch-controls.html)
- NIST's Generative AI Profile treats provenance, data quality, retrieval, and
  evaluation as lifecycle concerns. The check preserves provenance as one fixed
  identifier and leaves its result separate from policy authority.
  [NIST AI 600-1 Generative AI Profile](https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf)
- OWASP describes data leakage, cross-context conflict, and poisoning risks in
  RAG/vector systems. The query returns only candidate-library membership and
  the persisted/browser projection removes even those IDs, catalog titles, and
  metadata.
  [OWASP LLM08:2025](https://genai.owasp.org/llmrisk/llm082025-vector-and-embedding-weaknesses/)
- W3C recommends a polite `role="status"` for non-urgent state updates and
  advises explicit `aria-atomic="true"` where the whole short message should be
  announced. The UI announces only its concise fixed result without moving
  focus or making the longer review content live.
  [W3C ARIA22](https://www.w3.org/WAI/WCAG22/Techniques/aria/ARIA22.html)

## Options Considered

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Reuse lexical current-library retrieval as the operator signal | Already exists and can find approximate catalog matches | Title/year/text results are not canonical identity and can confuse a new-item decision | Reject |
| Exact server-owned contrastive inventory lookup | High precision, one bounded read, no provider call, useful on confirmation and selection flows | Cannot decide a brand-new item with no existing inventory association | Adopt |
| Add embedding search immediately | Could surface semantic documentary/comedy differences | Requires corpus lifecycle, access partitioning, poisoning controls, recall evaluation, and a clear authorization boundary | Defer |
| Allow AI to infer from raw catalog data | Adds semantic judgment | Increases untrusted-text and probabilistic-authority exposure | Reject |

## Security and Authority Boundaries

- Candidate libraries are derived from the policy ranking, must be active and
  same-media-type, and are capped at three.
- A positive TMDb ID is required. No user-controlled title, overview, policy
  text, model output, or browser parameter reaches the database query.
- The query is parameterized and returns `library_id` only. Unexpected,
  duplicate, and unrequested rows are discarded before the result is assessed.
- The persisted and browser-facing projections contain only version,
  provenance, and a fixed result ID. They contain no catalog identity,
  candidate ID, library name, media text, prompt, provider, or routing control.
- Query or dependency failure produces `retrieval_unavailable`; it cannot block
  classification, broaden evidence, trigger AI, change a policy score, learn,
  or route media.

## Final Recommendation Stack

1. Use exact canonical inventory evidence as a bounded cross-check for pending
   decisions, while retaining policy and operator routing authority.
2. Track only aggregate operator outcomes by fixed contrastive result before
   claiming that the signal improves routing precision.
3. Add labeled replay fixtures for Katrina-like new items and known duplicate
   inventory cases; treat neutral/no-match output as a required outcome, not a
   failure to be hidden.
4. Consider semantic retrieval only if those evaluations show a repeatable,
   meaningful gap that exact identity and policy evidence cannot explain.
5. If a local model is later evaluated, use a strict schema-bound,
   advisory-only `support` / `contradict` / `insufficient` verdict against a
   bounded evidence contract; never grant it destination or route authority.
