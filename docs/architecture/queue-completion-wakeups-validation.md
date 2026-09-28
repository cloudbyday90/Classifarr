# Queue completion wakeups: validation outcome

## Scope — 28 September 2026

Implements the [completion-driven wakeup design](queue-completion-wakeups.md).
New timer ownership is a small ESM service. Existing QueueService remains the
composition boundary; no new dependency, migration, API, routing decision or
provider configuration is introduced. The Unreleased changelog records the change.

The worker now receives a coalesced hint after durable enqueue/bookkeeping and
after actual task settlement releases counters and the admission permit. It
still polls for external inserts, bulk writes, due retries and pressure recovery.
Stop/start is serialized; a newer stop cancels a queued restart. In-flight tasks
retain their capacity accounting when the dispatch loop stops.

## Regression checks

- Final full backend unit run: 1,517 suites, 45,726 tests passed.
- Focused queue suite: 139 tests passed across four suites.
- New wakeup service: 100% statements, branches, functions and lines in focused
  coverage. Worker loop: 93.41% lines, 80.70% branches. This is scoped coverage,
  not a fresh repository-wide coverage/ratchet claim.
- Final targeted integration run: two suites, 20 tests passed. The new real-database
  test covers completion/enqueue wakeups with a 60-second fallback:
  higher-priority eligible work runs first, future retries stay pending with zero
  attempts, and eligible tasks complete once. Provider-fault Compose tests are a
  separately gated test and were not enabled by this run.
- Unit cases cover notifications before/during waits, 10,000-hint coalescing,
  idle fallback, real Node timer cancellation, single-sleeper enforcement,
  pressure/unknown-memory/error cooldowns, AI-unavailable requeue, duplicate
  startup, stop during dequeue, immediate restart and superseding stop.
- Failed enqueues do not notify; notifications grant no admission and carry no
  payloads. Retry/priority SQL and the provider rate limiter remain unchanged.

Server/client lint, type checking, Markdown lint, ESM static import and strict
mock-shape checks, migration validation and CI preflight passed. No full frontend
test run or full integration run is claimed; UI code is unchanged.

## Capacity protocol and baseline

Run the unchanged `node scripts/run-resource-study.mjs --capacity` profile on
both revisions: 1,600 ingested movie/TV items across four libraries, 6,700
evaluation descriptions at 768 dimensions, a 20-task pressure cohort, five-minute
workload and at most two-minute final drain. Use the isolated owned Compose
project, fresh database, internal network and unchanged 2 GiB memory ceiling.
No production volumes or real provider credentials are used.

Baseline is clean commit `072b0d4df7a240f329851287b65913ae7538f9f1`:

- Project: `classifarr-resource-study-20655c04ed0439dd3d5728ac4c74ef9b`.
- Image: `sha256:d4f777b03623b9735b6a9f9921aa71bf9b0c373d901b7fe3af13b535ed9e4489`.
- Aggregate receipt: `.tmp/resource-study/classifarr-resource-study-20655c04ed0439dd3d5728ac4c74ef9b/result.json`.
- Passed: 1,620 completed tasks including the cohort; zero pending, failed or
  routing tasks; all permits released; owned resources cleaned.
- Final drain 77,461 ms; total study 391,255 ms. Cohort first dispatch 521.4 ms,
  observed completion 4,234.1 ms, with no starts during the 28,253.2 ms hold.
- Peak container memory 673,746,944 bytes (642.5 MiB), maximum sampled unfinished
  queue 505, oldest pending item 101.6 seconds, container CPU p95 1.328 cores,
  maximum sampled event-loop p99 28.18 ms. No OOM kills or memory-limit hits.

Both runs share a Docker Desktop host with unrelated live workloads; this is a
controlled profile comparison, not a statistically isolated hardware benchmark.
The baseline overlapped short lint/focused tests. Synthetic provider calls are
not throttled like real TMDb requests. Telemetry pressure is injected, not a
physical OOM. Completion is observed at approximately two-second intervals.
Successful recovery does not establish AI accuracy or general exactly-once
execution across process crashes or visibility expiry.

## Initial candidate measurement

An initial candidate passed before the final superseding-stop safeguard was added:
project `classifarr-resource-study-48321c05d5938d7a53a8855104f15cc7`, receipt
`.tmp/resource-study/classifarr-resource-study-48321c05d5938d7a53a8855104f15cc7/result.json`.
It had 76 ms final drain, 1,620 completed tasks, zero pending/failed/routing work,
622.7 MiB peak container memory, 1.860 p95 container cores, 33.91 ms maximum
sampled event-loop p99 and 16 evaluations. Full unit/static runs overlapped this
initial measurement. A separate final-build capacity repeat confirms the exact
runtime being committed; the preliminary result is not substituted for that run.

## Final-build capacity result

Passed using project `classifarr-resource-study-4296eb22ae04640cec8d401629ef4223`,
image `sha256:a1da39dbfc2d4064c2f6b137fce4d8b80b71850c2506b1e380b24c17b8d05ece`.
Receipt: `.tmp/resource-study/classifarr-resource-study-4296eb22ae04640cec8d401629ef4223/result.json`.
This repeat includes the superseding-stop safeguard. Full unit/integration tests
finished before its workload; a short preflight check overlapped early work.

| Measurement | Baseline | Final candidate |
| --- | ---: | ---: |
| Final drain after producers joined | 77,461 ms | 63 ms |
| Total study including settlement/drain | 391,255 ms | 318,114 ms |
| Peak container memory | 642.5 MiB | 636.6 MiB |
| Container CPU p95 sampled cores | 1.328 | 1.670 |
| Maximum sampled event-loop p99 | 28.18 ms | 26.36 ms |
| Maximum sampled pending/processing tasks | 505 | 431 |
| Maximum age of pending work | 101.6 s | 30.4 s |
| Cohort first dispatch after pressure clears | 521.4 ms | 673.1 ms |
| Cohort observed completion | 4,234.1 ms | 2,049.0 ms |
| Completed evaluation runs | 18 | 17 |

The candidate kept up with production of synthetic work; 63 ms is only the final
drain, **not** total processing time for 1,620 jobs. First dispatch still waits for
the pressure polling cooldown; faster wakeups intentionally do not bypass it.

All 1,620 tasks completed, including the 20-task cohort held for 30,278.5 ms across
16 checks. Zero cohort starts during pressure, zero repeated cohort dispatches,
zero pending/failed/routing tasks, current profiles for all four libraries, and
complete ingestion/backfill acknowledgements. Music remained excluded; source
outages preserved inventory. Ingestion, queue and evaluation all observed pressure
deferrals. Every class finished with zero active permits. No OOM kills or memory
limit hits; container health and owned-project/image/volume cleanup passed.

Queue permit acquisitions rose from 1,978 to 2,743; these include empty checks and
are not unique tasks. Peak queue permits remained six (five metadata workers plus
a transient probe). Evaluation still progressed, but two additional busy deferrals
illustrate competition for shared admission. Faster draining concentrates CPU and
database work rather than increasing configured task concurrency. This is a
bounded improvement with a measured tradeoff, not a claim of universal speedup.

Recommendation: retain local hints plus fallback polling, unchanged memory and
provider limits, and the existing isolated capacity gate. Defer distributed
notifications and production resource tuning. The final run is the five-minute
capacity profile; neither the separate smoke profile nor the 30-minute soak was
rerun for this patch. Aggregate receipts stay local/ignored; no raw data is added
to the repository.

## PR and deployment boundaries

GitHub MCP searches at the start and during validation returned no open PRs in
`cloudbyday90/Classifarr`; there is no eligible PR to randomly select. No closed PR
is substituted, no PR is merged and no release/version change is made.

The live Classifarr container remains healthy on image
`sha256:8c2fe703d58e4784b2ef153aa11377e1bce125e720eb62707311fd042aa7625e`.
Its 2 GiB memory, 4 GiB memory-plus-swap, unset CPU quota and unset PID cap are
unchanged. This work tests disposable builds, not a live deployment.

## Next component

Evaluate explicit CPU/PID budgets in the isolated workload before selecting
production defaults. Run paired baseline/limited profiles and require complete
ingestion, evaluation, database recovery and queue drain within the existing
deadlines. Report throttling and peak process counts; do not infer a safe ceiling
from one observed peak. Keep memory limits and provider controls unchanged.

The follow-up [CPU/PID budget comparison](resource-budget-comparison.md) now
implements the matched workload experiment. Its
[separate outcome](resource-budget-comparison-validation.md) distinguishes tested
source-outage recovery from the remaining database/restart-pressure experiment.
