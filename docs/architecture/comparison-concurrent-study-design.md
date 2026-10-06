# Comparison refresh under concurrent ingestion

Date: 2026-10-06. Follows [normalization reuse measurements](comparison-normalization-reuse-outcome.md).

## Contract

Add opt-in `comparison-control` and `comparison-concurrent` scenarios to the
existing isolated resource-study launcher. No production scheduler, admission,
cache limit, retry clock or memory safeguard changes. Nothing runs on ordinary
installs. Use one immutable image, sequential runs and no simultaneous builds or
test suites during measurement; observe other host activity rather than stopping
unrelated applications.

Both scenarios run three natural comparison/representative refresh attempts,
with real five-minute intervals, then five minutes of post-stop observation.
Reuse the existing 5776-description/1024-component comparison corpus, workers,
vector SQL and locks. That corpus has its own private PostgreSQL instance and a
synthetic catalog adapter. Ingestion/metadata use the migrated application database
and real services. They share the probe process, cgroup and one production
resource-admission instance, but not catalog state. This isolates allocation and
admission contention; it does not prove same-catalog invalidation, scheduler
wiring, provider throughput, model accuracy or production capacity.

The loaded scenario starts twenty non-overlapping ingestion waves after the first
comparison build is admitted. Four synthetic movie/TV libraries grow by twenty
items per wave (1600 final items). Production queue workers perform metadata
enrichment with fixed in-process providers; classification/routing is forbidden.
Thirty-second wave spacing spans about ten minutes. Count work admitted while
discovery is active, deferrals by reason, unique metadata completion, completed
handoffs, worker exits and outstanding permits. No allocated ballast, forced GC,
inspector, falsified memory readings or deadline advancement.

Require the existing fresh-install guard, internal-only network, non-root user,
read-only root, dropped capabilities, two CPUs, 2 GiB and 128 PIDs. Bound SQL and
all loops; join producers and queue workers on success or failure. A failed or
cancelled run is not evidence of completion; the launcher removes only its random
owned project. Retries are a new isolated run, never replayed against live data.
No secrets, media, raw SQL text or provider bodies enter receipts. A five-minute
tail is an observation, not a promise V8 returns memory immediately.

## Options and recommendation

| Option | Benefit | Cost / decision |
| --- | --- | --- |
| Shared-process controlled service study | Measures real admission and allocation interaction safely | Separate synthetic comparison catalog; implement first |
| Exercise the local/Plex installation | Most familiar workload | Non-repeatable and affects real integrations; do not load-test it |
| Change memory thresholds now | Could reduce warnings | Hides symptoms without cause; reject |
| Full same-catalog scheduler rehearsal | Stronger deployment fidelity | More fixture/provider work; follow if this study identifies a gap |

Validate harness contracts, permit cleanup, failure joining, natural timing and
receipt rejection before running the image. Keep outcome and next recommendations
separate. A measured higher peak must remain visible, not be explained away.

## Official sources

Discovered and opened through MCP on October 6, 2026:

- [Node process memory](https://nodejs.org/api/process.html): RSS spans worker
  threads; other memory fields are thread-local. Record both, not a summed heap.
- [Node worker threads](https://github.com/nodejs/node/blob/main/doc/api/worker_threads.md):
  structured cloning and worker resource limits do not provide a global memory guarantee.
- [Docker resource constraints](https://docs.docker.com/engine/containers/resource_constraints):
  enforce CPU/memory bounds and preserve OOM safeguards while measuring demand.
- [PostgreSQL 18 monitoring](https://www.postgresql.org/docs/18/monitoring-stats.html):
  distinguish active sessions from cumulative counters; avoid long-lived statistics snapshots.

No UI changes or new accessibility claims are part of this diagnostic work.
