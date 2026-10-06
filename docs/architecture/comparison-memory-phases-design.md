# Comparison memory phases and elapsed refresh study

Date: 2026-10-06. Follows the [lifetime outcome](comparison-refresh-lifetimes-outcome.md).

## Decision

Improve the isolated diagnostic harness before choosing another runtime fix.
The last apparent RSS improvement did not reproduce. Short injected-clock cycles
also cannot establish whether natural reclamation permits later refreshes.

Measure production worker fitting, control construction, community discovery and
quality/publication separately through existing injected functions. Weakly track
community rows as well as snapshots, owned inputs and published handles. Add
kernel cgroup high-water readings alongside sampled current usage. High-water is
cumulative since container creation, not the peak of each named phase; never
reset a kernel counter or silently replace missing telemetry with zero.

Add an explicit `elapsed` mode: five attempts, cold/unchanged/changed/unchanged/
changed inputs, at least 300001 real milliseconds between attempts, no inspector
session and no forced GC. Keep the existing fast injected-clock modes clearly
labelled. Report elapsed monotonic time and completed versus deferred attempts.
Run in a disposable, time-bounded, network-isolated container with synthetic data,
private PostgreSQL, 2 GiB memory, two CPUs and 128 PIDs. No live credentials,
provider requests or app-data mounts. Optional representative observation and
neighborhood hooks remain outside this fixture and must be named as a limitation.

## Safety and completion

No production scheduler, fit algorithm, vector ownership, admission, deadline,
cache bound, cancellation or freshness check changes. Incomplete inputs remain
unavailable and memory pressure remains deferred. Existing factory shutdown and
private database cleanup run on normal/error completion; the outer container
deadline bounds a stuck diagnostic process. Restart starts a new synthetic study,
not a resumed recovery. Success means measured attempts with known counters and
all fit workers exited, not that every attempt necessarily published a profile.
Missing high-water data is explicitly null; normal resource assertions still
require their existing telemetry. Logs contain only fixed phases and aggregates.

Inspect worker structured cloning and duplicate normalization, but do not confuse
observed overlapping copies with proof that any one is the dominant peak. Do not
transfer caller-owned buffers, weaken validation or add production GC to reduce
the measured number. Capture findings in a separate outcome document.

## Options and recommendation stack

| Option | Pros | Cons / decision |
| --- | --- | --- |
| Phase, kernel-peak and real-time diagnostics | Better attribution without changing results | Bounded but slower study; first |
| Normalize once across build stages | Could reduce repeated array allocation | Must preserve validation and numerical results; measure first |
| Transfer worker buffers | Could avoid structured-clone copies | Requires explicit ownership and detachment design; defer |
| Increase limits or force runtime GC | Might change the symptom | Does not establish cause; reject |

Recommended order: verify counters and timing → run collected lifetime control →
run natural elapsed cycles → select and separately test the smallest allocation
change. Rebuild local Compose without cache and dump/check the schema in isolated
candidate databases. No Unraid deployment, release or migration change.

## Official research

Discovered and opened through MCP web search on October 6, 2026:

- [Node 24.21 worker threads](https://r2.nodejs.org/docs/latest-v24.x/api/worker_threads.html):
  worker data is cloned; transferred buffers change ownership. Worker heap limits
  do not bound all external buffers or the whole process.
- [Linux cgroup v2](https://www.kernel.org/doc/html/latest/admin-guide/cgroup-v2.html):
  `memory.peak` records the cgroup high-water mark; a phase sample is not a reset.
- [Linux cgroup v1 memory controller](https://www.kernel.org/doc/html/latest/admin-guide/cgroup-v1/memory.html?highlight=swappiness):
  `memory.max_usage_in_bytes` is the recorded maximum, separate from current
  usage and limit-hit counters.

These sources establish measurement semantics, not a performance guarantee for
Classifarr. No user-interface change is proposed, so there is no new W3C UI claim.
