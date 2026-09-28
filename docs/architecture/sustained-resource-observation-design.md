# Sustained resource observation: design

## Decision — 28 September 2026

Extend the [existing resource study](mixed-workload-resource-study.md) with a
settled observation after work drains. The previous protocol stopped at drain,
which could not distinguish memory needed during work from memory remaining
afterward. Do not add a production orchestrator, change admission reservations,
or infer a memory leak from one RSS number.

This implements the measurement part of the trigger-replay follow-up. Restart
recovery remains a separate installation drill: restarting this probe would
discard the process whose retained memory we need to observe. A combined
load/restart experiment needs explicit process epochs, not subtraction across
different processes. This change does not claim that combined experiment passed.

## Official research and alternatives

Sources were discovered and read through web tools on September 28, 2026.

| Approach | Advantages | Costs / limitations | Decision |
| --- | --- | --- | --- |
| Extend the existing isolated ESM study | Exercises real ingestion, backfill, profiles and evaluation with known synthetic inputs | Service-level orchestration, not production scheduler timing or model inference | Selected |
| Add an HTTP load-testing framework | Useful for API/user concurrency and multi-hour tests | Would not itself exercise internal ownership/admission boundaries; another dependency | Defer until testing API capacity |
| Observe memory after settled work | Reveals retained footprint without restarting or forcing GC | Sampler/DB connection allocations and natural GC remain; slope is descriptive | Selected |
| Fail on any positive memory slope | Simple automated rule | False failures from caches, GC timing and sampling; no justified threshold yet | Rejected |
| Lower live limits immediately | Harder resource boundary | Could stall ingestion before representative evidence exists | Rejected |

[Grafana's soak-testing guidance](https://grafana.com/blog/soak-testing/)
describes extended workloads and gradual degradation, generally over hours or
days. Run short validation before the longer profile. Our fixed 30-minute
workload plus two-minute idle period is bounded regression evidence, not a
multi-hour leak certification. Reuse the existing workload rather than adding
k6 solely to drive internal services.

[Node's process-memory reference](https://nodejs.org/download/release/v24.19.0/docs/api/process.html)
distinguishes whole-process RSS from thread-local heap/external counters.
ArrayBuffers are included in external memory and must not be added to it.
The collector uses APIs available in the pinned Node 24.18.1 runtime, not new
24.19-only behavior. RSS growth alone does not identify its cause.

[Docker runtime metrics](https://docs.docker.com/engine/containers/runmetrics/)
describe the cgroup measurement boundary. The
[Docker stats reference](https://docs.docker.com/reference/cli/docker/container/stats/)
explains Linux CLI cache subtraction. Raw cgroup memory includes the probe,
PostgreSQL, maintenance web process and accounted cache; it is not the CLI's
cache-adjusted value. Preserve v1/v2 labels and fail on missing required metrics.

[W3C table guidance](https://www.w3.org/WAI/tutorials/tables/caption-summary/)
supports descriptive context and clear table structure. Generated Markdown uses
headings, labeled columns, units and explicit text outcomes, never color alone.
This is a report improvement, not a claim of complete UI WCAG conformance.

## Architecture and bounds

- `resourceStudyIdle.mjs`: observe only after producers/evaluators are joined,
  the queue worker is stopped, processing is zero and all permits are released.
  Do not dispatch, refill, invoke evaluation, restart or force GC during idle.
  Query/sample every two seconds; reject new work, failed/routing tasks,
  changed completion totals or a missing backlog. Bound time and sample count.
- `resourceStudyTrend.mjs`: bounded, same-process statistics for steady,
  recovery and idle phases. Validate ordered phases, monotonic timestamps and
  completion counters, complete memory fields and at least five samples/phase.
  Report first/last 20% window medians (at least two samples), delta, sampled
  peak and ordinary least-squares slope against elapsed minutes. For an even
  window, the median is the mean of its two central values. The fitted slope
  describes that observed window; it is not a forecast beyond it.
- `resourceStudyProfiles.mjs`: v4 receipts require the appropriate workload and
  idle duration, adequate steady/recovery coverage and settled final backlog.
  Old v1–v3 evidence cannot masquerade as a current passing result.
- `resourceStudySummary.mjs`: reconstruct aggregate Markdown from validated
  numeric fields and fixed labels. Never interpolate arbitrary item text,
  provider responses, filesystem paths or credentials into the report.
- The existing launcher saves JSON plus Markdown only after study/health
  validation and verified disposal of its own resources. No new runtime timers,
  API endpoints, production tables or background services are introduced.

| Profile | Workload | Additional settled observation | Evaluation corpus |
| --- | ---: | ---: | ---: |
| smoke | 2 minutes | 10 seconds | 400 rows, 768 dimensions |
| capacity | 5 minutes | 20 seconds | 6,700 rows, 768 dimensions |
| soak | 30 minutes | 120 seconds | 400 rows, 768 dimensions |

The two-minute final drain allowance is unchanged and recorded separately from
idle. The existing overall allowance also covers final scan and worker settling.
The queue-pressure cohort still must remain pending with zero attempts during
injected pressure, start within 30 seconds after pressure clears, and complete
within 120 seconds. No retry dates, leases or recovery deadlines are relaxed.

Memory sampling itself allocates, and bounded samples are retained by the probe
until reporting. Main-thread heap/external values are not the worker heap.
Queue completions are counts during each observed phase, not per-item latency
or whole-run throughput. Missing coverage is an error, not a zero-valued metric.
Sampled peaks cannot guarantee instantaneous peaks were captured.
Whole-run percentile summaries now include idle samples. Compare matching v4
profiles or corresponding phases, not an old v3 whole-run percentile against v4
as though the observation windows were identical.

## Execution and safety

Run `node scripts/run-resource-study.mjs --smoke`, then
`node scripts/run-resource-study.mjs --soak`. The existing no-argument invocation
still selects soak. Both commands build a disposable image from the working
tree; they do not rebuild or restart the live Compose project.

The resource-capacity workflow adds an explicit manual `soak` option with a
50-minute job timeout. Default PR/push runs remain smoke with the existing
35-minute timeout. Fixed commands, SHA-pinned actions, read-only repository
permissions, no persisted checkout credentials and aggregate-only 14-day
artifacts remain unchanged. Do not automatically run long studies on every push.

Runtime remains inside an internal network with synthetic credentials/data,
no host ports or production mounts, 2 GiB memory and the selected verified
CPU/PID budget. Teardown checks the randomly named, initially empty owned project;
it never prunes Docker or deletes unrelated data. A failed run must not save a
passing receipt. No release, deployment, dependency or routing change is included.

## Recommendation stack

1. Keep production admission and limits unchanged.
2. Run short validation, then the bounded sustained profile with idle evidence.
3. Interpret heap, external, RSS, container memory and backlog together; investigate
   unexplained retention with matched experiments before selecting thresholds.
4. Separately test a restart during representative queued work using the existing
   installation drill, with process-epoch boundaries and durable ownership checks.

See the [validation outcome](sustained-resource-observation-validation.md) for
actual evidence, limitations and the next component selected from the findings.
