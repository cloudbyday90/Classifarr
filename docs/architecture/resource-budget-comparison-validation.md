# CPU/PID budget comparison — validation outcome

## Scope — 28 September 2026

Implements the [isolated budget comparison design](resource-budget-comparison.md).
This is resource-safety evidence for synthetic workloads, not AI-quality evidence
or a production sizing recommendation. Production services, limits, routing,
database schema and release version are unchanged.

The comparison uses a single source-image identity, fresh disposable databases
and sequential capacity runs on Docker Desktop: cgroup v1, 16 available CPUs and
approximately 15.58 GiB VM memory. Each container retains its 2 GiB memory ceiling.
The host is shared, so small timing differences are not statistically significant.
Cgroup v2 parsing and enforcement are regression-tested, not claimed as a second
real-host experiment.

## Automated validation

- Full backend unit suite: 1,519 suites and 45,806 tests passed.
- Focused resource-study suite: 156 tests passed, including startup PID denials,
  missing counters, ineffective limits, counter regression, limit drift, wrong
  image/profile, incomplete work, shared-image lifetime, cleanup failure and
  prevention of false success.
- Lint, server/client type checking, Markdown lint, static ESM imports, migration naming
  and schema integrity, and strict ESM mock-shape checks passed.
- CI preflight passed: copyright, ownership inventory, dependency analysis and
  production dependency analysis.
- No client API, UI or dependency changes. A separate frontend test suite and
  the 30-minute soak were not rerun for this change.

## Container comparison

The first attempt correctly failed the matched-image gate: baseline and bounded
workloads each passed, but per-scenario builds produced different image IDs. No
aggregate success was emitted. The launcher was changed to build once, reuse its
immutable identity, verify every started container and clean the shared image
after all scenarios. Those earlier runs are not used in the final comparison.

The final comparison passed using one built image:
`sha256:fc2567d6af887e0bb5c5bc9ff3b8ddb42785d6c7e37c7195344a70f7e6889c82`.
The launcher independently verified the actual image on both starts in all three
scenarios. Workloads ran sequentially; no source rebuild occurred between them.

| Measurement | Baseline: no CPU/PID ceiling | Bounded: 2 CPUs / 128 PIDs | Stress: 1 CPU / 128 PIDs |
| --- | ---: | ---: | ---: |
| Completed metadata tasks | 1,620 | 1,620 | 1,620 |
| Completed evaluation iterations | 17 | 16 | 14 |
| Total workload, settlement and drain | 316.953 s | 315.959 s | 320.066 s |
| Final drain after producers joined | 72 ms | 66 ms | 84 ms |
| Cohort first dispatch after pressure | 669.4 ms | 660.2 ms | 505.7 ms |
| Cohort observed completion after pressure | 2,036.8 ms | 2,049.9 ms | 2,039.8 ms |
| Peak sampled container memory | 643.0 MiB | 642.8 MiB | 637.8 MiB |
| Container CPU p95, sampled cores | 1.697 | 1.589 | 1.011 |
| Maximum sampled event-loop p99 | 26.18 ms | 60.92 ms | 101.45 ms |
| Peak sampled workload PID/thread count | 49 | 49 | 46 |
| Throttled enforcement periods | Not applicable | 229 / 2,441 (9.38%) | 1,521 / 2,603 (58.43%) |
| PID denials / memory-limit hits / OOM kills | 0 / 0 / 0 | 0 / 0 / 0 | 0 / 0 / 0 |

Each run retained 1,600 inventory items across four movie/TV libraries, completed
the additional 20-task pressure cohort exactly once, and finished with no pending,
failed or routing work. All profiles and ingestion/backfill acknowledgements were
current. Source outages preserved inventory, music remained excluded, and all
three work classes deferred under injected pressure and released their permits.
The held cohort waited approximately 28–30 seconds with no starts during pressure.

Fresh initialization and maintenance restart passed under every budget. Startup
PID-denial, memory-limit and OOM-kill counters were zero. All owned containers,
volumes, networks and the single shared image tag were removed successfully;
cleanup failures cannot publish aggregate success.

The aggregate receipt remains local at
`.tmp/resource-study/comparison-3020a90c2e7e729d13b0e5cbbaeece2a/result.json`.
Individual receipts are referenced in the launcher's local validation log. No raw
payloads, real provider calls or routing writes were needed.

## Findings and recommendation stack

1. Keep the new isolated gate. It verified preservation and recovery under both
   quotas without relaxing deadlines or increasing concurrency.
2. Use **2 CPUs / 128 PIDs as the next test candidate**, not a deployment default.
   It bounded CPU exposure and preserved recovery, but this run showed additional
   throttling and a higher maximum event-loop delay. This is a containment versus
   latency tradeoff, not a performance improvement claim.
3. Keep **1 CPU as a stress profile**, not a recommended default. It passed the
   correctness gates, but throttled more often and completed fewer evaluation
   iterations. One run does not establish a precise throughput penalty.
4. Retain existing live limits until normal-runtime restart and database
   connection-pressure recovery are validated with durable pending work.

Throttle percentages describe CFS enforcement periods, not elapsed time lost.
CPU samples span quota-period boundaries; a short sample slightly above one core
does not contradict an independently verified one-core quota. Evaluation counts
include repeated fixed-cohort iterations, not unique media or classification
accuracy. Final-drain milliseconds are not total processing time for 1,620 tasks.

## PR and deployment boundaries

GitHub MCP searches at the start and during container validation returned no open
PRs in `cloudbyday90/Classifarr`. There was no eligible PR to select randomly; no
closed PR was substituted and no PR was merged.

No release, version change, image publication, live rebuild or production-limit
change is included. Only randomly named, verified-owned study resources are
created and disposed of. Local receipts contain aggregate synthetic evidence and
remain ignored under `.tmp`; no raw media metadata or credentials are committed.

A read-only live check confirmed healthy Classifarr on image
`sha256:8c2fe703d58e4784b2ef153aa11377e1bce125e720eb62707311fd042aa7625e`,
with 2 GiB memory, 4 GiB memory-plus-swap, no CPU quota and no PID ceiling. This
is the existing configuration, not the disposable comparison image or a sizing
endorsement. Other running containers were not modified.

## Limitations and next decision

CPU quotas constrain the application and embedded PostgreSQL together. PID
accounting includes threads; the sampled peak is not a safe minimum limit. Startup
probes catch denial counters from fresh initialization and the maintenance-mode
restart, but do not measure every instantaneous startup peak.
The fresh-start observation was 48 PID/thread IDs in every scenario, exceeding
the stress workload's sampled peak of 46; neither is a safe minimum ceiling.

Source outages and injected admission pressure are not a PostgreSQL crash or
physical out-of-memory event. A short synthetic comparison cannot demonstrate
long-term leak freedom, API rate-limit behavior, production throughput or AI
accuracy. Keep those claims separate from successful inventory/backfill recovery.

Retain the existing memory/admission controls and opt-in budget comparison.
Before proposing production caps, test normal-runtime restart and database
connection pressure under a candidate budget with durable pending backfill.
Extend `scripts/run-runtime-installation-acceptance.mjs` and its existing isolated
drill rather than creating another orchestration framework; use the measured
2-CPU/128-PID candidate and keep fresh-install and upgraded-data cases distinct.
Require original work identity, successful recovery, no ownership takeover and
bounded readiness, with no PID denials or memory-limit events. Do not repeat the
completed queue-wakeup refactor or treat this as authorization for live tuning.
