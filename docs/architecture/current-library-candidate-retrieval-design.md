# Current-Library Candidate Retrieval Design

## Status

Implemented on 2026-08-30. This is the first, read-only component of
whole-library evidence for policy-candidate adjudication. It neither changes
policy scoring nor grants a model or retrieved content authority to route.

## Problem

Classifarr synchronizes real library inventory into `media_server_items`, but
the existing RAG corpus contains historical confirmed classifications rather
than all current library items. For an ambiguous `prompt_select` result, an AI
advisory therefore had useful profile aggregates and historical matches but
could not tell whether the candidate library presently contains the exact item
or closely matching catalog evidence.

The first improvement must add that evidence without automatically embedding
the full library, sending descriptions to a remote provider, or making
retrieval output a routing decision.

## Official Research Basis

Research was performed against official sources available on the requested
August 2026 baseline:

- [PostgreSQL full-text search controls](https://www.postgresql.org/docs/current/textsearch-controls.html)
  documents `plainto_tsquery` as the parser for unformatted text; it does not
  interpret text-search operators from a title.
- [PostgreSQL GIN indexes](https://www.postgresql.org/docs/current/gin.html)
  explains the scalability and write-cost characteristics of GIN. That supports
  measuring this bounded lookup before adding a maintained index to every
  library refresh.
- [NIST AI RMF Generative AI Profile](https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf)
  identifies governance, provenance, privacy, human oversight, and evaluation
  as lifecycle responsibilities for generative-AI systems.
- [OWASP LLM08: Vector and Embedding Weaknesses](https://genai.owasp.org/llmrisk/llm082025-vector-and-embedding-weaknesses/)
  recommends permission-aware partitioning, source validation, minimization,
  and monitoring for retrieved AI context.

## Options Considered

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Do nothing beyond classification-history RAG | Smallest implementation. | Cannot use current inventory, even for an exact TMDb match. | Rejected. |
| Immediately embed every library item | Enables semantic similarity across synopsis text. | Needs provider/cost authorization, backfill and refresh lifecycle, recall evaluation, and a larger leakage/poisoning surface. | Deferred. |
| Candidate-scoped synchronous catalog lookup | Uses current synchronized data now; exact identifiers are high precision; no background work or provider call. | Lexical retrieval is not semantic recall; a very large deployment may later need an index. | Adopted. |

## Adopted Architecture

```text
Policy engine owns 2–3 prompt_select candidates
        |
        v
Read only those candidate library IDs from media_server_items
        |
        +-- exact TMDb ID: relevance 100
        +-- normalized title + year: relevance 90
        +-- bounded PostgreSQL plain-text match over the incoming title, genres,
            and description: relevance 1–89
        v
At most 3 title/year matches per candidate
        |
        +-- trusted-local Ollama: bounded titles and aggregate match facts
        |
        +-- all other providers: aggregate match facts only
        v
Existing advisory proposal validation and operator confirmation
```

`currentLibraryCandidateRetrievalContract.mjs` derives a request only from the
policy-owned contract and validated metadata title. It fixes the candidate and
per-candidate result caps. `currentLibraryCandidateRetrieverQuery.mjs` owns the
parameterized query. `currentLibraryCandidateRetriever.mjs` executes a
read-only lookup and converts a database failure to an unavailable fact,
never to an AI or routing failure.

The incoming title, genres, and description are reduced to at most 48 plain
search terms before local database ranking. Candidate summaries and other
synchronized metadata can affect ranking, but the query returns only title,
year, match kind, and a bounded score. The existing prompt explicitly labels
retrieved content as untrusted evidence, never instructions.

## Security and Authority Boundaries

- Candidate library IDs, media type, and result limits are server-owned.
- The query is parameterized and uses `plainto_tsquery`; a title cannot become
  text-search syntax.
- A result is accepted only if its library ID belongs to the original candidate
  set; unexpected rows are discarded.
- Provider-scoped projection strips title/year data for remote and untrusted
  Ollama hosts. The existing syntactic local-endpoint boundary remains in
  force.
- Local title evidence is normalized to a single bounded line and match labels
  are allow-listed before prompt construction, preventing synchronized catalog
  text from introducing prompt-shaped control lines.
- Lookup is read-only and does not mutate inventory, produce embeddings, learn
  from outcomes, call an external service, change a policy score, or route.
- Retrieval errors degrade to an `unavailable` evidence status. They cannot
  expand candidates or bypass operator confirmation.

## Final Recommendation Stack

1. Use exact identifiers and current candidate-library inventory as the first
   high-precision whole-library signal.
2. Keep lookup candidate-scoped, bounded, provider-minimized, and advisory.
3. Retain policy and operator authority; do not infer a route from catalog
   retrieval alone.
4. Use the implemented aggregate latency and AI/operator-agreement telemetry
   before introducing a maintained full-text or embedding index. See
   [telemetry design](current-library-candidate-retrieval-telemetry-design.md).
5. Only then evaluate versioned current-library embeddings, including explicit
   provider, cost, retention, access-partition, poisoning, and recall controls.
