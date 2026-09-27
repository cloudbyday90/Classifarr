# Recovery progress and startup readiness: design

Date: 2026-09-27. Scope: current credential-released movie/TV recovery cases and
the scheduled inventory learning services that consume their metadata.

## Decision

Capture milestones at their transactional boundaries, then present an accessible
stage chart in the existing administrator Metadata recovery view. Add a cheap
prerequisite probe before scheduled learning does expensive work. Do not add a
second scheduler, broker, metrics server, chart dependency or AI call.

## Evidence and contract

Each source row holds at most one bounded JSON progress receipt, tied to its
current recovery case ID and credential generation. A verified wakeup records
release time and the actual jittered eligibility time. Queue insertion records
first admission only when the payload matches the receipt, typed TMDb identity
and library. Admission and receipt commit or roll back together. The provider
lease records first start; successful observation persistence records completion.
Source changes or a new case clear the receipt. Another verified wakeup replaces
it. Task retention cannot erase these timestamps; item deletion removes them.

The migration does not invent earlier milestones. It adds no live backfill or
provider calls. This is a latest-case diagnostic, not an immutable history or
exactly-once network execution guarantee. An older already-queued task can recover
without a recorded admission; its timing remains unmeasured.

The read-only `/api/inventory-recovery/progress` endpoint uses the existing
administrator access-session boundary, no-store headers, rate limit and a current
actor check before and after its read-only repeatable-read transaction. Fixed
queries have a three-second statement deadline. At most 1,001 rows are retrieved
to summarize the newest 1,000 retained wakeups within 30 days in active supported
libraries; a lookahead flag discloses truncation. No credentials, titles, raw
provider errors, item IDs or case IDs leave the aggregate endpoint.

Current stages form a partition: waiting, ready, queued, checking, source blocked,
recovered, or unmeasured. Source conflicts take precedence over pending work;
recovery requires a persisted completion receipt and a valid resolved case.
The six-hour attempt clock still applies when computing current eligibility.
The chart reports a cohort recovery percentage, never placement accuracy or
overall library health. It shows no percentage for an empty cohort and never
rounds partial completion up to 100%.

Elapsed-time summaries are medians with their own sample counts. Eligible-to-queue
uses only ordered recorded timestamps; queued-to-saved includes retries and
cooldowns, not just provider request latency. Missing or inconsistent times are
not replaced by zero. A long queue wait is a diagnostic hint, not automatic
permission to change routing, retry policy or provider admission.

## Fresh installation and busy-system behavior

A shared, coalesced readiness wrapper now precedes scheduled description refresh,
representative-profile refresh, multi-scale context refresh and source-pair
evaluation/adjudication capture. It checks enabled RAG, active supported libraries,
current pending/running sync or collecting source capture, available inventory,
and pending-due/processing foreground tasks. Pending work with NULL retry time is
due; the existing inner busy check is corrected accordingly.

| Condition | Behavior |
| --- | --- |
| Learning disabled / no selected libraries / no items | Return a fixed waiting reason; no model client, corpus scan or evaluation write |
| Ingestion or due foreground work active | Yield; recheck on the next existing tick |
| Readiness database probe fails | Fail closed as unavailable; do not start learning |
| Prerequisites available | Run the existing worker, retaining its configuration, evidence, lock, memory and publication checks |
| Stop while the readiness probe is pending | Do not start the worker when the probe returns |

Ingestion, gap analysis, metadata recovery, ordinary queue workers and security/
retention jobs are not gated behind learning readiness: doing so could prevent
the system from ever becoming ready. Readiness is an admission observation, not
a lock preventing new ingestion from starting later. Existing inner admission
and publication guards remain authoritative. A future-dated retry alone does not
block learning indefinitely. A stale running/collecting marker is not silently
discarded; the owner must reconcile it rather than guessing that ingestion ended.

This is not a platform-wide rewrite of every scheduler. Cached destination
evaluation, routing and operator-initiated studies retain their existing domain
contracts. The wrapper does not stop an already-running job merely because new
work appears; that job retains its existing cancellation/revalidation behavior.

## Official research and alternatives

URLs were discovered using online search/navigation and reviewed on 2026-09-27.

- [PostgreSQL trigger behavior](https://www.postgresql.org/docs/18/trigger-definition.html)
  documents transactional trigger execution. Use this to couple admission and
  progress without a crash window between separate application writes.
- [OpenTelemetry Metrics SDK](https://opentelemetry.io/docs/specs/otel/metrics/sdk/)
  documents bounded cardinality. Apply fixed stage/reason labels; keep per-case
  identity in private durable state, not metric labels. No SDK is added here.
- [Microsoft background-job guidance](https://learn.microsoft.com/en-us/azure/architecture/best-practices/background-jobs)
  covers idempotent scheduled work and durable progress reporting. Apply those
  principles to the existing local queue and database; no cloud service is needed.
- [Kubernetes probe concepts](https://kubernetes.io/docs/concepts/workloads/pods/probes/)
  distinguish startup/readiness from liveness. By analogy, missing inventory is
  a normal worker-admission wait, not a reason to restart the healthy application.
  This is an application-level design choice, not a Kubernetes dependency.
- [W3C image alternatives](https://www.w3.org/WAI/tutorials/images/) calls for
  equivalent text for charts. The decorative bar has a visible count legend,
  denominator and timing labels; information is not available through color alone.
- [W3C Pause, Stop, Hide](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide)
  supports user control of automatic updates. Reuse one pausable, non-persistent
  SWR snapshot for chart and cases; access failure hides both, even while paused.

| Option | Pros | Cons / recommendation |
| --- | --- | --- |
| Infer progress from logs or live queue only | No write-path changes | Loses history at cleanup and confuses attempts with commits; reject |
| Latest-case transactional receipt | Restart-safe, bounded storage, attributable timings | Not a lifetime trend; recommended |
| Append-only event/metrics platform | Long-term trends and cross-instance export | Retention, cardinality and operational burden; defer until needed |
| Globally pause all services during startup | Simple rule | Deadlocks prerequisite production and recovery; reject |
| Demand-gate scheduled learning only | Prioritizes ingestion, resumes automatically | Conservative under sustained foreground load; recommended |

Final stack: PostgreSQL receipt/indexes → modular ESM projection/readiness services
→ existing authenticated API/queue/scheduler → non-persistent SWR → Vue/CSS chart
with equivalent text. No new dependencies, release or automatic routing changes.
