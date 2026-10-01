# Classification retrieval maintenance outcome

## Changes and findings

The production semantic query selects text-nearest candidates first, then combines
text and image scores within that candidate set. The earlier image-only benchmark
does not establish the cost or index requirements of this production query. The
new opt-in `node scripts/run-resource-study.mjs --classification-retrieval` mode
uses the actual SQL executor, recall settings and result mapper under image repair.

The query is now built in one pure, parameterized ESM function shared by production
and isolated plan measurements. A concrete projection bug is fixed: classification
status was selected inside the candidate query but dropped by its outer SELECT,
even though the mapper expected it. Real PostgreSQL regression tests now retain
status, preserve image reranking and missing-image fallback, and exclude stale or
unassigned rows both with and without an image index.

No image evidence, precision, candidate limit, threshold, ranking weight, production
deadline or queue ownership rule was weakened. No backpressure, image-index readiness
gate, privileged controller, migration or deployment-template change was introduced.

## Experiment and limits

The disposable study holds 50,000 synthetic 1,024-dimensional text vectors and
2,000-dimensional image vectors. Four movie/TV libraries ingest and enrich another
80 items per phase, while 40 semantic requests return five results from 50 candidates
using 70% text / 30% image weights. Every returned row must retain status and finite,
correctly weighted image evidence. SQL profiling runs separately from latency samples;
the receipt contains only aggregate booleans, counts and timings, not raw plans,
vectors, titles, SQL or credentials.

Read-only transactions and five-second statements bound study retrieval. The study
retains its single-reader, no-parallel-gather setting. It is not a concurrency sweep,
the larger 200-candidate recheck configuration, an AI-provider benchmark, full
classification/routing evidence, a semantic accuracy evaluation or a production SLA.
Cache state, growing inventory, host validation work and sequential case order limit
cross-phase comparisons. No physical memory exhaustion is injected.

The first experimental project,
`classifarr-resource-study-67aa30602eed08266f294d4443675886`, failed during its bulk
synthetic history assignment, before retrieval, and cleaned up. Its sanitized error
report did not retain SQLSTATE, so it does not establish a definitive failure cause.
Inspection found per-row totals/search triggers; a real-schema 100-row assignment
regression passes. The final fixture bounds history assignments to 100 rows just
like vector writes, without increasing the database statement timeout.

## Measured Docker outcome

Measured on 1 October 2026 with enforced 4 GiB / 2 CPUs / 128 PIDs. Total study
duration, including cohort preparation, was 407.87 seconds.

| Phase | Repair seconds | Retrieval p95 ms | Scan p95 ms | Reads overlapping build | Sampled container peak MiB |
| --- | ---: | ---: | ---: | ---: | ---: |
| Baseline, no image index | — | 9.59 | 207.09 | 0 | 2,527.0 |
| Active image build | 48.07 | 10.09 | 247.55 | 40 | 3,725.7 |
| Deliberately cancelled build | 4.19 to observed cleanup | 49.58 | 491.62 | 9 | 2,609.8 |
| Invalid-index recovery | 47.04 | 10.82 | 607.48 | 40 | 3,766.7 |

Every measured plan used `idx_embeddings_hnsw`, never
`idx_embeddings_image_hnsw`, with no sequential embedding scan and exactly 50
candidate rows. Separately profiled SQL execution was 7.49 / 8.99 / 17.31 / 9.49 ms
respectively. Request latency also includes transaction/recall-setting overhead;
plan timing is not an interchangeable metric. These measurements support keeping
this retrieval path available during image repair, not pausing it on image-index
presence alone. They do not establish behavior without the **text** index.

All 320 movie/TV items finished enrichment. All 800 semantic result rows retained
status and verified image-weighted scores. Music stayed excluded, original vector
counts and identity sums were preserved, both completed repairs verified three
indexes, and the stale interrupted claim was refused before recovery. Cancellation
did not acknowledge success. Database idle was confirmed 103 ms after the post-exit
check began; this is not an exact SIGTERM-to-cancellation latency measurement.

No OOM kill, memory-limit hit or PID-limit hit was recorded. Peak raw container
memory was about 3.68 GiB (92% of its limit), including PostgreSQL and filesystem
cache; it is not an application heap measurement. CPU throttling occurred in 75 of
4,074 elapsed quota periods (about 1.8%). This single-reader workload leaves no basis
for increasing default limits or claiming safe peak concurrency. Owned cleanup
passed, and the existing live Classifarr container remained unchanged and healthy.

Receipt: `.tmp/resource-study/classifarr-resource-study-f5b3d278155f241fab50e9c99e2dd937/result.json`.
Tested image: `sha256:3c0fb4c4e795a542a0cfa3f5a8a8a2f0606e258e6e7f5bc87c71fc46752c606e`.
Receipts are ignored, regenerable intermediates; these committed documents retain
the measured conclusions. The final host report heading was clarified after the
experiment; its execution code and measurements are unchanged.

## Verification and delivery

The targeted suite passed 361 tests across 59 suites. Real PostgreSQL integration
passed 48 tests across seven suites. Lint, type checks, naming/language/maintenance
gates, ESM checks and CI preflight passed. Ownership review records 19 owned,
224 separately coordinated and 490 unresolved paths; unresolved debt remains
unchanged. The full backend coverage run passed 1,605 suites / 49,050 tests, with
one existing skip; the final focused suite also covers the subsequently added
session/fixture failure cases. Backend coverage is 90.01% statements/lines, 85.35%
branches and 91.63% functions. Frontend coverage passed 412 suites / 5,835 tests.
The combined coverage ratchet passed without lowering any baseline.

GitHub MCP and the saved GitHub CLI login both returned an empty open-PR list for
`cloudbyday90/Classifarr`; no random PR was available and no PR was merged. Unreleased
changelog notes cover the change. No release or live deployment update was performed.

## Recommendation and next component

Keep text-first candidate selection, image reranking and independent image-index
recovery. Benefit: no new blanket classification wait or loss of image evidence.
Cost: resource contention can still occur, and a single synthetic reader cannot
establish a safe global concurrency limit. Do not increase CPU/memory defaults or
reduce candidate quality based on this experiment.

Next: **propagate classification retrieval cancellation into its database work**.
`classificationUtilsService` supplies an abort signal to semantic retrieval, but
`ragRetrieverSemanticSearch` does not pass it into `executeSemanticVectorSearch`.
Reproduce timeout during active SQL, then design bounded database cancellation and
connection cleanup that prevents late success, leaked queries and unsafe connection
reuse. Test it under concurrent callers before considering request coalescing or
backpressure. This is a code-observed gap to validate, not a claimed incident from
the successful retrieval measurements in this study.

Research, alternatives and the implementation plan are recorded separately in the
[design document](classification-retrieval-maintenance-design.md).
