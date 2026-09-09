# Scheduler Execution Resilience Design

**Status:** Implemented on 2026-09-09
**Scope:** Server-owned recurring and delayed-start scheduler tasks

## Problem

Classifarr had task-specific `noOverlap` settings, while most recurring tasks
used node-cron's default behavior. A long run could therefore overlap its next
recurring fire in one process. A delayed startup run could also begin while the
same recurring task was still active. Several tasks already use PostgreSQL
advisory locks where one replica must own work, but a lock is not a substitute
for avoiding redundant local work before acquiring a database connection.

The scheduler reported outcomes through logs only. Those logs can be rotated
and are not a bounded source of aggregate performance evidence.

## Requirements

- Require no operator input, library identity, provider configuration, media
  data, policy values, AI data, or routing state.
- Preserve the existing PostgreSQL advisory locks and task-specific transaction
  contracts for cross-replica ownership.
- Keep observation outside task success and failure behavior.
- Store only a small, fixed aggregate that is safe to retain and bounded across
  application releases.
- Use ES modules and isolate scheduling, execution, receipt, and persistence
  responsibilities.

## Decision

Every `SchedulerService.schedule()` registration uses a common resolver that
sets node-cron's `noOverlap: true`. The resolver rejects a caller that attempts
to disable it. This is a deliberate scheduler invariant: a task that requires
queued or concurrent execution needs a separate durable-work design rather
than an unnoticed scheduler option.

A `SchedulerTaskExecutionRunner` keeps a local set of active task names. It
prevents the same named task from running simultaneously when a delayed-start
timer, a direct scheduler invocation, or a cron fire reaches the runner. The
runner records an `in_process_overlap` aggregate and returns `false`; it does
not invoke the handler or acquire an advisory lock. node-cron's own
`execution:overlap` event records a `cron_overlap` aggregate for recurring
fires that are blocked before the handler starts.

The two controls have distinct scope:

| Boundary | Control | Result |
| --- | --- | --- |
| Same process, recurring fires | node-cron `noOverlap` | Later recurring fire is skipped. |
| Same process, recurring and delayed-start fires | `SchedulerTaskExecutionRunner` | Later invocation is skipped before database access. |
| Multiple replicas | Existing PostgreSQL advisory locks and task transaction locks | Only the lock owner performs work when the task requires ownership. |

PostgreSQL documents advisory locks as application-defined locks and provides
non-blocking `pg_try_advisory_lock`, which is the existing ownership mechanism
used here. [PostgreSQL advisory-lock functions](https://www.postgresql.org/docs/current/functions-admin.html)

## Passive Aggregate Receipt

`scheduler_execution_receipts` stores a coalesced counter with exactly four
fixed dimensions:

| Dimension | Allowed values |
| --- | --- |
| Task class | queue, library observation, maintenance, retention, policy maintenance, observation, other |
| Outcome | completed, failed, advisory lock held, in-process overlap, cron overlap |
| Duration | not sampled, then five fixed elapsed-time buckets |
| Receipt version | `scheduler.execution_receipt.v1` |

The implementation maps internal task names to a fixed task class before
persistence. It does **not** store the name, cron expression, error text, SQL,
identifier, library, provider, configuration, media, policy value, AI data,
decision, or routing data. The writer coalesces identical observations for one
minute, uses a parameterized upsert, and does not make a task await the write.
A failed receipt write only produces a bounded warning.

This follows W3C guidance to limit processing to what is needed for the stated
purpose and not use data for a different purpose. [W3C Privacy
Principles](https://www.w3.org/TR/privacy-principles/)

## Alternatives Considered

| Option | Benefits | Costs and decision |
| --- | --- | --- |
| Enable `noOverlap` only for known long tasks | Small edit | New scheduler tasks can silently regain overlap; rejected. |
| Use a distributed node-cron coordinator | Handles replicas | Requires coordinator configuration and operational ownership; rejected because PostgreSQL locking already covers work that needs cluster ownership. |
| Apply a global database advisory lock to every task | Strong replica exclusion | Adds connection pressure and may duplicate task-specific transaction locking; rejected. Existing task contracts retain locks where ownership matters. |
| Persist task names, cron expressions, and errors | Easier ad hoc diagnosis | Adds operational detail and unbounded dimensions; rejected. |
| Install OpenTelemetry immediately | Standard exporter ecosystem | Requires a collector/exporter and configuration surface; deferred. The fixed receipt vocabulary can map to future telemetry. |

node-cron documents that `noOverlap` skips a fire that arrives during a
long-running task. It also exposes `execution:overlap`, which lets this design
observe a skipped fire without invoking work. [node-cron
README](https://github.com/node-cron/node-cron/blob/main/README.md)

## Operational Semantics

A `completed` receipt means that the JavaScript handler returned without
throwing. It does not reinterpret a task's own structured result, create an
automatic retry, or authorize a change. A skipped recurring fire is not queued;
the next cron fire remains the normal retry opportunity. This bounds work but
means a task whose cadence is too short for its duration needs a separate,
evidence-based redesign.

No HTTP endpoint, policy authority, semantic selection, label capture, AI
call, media routing, configuration change, or operator action is introduced.
