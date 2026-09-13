# Lazy corpus synopsis projection: design

## Decision and previous-commit review

Commit `6028bb09` correctly narrowed live reads to movie or TV inventory without
discarding same-media libraries. Its measured query plan still carried full
classification-history JSON through sorting, even when inventory already had a
usable synopsis. Keep media scoping and fitted-model reuse unchanged.

Replace the unconditional history lateral join with a correlated scalar lookup
inside the existing synopsis `COALESCE`. Read the latest typed history overview
only when neither inventory overview nor summary supplies a nonblank string.
The history JSON object is no longer a joined output carried through sorting.

Apply this to the existing shared ESM SQL builder, not a second implementation:
live retrieval, global refresh and evaluation reads share the same fallback
semantics. Query text changes for global consumers, but their columns, all-media
scope, ordering, row limits and returned values must remain identical. The
existing small module does not need another service or singleton.

## Alternatives, pros and cons

| Option | Benefit | Cost or risk | Decision |
| --- | --- | --- | --- |
| Keep full-history lateral join | No query change | Sorts unnecessary history payload and reads unused fallback rows | Replace |
| Project only history overview in lateral join | Narrower sort rows | Still looks up history for every inventory row | Measured, not selected |
| Lazy scalar fallback | Smaller sort payload and no unused history reads | Requires strict fallback, history-order and parity tests | Selected |
| Force materialized projection CTEs | Can control repeated computation | May inhibit optimization and add temporary storage | Defer |
| Raise global sort memory or add indexes | Could help some plans | Per-operation memory/concurrency cost; existing history index already works | Not needed for this component |

The read-only local prototype compared all three query implementations for
movie, TV and all-media scope in three alternating-order rounds. Returned rows
matched exactly in every arm. The lazy variant performed best overall and
reduced observed history scans from 5,008 to 2 for movies and 1,643 to 0 for TV.
Final code and rebuilt-service measurements belong in the separate outcome.

## Compatibility and safety requirements

- Preserve precedence: trimmed nonblank string overview, then trimmed nonblank
  string summary, then the latest history row's string overview, then empty text.
- Preserve history whitespace and null/type behavior. Do not search older history
  for a usable synopsis when the latest row lacks one. Keep `created_at DESC,
  id DESC`, including existing null ordering and typed movie/TV identity matching.
- Keep the 4,000-character SQL output bound, 50,001 overflow sentinel, deterministic
  inventory ordering, evaluation metadata bound and all candidate metadata fields.
- Preserve active/media-compatible libraries and source-conflict exclusion before
  ordering/limiting. No shortlist-only filtering or hard-coded library names.
- Keep parameter binding, fresh read-only transactions, cancellation, corpus
  budgets, vector freshness, model-cache keys and routing validation unchanged.
- A lazy lookup is not removal of authorization checks: all existing source and
  library guards still apply. Descriptions remain untrusted data, not instructions.
- No schema, dependency, API, user acknowledgement, scheduled job or new cache.
  Log only allowlisted aggregate performance results, never private corpus rows.

## Official sources and August 2026 applicability

URLs were discovered through search/MCP and official documentation navigation,
then opened on 12 September 2026. The implementation uses established PostgreSQL
17 behavior and OWASP 2025 guidance, not features introduced after August 2026.
Mutable documentation is not claimed to be an archived August snapshot.

- [PostgreSQL 17 conditional expressions](https://www.postgresql.org/docs/17/functions-conditional.html)
  documents short-circuit evaluation of `COALESCE`. Put the correlated fallback
  inside that expression rather than assuming an outer join becomes lazy.
- [PostgreSQL 17 SELECT](https://www.postgresql.org/docs/17/sql-select.html)
  explains when output expressions can be evaluated after sorting and limiting.
  Preserve the explicit total ordering and measure the actual chosen plan.
- [PostgreSQL 17 TOAST](https://www.postgresql.org/docs/17/storage-toast.html)
  explains out-of-line/compressed values and in-memory representations. Large
  JSON values can carry materialization costs; this is a reason to measure
  projection width, not to change storage settings speculatively.
- [PostgreSQL 17 WITH queries](https://www.postgresql.org/docs/17/queries-with.html)
  describes materialization tradeoffs. An optimization fence is not inherently
  faster and is unnecessary when a smaller expression change works.
- [PostgreSQL 17 using EXPLAIN](https://www.postgresql.org/docs/17/using-explain.html)
  supports execution, loop, buffer and sort diagnostics. Node times are cumulative;
  planner widths are estimates, not actual payload measurements. Compare the
  same snapshot and distinguish instrumented execution from client latency.
- [OWASP LLM08:2025](https://genai.owasp.org/llmrisk/llm082025-vector-and-embedding-weaknesses/)
  supports source integrity and access-aware retrieval. Performance work must not
  omit source exclusions or turn retrieved content into routing authority.
- [W3C status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages)
  cautions against unnecessarily frequent announcements. An internal query
  optimization needs no additional UI panel or busy progress announcements.

## Final recommendation stack and acceptance

Keep PostgreSQL/pgvector, local embeddings, the shared modular ESM corpus builder,
media-scoped live reads, bounded exact-input model reuse and fresh deterministic
routing validation. Preserve the current Vue UI and automatic refresh behavior.

Test exact SQL-result parity against the preceding builder across all field/scope
variants, malformed JSON types, Unicode/length/whitespace boundaries, latest-row
fallback, duplicates, source conflicts and overflow ordering. Verify unused
history lookups do not execute. Repeat real Compose query comparisons and live
AI/RAG smoke outcomes without routing media or changing settings. Record results
and limitations in [the outcome document](lazy-corpus-synopsis-outcome.md).
