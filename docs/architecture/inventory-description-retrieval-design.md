# Inventory Description Retrieval — Design

Status: implementation design, 11 September 2026; unreleased.

## Decision and previous-commit review

Commit `84688585` compared freshly embedded descriptions within neighbors
selected by historical vectors. Six of 24 library winners changed. That did not
measure independent retrieval or correctness. Reuse its local-only transport,
projection and scoring, but now search descriptions across the active inventory.

Build an isolated, resumable shadow vector cache. A fresh inventory snapshot
determines membership and description hashes on every run; cache contents never
define the searchable inventory. Reuse unchanged vectors rather than requiring
another full embedding pass. No route, policy, provider setting, declaration,
review worksheet or dashboard control is changed.

## Recommendation stack and alternatives

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Re-embed everything each run | Simple, no persistent cache | Repeated compute and long runs | Reject |
| Isolated content-addressed cache and exact search | Reuses unchanged inputs; deterministic neighbor selection; no ANN recall loss | First build and snapshot collection cost time | Implement |
| Replace live classification vectors | Immediate runtime adoption | Mixes input contracts and unvalidated behavior | Reject |
| ANN index immediately | Faster at large scale | Additional recall and filter tuning before a baseline exists | Defer until measured |

Recommended stack: read-only repeatable-read inventory snapshot → normalized
synopsis/hash → versioned local vector cache → exact cross-library retrieval →
aggregate shadow report. A later component can schedule incremental refresh;
this command already avoids recomputing unchanged descriptions.

## Data and comparison contract

- Read current active movie/TV inventory, using current overview/summary and
  historical overview only as a missing-description fallback. Exclude inventory
  memberships with current source-conflict observations using the existing guard. Report missing and
  conflicting descriptions, rather than selecting a convenient sample.
- Merge duplicate stable identities and library memberships. If nonempty
  normalized descriptions disagree between copies, exclude that identity.
- Use the existing 1,000-code-point synopsis projection. No library names,
  titles, genre labels or policy text enter the embedding input.
- Preserve the sampler's cohort and exclude its entire set of identities from
  every candidate library. Never require an existing classification embedding
  for a corpus item to participate in fresh retrieval.
- Search all eligible same-media identities, keeping three nearest neighbors
  per library, then reuse mean-neighbor cosine library ranking. Stable identity
  ordering breaks neighbor ties; tied library scores remain ties.
- Compare fresh fixed-neighbor and inventory-wide conditions using identical
  current descriptions. Keep historical-vector results separately: historical
  input and model revision remain unknown. None of these is accuracy.
- Canonicalize cold and cached vectors to float32 before scoring, matching
  pgvector storage. Unqueried outcome receipts remain unknown, not negative.

## Cache and security boundary

The new table contains only projection version, local model name/digest,
dimensions, description hash, vector and creation time. No plaintext synopsis,
media/library identity, prior placement or decision record is persisted there.
Vectors and hashes are still sensitive derived data, not anonymized data; normal
database access and backup protections apply. There is no new HTTP endpoint.

Keys include representation and content hash. Model/projection/content changes
miss the cache. Query only hashes from the current snapshot. Removed/inactive
items cannot become candidates through an old cache row. Thirty-day-expired rows
are not read, and each command physically prunes a bounded batch of expired rows;
physical deletion is not guaranteed while the command is idle.

Before checkpointing each embedding batch, verify the installed local model
digest still matches. Reject redirects, cloud/remote models, invalid vectors,
dimension changes, oversized responses and silent provider truncation. Completed
batches may survive a later failure for resumption, but incomplete coverage must
never produce a successful retrieval report. No cloud fallback or model pull.

Bound snapshots to 50,000 membership rows and 10,000 unique descriptions; reject
overflow rather than truncate the corpus. Bound each raw/normalized vector set
in process to 20 million coordinates. Default work per run is 512 new descriptions, in batches
of eight; a CLI override permits up to 10,000 for a deliberate initial build.
Inference has a 40-minute total budget and 60-second request timeouts. Database
transactions finish before inference; cache writes use short atomic statements.
The CLI holds one database session advisory lock to prevent competing shadow
builds; the lock is not a long-lived database transaction or a media-routing lock.

## Official research and date limitations

URLs were discovered using web/MCP search and read on 11 September 2026 for the
requested August 2026 baseline. Living documentation is not a verified August
snapshot; no September-only feature is required.

- [pgvector](https://github.com/pgvector/pgvector) documents exact search and
  the recall/speed tradeoff of approximate indexes. Start with exact cosine
  ranking and apply media/cohort filtering before neighbor selection.
- [Ollama embedding API](https://docs.ollama.com/api/embed) supports batches and
  explicit truncation control. Reuse the bounded local-only adapter.
- [Mixedbread model card](https://huggingface.co/mixedbread-ai/mxbai-embed-large-v1)
  recommends a retrieval-query instruction. Keep symmetric synopsis comparison
  as this baseline; evaluate instructed query formatting as a separate condition
  rather than changing retrieval and query representation simultaneously.
- [PostgreSQL INSERT](https://www.postgresql.org/docs/18/sql-insert.html) supports
  atomic conflict handling for resumable cache writes. Do not replace live rows.
- [OWASP RAG Security](https://cheatsheetseries.owasp.org/cheatsheets/RAG_Security_Cheat_Sheet.html)
  informs provenance isolation, content hashing, cache expiry and treating
  retrieved content as data rather than downstream authority.
- [W3C status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages)
  informs future concise accessible progress. This component adds no UI noise;
  progress reports are aggregate-only and do not expose descriptions.

## Validation

Test corpus membership, deletion, missing/conflicting descriptions, cohort/media
exclusion, independent neighbors, ties, cache reuse, expiry, model/content
changes, failure/resumption and budgets. Exercise the actual SQL and migration
with PostgreSQL/pgvector. Run the local Compose build, then a cold and warm shadow
comparison. Record measurements and limitations in a separate outcome document.
