# Shared work admission: validation outcome

## Scope — 28 September 2026

Implementation follows [the design decision](shared-work-admission.md). All new
code is ESM. There is no migration, routing change, release, production resource
limit change or new background timer. The live container from the preceding
no-cache deployment is left running; candidate execution here uses disposable
containers and synthetic movie/TV records.

## Evidence

- Deterministic admission tests exercise 300 mixed-work pressure/recovery cycles,
  bounded per-class concurrency, shared reservations, hysteresis, missing/invalid
  telemetry, reader exceptions and idempotent release. These are policy tests,
  not a sustained RSS/CPU benchmark or proof of maximum task allocation.
- Queue tests cover empty dequeue, dequeue failure, AI requeue, synchronous
  exceptions, rejected task promises and completion. Pressure prevents dequeue;
  in-flight reservations and visibility recovery remain active until settlement.
- Discovery tests cover priority relative to ingestion/backfill, independent
  wrappers sharing a budget, pre-callback failure, cancellation and late completion.
- PostgreSQL movie/TV tests verify that resource refusal preserves legacy items,
  does not create an ingestion attempt and retains watchdog eligibility. Restored
  memory allows normal owned ingestion and completion.
- UI tests cover fixed waiting messages, unknown-reason filtering, stopped
  workers, unavailable status and recovery. Command Center reuses its existing
  memory-only SWR request; ordinary revalidation does not announce a new wait.
- The ownership source pin was refreshed after review. Its analysis digest is
  unchanged; ownership and previously unresolved writer classifications are not
  relaxed. The first coverage pass caught the old pin; the corrected audit and
  its focused tests pass.

### Isolated startup and crash recovery

`node scripts/run-published-upgrade-drill.mjs --fresh-only` passed against
candidate image
`sha256:d7f2f3cc3c28125662c47e72da7253fc03f2a96c42c84e1ac27bd72632a8d701`.
PostgreSQL reported version `180006` with 296 migrations. The real startup
scheduler completed ingestion, metadata backfill and current profiles for two
movie and two TV items, observed ingestion/backfill deferrals, excluded music
and created zero routing tasks.

After a forced crash at the committed ingestion boundary, normal startup
preserved checkpoints, run identities and inventory, completed four metadata
tasks and produced current profiles with zero routing tasks. The harness removed
its isolated containers and volumes. This is fresh-install/crash-recovery
evidence, **not** provenance-verified published-image upgrade acceptance.

### Repository checks

| Check | Result |
| --- | --- |
| Final backend unit run | 1,514 suites; 45,590 tests passed |
| Final client coverage run, Vitest 5.0.2 | 403 files; 5,668 tests passed |
| PostgreSQL integration | 190 suites; 2,183 tests passed; one optional external-AI suite/test skipped |
| Coverage ratchet | Passed without changing thresholds or baseline |
| Lint, types, client build, Markdown lint | Passed; no lint warnings |
| Ownership, dependency, copyright preflight | Passed |
| ESM/static imports, mock shapes, migration/schema integrity | Passed |
| Four policy naming/language/maintenance gates | Passed |

Backend coverage: 90.29% statements/lines, 84.77% branches, 92.20% functions.
Client coverage: 85.96% statements, 78.47% branches, 85.41% functions, 87.92% lines.
The two new memory/admission modules have 100% reported coverage. Coverage was
collected in the initial backend pass described above; the final full unit run
then passed after correcting the reviewed ownership pin. No paid AI call was used.

## Operational limits and recommendation

Reservations are process-local estimates. External tools, other Node processes
and PostgreSQL are not token holders; their memory use is reflected only by OS
telemetry. Admission cannot stop an unexpectedly large in-flight allocation.
The container limit remains the final boundary. Continuous ingestion/backfill
may postpone evaluation; this intentionally favors completing source evidence.
No CPU/PID limit or automatic heap expansion is introduced.

Proceed with a 30-minute isolated mixed-workload study before tuning estimates
or adding CPU-adaptive concurrency. Use synthetic movie/TV providers and the
current 2 GiB container limit, including overlapping ingestion, metadata work,
evaluation and a provider outage. Record warm peak memory, event-loop delay,
queue latency, wait duration and resumption time. Acceptance requires no OOM,
preserved ownership/inventory, and complete backlog/profile recovery after
pressure clears. This is the next concrete follow-up, rather than another
scheduler or more dashboard-only diagnostics.

Follow-up completed: the [mixed-workload study](mixed-workload-resource-study-validation.md)
passed its 30-minute synthetic workload and recovery checks. Limits remain
unchanged. The next component is a bounded capacity-regression gate with a
production-scale profile, not speculative resource tuning.

That [capacity-regression follow-up](resource-capacity-regression-validation.md)
now passes with a larger evaluation corpus and real queued-work preservation.
The next measured opportunity is bounded completion-driven queue wakeup, while
keeping concurrency, reservations and production limits unchanged.
