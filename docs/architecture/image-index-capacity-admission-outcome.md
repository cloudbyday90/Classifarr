# Capacity-aware image-index maintenance outcome

## Implemented

The embedded worker now selects a fixed 512 MiB PostgreSQL workspace for larger
HNSW repairs only after workload and memory admission. Smaller repairs and
standalone/external callers retain 64 MiB. Deferral occurs before DDL and before
charging the durable automatic-attempt budget. The two-minute executor deadline,
queue ownership, supervisor lifetime, restore exclusion, fixed index definitions,
zero parallel maintenance workers and three-attempt automatic limit are unchanged.

Failures cross the existing inherited descriptor as fixed categories rather than
raw child output. The application logs classified failures through its existing
queue error handling; capacity deferrals generate a fixed informational reason.
No routing, provider settings, vector representation, shared database authority,
live container, template or release was changed.

Design, alternatives, pros/cons and discovered official PostgreSQL, pgvector,
Node and W3C sources are in the separate
[design document](image-index-capacity-admission-design.md).

## Actual disposable-container evidence

Measured 1 October 2026, PostgreSQL 18 / pgvector production image, deterministic
2,000-dimensional synthetic image vectors. Each study used an isolated random
Compose project, fresh data volume and the actual compatible maintenance worker.

| Profile and cohort | Outcome | Time | Workspace | Raw container peak |
| --- | --- | ---: | ---: | ---: |
| Previous 2 GiB, 50,000 vectors | Incomplete, deadline | About 120 s, twice | 64 MiB | About 1.95–1.99 GiB |
| Current 2 GiB, 50,000 vectors | Safely deferred: memory pressure | 0.51 s | Not granted | 1,402 MiB |
| Current 4 GiB, 1,000 vectors | Complete, 3/3 valid | 1.02 s | 64 MiB | 180 MiB |
| Current 4 GiB, interrupted 1,000-vector recovery | Complete, 3/3 valid | 1.01 s recovery | 64 MiB | 198 MiB |
| Current 4 GiB, 10,000 vectors | Complete, 3/3 valid | 17.70 s | 64 MiB | 738 MiB |
| Current 4 GiB, 50,000 vectors | Complete, 3/3 valid | 49.04 s | 512 MiB | 2,752 MiB |

The 4 GiB profile also enforced 2 CPUs and 128 PIDs. At 50,000 vectors, sampled
worker RSS peaked at 70.9 MiB, PostgreSQL backend RSS at 565.6 MiB, and container
CPU p95 at 1.16 cores. These process RSS values overlap shared mappings; raw
container usage includes cache. Do not add them or label the difference a leak.
The capacity build had 97 polls: 88 in building and 8 observing I/O wait, no lock
wait observed. Poll counts are not exact phase durations.

Both studies preserved synthetic row counts and identity sums, rejected the
rotated stale claim, verified invalid-index recovery, stopped all worker/observed
database work and cleaned their owned resources. Neither reported an OOM kill
or memory-limit hit. Recovery interruption was tested at 1,000 rows, not 50,000.

Receipt locations (ignored, regenerable intermediates):

- `.tmp/resource-study/classifarr-resource-study-258c8d2adba26716dbbe031474e8a785/result.json`
  — 2 GiB study, image `sha256:b13ae5784b862326a69527dd8b5dcbacd71a9304a074e3c1db577936570292e4`.
- `.tmp/resource-study/classifarr-resource-study-1be31bb403310b51924f316fba607c94/result.json`
  — 4 GiB study, image `sha256:f63bc78e9cfac9b9cf2e0ef67834700f03c83aa7bb938ffe6d21c0b6c821717a`.
  Workspace is read from the completed claim, not inferred from size.

Reproduce with `node scripts/run-resource-study.mjs --image-index` and
`node scripts/run-resource-study.mjs --image-index-capacity`. Only the latter
adds the disposable larger-memory profile; neither modifies a production limit.

## Validation and PR availability

665 focused tests and 48 tests in six real PostgreSQL integration suites cover capacity boundaries,
memory uncertainty, deferral before budget charging, automatic and manual ingestion
waits, cancellation, claim loss, catalog protection and fixed response transport.
The real embedded isolation drill passed for standard, custom UID 2345 and
Unraid-style UID 99 profiles, including fixed failure transport, actual queued
completion, interrupted recovery, shutdown/restart and owned cleanup. Project:
`classifarr-isolation-drill-f2a15f013a33fac3295172f2ed9cf1d0`.
The final-image repeat also passed and cleaned up:
`classifarr-isolation-drill-034e2beff0e633e372e11d27df98b5ad`.

Another 150 PostgreSQL tests in eight suites passed for legacy ingestion and
catalog recovery, Jellyfin restarts, AI-readiness backfill and provider waits:
198 integration tests across 14 suites in total.

Ownership review passes with 19 owned, 218 separately coordinated and 490
unresolved paths. The queue processor's additive log field does not resolve or
reclassify its pre-existing shared-writer debt. Lint, documentation lint,
type checking, CI preflight, naming/language/maintenance and ESM gates pass.
Full backend coverage: 1,600 suites passed, 48,958 tests passed, one existing
test skipped. Frontend: all 412 suites / 5,835 tests passed. The combined coverage
ratchet passed without lowering thresholds. Backend coverage is 90.02% lines
and statements, 85.33% branches and 91.71% functions.

Both the GitHub MCP connector and the saved GitHub CLI login returned no open
pull requests for `cloudbyday90/Classifarr` during this round. No random open PR
could be selected; no PR was merged or closed as a substitute.

## Recommendation and next item

Keep the admitted workspace and current deadline. Benefit: the larger fixture
completes without longer queue ownership or weaker index parameters. Cost: extra
PostgreSQL memory, and lower-memory installations may remain deferred until
headroom is available. Available-memory admission deliberately does not assume
that all cached pages are safely reclaimable, so it can be conservative.

Follow-up implemented: the [mixed-load repair study](image-index-mixed-load-design.md)
tests the previously recommended **mixed-load repair acceptance test**. Start a representative large repair,
then introduce controlled ingestion/classification load after admission. Measure
foreground latency, memory pressure and cancellation/cleanup; verify ownership
and automatic budgets survive interruption. Add a repeated low-headroom scenario
to distinguish a temporary wait from a deployment-capacity limitation. This fills
the current evidence gap rather than adding another scheduler or raising timeouts.

Recommendation stack: exact catalog verification → colocated workload/memory
admission → single bounded worker → classified logs → durable retry limits →
mixed-load evidence before broader release claims. A sequential synthetic pass
does not certify AI recall, large interrupted recovery or production throughput.
