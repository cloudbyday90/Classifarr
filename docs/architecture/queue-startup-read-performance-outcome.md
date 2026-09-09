# Queue startup read performance outcome

## Implemented outcome

The queue worker health check now reads active and recent-completed task
windows separately through `queueWorkerHealthRead.mjs`. The migration adds the
two supporting partial indexes.

The metadata refill path now advances by an ordered page of supported media
IDs. It records the frozen pass bound, number of scanned IDs, and final scanned
ID with candidate rows. Empty or ineligible pages therefore continue
automatically, while an enqueue failure restores the pre-read checkpoint and
retries the same page. Candidate IDs remain ascending through a bounded
in-process sort instead of a database payload sort.

All code is ES Module code. The change adds no dependency, API endpoint,
automatic routing, policy selection, semantic evidence, or operator action.

## Local evidence

The local PostgreSQL plan trial used the current container data:

| Read | Before | After | Result |
| --- | ---: | ---: | --- |
| Worker health | 161ms, 9,114 pages, sequential scan | 1.5ms, 18 pages, index-only scans | Selected indexes support the intended small windows. |
| Refill candidate page | 456ms, 5MB external sort | 215ms, ID-only in-memory sort | No wide-payload external sort; the source page stays bounded. |

Values are local observations, not a performance guarantee. The change is
correct independent of the number of libraries, active providers, or media
servers because page progression depends only on persisted IDs and the frozen
high-water mark.

## Validation

- The generated refill SQL was parsed and run with `EXPLAIN (ANALYZE, BUFFERS,
  SETTINGS)` against the local container.
- Focused refill, enrichment, and health-service tests passed: 3 suites and 129 tests.
- The migration naming and schema-snapshot integrity check passed.
- The static ESM import check and whitespace diff check passed.

## Recommendation stack

1. Keep the two health indexes and the separated health read.
2. Keep ID-first pagination and its progress metadata as the refill boundary.
3. Monitor slow-query execution time, buffer reads, queue row count, and
   candidate-page yield without logging media payloads or provider secrets.
4. Re-run `EXPLAIN (ANALYZE, BUFFERS)` after material queue-volume changes
   before adding further indexes.

## Next item

Add a privacy-preserving, aggregate performance receipt for the refill and
queue-health paths: plan version, duration bucket, scanned-ID count,
candidate count, and buffer bucket. It should be passive observability only.
It must not select a cohort, infer policy intent, invoke a provider, create
labels, or route media. That receipt will make future performance tuning
evidence-driven without adding operational work.
