# Event-loop delay observation design

**Decision date:** 2026-09-09

## Decision

Classifarr will measure process-local event-loop delay with Node's built-in
`monitorEventLoopDelay({ resolution: 20 })` API. Every five minutes, each
running process reduces its local histogram to one fixed p99 delay bucket and
increments a durable aggregate counter. The monitor begins only after the core
scheduler initializes; it has no user, administrator, library, or provider
configuration.

The stored receipt has only a version, one p99 bucket, an aggregate count, and
its latest observation time. A receipt cannot contain a raw delay, histogram
sample count, process identity, task name, schedule, SQL, identifier, media,
library, provider, configuration, policy, AI value, decision, error, or route.

## Why this measurement

Node v24's event-loop-delay monitor is an interval histogram whose values are
nanoseconds. With a 20 ms resolution, a healthy idle process normally includes
the sampling interval itself, so the bucket vocabulary begins below 25 ms rather
than treating a 20 ms sample as a fault. The p99 makes occasional pauses visible
without storing a raw maximum that may overemphasize a single outlier.

Each new scheduled observation resets the in-memory histogram after taking the
snapshot. The resulting persisted row therefore represents a bounded recent
window, while the database counter summarizes how often each bucket has
occurred across restarts and replicas.

## Architecture

| Module | Responsibility |
| --- | --- |
| `eventLoopDelayReceipt.mjs` | Defines the fixed receipt version, p99 buckets, and raw-value reduction. |
| `eventLoopDelayReceiptRepository.mjs` | Performs the parameterized aggregate upsert. |
| `eventLoopDelayObservationService.mjs` | Owns monitor start/stop, snapshot/reset, and failure containment. |
| `eventLoopDelayObservationSchedule.mjs` | Owns the server-controlled cadence and startup delay. |
| `eventLoopDelayObservationScheduler.mjs` | Starts local measurement and registers recurring observations. |
| `20260909_102827_add_event_loop_delay_receipts.sql` | Defines the bounded receipt table and database constraints. |

The service does not hold an advisory lock. Event-loop delay is intentionally
local to a Node process; suppressing other replicas would discard evidence.
Each replica contributes the same fixed aggregate dimensions and no replica
identity.

Histogram failures and receipt-write failures become fixed, non-persisted
warnings. They do not fail a queue, scheduler task, policy, media sync, AI
provider call, classification, or route. The scheduler's existing no-overlap
guard prevents concurrent local snapshot/reset calls.

## Node 24 child-process correction

The root workspace test launcher previously enabled `shell: true` on Windows.
Node 24 reports DEP0190 when `spawn` or `execFile` receives both shell mode and
arguments because arguments are concatenated rather than safely escaped.

The launcher now uses an explicit `cmd.exe` process with `shell: false` to
launch the fixed `npm.cmd` shim. It permits only conventional npm script names
(`A-Z`, `a-z`, digits, `:`, `_`, and `-`), so no script argument can introduce a
command separator or other shell syntax. This retains Windows support while
removing the deprecated Node API mode.

## Alternatives and tradeoffs

| Option | Benefits | Costs | Decision |
| --- | --- | --- | --- |
| Fixed p99 aggregate | Durable, low-cardinality evidence that shows sustained local stalls. | Buckets omit exact values and individual spikes. | Adopt |
| Persist raw histogram statistics | Precise diagnosis. | Adds precision and retention without a demonstrated need. | Reject |
| Per-task timing or correlation | Can connect a stall to one task. | Creates operational and library-sensitive dimensions. | Reject |
| External telemetry exporter | Supports centralized observability. | Requires collector configuration and ownership. | Defer |
| Pool-wait aggregate | Helps distinguish database pressure from a process stall. | Adds instrumentation before evidence warrants it. | Defer |
| `shell: true` for Windows npm scripts | Concise compatibility path. | DEP0190 and unsafe argument concatenation. | Reject |
| `cmd.exe` plus an allowlisted script name | Windows-compatible without Node shell mode. | Keeps a constrained command-interpreter boundary. | Adopt |

## Privacy, security, and accessibility

The receipt implements data minimization and purpose limitation: its sole
purpose is passive platform reliability measurement, and the table vocabulary
makes sensitive or identifying dimensions unrepresentable. It is not read by
policy, AI, semantic evidence, study labeling, classification, or routing code.

No UI or endpoint is introduced. If a future administrator view exposes these
aggregate counters, it must remain read-only, authorized, and present status
updates accessibly.

## Research basis

- [Node.js v24 performance APIs](https://nodejs.org/download/release/v24.16.0/docs/api/perf_hooks.html)
  document `monitorEventLoopDelay`, the `resolution` option, the nanosecond
  histogram values, and the timer-based sampling model used here.
- [Node.js event-loop guidance](https://nodejs.org/en/learn/asynchronous-work/dont-block-the-event-loop)
  explains that blocking callbacks can reduce throughput and enable denial of
  service, supporting a passive measurement before intrusive diagnosis.
- [Node.js child-process documentation](https://nodejs.org/api/child_process.html)
  documents direct `cmd.exe` invocation for Windows `.cmd` scripts and warns
  against shell-mode invocation with untrusted input.
- [Node DEP0190 documentation](https://nodejs.org/download/release/v25.0.0/docs/api/deprecations.html)
  records the Node 24 runtime deprecation for arguments passed with shell mode.
- [W3C Privacy Principles](https://www.w3.org/TR/privacy-principles/)
  recommends data minimization and purpose limitation; the fixed table shape
  enforces both.
- [PostgreSQL INSERT](https://www.postgresql.org/docs/18/sql-insert.html)
  documents the `ON CONFLICT DO UPDATE` aggregate upsert used by the repository.
