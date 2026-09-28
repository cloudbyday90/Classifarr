# Sustained resource observation: validation

## Scope — 28 September 2026

This records validation of the
[sustained observation design](sustained-resource-observation-design.md).
Real service/DB work uses synthetic movie/TV providers and vectors inside the
owned isolated Compose project. No paid model calls, live library changes,
production restart, resource-limit changes or release are part of this work.

## Short validation

The final-code smoke run passed on image
`sha256:b3235e578c7209911cc641e10ec6d0cca234b06db2b35aa59e99498b91f5333d`.
Its aggregate files are under
`.tmp/resource-study/classifarr-resource-study-1cbc95382c585bb97431d0d72c3533bb/`.

| Check | Observed result |
| --- | --- |
| Requested work / observed idle | 120 seconds / 10.0 seconds |
| Total probe duration / final drain | 153.4 seconds / 22.2 seconds |
| Supported inventory / completed metadata tasks | 400 / 420, including the 20-task held cohort |
| Held cohort started / completed / premature starts | 20 / 20 / 0 |
| First dispatch / observed cohort completion after clearance | 0.737 seconds / 2.065 seconds |
| Failed / pending / routing tasks at completion | 0 / 0 / 0 |
| Evaluations completed | 61; synthetic vectors, no model calls |
| Idle backlog/completion changes | None across six samples |
| Cgroup version / owned cleanup | v1 / passed |

The development smoke preceding the final median/validation tightening also
passed. Only the final-code run above is used for these smoke measurements.
Smoke is not sustained evidence and does not establish production capacity.

## Repository verification

- Backend unit suite: **1,524 suites / 45,988 tests passed**.
- Server/client lint and types, copyright, ingestion ownership and both
  dependency-use checks passed.
- ESM static imports and mock shapes, all four policy naming/language/maintenance
  gates, workflow actionlint and Markdown validation passed.
- Regression tests reject missing/invalid memory, reordered phases, nonmonotonic
  clocks/completion counters, insufficient phase coverage, old receipts,
  unbounded samples, unsettled idle work, frozen clocks and deadline overruns.
- Reports require validated aggregates and successful owned cleanup; arbitrary
  text is not included. Profile choice cannot inject shell commands or paths.

No production schema/API/UI contract or dependency changed. The isolated runs
exercise real PostgreSQL/service paths; the full database integration suite is
not being relabeled as rerun by this change. Full unit/static validation finished
before the sustained measurement to avoid adding that host workload to its data.

## Sustained result

The full v4 run passed in **32 minutes 4.7 seconds**, including the requested
30-minute workload and **120.2 seconds of measured idle**. Its local working-tree
image was `sha256:2712567fbc33c5439c1d0398a28ffa33df6e9fb441a45e6940785155b5e1b2bd`.
Aggregate JSON/Markdown are under
`.tmp/resource-study/classifarr-resource-study-ef61a772b14a72aff502858924eed033/`.
This is local diagnostic evidence, not published-image provenance or a release
attestation. Smoke and soak have separately recorded image IDs and profiles;
they are not a matched capacity comparison.

| Measure | Observed result |
| --- | --- |
| Supported inventory | 1,600 items across four movie/TV libraries |
| Completed metadata tasks | 1,620, including 20 held recovery tasks |
| Final failed / pending / routing tasks | 0 / 0 / 0 |
| Final ingestion/backfill and profiles | Complete; all four profiles current with matching acknowledgements |
| Held cohort | 20/20 completed, zero premature/duplicate starts, 89 hold checks |
| Hold / first dispatch / observed completion after clearance | 179.9 seconds / 0.168 seconds / 2.057 seconds |
| Provider outage | Eight refused checks over two outage scans; retained inventory count preserved |
| Evaluations | 917 completed; 205 deferred attempts |
| Final drain after final scan | 0.071 seconds; not the time to process the entire run |
| Raw container memory, sampled peak | **427.0 MiB / 2,048 MiB (20.9%)** |
| Probe RSS / main-thread heap, sampled peaks | 319.6 MiB / 82.1 MiB |
| Container CPU, median / p95 / maximum sampling window | 0.59 / 0.89 / 2.83 core equivalents |
| Event-loop p99, median / worst sampling window | 20.9 ms / 40.0 ms; 20 ms monitor resolution |
| Peak unfinished backlog / oldest pending age | 345 tasks / 180.0 seconds |
| PIDs/threads, initial / sampled peak / final | 36 / 49 / 36 |
| OOM kills / memory-limit hits / PID denials | No increases; all zero |
| CPU throttling | No increase; baseline has no CPU quota |
| Active admission permits at completion | Zero in every work class |
| Samples / idle samples | 923 / 61 |
| Owned container, data volume, network and image-tag cleanup | Verified |

The maximum queue age corresponds to the deliberate approximately three-minute
hold, not an unexplained stall. Completion-driven dispatch recovered the same
held tasks without manual queue repair. The script also required zero retry
attempts on those tasks and successful enrichment results. All admission classes
refused work during injected pressure and later resumed.

### Settled memory

These are early/late window medians within the same two-minute idle phase, not
single endpoint samples or process-restart comparisons.

| Scope | Early MiB | Late MiB | Change MiB |
| --- | ---: | ---: | ---: |
| Whole probe RSS | 207.55 | 204.75 | -2.79 |
| Main-thread heap | 56.67 | 39.95 | -16.72 |
| Main-thread external | 11.75 | 7.59 | -4.16 |
| Raw container memory | 297.94 | 279.58 | -18.36 |

Idle had zero pending work, zero age and no changed completion count throughout.
Steady RSS window medians were 281.16 → 281.11 MiB. Recovery RSS rose
280.56 → 284.98 MiB while container memory rose 364.59 → 378.88 MiB, then
declined during idle. This run does not show continued idle growth and provides
no evidence-based reason to expand the current memory limit. It does not prove
leak freedom. External memory briefly peaked at 35.09 MiB during idle, illustrating
why an individual allocation peak or positive short-window slope is not itself
a leak diagnosis. No forced GC or probe restart was used.

### Limits

- Actual Docker execution used cgroup v1; v2 parsing/validation is unit-tested,
  not locally exercised here. v1 OOM-invocation counts are unavailable, while
  OOM-kill and memory-limit-hit counters are measured directly.
- All 923 samples had required memory telemetry. The first event-loop window
  had no histogram observations; 922 event-loop windows were summarized rather
  than substituting zero for the missing value.
- The host was shared with existing applications. Occasional read-only aggregate
  checkpoints and normal health checks also ran. CPU/PID samples are observations,
  not exclusive-host benchmarks or minimum safe deployment limits.
- The long profile has 400 synthetic evaluation rows × 768 dimensions and a
  300-case cohort, not the separate 6,700-row capacity workload or model inference.
  Normal production scheduling is suppressed only in the disposable container;
  the probe explicitly drives real services and shares admission between them.
- This is temporary provider unavailability plus injected admission telemetry,
  not actual memory exhaustion. No crash/restart was injected into this sustained
  measurement; existing installation-recovery evidence remains separately scoped.

## Recommendation and next component

Keep the production 2 GiB memory limit, admission reservations and CPU/PID
settings unchanged. The selected stack is the existing Node ESM services,
owned Compose environment, cgroup/Node telemetry, strict versioned receipts,
readable aggregate Markdown and opt-in GitHub Actions.

Benefit: repeatable overlap/recovery and retained-memory evidence without new
production machinery or paid calls. Cost: roughly 32 minutes plus image/startup
time for this profile; synthetic success does not establish production capacity.

The next distinct component is **restart recovery with a representative unfinished
backfill backlog**, extending the existing installation-budget drill rather than
adding another orchestrator. Crash after a deterministic durable checkpoint while
work remains, then require the real startup scheduler to finish original work
under the already-defined CPU/PID budget, without reseeding or manual repair.
Verify stable item/run identities, no duplicate dispatch, sibling-library progress
and current profiles; keep pre/post-restart memory counters in separate process
epochs. The existing small installation fixture and this same-process soak do
not establish that combined boundary. Do not repeat another identical dashboard
or infer live resource limits from this run alone.

## PR availability and operational boundaries

GitHub MCP searches at the start of implementation and during final validation
returned no open pull requests in `cloudbyday90/Classifarr`. There was no PR to
select randomly or apply locally; no closed PR was substituted and none was
merged. All implementation changes are ESM; no new dependency is needed.

Local receipts stay ignored under `.tmp`; the separate design/outcome documents
and high-level Unreleased entry are committed. No release, tag or version bump
is included. Live Classifarr data, routing settings and other applications are
outside the study's ownership and remain untouched.

The user-supplied CI links were investigated separately in
[hosted budget diagnostics](resource-study-hosted-budget-diagnostics.md).
The earlier schema-replay failure is already fixed and passed on hosted CI;
the resource startup mismatch was traced to a finite host-default PID ceiling.
Its correction and separately scoped hosted result are linked there.
