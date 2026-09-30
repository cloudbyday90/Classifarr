# Retry co-load resource rehearsal: outcome

Date: 2026-09-30. See [design and trade-offs](retry-coload-resource-design.md).

## What changed

The isolated mixed-workload study now runs actual retry discovery/page/claim SQL
alongside ingestion, metadata work and synthetic-vector evaluation. Sixty pending
records cover three retry types and four libraries. Credential rotation releases
only matching waits; legacy and changed-deadline waits remain protected. Every
claim is rolled back and all original queue fields must remain unchanged.

The study remains offline, uses disposable owned Compose resources and never
imports live data or calls a provider. Receipts are versioned `resource_study.v5`
and `resource_budget_comparison.v2`. Old no-retry receipts are rejected.

## Important finding and protocol boundary

The first smoke run failed to drain. Its active synthetic OMDb configuration
kept making missing OMDb metadata eligible for another metadata task, while the
no-op adapter intentionally supplied no result. Joining the retry loop alone did
not stop that demand. The harness now disables only its exact synthetic provider
configurations before drain/idle, retaining all 60 pending retries.

This is not provider recovery or successful enrichment. The closed-loop load
produces repeated task completions, not unique-item throughput. A legacy exact
1,620-completion comparison assertion also caught this protocol change; v5
requires at least that workload, complete inventory/profile assertions and the
exact held 20-task cohort instead. No production safety condition was loosened.

This identifies a **candidate production-path problem to reproduce next**:
`queueRefillCandidates.mjs` considers missing OMDb metadata eligible while OMDb
is active, even after a prior metadata task finished. Verify how actual provider
waits and retry records interact with that path. Do not conclude that this
no-op-provider fixture measures real provider failures or successful recovery.

## Measurements

Smoke passed with owned cleanup, all 60 retry records preserved, 126 rolled-back
claims and five injected-pressure deferrals. It is a two-minute protocol check,
not a soak or a memory-leak assessment.

Capacity comparisons use the same immutable study image, fresh isolated data,
2 GiB memory, 6,700 synthetic evaluation rows and five-minute workload windows
plus settled idle. Baseline leaves CPU/PIDs uncapped; bounded uses two CPUs and
128 PIDs; stress uses one CPU and 128 PIDs. These are single sequential runs on
a shared developer host. Light checks ran during preparation; the full test
suites run after the comparison. They are not production sizing certification.

All three scenarios passed using image
`sha256:7db5abec767a1f00f8ad94dc23791c6ca51a244388a0664e1ffca9d6a8817e49`.
Aggregate receipt: `.tmp/resource-study/comparison-98234a96d391df4a2fade1139544678d/result.json`.

| Measurement | Uncapped baseline | 2 CPU / 128 PID | 1 CPU / 128 PID |
| --- | ---: | ---: | ---: |
| Sampled raw container-memory peak (MiB) | 885.4 | 709.9 | 660.2 |
| Sampled container CPU p95 (cores) | 3.35 | 2.00 | 1.01 |
| Sampled PID peak | 50 | 50 | 48 |
| Highest window event-loop p99 (ms) | 23.7 | 81.1 | 101.4 |
| Longest retry-type pass (ms) | 26.8 | 79.6 | 114.7 |
| Rolled-back retry claims | 309 | 303 | 294 |
| Metadata task completions, including repeats | 23,345 | 15,970 | 9,432 |
| Held 20-task cohort first dispatch (seconds) | 0.58 | 0.63 | 0.63 |
| Drain after demand stopped (seconds) | 0.13 | 0.13 | 3.69 |

All scenarios completed the held cohort, preserved the retry records and ended
with zero pending/failed/routing tasks. No memory-limit-hit or OOM-kill increase,
and no PID-limit hits, occurred. Cgroup v1 does not supply the v2 OOM counter;
these are verified available counters, not a universal no-OOM claim. CPU
throttling occurred in 51.5% and 79.4% of observed scheduling periods for the
two- and one-CPU runs respectively; that percentage is not CPU utilization or
wall-clock time stalled. All owned scenario resources and the shared image
were cleaned successfully.

The lower capped memory peaks do not establish a lower safe memory requirement:
the capped closed-loop runs completed less work. Memory figures above are raw
cgroup accounting and differ from Docker CLI cache-adjusted figures below.

Live Classifarr was not restarted or reconfigured. One read-only idle snapshot
showed healthy state, 0.36% Docker CPU, 406.3 MiB cache-adjusted memory in a 2 GiB
container, 37 PIDs and no OOM-killed flag. CPU/PID caps remain unset. This snapshot
cannot establish peak demand, historical OOM events or absence of leaks.

## Validation and recommendation

Focused resource/readiness/scheduler tests and actual PostgreSQL rollback,
credential-trigger, recovery and preserved-state tests passed. Full regression
suites passed: 47,215 backend tests and 5,795 frontend tests. The coverage
ratchet passed without baseline changes. Owned study
containers, networks, volumes and images are removed by the existing launcher;
reports remain local under ignored `.tmp/resource-study/`.

Recommendation: retain current live limits. First reproduce and eliminate
unnecessary metadata refills under actual provider waits without bypassing
credential recovery, due times, source fencing or independent TMDb work. Then
repeat this comparison with a bounded provider-failure adapter and representative
backlog sizes before selecting CPU/PID limits. The benefit is lower wasted work
and clearer recovery evidence; the cost is another targeted regression study,
not a blanket increase in memory or a lower cap that hides excess work.

GitHub MCP search returned no open Classifarr pull requests on this date; none
could be randomly selected or applied. No PR was merged and no release created.
