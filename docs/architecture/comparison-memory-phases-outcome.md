# Comparison memory phase investigation outcome

Date: 2026-10-06. [Design, sources and tradeoffs](comparison-memory-phases-design.md).

## Implemented scope

Small ESM diagnostic modules now distinguish worker fitting, broad-control
construction, local-community discovery and quality work. The isolated study
records monotonic elapsed time and the kernel's cumulative cgroup high-water mark,
including explicit null when unavailable. Its new `elapsed` mode uses real time
and five-minute waits; existing fast modes still use an injected scheduler clock.
No production algorithm, admission threshold, GC, cache, ownership or retry policy
changed. No schema, dependency or UI contract changed.

## Collected control

Source `e485b279b8b1bade4eb5541d5050c50b8d80033b`, built without cache:

- Image/index: `sha256:68aca43cb689bf5c75f1acadad0fd8566dd3d21ff71b929b0d00054c156acfd1`.
- Native manifest: `sha256:b30b4d06bde0cf9299f63bcd74bc6c5f88bcb7d015379e3dcb212446f59ab6e8`.
- Config: `sha256:1cdfcb36c11190b2c7fade03f42d6c4e692147ed072c1e34376c2c81a4e18e8b`.

The synthetic fixture has 5776 unique 1024-dimensional vectors and ten libraries.
It uses real PostgreSQL vector transport, transactions and advisory locking, plus
the production refresh factories, fitting workers and memory guards. Catalog and
provider identity are synthetic; optional representative observation/neighborhood
hooks are not wired. There are no external provider calls or live app-data mounts.
Limits: 2 GiB, two CPUs, 128 PIDs, 512 MiB private tmpfs, 1536 MiB V8 old-space;
non-root, read-only root, no network/capabilities, 35-minute outer deadline.

Five collected cycles completed in 247 seconds: ready, revalidated, ready,
revalidated, ready. There were 20 snapshot reads, three comparison builds and
six workers; every worker exited. Diagnostic GC occurred only at settled points
in this disposable run. Injected clock changes are not elapsed cooldown evidence.

| Measurement | Observed |
| --- | ---: |
| Highest sampled process RSS | 997.48 MiB |
| Highest sampled raw cgroup use | 1129.67 MiB |
| Kernel cumulative memory peak | 1136.55 MiB |
| Highest sampled RSS within a comparison worker-fit interval | 897.02 MiB |
| Highest sampled active worker heap | 213.62 MiB |
| Collected active heap range | 171.20–171.68 MiB |
| Collected heap after stopping both refreshers | 8.66 MiB |
| OOM kills / memory-limit hits | 0 / 0 |

Sampled original snapshots, decoded vectors, owned inputs and community scratch
rows/vectors were all collectible at every settled point. One active comparison
handle remained until stop, then none. This is bounded retention for the sampled
fixture, not a leak-free claim for the entire application.

The highest RSS sample was in unchanged revalidation, without a new worker in
that cycle. Changed-cycle verification also reached about 843 MiB main-thread
heap. Worker cloning is therefore not established as the dominant peak. Earlier
worker allocation can still influence allocator retention; RSS alone does not
assign exact ownership. Code inspection confirms independently normalized broad
vectors, community rows and graph input, but does not quantify their exclusive
cost. The stronger next lead is complete snapshot loading/verification.

Phase summaries cover the interval after each named marker. Repository read
markers are emitted after the read; the interval following `build_end` includes
the fresh verification read. Kernel peak values are cumulative for the disposable
container, not phase-local peaks. One-second samples may miss process-level peaks.

## Remaining results

Natural elapsed-cycle, full test and local rebuild observation results will be
recorded after their running checks complete. No memory improvement is claimed
from this diagnostic-only change.
