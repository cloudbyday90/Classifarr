# Live library model reuse: design

## Decision and scope

Reuse fitted contrastive metadata profiles and description-match baselines after
checking their exact training inputs against a fresh read-only inventory snapshot.
Refresh automatically on the next use when those inputs change. This is an
optimization of the live qualification introduced in `41095b7b`, not a new source
of routing permission or a change to confidence scores.

The previous implementation fits profiles during retrieval and fits the selected
library's baseline twice during successful revalidation. Reusing those numeric
models avoids repeated fitting without caching recommendations, decisions,
authorization, or complete retrieval responses.

## Alternatives and tradeoffs

| Option | Benefits | Costs and risks | Decision |
| --- | --- | --- | --- |
| Refit on every read | Simple isolation; no retained model state | Repeated training work on unchanged inventory | Retain as cache-miss path |
| Time-only cached evidence | Avoids inventory reads and fitting | May hide moves, deletions, expired vectors or changed restrictions | Reject for routing |
| Exact-input fitted-model reuse | Automatic; same results; fresh evidence and permission checks | Still pays snapshot reads, hashing and scoring; bounded memory | Select |
| Background model prewarming | Potentially reduces first-request latency | Query-specific exclusions, extra idle work and cancellation complexity | Defer until measured need |

## Implementation contract

- Keep repository-owned, bounded in-memory caches; no cross-database global cache,
  disk persistence, new database schema, endpoint, dependency or UI control.
- Profile fit keys bind the algorithm and projection versions, media/library scope
  and all sorted training identities, synopsis hashes, memberships and normalized
  metadata. Remove the query and every current/stored synopsis copy first. Score
  current query metadata separately; never cache its relative-fit result.
- Baseline fit keys bind the algorithm, embedding representation, media type,
  selected library, deterministic reference/calibration hashes and actual vectors.
  Reread the unexpired vectors inside the current inventory transaction before
  lookup. Missing, malformed or expired vectors cannot hit a successful model.
- Preserve the existing query-bound evidence fingerprints. Membership changes,
  shared synopsis copies and holdouts must still be reflected in fresh evidence,
  even when they leave the selected fitting sample unchanged.
- Cache only completed, usable models. Failures and cancellations publish no
  entry. Concurrent cold requests may fit independently; a caller must never
  inherit another caller's aborted promise or transaction.
- Use LRU eviction, finite entry/estimated-memory budgets and a five-minute
  non-sliding lifetime measured with a monotonic clock. Prune expired entries on
  access; idle cache memory is bounded but is not a timed deletion guarantee.
  Oversized models may be used for that request but are not retained.
  Each repository has at most eight profile entries (4 MiB accounting budget)
  and eight baseline entries (16 MiB accounting budget). Accounting includes
  retained numeric arrays and feature strings but is not a measured V8 heap cap.
- Preserve the numerical work budget per live request, including query scoring
  when a model is reused. Keep cancellation checks and cooperative fitting yields.
- Keep fresh policy, candidate, library, configuration and model checks, both
  retrieval snapshots, short-lived routing receipts and the global confirmation
  setting unchanged. Cached models never bypass explicit restrictions.

## Security and accessibility

Models remain internal and library-agnostic: names are neither training labels
nor cache authority. Private model parameters and cache fingerprints must not be
added to provider prompts, public APIs or logs. Caching observed placements does
not convert them into independently verified labels.

No new screen or status announcement is needed for an internal cache hit. Keep
existing review controls and keyboard behavior unchanged. If a future Command
Center summary exposes refresh health, announce meaningful status changes without
moving focus; do not announce every poll or cache access.

## Official research and date boundary

Sources were discovered with search/MCP services and opened on 12 September 2026.
Recommendations target practices available by August 2026, not later API features.
Mutable pages are not claimed to be historical August snapshots.

- [PostgreSQL 17: SET TRANSACTION](https://www.postgresql.org/docs/17/sql-set-transaction.html)
  explains transaction isolation and read-only modes. Keep a consistent snapshot
  within each retrieval and a separate fresh transaction for revalidation.
- [Node.js 17.9.1: timers](https://nodejs.org/download/release/latest-v17.x/docs/api/timers.html)
  documents abortable promise timers and `setImmediate`. These established APIs
  support the existing cancellable fitting loop; no runtime upgrade is needed.
- [WCAG 2.2, December 2024 Recommendation](https://www.w3.org/TR/2024/REC-WCAG22-20241212/)
  and [W3C ARIA22](https://www.w3.org/WAI/WCAG21/Techniques/aria/ARIA22)
  support accessible status messages. ARIA22 identifies a January 2026 update.
- [OWASP RAG Security: caching risks](https://cheatsheetseries.owasp.org/cheatsheets/RAG_Security_Cheat_Sheet.html#section-11-caching-risks)
  supports source-sensitive invalidation, cache isolation and limited lifetimes.
  This is a mutable supplemental cross-check, not a verified pre-August edition.
- [OWASP LLM08:2025](https://genai.owasp.org/llmrisk/llm082025-vector-and-embedding-weaknesses/)
  provides the pre-cutoff security basis: validate source integrity and maintain
  permission-aware retrieval boundaries instead of trusting embeddings as facts.

## Final recommendation stack

Existing PostgreSQL repeatable-read snapshots and pgvector cache; existing local
embedding representation checks; modular ESM exact-input model caches; unchanged
contrastive profile and empirical-baseline algorithms; fresh deterministic routing
validation; existing Vue interface with no additional user work.

## Acceptance

Test cold/warm numerical equivalence, source and representation drift, self/copy
exclusion, vector expiry/deletion, cache limits, cancellation and fresh routing
checks. Measure local cold/warm timings without routing media or changing the
administrator's confirmation setting. Report limitations alongside results in the
[outcome document](live-library-model-reuse-outcome.md).
