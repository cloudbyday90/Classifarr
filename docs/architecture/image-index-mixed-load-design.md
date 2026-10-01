# Image-index mixed-load and cancellation design

## Decision

Test the boundary after capacity admission, before changing production memory,
concurrency or retry policy. The previous sequential study cannot establish how
foreground work or cancellation behaves during an active HNSW build.

Use `node scripts/run-resource-study.mjs --image-index-mixed`. Reuse the existing
random, collision-checked disposable Compose project, fresh volume, internal
network, production image and enforced 4 GiB / 2 CPU / 128 PID study budget.
No live settings, deployment templates, credentials or library data are changed.

## Experiment

Seed 50,000 deterministic 2,000-dimensional vectors. Run four bounded cases:

1. Foreground baseline without image indexes or an index build.
2. Begin foreground work only after observing the actual index building phase.
3. Repeat; terminate the worker during building after at least five foreground
   retrievals overlap. Independently verify PostgreSQL stops, the index remains
   incomplete, and the interrupted claim has not acknowledged success.
4. Rotate only that synthetic claim, reject the old token, then repair the invalid
   index while foreground work starts again. Verify all three exact indexes.

Foreground work uses real media ingestion, queue enrichment and local content
analysis with synthetic movie/TV provider adapters. Four libraries receive 20
new items each per case. Music is excluded. Forty fixed nearest-neighbor reads
exercise the image retrieval database path, with a five-second statement ceiling.
This is not a full AI classification/routing or external-provider latency test.

Record scan and retrieval p50/p95/max, actual overlap observations, end-to-end
foreground completion, worker time, PostgreSQL stop delay, and sampled cgroup
memory/CPU. Verify original embedding counts and identity sums, growing enriched
inventory, natural backfill completion, no pending foreground work, no OOM/limit
events and owned cleanup. Every started promise is observed and joined.

The baseline and mixed cases are sequential and inventory grows. Cache order,
index availability and service warming confound direct ratios. No production
latency SLA, recall guarantee or physical memory-pressure claim follows from one
run. Existing low-headroom admission tests remain separate.

## Alternatives and recommendation stack

| Option | Pros | Cons | Recommendation |
| --- | --- | --- | --- |
| Admission plus concurrent DDL | Preserves availability and existing ownership | New work can arrive after admission | Retain and measure |
| Session-scoped disconnect detection | Can stop abandoned long queries without a second privileged controller | Requires PostgreSQL/platform support and a small polling cost | Selected after mid-build cancellation failed |
| External PID cancellation controller | Explicit server-side cancellation | Extra connection, PID identity/race checks and authority | Avoid unless needed |
| Cancel whenever foreground work starts | Prioritizes new work immediately | Repeated invalid indexes and repair starvation | Do not add without pressure evidence |
| Longer deadlines or larger default limits | May complete more repairs | More contention and stale ownership risk | Do not infer from this study |

Stack: capacity admission → single concurrent build → bounded foreground work →
independent database cancellation evidence → claim-fenced recovery → aggregate
report. No new always-running service or Compose update is required.

The reproduced gap is addressed with `client_connection_check_interval = '1s'`
on the pinned maintenance session. Only the validated colocated Linux worker opts
in; the pool discards that session afterward. A failed setting fails closed before
DDL. Standalone/external callers, index definitions, claim fencing, retry charging,
SQL deadlines and supervisor lifetimes are unchanged. This is kernel-reported
disconnect detection, not a guaranteed response to every network partition.

## Official research

Discovered and read with the web research service on 1 October 2026 for the
requested September 2026 baseline. Live documentation is not an archived snapshot.

- [PostgreSQL progress reporting](https://www.postgresql.org/docs/18/progress-reporting.html)
  distinguishes building, writer waits and validation; start overlap from observed
  work, not an arbitrary sleep or a child-process launch.
- [PostgreSQL concurrent reindexing](https://www.postgresql.org/docs/18/sql-reindex.html)
  describes concurrent phases and invalid-index recovery. Validate catalog state
  after interruption, not just a successful process exit.
- [PostgreSQL connection settings](https://www.postgresql.org/docs/18/runtime-config-connection.html)
  documents disconnect checks during long queries. Detecting a child exit alone
  is insufficient evidence that a database statement stopped.
- [PostgreSQL administration functions](https://www.postgresql.org/docs/18/functions-admin.html)
  distinguishes cancellation, termination and signal delivery; acknowledgement of
  a signal does not itself establish query completion.
- [pgvector build guidance](https://github.com/pgvector/pgvector/blob/master/README.md)
  advises maintenance memory within server capacity; retain current graph quality
  and single-worker settings rather than trading away retrieval quality.
- [W3C status messages](https://www.w3.org/WAI/WCAG21/Understanding/status-messages)
  supports meaningful textual status. Reports use labeled tables and explicitly
  distinguish interrupted work from completed recovery; no UI or WCAG certification
  is included in this backend/testing change.

## Outcome

Measurements and final verification belong in the separate
[outcome document](image-index-mixed-load-outcome.md).
