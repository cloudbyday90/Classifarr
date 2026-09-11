# Inventory Description Retrieval — Outcome

Status: implemented, tested locally, unreleased on 11 September 2026.

## Delivered and reconciled

The previous commit's description comparison still depended on neighbors
selected by historical classification embeddings. This component now searches
descriptions across eligible active inventory, including items that have never
had a classification embedding. It changes the candidate retrieval experiment,
not live routing, policy thresholds or automatic learning.

- Added separate ESM corpus, cache, retrieval, reporting and CLI modules.
- Reused the existing sampler, local-only provider transport and source-conflict
  guard. Shared cosine normalization and library-winner selection with the
  previous comparison to avoid divergent implementations.
- Added an isolated vector-cache migration and regenerated/validated the
  authoritative fresh-install schema. No existing embedding table was replaced.
- Keyed cached vectors by projection, model/digest, dimensions and description
  hash. Unchanged descriptions are reused; changed inputs are embedded again.
- Added verified batch checkpoints, bounded expiry cleanup and a CLI session
  advisory lock. Failed or overlapping builds do not claim successful retrieval.
- Kept all media descriptions and membership identities out of persistent cache
  rows and printed reports. Derived vectors/hashes remain sensitive local data.

No new settings screen, purpose declaration, acknowledgement or reviewer
worksheet is required. This is currently a developer-run shadow command, not an
automatically scheduled refresh worker or a change to the live AI prompt.

## Local Compose results

The initial cold build used the configured local Ollama model. A subsequent
warm run after rebuilding reused the entire cache and reproduced the aggregate
retrieval results. Measurements include the historical-baseline sampler:

| Measurement | Cold build | First warm run |
| --- | --- | --- |
| Elapsed time | 214.87 seconds | 33.97 seconds |
| Eligible identities with descriptions | 6,647 | 6,647 |
| Unique description vectors needed | 6,644 | 6,644 |
| Cached vectors reused | 0 | 6,644 |
| New descriptions embedded | 6,644 | 0 |
| Descriptions remaining | 0 | 0 |
| Expired cache rows pruned | 0 | 0 |

After the final float32-parity refinement, another warm run completed in
34.87 seconds with the same coverage, zero new embeddings and identical ranking
counts. These individual timings are not a general performance guarantee.

The filtered source contained 6,651 membership rows and 6,649 stable identities.
Two identities had no usable description; none had conflicting normalized
descriptions. Two descriptions were explicitly shortened by the versioned
projection. The full active inventory census was larger: eligibility filters,
including the existing source-conflict guard, still apply. These are not counts
of every unfiltered media-server record.

The model was `mxbai-embed-large:latest`, with 1,024 dimensions and digest
`468836162de7f81e041c43663fedbbba921dcea9b9fefea135685a39b2d83dd8`.
Digest/dimension checks passed. A concurrent second CLI run returned
`already_running` without duplicating inference.

## Retrieval finding

All 24 sampled queries could be compared across libraries. Full-cohort identity
exclusions applied throughout. Each condition contained 360 neighbor slots;
only 107 overlapped, so independent retrieval replaced 253 slots.

| Condition | Leading library matched current placement |
| --- | --- |
| Historical stored vectors | 22 of 24 |
| Current descriptions, historical fixed neighbors | 18 of 24 |
| Current descriptions, independently retrieved inventory neighbors | 21 of 24 |

Moving from fixed to independent description retrieval changed four leading
libraries: two genre-overlap items and two ordinary items. Documentary and
reality strata had no winner changes in this comparison. There were no new or
resolved library ties and no missing fixed-neighbor descriptions.

This establishes that the old neighbor pool omitted many items selected by
fresh semantic retrieval. It does not establish which placement is correct.
There are no independent labels, so accuracy remains unavailable. Existing
placement is not ground truth; 21/24 must not become a displayed confidence
percentage. The screenshot item itself was not separately validated here.
Outcome receipts are not queried by the fresh retrieval path and are reported
as unknown, rather than as evidence that no receipts exist.

Warm-run time includes the existing historical sampler, not just exact vector
search. Do not use 34 seconds as an estimate for a future online retrieval
request. Keep baseline collection out of the eventual classification path.

## Running and resuming

A deliberate initial build for an inventory within the documented bounds:

```sh
docker compose exec -T classifarr node src/scripts/runInventoryDescriptionRetrieval.mjs --max-new-descriptions 8192
```

Normal bounded invocation:

```sh
docker compose exec -T classifarr node src/scripts/runInventoryDescriptionRetrieval.mjs
```

The checkout also exposes `npm --prefix server run study:retrieve:inventory-descriptions`.
For extra CLI arguments, invoke the Node script directly rather than forwarding
unsupported flags through npm 12. The default embeds at most 512 new
descriptions; the override permits 1–10,000. Existing `--size` and `--seed`
options affect sampled queries, never truncate the searchable corpus.

Incomplete coverage returns `warming_cache`, no comparison and a nonzero exit.
Rerunning resumes matching verified cache entries. `already_running` also exits
nonzero. Errors can retain completed cache batches but do not move media. Cache
entries older than 30 days are not read; bounded physical cleanup occurs on
command execution, not on a continuously running expiry schedule.

## Validation and CI

- Focused service, transport, sampler and CLI tests passed, covering independent
  neighbors, cohort/media exclusions, deletion, warm reuse, content/model
  changes, partial-build resumption, provider failure, ties and the build lock.
- Eight PostgreSQL/pgvector integration tests passed. They exercise the actual
  migration twice, vector constraints, key provenance, expiry/replacement,
  current metadata precedence, typed descriptions and inventory-only items.
- Backend security/test lint, type checking, documentation lint, ESM static
  imports/mock shapes, migration naming and whitespace checks passed.
- Authoritative schema dump and fresh-container schema verification passed.
  An initial test path error was corrected. An npm flag-forwarding invocation
  failed; invoking the schema script directly completed the check successfully.
- Final full backend suite: 1,211 suites and 34,261 tests passed. CI tests use
  fake embeddings or loopback HTTP, not the user's Ollama service.

No client API contract, frontend component, dependency or CI workflow changed.
Product-language, delivery-term-removal and runtime-release-maintenance audits
passed. The production-naming gate remains blocked by the same 26 pre-existing
references. This component does not claim a completely green repository CI run.

GitHub MCP returned no open PRs for `cloudbyday90/Classifarr` on 11 September
2026, so no random open PR could be implemented locally and none was merged.
[Repository pull requests](https://github.com/cloudbyday90/Classifarr/pulls)

## Recommendation stack, tradeoffs and next component

Final stack: fresh inventory snapshot → synopsis projection/content hash →
isolated local cache → exact eligible-neighbor retrieval → aggregate shadow
comparison. The [design](inventory-description-retrieval-design.md) records
official-source research, the August-baseline date caveat, W3C considerations
and security boundaries.

Advantages: descriptions drive retrieval; unchanged items need no repeated
inference; interrupted work resumes; no new user-facing administration.
Limitations: initial indexing costs compute, this is not yet automatic refresh,
mean-top-three scoring can favor large/mixed libraries, and current placement
cannot prove correctness. Do not replace live routing solely from this result.

Next implement an automatic incremental refresh worker tied to inventory sync.
Reuse this cache and source projection, respect configured local-provider/RAG
state, bound each job and skip unchanged content. Separate that maintenance job
from the historical comparison sampler. Then the AI comparison can consume
fresh description-selected examples without asking users to rebuild indexes
or declare every library's purpose manually.

This follow-up is now implemented in the
[automatic description refresh outcome](inventory-description-refresh-outcome.md).
