# Shared-catalog comparison study

Date: 2026-10-06. Follows [natural recovery](comparison-natural-recovery-outcome.md).

## Contract

Add an opt-in `comparison-catalog` profile in the existing isolated image runner.
Use its single migrated application database, real inventory queries, ingestion
ownership, metadata queue, advisory locks and representative/comparison schedule
registrations. Do not start a second PostgreSQL cluster or intercept catalog SQL.
This still uses a schedule adapter, not the complete application scheduler.

Ten synthetic movie/TV libraries start with 1776 fixture items and grow by 200
per wave to 5776 unique descriptions in 20 waves, 30 seconds apart. The first
import contains 1976 items. All inventory writes go through MediaSyncService.
Fixed in-process metadata providers and deterministic 1024-component vectors
avoid external traffic and inference costs. Populate only missing vector keys
after scans, through the production projection/cache writer. Provider accuracy,
description backfill scheduling and full application capacity remain out of scope.

Read busy/config state and the production ingestion/backfill readiness gate from
PostgreSQL; use the real local inventory revision signal. Never force idle or bypass admission.
Use the existing two-CPU, 2 GiB, 128-PID isolated topology and immutable image.
Keep resource limits, retry jitter/backoff, wall clocks, cache limits and ownership
fences unchanged. No forced GC, inspector, ballast or automatic runtime repair.
Fresh/ordinary installations run no additional jobs. Unknown telemetry, worker
failure, OOM/limit events or incomplete cleanup must reject the result.

Bound the study to 25 minutes plus joined shutdown. Completion requires all 5776
items through import and both metadata stages, no pending/failed/routing tasks,
all ten import handoffs complete, full cached-description coverage, and successful
comparison publication/revalidation followed by a scheduled revalidation at least five minutes
later, both after the load drains. Observe representative publication as well.
Keep workers/caches alive until this condition or the deadline. Capture exact
discovery admission decisions and actual permitted overlap with other work.
Do not require or invent pressure to pass this workload test: report whether
post-pressure recovery was observed separately. Preserve the older strict recovery
profile and its rejected results unchanged.

Cancellation stops schedules, aborts/joins refreshes and joins ingestion before
stopping its metadata consumer. No restart resumes this disposable study; a new
run starts empty isolated data. Numeric allowlisted traces omit provider bodies,
credentials and catalog text. The launcher removes only its random owned resources.

## Options and recommendation stack

| Option | Benefit | Cost / decision |
| --- | --- | --- |
| Single real catalog with synthetic transports | Tests actual growth, busy state and invalidation without provider risk | Longer isolated run; implement now |
| Full application scheduler and real provider traffic | More production-like | Extra variables and side effects; defer |
| Change worker allocation or memory limits | Might reduce pressure | No causal evidence yet; do not change |

First establish completion and retention across loaded refresh cycles. Then use
the measured phase/worker peaks to choose a narrowly scoped allocation experiment,
or improve the fixture if the result is inconclusive. No UI change is needed.

## Official research and PR trial

Discovered and read through web tools on October 6, 2026:

- [Node 24 process memory](https://nodejs.org/docs/latest-v24.x/api/process.html): RSS covers the whole
  process; heap/external fields are thread-local and ArrayBuffers are included in
  external memory. Do not add these overlapping measurements.
- [Docker resource constraints](https://docs.docker.com/engine/containers/resource_constraints):
  measure requirements with explicit limits while retaining OOM protections.
- [PostgreSQL monitoring](https://www.postgresql.org/docs/18/monitoring.html):
  combine database observations with operating-system resource measurements.

The fresh open pool contains #555 and #556. Random selection chose
[client typings #555](https://github.com/cloudbyday90/Classifarr/pull/555), head
`5545605b53c854de8847b44e24fa083ff4218080`. Trial its exact manifest/lock diff:
Node types 24.19.1 to 26.6.4, undici-types 7.24.6 to 8.9.0. New declarations are
useful only when compatible with deployed Node 24; retain the runtime-major gate
and revert the trial if it fails. No merge or release is authorized.
