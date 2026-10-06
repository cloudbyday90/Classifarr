# Comparison normalization reuse outcome

Date: 2026-10-06. [Design, official sources and tradeoffs](comparison-normalization-reuse-design.md).

## Implementation

A small ESM normalization factory reuses exact arrays within one comparison build.
It validates input on every lookup and compares every cached component with the
fresh normalization calculation. Broad control, retained-mean validation and
community discovery share the factory; the graph retains its separate second
normalization. Standalone callers retain fresh normalization by default. No global
cache, source mutation, schema change, new provider call or unchecked flag.

Existing component/worker/cache limits, admission headroom, retry budgets,
timeouts, publication verification and safe optional-failure behavior are intact.
The factory and scratch inputs are not captured by the public profile handle.

## Verification

- Focused tests: 19 suites, 232 tests passed, including exact non-unit control and
  community comparisons, retrieval isolation, signed zero, malformed vectors,
  dimensions, mutation and cancellation. Existing optional-failure tests passed.
- [PR #556](node-types-pr556-outcome.md) was applied locally, rejected by the
  Node-major gate, then reverted; no dependency change or PR merge.
- Isolated PostgreSQL: three suites / 18 tests passed. Server lint/typecheck,
  normal/production dependency gates, copyright, inventory ownership, static ESM
  imports and migration/schema naming passed without baseline changes.
- Tooling policy: 40 tests passed through the required npm entry point. An initial
  direct `node --test` invocation lacked npm's execution context and correctly
  failed the strict-installer policy checks; no policy was changed.
- Full backend coverage: 1716 suites / 53403 tests passed in 872.648 seconds;
  one Windows-only directory-fsync skip was replayed successfully in the candidate
  Linux image. The new normalizer has 100% statement/branch/function coverage.
- Full client coverage: 443 files / 6409 tests passed in 430.77 seconds. Coverage
  ratchet passed with both current reports (server lines 89.75%, branches 85.67%;
  client lines 88.78%, branches 80.37%). No baseline or timeout was relaxed.

## Candidate image and local replacement

Built without cache from clean source `694089f7ce7adf0cf70c50ebb6df25232eab9087`:

- Image/index: `sha256:ee57e3a1a541cd69ad1e3d4234bf7d3f59dc855af4a7caa97eba020bffef3957`.
- Native manifest: `sha256:275394ebe2728cffa5a25d84d8609431c562ea5c08edb7033dec23b3fe2447f8`.
- Config: `sha256:eb272a606e3b4761834cac68e687bbdf3e5bedd89101cf32403abeab9154dbe4`.

Baseline is the previous local `d94d1d8b` image/index
`sha256:dc99037c045017cc84aac4b6f00f1d3dbc0543f36b7a878562f80cd85c94c704`.
Both inspected installations contain PostgreSQL 18.6-r0 and libcrypto/libssl
3.5.9-r0. These are local development images, not a published upgrade rehearsal.

The local database backup was checksum/list verified: 75,658,100 bytes, SHA-256
`54d62974ee5c5edb5349e7940c1dc90de85ee8bb528eeda9581954b927646413`.
The old image was pinned for rollback. Backups remain private under ignored
`.tmp`; archive readability is not a restore rehearsal.

The local replacement started at 15:03:24 UTC and passed its health check, preserving 5832 inventory rows,
323 recorded migrations, appdata/media mounts, user 1000:1000 and the 2 GiB limit.
CPU quota and PID cap remain unset; no permission or memory-limit changes.
Independent candidate-image schema dump and check passed without changing
`database/schema/current.sql`. Native Linux exclusive-copy/directory-fsync replay
passed. No Unraid action or release was performed.

From 15:04:06–15:13:50 UTC, all 36 local samples were healthy: raw cgroup
493.68–783.77 MiB, kernel high-water 802.14 MiB, sampled CPU peak 201.63%
(about two cores), and 35–48 PIDs/threads. No OOM kill, memory-limit hit or restart.
The process list contained init, the supervisor/application and PostgreSQL; no
accumulating fitting workers were observed. This short window is not a sustained
capacity test and does not rule out every uncontrolled host process.

The initial bounded read-only check reported `backfilling`, specifically three
active libraries with complete ingestion but unfinished handoff checkpoints.
There were no pending/processing queue tasks at that read. The same checkpoints
completed automatically at 15:15 UTC and readiness became `ready`; no reset or
forced recovery was necessary. The latest observed durable memory warning still
predated this image (13:58:45 UTC). Readiness and a separate diagnostic process's
memory admission are not proof a new comparison model was published.

## Allocation control

An ignored, read-only-mounted diagnostic used the candidate's actual ESM factory,
existing isolated fixture and GC-assisted metrics. It kept decoded and owned
source maps alive, normalized 5776 vectors of 1024 components, then retained
both a map of reused results and an independent normalized map. All reused arrays
were reference-identical; every independent array had exactly equal values.

| Retained state | Collected heap |
| --- | ---: |
| Source plus first normalized map | 148.06 MiB |
| Plus reused-result map | 148.17 MiB |
| Plus independently normalized map | 193.85 MiB |
| After leaving the measuring scope | 7.13 MiB |

Reuse added about 0.11 MiB versus 45.68 MiB for the additional independent map.
The normalizer and tracked output were collectible after scope exit. This is an
incremental allocation control, not a process-peak forecast or timing benchmark.

## Collected complete-cycle study

The unchanged existing study uses 5776 synthetic 1024-dimensional vectors, ten
libraries, real PostgreSQL transport/transactions/advisory locks, production
refreshers, fit workers and memory guards. Optional representative observation/
neighborhood hooks remain outside this fixture. Each owned disposable container
has two CPUs, 2 GiB memory, 128 PIDs, 512 MiB private tmpfs and 1536 MiB V8 old-space,
with no network, capabilities, credentials, live mounts or Docker socket.

Candidate collected run: five successful attempts (ready, revalidated, ready,
revalidated, ready), 20 reads, three builds, six workers created/exited, none left.
No OOM or limit event. Sampled peak RSS 828.55 MiB, raw cgroup 956.26 MiB, kernel
peak 962.77 MiB. Collected active heap was 171.21–171.73 MiB; stopped heap 8.78 MiB.
All tracked original snapshots, source vectors and community row containers were
collectible at settled points. Two sampled community vectors now intentionally
share the published model's arrays and live with its one handle, not as duplicate
scratch buffers. Both vectors and the handle were collectible after shutdown.

Injected clocks and diagnostic collection in this run are not natural cooldown
evidence. Kernel peaks include PostgreSQL/tmpfs; process RSS spans workers and
one-second samples can miss peaks. Concurrent host tests and the local application
mean elapsed duration is not a latency benchmark.

Same-round collected comparison (all five attempts succeeded in each run):

| Image/run | Peak RSS | Peak raw cgroup | Kernel peak | Stopped heap |
| --- | ---: | ---: | ---: | ---: |
| Baseline `d94d1d8b` | 872.33 MiB | 1002.89 MiB | 1012.15 MiB | 8.64 MiB |
| Candidate, first | 828.55 MiB | 956.26 MiB | 962.77 MiB | 8.78 MiB |
| Candidate, repeat | 854.75 MiB | 980.86 MiB | 983.68 MiB | 8.75 MiB |

All three used 20 reads, three builds, six workers created/exited, no OOM or limit
event, and no tracked retained objects after collected shutdown. Peak reductions
in these collected controls are modest and GC-sensitive; the unchanged baseline
also varied from previous rounds. Do not substitute these controls for elapsed
or loaded-application measurements.

## Natural elapsed comparison

Both images use the existing `elapsed` mode: five attempts with at least five
minutes between cycles, no inspector and no forced GC. Use the bounded invocation
in the [phase-study reproduction guide](comparison-memory-phases-outcome.md),
substituting the immutable image IDs above. This exercises cold build, unchanged
revalidation, changed build, unchanged revalidation and another changed build.

The baseline finished in 1401.918 seconds with all five attempts successful,
20 reads, three builds and six workers created/exited. Its peak RSS was 994.95 MiB,
raw cgroup 1136.45 MiB and kernel peak 1136.91 MiB. Natural heap before later
cycles was 171.97–172.44 MiB. Stopped heap was still 847.96 MiB after only two
seconds; that short tail and its uncollected weak references do not prove a leak.
The collected baseline independently proves collectibility, not prompt RSS release.

The candidate finished in 1396.390 seconds with the same five successful attempts,
20 reads, three builds and six workers created/exited; none remained active. Neither
elapsed run recorded an OOM kill or memory-limit hit. Natural heap before later
candidate cycles was 171.63–172.23 MiB. Its stopped heap was still 670.44 MiB after
the same short two-second tail, with uncollected tracked references; the collected
candidate runs independently establish that these objects can be reclaimed.

| Natural elapsed run | Peak RSS | Peak raw cgroup | Kernel peak |
| --- | ---: | ---: | ---: |
| Baseline | 994.95 MiB | 1136.45 MiB | 1136.91 MiB |
| Candidate | 1115.75 MiB | 1251.04 MiB | 1251.37 MiB |

Despite the demonstrated allocation saving, the candidate's natural peak was
higher, during the first changed build's worker fit. That phase precedes the
normalization reuse in that cycle. The experiment does not isolate why
GC/allocation timing differed; it neither establishes a causal peak regression nor supports a general
peak-reduction claim. Steady between-cycle heap and worker counts did not grow
monotonically. All owned study containers exited and were automatically removed.
The broader memory-pressure warning remains an open workload/capacity question.

## Recommendation stack

1. Keep exact build-local reuse. Benefit: removes duplicate normalized arrays
   without trusting a normalized flag or changing values. Cost: still performs
   validation and arithmetic, plus a small WeakMap; sharing is read-only by the
   internal consumer contract, not a new security boundary.
2. Before another memory fix or release-capacity claim, run a sustained same-image
   comparison/ingestion/metadata workload with controlled host load and repeated
   natural cycles. Benefit: tests the real admission contention behind the user's
   warnings. Cost: longer isolated rehearsal and representative workload design.
   Keep reserve/headroom, backoff, normal GC and failure visibility unchanged.
3. Then evaluate packed transferable worker input if those measurements still
   identify clone allocation as worthwhile. Benefit: could reduce the earlier
   measured clone cost. Cost: explicit buffer detachment/ownership, validation
   and cancellation protocol; it does not by itself eliminate verification peaks.

The local handoff completed automatically, so no speculative backfill repair is
recommended from the transient `backfilling` observation. No UI was changed and
no new accessibility claim is made.
