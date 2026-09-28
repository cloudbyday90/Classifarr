# Resource capacity regression validation

## Outcome — 28 September 2026

The larger isolated capacity profile passed with 6,700 synthetic evaluation
descriptions and 768-dimensional vectors. It completed 1,600 inventory items
across four movie/TV libraries, plus a 20-task queued-work pressure challenge.
This work made no changes to production settings, data, image or container;
the existing application continued its normal background activity.

The [design and source research](resource-capacity-regression-gate.md) explain
the acceptance choices and tradeoffs. This is resource/recovery evidence, not
AI accuracy, provider latency, maximum supported capacity or physical-OOM evidence.

## Larger-corpus result

| Measurement | Observed result |
| --- | --- |
| Nominal work / total measured duration | 300 / 409.973 seconds |
| Final drain after final scan | 105.769 seconds; below the 120-second bound |
| Inventory / completed metadata tasks | 1,600 / 1,620 including the pressure cohort |
| Final pending / failed / routing tasks | 0 / 0 / 0 |
| Real evaluation computations | 17, from a 6,700-row corpus; bounded 300-case cohort |
| Held pressure tasks | 20, balanced across four libraries and movies/TV |
| Hold checks / measured hold | 16 / 30.269 seconds |
| Premature / duplicate cohort dispatches | 0 / 0 |
| First cohort dispatch after pressure cleared | 0.727 seconds |
| All cohort tasks observed successfully enriched | By 4.075 seconds after clearance |
| Sampled container memory maximum | 674,574,336 bytes; 643.3 MiB; 31.4% of 2 GiB |
| Sampled process RSS / main-thread heap maxima | 529.5 / 110.8 MiB |
| Container CPU cores, window p50 / p95 / max | 0.298 / 1.390 / 2.662 |
| Event-loop per-window p99, median / maximum | 20.595 / 24.134 ms; 20 ms histogram resolution |
| Maximum unfinished queue / oldest pending age | 596 / 120.633 seconds |
| cgroup PID/thread count, initial / peak / final | 36 / 49 / 42 |
| OOM kills / memory-limit hits / CPU throttling growth | 0 / 0 / 0 |
| Remaining admission permits | 0 for ingestion, queue and discovery |
| Container health / owned-project cleanup | Passed / passed |

All four ingestion runs finished with durable backfill acknowledgements and
current profile revisions. Source outage preserved existing inventory, and
unsupported music was excluded. No paid provider call or routing task was made.

The final drain is close enough to its bound to prioritize dispatch efficiency;
the bound was not relaxed to obtain a pass. CPU had no quota, so zero throttling
does not demonstrate sufficient capacity under a future CPU cap. Memory was
sampled, not a guaranteed instantaneous peak. The PID counter includes threads
and transient database connections; it is not a count of independent services.

Raw aggregate receipt, ignored by Git:
`.tmp/resource-study/classifarr-resource-study-1e416664cc7b82f94d84c5574a9e05b2/result.json`.
Candidate image:
`sha256:2d0f7eb01a8e0ca2f196a6f4cfac66d3436aec27516dfc247f05aa7f7599b775`.
Only the owned candidate tag, project container, network and synthetic volume
were removed after verification. That disposable database is not retained; the
deterministic fixture regenerates it. No unrelated image or volume was deleted.

## Final-code short run

After tightening completion timing, the exact implementation passed the short
Docker gate: 400 inventory items and all 420 metadata tasks completed, 58 real
evaluations, zero pending/failed/routing tasks, current profiles and verified
cleanup. The 20-task cohort covered all four libraries and both movie/TV types.
It stayed pending for 12.193 seconds across seven checks, first dispatched
0.394 seconds after clearance, and was observed completely enriched by
4.083 seconds. No premature or duplicate dispatch, OOM, limit hit or permit leak
was observed. Total measured duration was 168.495 seconds, including a
45.770-second final drain; sampled container memory peaked at 407.6 MiB.

Receipt:
`.tmp/resource-study/classifarr-resource-study-c7ecadd878a6a5d54ee182ba9373e394/result.json`.
Candidate image:
`sha256:17bc88b47eeab62cdd1324cffa0ec6213f89cf64a14e4a4c9b5f03c40aa151f7`.
The owned container, volume, network and image tag were cleaned; the aggregate
receipt remains available locally. Full unit/static verification overlapped this
run, so its timing is not an exclusive-host benchmark either.

## Validation scope

- Final full backend unit suite: 1,516 suites, 45,687 tests passed.
- Focused study/recovery/workflow tests: 87 passed, including malformed evidence,
  absent inventory, lost/retried/skipped tasks, premature/duplicate dispatch,
  deadlines, cleanup, profile allowlists and CI isolation contracts.
- Server/client lint and type checks passed.
- Markdown, ESM static-import and strict mock-shape checks passed.
- Migration naming and schema snapshot integrity passed; no migration was added.
- CI preflight copyright, ingestion ownership and dependency checks passed.

The capacity workload ran on local Docker Desktop with cgroup v1, 16 CPUs and
about 15.58 GiB VM memory. The container limit was 2 GiB. Other local applications
remained running; host unit/static checks overlapped part of this run. These are
not dedicated-host comparative timing measurements. The CI workflow is intended
for ephemeral GitHub-hosted runners; local tests do not claim a hosted CI result.
Full coverage and the separate full integration suite were not rerun for this
test-harness-only change; Docker exercised the real database/services directly.
The 30-minute soak was not repeated with the new vector dimensions; its earlier
v1 evidence remains separately labeled in the mixed-workload validation document.

Review after the larger run tightened the completion deadline: query latency now
counts because the completion timestamp is taken after the database read returns.
A regression test crosses the deadline during that read and requires failure.
The larger measurements above precede that observation-only adjustment; the
final short run verifies the stricter implementation. Two earlier development
smoke runs passed as well but are not substituted for final-code evidence.

## PR and deployment scope

GitHub MCP searches at the beginning and near the end returned no open PRs for
`cloudbyday90/Classifarr`. No random PR could be selected; no closed PR was reused,
and no PR was merged. No release, version change or live rebuild is included.

The live container remained healthy on image
`sha256:8c2fe703d58e4784b2ef153aa11377e1bce125e720eb62707311fd042aa7625e`.
Its 2 GiB memory, 4 GiB memory-plus-swap, unset CPU quota and unset PID cap remain
unchanged. The new CI check does not change branch-protection requirements.

## Follow-up: bounded queue wakeups

The capacity test passed but exposed a long tail in ordinary metadata work.
Code inspection shows `QueueWorkerLoopService.startWorker()` waits for the fixed
poll interval after no dispatch, including when metadata slots were full at the
check; task completion releases the permit without waking that wait. The default
poll interval is one second. This is a concrete optimization hypothesis, not a
claim that polling alone caused the entire measured drain.

The subsequent [wakeup implementation and validation](queue-completion-wakeups-validation.md)
adds coalesced completion/enqueue hints with timed polling fallback. It preserves
configured concurrency, admission checks, provider controls and retry eligibility,
and tests idle behavior, shutdown races and pressure cooldowns. That separate
outcome contains the new baseline/candidate comparison and the next bounded
CPU/PID-budget evaluation; do not repeat this completed investigation as a new
scheduler project or use it to justify a speculative RAM increase.
