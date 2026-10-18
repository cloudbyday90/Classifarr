# Gateway catalog memory attribution

Approved 2026-10-18 through the grill-me workflow: add local rehearsal
measurements, not production telemetry or new recovery behavior.

## Problem and contract

The preceding wide-history capture reached the 256 MiB worker cgroup ceiling.
The existing lifetime peak cannot distinguish anonymous memory, file cache,
the Node worker, its pg_dump child, or the fixture observer. Source PostgreSQL
has a separate 2 GiB container; its memory is not part of the worker reading.

Extend the existing isolated archive qualification runner with an explicit
catalog-memory mode and a matching unsampled baseline. Preserve the packaged
worker invocation, read-only source role, immutable image, synthetic fixtures,
network isolation and exact owned-resource cleanup. No application source or
dependencies are overlaid. Ordinary installations perform no new work.

Use small ESM fixture modules. Reuse the image's bounded resident-memory readers
and parsers. Sample sequentially with at least 500 ms between observations, at most
420 times, checking a
50 ms observation budget between reads. A proc read already in progress is not
a hard real-time guarantee. Retain fixed-size aggregates, not a growing trace.
Record actual observation duration and gaps to expose observer overhead.

Read cgroup current usage, version-specific memory.stat fields and, when
available, pressure stall totals. Read smaps_rollup for the observer, known worker
and its identity-checked direct pg_dump child. Fence PID start time, parent,
executable and cgroup membership before/after reads. Never emit command lines,
environment, paths, SQL, payloads or raw errors. Missing/invalid counters and
vanished/reused processes are unavailable, not zero. Preserve v1/v2 field names;
do not add overlapping memory categories or process RSS to cgroup totals.

Report sampled maxima with their corresponding observations, separate from the
kernel's lifetime peak. Windows describe before an export process was observed,
export-process-present and after it was observed; absence before any observation
does not prove no export occurred. Unknown observations stay unknown. These are
not exact internal phases or exclusive SQL/file/CPU timings. A short-lived
process or memory spike can fall between samples.

Telemetry is observational: it never admits maintenance, resets attempts,
clears caches, writes cgroup controls or authorizes deletion. Preserve the
256 MiB worker, no swap, 0.5 CPU, 32 PIDs, 120-second assessment, three shared
attempts, cooldowns, file-race checks and 1 GiB archive budget. The fixture's
existing outer deadline remains. Cancellation/restart follows existing durable
state; observations are not checkpoints. A missing measurement marks evidence
incomplete, independently of the worker's success or refusal. No new schema,
database, admin action, live provider call or production activation is involved.

## Research and decision

Official sources discovered and opened through MCP on 2026-10-18:

- [Linux cgroup v2](https://cdn.kernel.org/doc/html/latest/admin-guide/cgroup-v2.html):
  distinguish anonymous, filesystem and kernel accounting; file includes shared
  memory. Counter fields overlap. A lifetime peak is not a phase-local peak.
- [Linux cgroup v1](https://www.kernel.org/doc/html/latest/admin-guide/cgroup-v1/memory.html?highlight=swappiness):
  hierarchical total counters differ from v2 names; usage accounting can be
  approximate. Preserve the reported interface instead of pretending equivalence.
- [Docker statistics](https://docs.docker.com/reference/cli/docker/container/stats/):
  Linux CLI usage subtracts inactive file cache. Do not substitute that display
  for the raw cgroup budget used by the qualification.
- [Linux pressure metrics](https://cdn.kernel.org/doc/html/latest/accounting/psi.html):
  stall totals help distinguish high occupancy from observed resource contention.
  Unsupported pressure metrics do not establish zero pressure.
- [Linux process status](https://www.man7.org/linux/man-pages/man5/proc_pid_status.5.html):
  RSS status counters are approximate. Reuse bounded rollup reads and report
  sampling uncertainty, rather than treating process totals as exact attribution.

| Option | Benefit | Weakness | Decision |
| --- | --- | --- | --- |
| External fixture observations | No production behavior change; repeatable attribution | Sampling gaps and observer cost; coarse windows | Implement first |
| Internal SQL/file instrumentation | Precise semantic phase boundaries | Changes measured runtime; additional maintenance | Defer unless observations require it |
| Raise limits or skip repeated validation | Could shorten or unblock a run | Hides cause or weakens file-race protection | Reject |

Recommended stack: existing isolated Docker/PostgreSQL qualification, modular ESM
fixture sampling, Linux cgroup/proc counters, bounded summaries and exact-image
comparison. This is our engineering application of the sources.

## Verification and completion

Test both counter formats, invalid/duplicate/oversized fields, missing pressure,
PID exit/reuse/membership changes, finite output, sampling gaps, deadline and
sample caps, non-overlap and failure reporting. Retain all wide-history scenario
assertions: two real restores, preserved attempts and oversized-evidence refusal.
Run matched sampled/baseline scenarios sequentially without clearing host caches;
record order, timing variability and observer cost, not a universal benchmark.

Run affected quality checks, build local Compose without cache, evaluate the exact
image and confirm local app health. Document findings separately, update Unreleased
and commit/push on main. No release, Unraid, Plex or shared Ollama changes.
Next action must follow measured evidence; no allocation or I/O optimization is
included merely because a peak is high.
