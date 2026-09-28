# Isolated CPU and PID budget comparison

## Decision — 28 September 2026

Extend the existing disposable resource study, not production scheduling. The
queue wakeup improvement reduced final drain but concentrated CPU work. Measure
explicit CPU/PID ceilings before recommending deployment settings.

Use three fixed, sequential capacity scenarios: baseline (no CPU/PID ceiling),
bounded (2 CPUs, 128 PIDs), and stress (1 CPU, 128 PIDs). All retain 2 GiB memory,
the same synthetic movie/TV inventory, evaluation vectors, concurrency, pressure
cohort, recovery deadlines and provider behavior. These values are experiments,
not inferred minimum requirements or production defaults.

## Safety and evidence contract

Reuse randomly named, verified-empty owned Compose projects with internal
networking, no published ports or host mounts, dropped capabilities and a
read-only root. Limit overrides apply only to the study app. No Docker socket,
privileged operation, real provider credentials, routing change or live update.
Only allowlisted budgets may select fixed override values; ambient Compose/study
variables cannot substitute another project, image, limit or configuration.

Verify requested limits in Docker after each fresh start and maintenance restart,
then independently verify effective cgroup limits after both startups and inside
the workload. Startup probes run before database seeding or workload execution;
memory-limit, OOM and PID-denial counters must still be zero. Capture
CPU quota/period, enforcement/throttling counters, PID ceiling and PID-denial
events for cgroup v1 and v2. Missing data fails closed; unlimited is distinct from
unknown. CPU throttling is expected under quotas, but PID denials, OOM kills,
memory-limit events, limit drift and counter regression fail the experiment.

Each scenario must preserve inventory during source outage, defer under memory
pressure, resume and complete the real queue cohort, backfill all supported
inventory, refresh every profile and complete evaluations. Retain the existing
deadlines. Do not manufacture a pass by relaxing them for a constrained case.

Build one owned image, then run scenarios sequentially against its immutable
local image ID to avoid benchmark self-contention and per-build artifact drift.
Verify the actual image ID on every container start, not just a mutable image tag.
Require the same image ID and capacity profile; do not compare different revisions.
Only publish a passing comparison after all scenarios and owned-resource cleanup
succeed, including disposal of the shared image. Individual passing receipts may
remain if a later scenario fails; they
are not a passing comparison. CI adds an opt-in comparison choice, leaving the
short PR gate unchanged. No fork bomb or deliberate process-exhaustion test.

## Running and interpreting the comparison

Run `node scripts/run-resource-study.mjs --budget-comparison`, or choose `budgets`
in the manual resource-capacity workflow. The three five-minute workloads run
sequentially; the initial image build, initialization, settlement and final drain
and 20 seconds of settled idle per scenario are extra. Source changes after that build cannot alter later scenarios; repeat
the whole comparison to validate changed code. Differing image IDs still fail it.

The launcher retains individual v4 receipts and Markdown summaries beneath
`.tmp/resource-study/classifarr-resource-study-*/result.json` and a completed
comparison beneath `.tmp/resource-study/comparison-*/result.json`. V3 introduced
budget identity, independently checked cgroup limits and enforcement counters.
V4 additionally requires [settled idle/trend evidence](sustained-resource-observation-design.md);
the per-run Markdown is adjacent `result.md`. Historical v1–v3 results retain
their earlier scope and cannot satisfy the current protocol.

CPU utilization is reported in cores, not host-wide percent. Throttled-period
percentage is the fraction of observed CFS enforcement periods that throttled,
not a percentage of elapsed time or lost throughput. Without enforcement periods
it is unknown/not applicable, not zero. Throttled duration can aggregate across
CPU run queues; do not divide it by wall time as a utilization percentage.
PID peaks are sampled workload observations; startup counters detect denial
events but do not establish the startup peak. Full initialization still must
pass normal fresh-database checks before entering maintenance-mode workload tests.

## Options, pros and cons

| Option | Benefit | Limitation | Recommendation |
| --- | --- | --- | --- |
| Hard CPU quota | Explicit host-exposure ceiling | Can throttle database and workers together | Measure 2 and 1 CPU cases |
| CPU shares alone | Relative fairness during contention | Not an absolute ceiling | Not a substitute for this experiment |
| PID ceiling with headroom | Bounds process/thread creation | Too low can prevent database connections, health checks or recovery | Measure 128; do not infer minimum from sampled peaks |
| Apply limits directly to live Compose | Immediate containment | Unmeasured availability/regression risk | Do not do this |

## Official sources researched

URLs discovered through online search and checked on 28 September 2026:

- [Docker resource constraints](https://docs.docker.com/engine/containers/resource_constraints/):
  quotas limit CPU bandwidth; shares are relative scheduling preference.
- [Docker building best practices](https://docs.docker.com/build/building/best-practices/):
  images are immutable snapshots, whereas tags can change. The comparison builds
  once and uses the verified local image identity rather than trusting rebuilds
  to produce an identical artifact.
- [Compose service reference](https://docs.docker.com/reference/compose-file/services/):
  service-level `cpus` and `pids_limit` configure these ceilings.
- [Kernel CFS bandwidth control](https://docs.kernel.org/scheduler/sched-bwc.html):
  quota/period and throttling counters describe enforcement, not application
  progress. Ancestor constraints can also throttle a group.
- [Kernel cgroup v2](https://docs.kernel.org/6.18/admin-guide/cgroup-v2.html):
  CPU/PID interfaces and hierarchical accounting. PID accounting includes threads.
- [Kernel v1 PID controller](https://docs.kernel.org/5.17/admin-guide/cgroup-v1/pids.html):
  reaching the ceiling can reject process creation; inspect denial events rather
  than relying only on sampled process counts.
- [W3C data tables](https://www.w3.org/WAI/tutorials/tables/):
  present comparison results with explicit headers and units, not color alone.
  This change adds labeled documentation tables, not a new dashboard or alerts.

## Recommendation stack and limitations

1. Verify enforcement independently of configuration and collect failure counters.
2. Compare matched isolated workloads and keep all correctness/recovery gates.
3. Record CPU throttling, latency, memory, PID peaks and evaluation progress.
4. Select a follow-up from measured results; keep production settings unchanged
   until representative restart/connection pressure is also evaluated.

Synthetic providers do not measure real API throttling or AI accuracy. A shared
Docker Desktop host is not an isolated performance laboratory. Sampled PID peaks
may miss bursts; denial counters supplement but do not establish spare capacity
for untested operations. Existing source-outage recovery is not a database crash
test. The [separate validation outcome](resource-budget-comparison-validation.md)
distinguishes those limits from evidence.
