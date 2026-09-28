# Mixed-workload resource study: validation

## Scope — 28 September 2026

This validates the [resource-study design](mixed-workload-resource-study.md).
The workload uses real ingestion, queue, profile and evaluation services with
synthetic providers/vectors. It is not a model-accuracy result, production
capacity certification, physical-OOM recovery test or startup-scheduler test.
The existing installation drill separately covers startup and crash recovery.

## Short-run validation

The final smoke run passed against candidate image and aggregate evidence
recorded in the ignored artifact directory
`.tmp/resource-study/classifarr-resource-study-5c1d4360a2eccdfffb785fc8a737b837/`.

| Check | Result |
| --- | --- |
| Workload plus drain | 168.1 seconds; 120-second requested workload |
| Inventory / completed metadata tasks | 400 / 400 |
| Failed / pending / routing tasks at completion | 0 / 0 / 0 |
| Source-pair evaluations | 72 completed; synthetic vectors, no model calls |
| Final profiles | All four current, matching source and acknowledged revisions |
| Provider outage | Four refused source checks; prior inventory preserved |
| Injected admission pressure | All three work classes deferred and resumed |
| Admission permits remaining | Zero |
| Sampled container memory peak | 364.3 MiB raw cgroup usage |
| Largest sampled-window event-loop p99 | 24.6 ms, with a 20 ms monitor resolution |
| OOM kills / memory-limit hits | No increase |
| Owned container, volume, network and image-tag cleanup | Verified |

The initial smoke attempt rejected missing v2 counters on this v1 host. The
collector was corrected to read v1 explicitly. A subsequent development run
caught incorrect harness accounting for returned source deferrals; the harness
now counts the actual deferred result rather than assuming the service throws.
The short protocol uses smaller growth waves and waits through normal cooldown
and final drain. No production recovery logic or retry timestamps were weakened.

## Repository validation

- Backend unit suite: 1,515 suites and 45,639 tests passed.
- Final focused run: 48 tests passed, including four receipt-duration rejection
  cases added after the full unit run. The launcher now rejects nonnumeric,
  shortened or over-budget elapsed-time receipts before saving success.
- Focused tests cover cgroup units/unknowns/drift, bounded metrics, admission
  wait accounting, fixture bounds, real evaluation-thread completion, CLI
  environment refusal, isolated lifecycle, failure cleanup and forbidden
  topology settings.
- Lint (without warnings), server/client types, Markdown lint, static ESM imports,
  migration naming and schema integrity passed.
- Copyright, ingestion ownership audit and development/production dependency
  checks passed. There is no production API/schema/UI contract change.
- All four policy naming/language/maintenance gates and ESM mock-shape checks
  passed. No coverage threshold, release version or dependency was changed.

## PR availability and deployment

Three GitHub MCP searches, including a post-study check, returned zero open pull requests for
`cloudbyday90/Classifarr`. No PR was selected, applied, merged or substituted with
a closed PR. PR #553 belongs to the preceding commit, not this study.

The live Classifarr image remains
`sha256:8c2fe703d58e4784b2ef153aa11377e1bce125e720eb62707311fd042aa7625e`.
Read-only inspection confirmed a 2 GiB RAM limit, 4 GiB memory-plus-swap setting,
no explicit CPU quota and no PID cap. Other applications and production data
were untouched. There is no release or production restart in this change.

## Sustained study

The full run passed in **30 minutes 3.9 seconds** against image
`sha256:54ead5c3c65b8e0d0ec48c53d4392088f93ed090d9814d8b236b8ae005fdec40`.
Its aggregate receipt is in
`.tmp/resource-study/classifarr-resource-study-79bcf6524a0ab573d4d83cc546358c64/result.json`.
The runner verified disposal of its own container, volume, network and image tag.
Production and the other existing applications remained running.

| Measure | Observed result |
| --- | --- |
| Inventory / completed metadata tasks | 1,600 / 1,600; 800 movies and 800 TV items |
| Libraries | Four; 400 items each, all final profiles current |
| Source-pair evaluations | 1,081 completed; 225 deferred attempts |
| Source scans | 68 completed; 16 deferred attempts |
| Provider outage | Eight refused checks across two outage scans; inventory preserved |
| Sampled container RAM peak | **396.6 MiB / 2,048 MiB (19.4%)**, raw cgroup usage |
| Sampled probe-process RSS / main-thread heap peaks | 284.1 MiB / 75.1 MiB |
| Container CPU, median / p95 sampling window | 0.50 / 0.79 core equivalents |
| Container CPU, highest sampling window | 3.27 cores during warmup; 1.42 during recovery |
| Event-loop p99, median / worst sampling window | 20.7 / 26.0 ms, 20 ms monitor resolution |
| Maximum unfinished backlog / oldest pending age | 395 tasks / 77.5 seconds |
| Longest admission wait: ingestion / queue / evaluation | 180.0 / 179.2 / 180.2 seconds |
| Observed PIDs, including threads | 36 initially; sampled peak 48; 39 before probe shutdown |
| Final unfinished / failed / routing tasks | 0 / 0 / 0 |
| Final active admission permits | 0 in all three work classes |
| OOM kills / memory-limit hits / CPU throttling | No counter increases |
| Samples | 862 valid windows; no missing required telemetry |

The approximately three-minute admission waits correspond to the injected
pressure interval, not unexplained stalls. Queue permits peaked at six because
admission also covers dequeue attempts that find no eligible task; that is not
six simultaneously executing metadata jobs. Music exclusion counts are repeated
scan observations, not unique tracks. Final profiles matched source and
acknowledged revisions, and all ingestion-to-backfill handoffs completed.

### Interpretation and limits

No runaway worker or admission-permit leak was observed in this bounded mix.
That does **not** prove the absence of every platform leak or establish capacity
for large embeddings, image processing, backups or paid AI inference. Normal
production scheduling was disabled only inside the study container; the probe
explicitly orchestrated these service calls. The host was shared with existing
applications, and the unit run finished near the start of warmup. This was not
an exclusive-host CPU benchmark.

The pressure phase had an empty metadata backlog: it verifies queue admission
refusal but is not a sustained-pressure test with queued work waiting throughout.
The recovery burst subsequently grew to 395 unfinished tasks and drained without
manual repair. Wait duration is recorded; exact wake-up latency relative to the
pressure-clear instant is not separately instrumented. Memory pressure was
injected telemetry, not forced physical allocation. On this cgroup v1 host,
OOM-invocation counts are unavailable; OOM-kill and memory-limit-hit counters
are measured directly and stayed at zero.

## Recommendation and next component

Keep the 2 GiB limit and existing reservations unchanged. The study found no
reason to expand memory or shrink safeguards. CPU and PIDs remain without hard
caps; this small, synthetic vector corpus cannot safely choose those caps.

The next component should be an **automated capacity-regression gate**:

1. Run the short isolated smoke protocol in a bounded CI job to catch broken
   admission, cooldown and backfill behavior automatically.
2. Add an opt-in production-scale profile near the observed 6,700-item inventory,
   with representative vector dimensions, a nonempty queue during pressure and
   explicit post-pressure wake-up timing. Use synthetic data, not copied media.
3. Compare proposed CPU/PID caps in that disposable profile before enabling
   them by default. Stop on missing telemetry, failed recovery or resource drift.

This adds a repeatable engineering gate instead of another dashboard panel.
Its advantage is early regression detection; its cost is Docker/CI runtime and
the continued need to distinguish synthetic capacity from real model quality.
