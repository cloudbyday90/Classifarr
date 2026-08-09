# Task Queue Maintenance Serialization And Retention Telemetry

Status: implemented and verified on 2026-08-09.

## Problem

`task_queue` keeps terminal rows for operator troubleshooting and removes them
using status-specific retention periods. The worker also starts an asynchronous
age drain, while the scheduler runs a delayed startup cleanup and a daily cron
cleanup. Before this change, all delayed-startup cleanup records looked like
scheduled runs, age-only cleanup logged a warning as "bloat", and the entry
points could overlap across processes.

An August 2026 review confirmed that a 1,050-row age-only startup drain was
working as designed: the queue was well below its 200,000-row cap and contained
only completed rows older than the seven-day retention period. The misleading
warning and ambiguous history made that normal behavior appear unhealthy.

## Research

- PostgreSQL documents nonblocking session advisory locks as an application
  coordination mechanism. A failed `pg_try_advisory_lock` returns immediately,
  and a session-level lock remains held until explicit release or session end.
  This suits a multi-statement maintenance operation that must not overlap:
  [PostgreSQL 18 advisory lock functions](https://www.postgresql.org/docs/18/functions-admin.html).
- PostgreSQL advises that many installations can rely on autovacuum and warns
  that regular manual `VACUUM ANALYZE` activity can create I/O pressure or
  interfere with autovacuum. The current task queue already has aggressive
  per-table autovacuum settings, so vacuum-threshold tuning is a measured
  follow-up rather than part of this serialization change:
  [PostgreSQL 18 routine vacuuming](https://www.postgresql.org/docs/18/routine-vacuuming.html).
- PostgreSQL distinguishes session and transaction advisory locks. A
  transaction lock cannot protect the existing multi-batch cleanup because the
  operation intentionally uses multiple statements and may run `VACUUM`, which
  cannot run inside a transaction block. The session helper already used by this
  repository provides the required dedicated connection and `finally` release.

## Options

### Scheduler-Only Lock

Pros: minimal scheduler edit.

Cons: does not cover the worker-startup drain, duplicates lock policy in two
layers, and leaves a direct service call unprotected.

### Per-Statement Transaction Lock

Pros: automatic release at each transaction boundary.

Cons: cannot serialize the complete multi-batch cleanup and vacuum lifecycle;
each statement could interleave with another process.

### Service-Owned Session Advisory Lock

Pros: one lock protects every entry path, is nonblocking, works across
processes, releases on error or session end, and matches the existing database
helper pattern.

Cons: requires an injected lock helper in unit tests and one new advisory-lock
identifier.

### Final Recommendation

Use a service-owned session advisory lock plus an in-process single-flight
guard. Retain the existing indexed, status-specific batch deletes and current
retention periods. Record an explicit cleanup origin, classify safe age-only
drains as informational, and preserve warnings for count-cap pressure,
combined pressure, and failures.

## Contract

### Cleanup Origins

New records identify one of the following origins:

- `worker_startup`: the asynchronous drain launched with the queue worker.
- `startup_delayed`: the scheduler's five-minute post-start reconciliation.
- `cron`: the daily 03:15 scheduler execution.
- `legacy`: rows written before the origin column existed.

The existing `cleanup_type` and `trigger` fields remain for compatibility. The
origin explains *where* the run began; the trigger explains *why* rows were
removed.

### Serialization

`QueueMaintenanceService` owns both guards:

1. An in-process promise guard returns a bounded skipped result when a cleanup
   is already running in the same Node.js process.
2. A nonblocking PostgreSQL session advisory lock returns a bounded skipped
   result when another process owns queue maintenance.

The service never waits for a competing cleanup. A skipped run performs no
delete, history insert, or vacuum. The lock covers counts, age deletion,
count-cap deletion, history persistence, and the existing vacuum step.

### Logging

An age-only worker-startup backlog below the count cap is a normal retention
event and logs at `INFO` as a retention drain. Count-cap and combined pressure
remain `WARN`, while lock skips are `DEBUG`. Structured fields include the
origin, trigger, status counts, retention policy, and cap.

## Acceptance Criteria

- A worker-startup drain, delayed-startup cleanup, and cron cleanup persist
  distinct origins.
- Existing cleanup-history rows migrate to `legacy` without changing their
  type, trigger, or counts.
- A local in-flight cleanup and a cross-process advisory-lock conflict both
  skip without deleting rows or recording history.
- Age-only startup cleanup logs an informational retention message; count-cap
  pressure still logs a warning.
- The existing status-specific retention, count-cap trimming, and non-fatal
  vacuum behavior remain covered by focused tests.
- The authoritative schema snapshot includes the migration.

## Implementation Outcome

- Added `cleanup_origin` to `task_queue_cleanup_history` with a `legacy`
  default, a closed check constraint, and a forward-only migration that
  preserves every existing history row.
- Routed worker-startup, delayed-startup, and daily cron cleanup through one
  service-owned nonblocking advisory lock and an in-process single-flight
  guard. A skipped invocation has no data-plane side effects.
- Reclassified an age-only, below-cap startup drain as informational retention
  work. Capacity and combined pressure remain warnings with the same bounded
  telemetry used for cap trimming.
- Corrected the documented task-queue cap default from 10,000 to 200,000.

Verification completed with focused queue/scheduler/database tests, the full
server unit and integration suites, server and documentation linting,
migration/static-ESM/mock-shape checks, a recreated healthy local Compose
installation, and authoritative source plus fresh-container schema dumps.

## Deferred Follow-Up

Measure manual `VACUUM ANALYZE` duration and autovacuum activity before adding
a deletion threshold. The current table-level autovacuum policy is deliberately
aggressive; changing vacuum behavior without production measurements would
trade a noisy log for an unverified performance risk.
