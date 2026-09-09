# Scheduler Execution Resilience Outcome

**Completed:** 2026-09-09
**Status:** Implemented and locally validated

## Outcome

Classifarr now treats duplicate scheduler execution as a bounded, observable
condition. All recurring registrations through `SchedulerService` receive
node-cron's `noOverlap: true`; the option cannot be disabled through the shared
resolver. The new in-process runner also prevents a delayed startup timer or
direct invocation from entering a task while the same named task is active.

Cross-replica behavior is unchanged. Existing task-level PostgreSQL advisory
locks and transaction locks continue to decide whether work requiring cluster
ownership may run. This avoids adding an unconditional database lock and
connection acquisition to every scheduled fire.

## Implementation

| Component | Responsibility |
| --- | --- |
| `schedulerCronOptions.mjs` | Enforces scheduler-wide node-cron non-overlap options. |
| `schedulerTaskExecutionRunner.mjs` | Coordinates local execution, preserves advisory-lock behavior, and observes cron overlap events. |
| `schedulerExecutionReceipt.mjs` | Defines the private fixed-bucket receipt contract and safe recording boundary. |
| `schedulerExecutionReceiptService.mjs` | Coalesces observations for 60 seconds and isolates failed writes. |
| `schedulerExecutionReceiptRepository.mjs` | Performs the parameterized aggregate upsert. |
| `20260909_085356_add_scheduler_execution_receipts.sql` | Adds the bounded receipt counter table and database constraints. |
| `scheduler.mjs` | Composes the modules without adding a new application-wide singleton. |

The receipt contains only fixed task classes, outcome IDs, duration buckets,
receipt version, count, and freshness timestamp. It is unable to expose or
reconstruct a task name, schedule, error, SQL, media, library, provider,
configuration, policy content, AI data, decision, or routing state.

## Local Validation

- Focused scheduler, receipt, and source-inventory suite: 109 passing
  assertions.
- Complete backend CI suite: 1,155 suites and 32,994 tests passed with the
  512 MB idle-worker recycle limit.
- Complete client CI suite: 356 files and 4,935 tests passed.
- Server and client type checks, security/test lint, Knip (ordinary and
  production), docs lint, the coverage ratchet, ESM checks, the production
  client build, migration/schema checks, and copyright/diff checks passed.
- A no-cache Docker Compose rebuild, forced recreation, health check, and
  authoritative schema snapshot check passed. The new migration applied and
  the recreated service was healthy.
- A 14-path security diff review found no validated findings.

The preceding [GitHub workflow run](https://github.com/cloudbyday90/Classifarr/actions/runs/34326284554)
failed only at Knip because an unused compatibility re-export remained in the
source tree. Removing that alias restores dependency-declaration validation.
The source-inventory scanner now records a file deleted from the worktree but
still present in Git's index as a coverage gap instead of throwing; its focused
test uses an isolated temporary Git repository. The downstream release
acceptance readout did not run because it correctly requires repository
validation to pass first.

The repository's GitHub pull-request page had no open pull requests when this
work began, so there was no random open PR available to test locally.
[GitHub pull-request queue](https://github.com/cloudbyday90/Classifarr/pulls)

## Recommendations and Tradeoffs

| Priority | Recommendation | Benefits | Tradeoff |
| --- | --- | --- | --- |
| 1 — implemented | Default non-overlap plus local runner guard | Prevents same-process duplicate work and avoids redundant lock attempts. | A skipped fire waits until the next cadence. |
| 2 — implemented | Fixed, coalesced scheduler execution receipt | Gives durable, low-cost evidence across restarts without collecting operational payloads. | It intentionally cannot diagnose a specific task or error. |
| 3 — implemented | 512 MB CI idle-worker recycle limit | Keeps complete coverage runs bounded after a worker retains excessive memory. | Recycling a worker adds a small test-run cost. |
| 4 — next | Add a passive event-loop-delay aggregate using Node's built-in `monitorEventLoopDelay` | Separates scheduler delay caused by process stalls from task duration. | Needs a stable observation window and carefully chosen buckets. |
| 5 — later, evidence-led | Add a coarse connection-pool wait aggregate only if receipts show persistent scheduler delay | Can distinguish database acquisition pressure from CPU stalls. | Adds more instrumentation and must retain no query or connection identity. |
| 6 — defer | Export OpenTelemetry metrics | Integrates with external observability systems when one is actually configured. | Introduces collector/exporter configuration and operator responsibility. |

Node's `monitorEventLoopDelay` provides a histogram of event-loop delay in
nanoseconds, so it can support the next passive, bucketed measurement without a
new dependency. [Node.js performance APIs](https://nodejs.org/api/perf_hooks.html)

Jest evaluates idle worker memory after a test and can recycle workers above a
fixed threshold. The 512 MB cap matches the existing ordinary backend test
command and bounds complete coverage runs without changing test semantics.
[Jest configuration](https://jestjs.io/docs/30.0/configuration)

## Final Recommendation Stack

1. Keep the implemented non-overlap, local execution, existing advisory-lock,
   aggregate-receipt, and bounded CI-worker layers as the scheduler baseline.
2. Observe the fixed receipts through at least one normal maintenance cycle;
   do not retime the clustered cleanup schedules without evidence of overlap,
   failure, or long duration.
3. Implement a private event-loop-delay aggregate as the next reliability item.
4. Consider a coarse pool-wait aggregate only if the first two data sources
   indicate database contention.
5. Add an external telemetry exporter only when a collector and ownership model
   exist.

This stack is library- and configuration-agnostic. It does not introduce policy
authority, semantic selection, AI automation, or automatic media routing.
