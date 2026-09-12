# Media-scoped live retrieval: design

## Decision

Filter the live inventory corpus by the requested movie/TV type in PostgreSQL,
before returning rows and applying corpus limits. Continue reading every active
same-media library, not merely the two or three shortlisted destinations.

Commit `970aa5f0` added bounded fitted-model reuse. Its local qualified-case
validation still spent most of its time in two fresh retrieval calls. Reviewing
the corpus query showed that it loads both movie and TV inventory and only later
filters training and similarity candidates in JavaScript. This component removes
that unrelated-media work without changing learned scoring or routing authority.

## Alternatives and tradeoffs

| Option | Pros | Cons | Recommendation |
| --- | --- | --- | --- |
| Filter after a global inventory read | Existing behavior; one shared query | Extra transfer/preparation; unrelated media consumes live corpus limits | Keep only for global consumers |
| Parameterized media-scoped live read | Less unrelated work; same-media learning remains complete | Must test identity boundaries, exclusions and global-query compatibility | Implement |
| Read only shortlisted libraries | Smaller result set | Omits shared copies and contrasting metadata outside the shortlist | Reject |
| Add indexes or materialized inventory immediately | Could reduce database work further | Storage/write complexity without identifying the expensive phase | Measure first |

## Boundaries and implementation

- Extend the existing SQL builder with a fixed, internal media-scope option. Bind
  the requested type as a SQL parameter; never interpolate request text into SQL.
- Extract a small live-corpus reader which validates movie/TV scope and its typed
  stable identity, executes the existing query inside the caller's transaction,
  and rejects unexpectedly mixed-media results or scope changes during the read.
- Keep source-conflict exclusion, active-library/media compatibility, stable
  ordering, synopsis fallback and bounded row/document counts unchanged.
- Read all same-media library memberships so copies, conflicting descriptions,
  query/stored synopsis exclusions and contrastive background profiles remain
  intact. Do not train library categories from their names.
- Preserve default all-media SQL for background vector refresh, frozen benchmark
  snapshots and other global consumers. No new scheduler or index-refresh system.
- Keep model-cache identities, vector expiry, both fresh routing snapshots,
  current policy/configuration checks and short-lived routing receipts unchanged.
- Live bounds now apply to the requested media corpus. A large unrelated-media
  corpus must not make an otherwise bounded live request unavailable. This is a
  deliberate availability improvement, not a relaxed per-request memory limit.

## Security, UI and efficiency

This is a read-only optimization with no new database schema, API endpoint,
dependency, user preference or acknowledgement. Request scope is not permission:
the existing source and library checks still govern admitted evidence. Diagnostics
must report only allowlisted counts and timings, not titles, synopsis text, IDs,
query plans with private literals, model vectors or credentials.

No UI refactor is necessary for an internal query filter. Preserve existing
review controls and accessible status behavior. Do not add progress announcements
for each internal read or make the Command Center more crowded.

## Official research and August 2026 boundary

Sources were discovered through search/MCP and opened on 12 September 2026.
Versioned PostgreSQL 17 documentation and OWASP's 2025 risk guidance provide the
technical basis; mutable documentation is not represented as an archived August
2026 snapshot. No post-August API feature is required.

- [PostgreSQL 17: EXPLAIN](https://www.postgresql.org/docs/17/sql-explain.html)
  supports structured plan inspection and actual execution measurements. Explain
  only SELECT statements in read-only transactions; avoid treating planner cost
  as elapsed time or instrumented execution as end-to-end latency.
- [PostgreSQL 17: examining index usage](https://www.postgresql.org/docs/17/indexes-examine.html)
  recommends examining real workloads rather than assuming an index helps.
  Inspect existing plans/statistics before proposing a schema change.
- [OWASP LLM08:2025](https://genai.owasp.org/llmrisk/llm082025-vector-and-embedding-weaknesses/)
  supports source integrity and permission-aware retrieval. Narrowing by media
  must not remove checks on conflicting sources or same-media memberships.
- [W3C: status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages)
  distinguishes accessible status reporting from creating unnecessary messages
  and cautions against overly frequent announcements. This internal optimization
  does not require another visible progress panel.

## Final recommendation stack

Existing PostgreSQL/pgvector with parameterized, repeatable-read live queries;
local embedding checks; modular ESM corpus/retrieval services; bounded learned
model reuse; unchanged deterministic routing validation; existing Vue interface.

## Acceptance and measurement

Prove movie/TV isolation, full same-media membership, identical evidence and
fingerprints for formerly bounded inputs, stored/copy/conflict exclusions,
cancellation and malformed-scope rejection. Prove global SQL remains all-media
and same-media corpus limits still reject over-budget requests.

Use read-only local comparisons with equal inputs and identical AI proposals.
Measure corpus query/transfer, preparation/fitting, ranking/vector reads and
representation checks separately where observable. Compare structured SELECT
plans and returned counts without logging private rows. Report limitations and
actual outcomes in the [outcome document](media-scoped-live-retrieval-outcome.md).
