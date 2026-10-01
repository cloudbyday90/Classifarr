# Classification retrieval during image-index maintenance

## Decision and scope

Measure the production semantic SQL before adding maintenance-triggered backpressure.
It retrieves a bounded candidate set by text distance, then reranks those candidates
with image similarity. The previous image-only nearest-neighbor benchmark does not
represent this query or establish that classification needs the image HNSW index.

Reuse the disposable, collision-checked resource study with four phases: baseline,
active build, interrupted build and claim-fenced recovery. Use synthetic embeddings
and providers only, four movie/TV libraries and actual intake/enrichment queue work.
Do not call paid providers, perform routing, change live data or update deployment
templates. The image budget remains 4 GiB / 2 CPUs / 128 PIDs.

## Implementation plan

1. Extract the parameterized semantic query into a pure ESM builder shared by
   production execution and the isolated query-plan measurement. Preserve candidate
   limits, filters, precision, weights, held-out exclusions and recall settings.
2. Populate the existing 50,000-row synthetic image cohort with deterministic text
   vectors and assigned libraries. Measure real semantic retrieval during each
   existing repair phase, retaining the real ingestion/enrichment completion checks.
3. Capture aggregate `EXPLAIN (ANALYZE, BUFFERS, TIMING OFF, FORMAT JSON)` evidence
   separately from normal request latency. Never persist raw plans, SQL parameters,
   titles or vector contents. Check finite image contributions and weighted scores.
4. Fix the missing status projection found during tracing: the result mapper already
   exposes classification status, but the outer SQL currently drops it.
5. Add a closed receipt/report contract and regression tests. Decide on further
   admission controls only from measured contention and correctness evidence.

This tests the classification **retrieval component**, not model quality, the full
classification pipeline, routing exactly-once behavior or external provider latency.
Sequential phases, changing inventory, synthetic vectors and cache effects limit
performance comparisons. Do not infer quality or a production SLA from the study.

## Alternatives and recommendation stack

| Option | Benefit | Cost or risk | Decision |
| --- | --- | --- | --- |
| Measure the existing text-first query | Preserves image evidence and current ranking | Does not itself eliminate contention | Implement first |
| Pause classification whenever an image index is absent | Simple rule | Blocks a query that may not need that index | Reject without evidence |
| Coalesce identical retrieval requests | May reduce duplicate work | Cancellation, scope and stale-result semantics need design | Consider only if duplicates are measured |
| Globally raise limits or lower candidate count | Can improve one benchmark | More contention or weaker retrieval quality | Do not change |

Recommendation: actual SQL → explicit candidate bounds → plan and score evidence →
repair overlap/cancellation/recovery checks → targeted admission only if justified.
Keep existing claim fencing, maintenance deadlines and queue behavior unchanged.

## Official research

Discovered through web research on 1 October 2026 for the requested September 2026
baseline; these are live documents, not an archived September snapshot.

- [PostgreSQL EXPLAIN](https://www.postgresql.org/docs/18/sql-explain.html): ANALYZE
  executes the query and adds measurement overhead; use disposable SELECT workloads,
  current statistics and separate measurements rather than timing an altered query.
- [pgvector documentation](https://github.com/pgvector/pgvector/blob/master/README.md?plain=1):
  approximate nearest-neighbor index use depends on the ordering expression. Inspect
  the real plan; do not substitute image-only retrieval or reduce recall settings.
- [W3C status messages](https://www.w3.org/WAI/WCAG21/Understanding/status-messages):
  waiting, completed and failed outcomes must remain understandable. This backend
  study uses labeled textual tables and distinguishes cancellation from completion;
  it introduces no UI and claims no accessibility certification.

## Outcome

The separate [outcome document](classification-retrieval-maintenance-outcome.md)
records measurements, validation, PR availability and the evidence-backed next
component.
