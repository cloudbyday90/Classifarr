# Inventory Description Comparison — Outcome

Status: implemented and tested locally, 11 September 2026; unreleased.

## Delivered

The previous commit, `1e31e23a`, supplied a declaration-free inventory sampler
but compared stored embeddings with unverified historical input text. This
component adds a paired experiment that re-embeds actual descriptions on both
sides. It does not change the live classifier, thresholds, policy declarations,
learning, or media placement.

Small ESM modules separate description projection, local-provider transport and
comparison orchestration. The existing sampler now retains provider/model/
dimension provenance privately. Both conditions share one library-ranking
function instead of maintaining separate scoring implementations.

The database snapshot closes before inference. Requests use the configured
local Ollama model, bounded batches, explicit truncation rejection and model
digest checks before and after inference. No cloud fallback, model download,
database write or new UI control is introduced. Reports exclude descriptions,
item identities, library names and vectors.

## Real Compose measurement

The rebuilt Compose service completed the default experiment in 99.10 seconds,
including sampling and inference. This is one measured run, not a general
performance guarantee.

| Measurement | Result |
| --- | --- |
| Active libraries | 10 |
| Sampled / paired items | 24 / 24 |
| Excluded items or missing neighbor descriptions | 0 |
| Neighbor occurrences in each condition | 360 |
| Unique descriptions embedded | 312 |
| Embedding batches | 39, at most eight descriptions each |
| Shortened description occurrences | 0 |
| Changed leading libraries | 6 of 24 |
| New or resolved ties | 0 |
| Stored-vector agreement with current placement | 22 of 24 |
| Description-only agreement with current placement | 18 of 24 |
| Independently labeled samples | 0 |
| Measured accuracy | Unavailable |

The configured model was `mxbai-embed-large:latest`, with 1,024 dimensions.
Its digest remained
`468836162de7f81e041c43663fedbbba921dcea9b9fefea135685a39b2d83dd8`.
The historical vectors' model revision and input format remain unverified.

Each stratum contained six items. Leading-library changes were: documentary 0,
genre-overlap 3, ordinary 2 and reality 1. The experiment did not establish which
of those changes was correct, and did not specifically validate the screenshot
item. No content-bearing per-item results were printed or committed.

## Interpretation and tradeoffs

Descriptions materially affected rankings even when the neighbor pool was
fixed. That is useful evidence for continuing semantic retrieval work, but not
evidence for raising confidence scores or routing these items automatically.
Lower agreement could reflect useful corrections, worse matches, or a mixture.
Existing membership is an observation, not independent ground truth.

| Recommendation | Advantage | Cost or limitation |
| --- | --- | --- |
| Keep paired comparisons | Isolates changes to representation within the same candidate pool | Cannot recover neighbors omitted by old retrieval |
| Use a separate description index next | Finds neighbors from actual synopsis meaning without embedding destination labels | Requires versioning, refresh, bounded compute and retrieval validation |
| Keep current routing authority unchanged for this experiment | Avoids promoting unvalidated ranking changes | Does not yet reduce live review counts |
| Avoid another diagnostic dashboard card | No extra setup or user workload | Detailed investigation remains a developer command |

## Running locally

```sh
docker compose exec -T classifarr node src/scripts/runInventoryDescriptionComparison.mjs
```

For a checkout with its normal local database configuration:

```sh
npm --prefix server run study:compare:inventory-descriptions
```

The command uses the sampler's optional `--size` (1–32) and `--seed` arguments.
It performs local inference; it is not a metadata-only command. It requires an
enabled, configured local Ollama embedding model already installed. It rejects
incompatible representations or reports explicit unpaired cases, and does not
silently fall back to a cloud provider. A failed inference produces no partial
success report. The private service inputs must not be logged.

## Validation and CI impact

- Full backend suite: 1,209 suites and 34,182 tests passed.
- Focused comparison, HTTP transport, sampler and CLI suites: 66 tests passed.
- Real loopback HTTP tests covered redirects, oversized responses, model
  identity, remote-model rejection, malformed responses and invalid vectors.
- Existing pgvector integration fixture: four tests passed, including the new
  representation-provenance assertions.
- Backend security/test lint, type checking, documentation lint, ESM static
  imports and mock shapes, and whitespace checks passed. Two test-fixture lint
  errors were corrected; its 20 tests and test lint passed again afterward.
- Compose rebuilt successfully; the real local model preflight and comparison
  completed, and the service remained healthy.

No client API contract, frontend, dependency, schema or CI workflow changed.
The unit tests use fake embeddings and loopback HTTP, so CI does not require
Ollama or send media descriptions to any provider.

The product-language, delivery-term-removal and runtime-release-maintenance
audits passed. The production-naming gate still reports the same 26 pre-existing
references documented in the sampler outcome. That gate was not weakened; this
work does not claim that the entire repository CI pipeline is green.

## Pull request availability

GitHub MCP returned no open pull requests for `cloudbyday90/Classifarr` on
11 September 2026. There was no open PR to randomly select or implement locally,
and none was merged. [Repository pull requests](https://github.com/cloudbyday90/Classifarr/pulls)

## Final recommendation and next component

Recommended stack: inventory sampler → versioned description-only projection →
local embedding batches → exact paired comparison → aggregate findings.
The [design document](inventory-description-comparison-design.md) records
official sources discovered through web/MCP research, August-baseline date
limitations, W3C considerations and security decisions.

Follow-up implemented: see the
[inventory-wide retrieval outcome](inventory-description-retrieval-outcome.md)
for the real cache and retrieval measurements. The original next step was to
build isolated, description-based retrieval across the current inventory.
Let it select its own neighbors, retaining whole-cohort exclusions and testing
provider-recommended query formatting as a separate condition. Start with a
bounded shadow evaluation, not a live routing switch. Use these results to
design an incremental background index that refreshes changed descriptions
without new purpose declarations or per-library review worksheets.

That directly advances Classifarr toward learning library contents with less
user involvement. Existing placements must not become unquestioned truth, and
neither this experiment nor a future index alone proves routing accuracy.
