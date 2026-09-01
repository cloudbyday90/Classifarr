# Current-Library Candidate Semantic Retrieval Design

## Status

Approved for implementation on 2026-09-01.

## Problem

The existing current-library candidate lookup is deliberately lexical: it can
prove an exact identity, title/year, or bounded catalog-text match, but it
cannot compare an incoming synopsis with the descriptions of items currently
in each eligible library. This leaves broad policy evidence vulnerable to a
plausible-but-wrong destination, such as a disaster documentary appearing
under a comedy-focused candidate.

The enhancement must make the semantic evidence useful to advisory AI without
turning a model, retrieval result, or existing collection contents into route
authority.

## Local Evidence

The local Compose database was queried read-only on 2026-09-01. It contains:

- 6,690 synchronized current-library items across 10 libraries;
- 6,658 items with a retained synopsis; and
- 6,657 of 6,657 current items with a stable TMDb ID already represented by a
  non-stale `classification_embeddings` vector in the same current library.

This makes a separate whole-library embedding table and a new backfill job
unnecessary for the first semantic component. The retrieval query can require
the stable TMDb join back to `media_server_items`, so historical embeddings are
used only where they represent a currently synchronized item.

The GitHub Pull Requests API returned zero open pull requests for
`cloudbyday90/Classifarr` during this work. No PR can be implemented locally
without fabricating one.

## Research Basis

- [pgvector](https://github.com/pgvector/pgvector) documents that approximate
  HNSW search trades recall for speed and that filtering can reduce returned
  results. Its iterative index scans and query-local `ef_search` setting are
  the basis for the bounded filtered vector query.
- [PostgreSQL full-text-search controls](https://www.postgresql.org/docs/18/textsearch-controls.html)
  confirms that `plainto_tsquery` treats unformatted text as data rather than
  search operators. The existing lexical lookup keeps this safe fallback.
- [Ollama structured outputs](https://docs.ollama.com/capabilities/structured-outputs)
  recommends a schema plus response validation and a low temperature for
  reliable structured results. The existing validated advisory proposal
  contract remains the only model-output boundary.
- [OWASP LLM08: Vector and Embedding Weaknesses](https://genai.owasp.org/llmrisk/llm082025-vector-and-embedding-weaknesses/)
  identifies cross-context leakage and poisoning risk in retrieved context.
  Candidate ownership, source minimization, stable-identity joins, and prompt
  treatment of catalog text as untrusted evidence directly mitigate those
  risks.
- The [W3C disclosure pattern](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/)
  and [WCAG 2.2 status-message guidance](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)
  support a concise default decision with optional evidence details, rather
  than adding a new always-expanded technical card.

## Options

| Option | Benefits | Costs and risks | Decision |
| --- | --- | --- | --- |
| Keep lexical catalog lookup only | No new provider call or vector query. | Cannot compare synopsis meaning; wrong broad policy candidates remain weakly challenged. | Reject. |
| Embed every current item in a new table | Independent corpus lifecycle. | Duplicate storage, backfill, deletion, cost, retention, and poisoning surface. | Defer. |
| Reuse active embeddings through a stable current-inventory join | Real current-library semantic evidence now; no schema migration or bulk backfill. | Coverage is limited to stable-ID items and existing embedding availability. | Adopt. |
| Let AI search all libraries or route itself | Maximum apparent flexibility. | Expands provider data and creates non-deterministic routing authority. | Reject. |

## Selected Architecture

```text
policy-owned two-to-three candidate set
  -> canonical title, media type, synopsis formatted by existing embedding code
  -> one existing configured embedding request
  -> bounded HNSW search over non-stale history vectors
       joined by library, media type, and stable TMDb ID to current inventory
  -> at most three distinct current items per candidate library
  -> provider-scoped evidence projection
       trusted local Ollama: bounded titles + similarity bands
       remote/untrusted endpoint: count + top similarity only
  -> existing schema-constrained advisory candidate comparison
  -> server-owned operator decision; no automatic route
```

The new retrieval service is read-only. It uses the repository's existing
query-local pgvector recall settings, a fixed candidate window, static SQL,
and a stable `media_server_items` join. It returns no descriptions, raw
metadata, embeddings, identifiers, or model text. Retrieval failure is an
`unavailable` advisory fact; it cannot substitute lexical evidence, broaden
the candidate set, retry a provider, or alter the policy score.

## Security and Authority Controls

- Candidate IDs, media type, result count, and scan window are server-owned.
- The incoming item creates one embedding using the already configured RAG
  provider; retrieved current-library content is never sent for embedding.
- Current items must match the embedding's library, media type, and TMDb ID.
- Only normalized one-line titles and bounded integer similarity are available
  to a syntactically trusted local Ollama endpoint. Remote providers receive
  aggregate semantic facts only.
- Prompt construction labels all catalog and retrieval evidence untrusted and
  never accepts instructions from it.
- The provider remains limited to a validated proposal within the original
  candidate set. It cannot change a score, policy, candidate membership, or
  route.
- The persisted UI status is a fixed allow-listed availability fact. It stores
  no title, identifier, similarity, prompt, response, provider, or model.

## UI Decision

The existing `CandidateReviewEvidenceSummary` stays compact. Semantic
availability appears only inside its native `Review evidence details`
disclosure, alongside the existing exact-item and AI-comparison explanation.
This communicates whether the advisory comparison used current-library
semantic evidence without making the operator interpret retrieval scores or
adding a second action.

## Recommendation Stack

1. Implement bounded current-library semantic retrieval from the existing
   stable-ID embedding coverage.
2. Keep lexical identity lookup as an independent high-precision check.
3. Project semantic facts with stricter minimization for remote providers and
   retain the existing structured, advisory AI response contract.
4. Keep operator confirmation mandatory for all pending decisions.
5. Next, evaluate whether semantic counter-evidence should deterministically
   downgrade broad `prompt_confirm` outcomes to a bounded candidate comparison;
   do not make that routing-policy change without an offline evaluation set.
