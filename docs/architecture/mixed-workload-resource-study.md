# Mixed-workload resource study

## Image-index capacity mode

Run `node scripts/run-resource-study.mjs --image-index` for the separate
[image-index repair study](image-index-resource-study-design.md). It uses the
same disposable installation boundary but measures the compatible maintenance
child over fixed synthetic vectors, including interruption and recovery.
It does not run the mixed ingestion/provider workload described below. Results
are saved as JSON and a readable Markdown table under `.tmp/resource-study/`.
An `incomplete` build is a capacity result, not a passed repair. See the
[measured outcome](image-index-resource-study-outcome.md).

## Decision — 28 September 2026

Measure before changing admission estimates or CPU limits. This follows the
[shared admission validation](shared-work-admission-validation.md). Use an owned,
disposable Compose project with a 2 GiB limit, synthetic movie/TV inventory and
no external runtime network, host ports, real credentials or production volumes.

Run real ingestion, metadata queue processing and source-pair worker-thread
evaluation in one probe process sharing the production admission coordinator.
The existing application starts normally to initialize its schema, then restarts
in its existing maintenance/restore mode so its scheduler cannot compete with
the probe. This is a service-level resource study, not a startup-scheduler test.
The separate installation drill remains the scheduler/crash-recovery evidence.

## Research and tradeoffs

| Choice | Benefit | Limitation |
| --- | --- | --- |
| Cgroup v1/v2 counters plus Node metrics | Separates container pressure, worker RSS, CPU and event-loop delay | Supported Linux layouts only; absent metrics must not become zero |
| Real services with synthetic provider adapters | Repeatable, private, no paid calls; real database and worker costs | Not real provider latency, model inference or placement accuracy |
| Inject low-memory telemetry for a bounded phase | Deterministically tests admission and recovery without exhausting the host | Does not establish physical-pressure or OOM tolerance |
| Fixed 30-minute run and bounded corpus/samples | Reproducible and finite | One workstation/run is not a capacity guarantee |
| Keep current limits pending evidence | Avoids throttling ingestion speculatively | CPU remains uncapped in the live deployment |

[Docker runtime metrics](https://docs.docker.com/engine/containers/runmetrics/)
describe container cgroups. The
[Docker stats reference](https://docs.docker.com/reference/cli/docker/container/stats/)
distinguishes Linux cache-adjusted CLI memory from raw cgroup usage. Record raw
bytes with their scope; do not compare them as the same measure.

The [kernel cgroup v2 specification](https://docs.kernel.org/7.1/admin-guide/cgroup-v2.html)
defines `memory.current`, `memory.max`, `memory.events`, `cpu.stat` and
`pids.current`. CPU is reported as core equivalents (one fully used core = 1),
not a percentage of an unspecified host. PIDs include threads. Compare event
counters against their initial values; a missing counter invalidates evidence.

The [Compose service specification](https://docs.docker.com/reference/compose-file/services/)
provides `cpus` and `pids_limit` controls. These enforce different boundaries from
application-level admission. They remain unchanged in this study; selecting
values requires representative database/worker thread counts and throttled
throughput measurements, not just a low idle CPU reading.

The local Docker environment uses v1. Its
[memory controller documentation](https://docs.kernel.org/admin-guide/cgroup-v1/memory.html)
distinguishes limit hits (`memory.failcnt`) from OOM kills, while its
[CPU accounting controller](https://cdn.kernel.org/doc/html/latest/admin-guide/cgroup-v1/cpuacct.html)
reports CPU usage in nanoseconds. The collector converts CPU units explicitly
and reports the cgroup version. A v1 limit hit is not relabeled as an OOM event.

[Node 24 performance hooks](https://r2.nodejs.org/docs/latest-v24.x/api/perf_hooks.html)
provide event-loop-delay histograms in nanoseconds. Use the long-established
`resolution` option only, compatible with our pinned 24.18.1 runtime. Event-loop
utilization is not CPU utilization; collect CPU time separately.

[Node process-memory documentation](https://nodejs.org/download/release/v24.19.0/docs/api/process.html)
also distinguishes whole-process RSS from thread-local heap counters. In this
receipt, `rssBytes` includes evaluation threads; `heapBytes` is only the probe's
main-thread V8 heap. Container memory additionally includes PostgreSQL, the
maintenance web process and kernel-accounted cache.

[W3C guidance for complex images](https://www.w3.org/WAI/tutorials/images/complex/)
requires equivalent text/data for charts. The outcome uses a labeled numeric
table rather than color-only status or an unlabeled chart.

## Protocol and acceptance

- Thirty minutes of work, with a bounded final drain and settled idle observation.
  A short smoke mode is
  separately labeled and cannot count as sustained evidence.
- Four synthetic movie/TV libraries, growing in bounded increments; unsupported
  music is excluded. Repeated ingestion exercises idempotency and ownership.
- Real queue dispatch/refill and metadata writes, synthetic TMDb details.
- Real source-pair evaluation thread using a bounded synthetic vector corpus;
  no AI model calls or routing mutations. It is not an accuracy benchmark.
- Provider-outage phase must preserve prior inventory. Telemetry-pressure phase
  must defer all three work classes. Recovery must complete ingestion, backfill
  and profiles without resetting durable ownership or acknowledgement state.
- Record process RSS/heap, container memory, CPU, event-loop delay, queue age,
  admission waits, worker completions and final data invariants. Cap samples and
  never persist per-item payloads or provider credentials in the receipt.
- Require no OOM events, no failed/pending backlog, current final profiles,
  zero routing tasks and verified disposal of only the owned resources.

## Running the study

Run `node scripts/run-resource-study.mjs --smoke` for a two-minute workload
with up to 400 inventory items, then `npm run benchmark:resources:compose` for
the 30-minute workload with up to 1,600 items. The launcher builds the current
source image. It accepts no server address, volume, image or credential options.
It disables Compose environment-file loading and uses the fixed isolated
installation topology. Both modes allow up to two minutes for final draining;
build/startup time is additional. The
[sustained-observation extension](sustained-resource-observation-design.md) adds
10 seconds of settled idle for smoke, 20 for capacity, and 120 for soak. The
explicit `--soak` argument is equivalent to the default. Idle does not refill
the queue, evaluate inputs, force GC or restart the probe.

The follow-up [capacity regression gate](resource-capacity-regression-gate.md)
adds `--capacity`: five minutes of work, up to 1,600 inventory items and a
6,700-row evaluation corpus. Current profiles use 768-dimensional vectors and
require a nonempty queued-work pressure/recovery cohort. Historical v1 results
in the validation document retain their original 64-dimensional scope.

The [CPU/PID budget comparison](resource-budget-comparison.md) adds
`--budget-comparison`: the same capacity workload runs sequentially with baseline,
2-CPU/128-PID and 1-CPU/128-PID budgets. This is opt-in evidence, not a change to
deployment defaults; all three scenarios must meet the same recovery deadlines.

Twenty waves grow four libraries equally. The long study attempts a source-pair
evaluation approximately once a second after the preceding attempt settles;
each successful evaluation recomputes a 300-case cohort from 400 synthetic
descriptions and 768-dimensional vectors. Passing no previous evaluation state
deliberately prevents unchanged-input skipping. This is a stress workload, not
the production scheduler cadence or the largest supported vector corpus.
The capacity profile waits ten seconds between settled attempts; its corpus
size is separate from the bounded 300-case evaluation sample.

The phases are warmup (20%), steady (20%), provider outage (10%), injected
admission pressure (10%) and recovery (40%). Pressure changes only the probe's
memory reader. Service leases, retry dates, ownership checks and profile
acknowledgements are never forged. The final drain retries refused scans using
the normal admission/cooldown rules.

Version 4 aggregate JSON receipts and labeled Markdown summaries are written
below `.tmp/resource-study/<owned-project>/` only
after the workload and container-health checks pass and cleanup is verified.
Failures return a nonzero exit status and fixed diagnostics. Only the freshly
owned project, volume/network and candidate image tag are removed. The previous
production image, live containers and published release remain untouched.

Metrics are sampled approximately every two seconds; reported peaks are sampled
peaks, not guaranteed instantaneous maxima. Event-loop p99 is calculated per
sampling window, then summarized across windows. Backlog age is the oldest
currently pending task, not the latency distribution of completed tasks.
Admission counts include attempts that find an empty queue, not unique jobs.
Steady/recovery/idle summaries also include scoped external and ArrayBuffer
memory, early/late window medians and time-based slopes. These are observations,
not leak diagnoses. The manual CI `soak` option uses the same fixed workload;
automatic PR/push gates remain short smoke runs.

## Recommendation stack

1. Keep the shared admission policy and current resource limits unchanged.
2. Run this isolated study and publish measured scope and limitations.
3. Use its findings to select a single next capacity experiment; do not infer
   safe maximum allocations or CPU thresholds from synthetic results alone.

No release, production container restart, schema migration or routing change is
part of this work. See the separate validation outcome for measured results.
