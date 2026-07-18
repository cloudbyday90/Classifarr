# Native Intent Reconciliation Scheduler

## Status

Implemented as Phase 8R.3.2.1. The follow-on durable ledger is also now
implemented; retry, circuit-breaker, and read-only-status work remain.

## Objective

Move safe native-intent storage conversion out of the normal policy-authoring
flow. A server-owned job converts only current, eligible legacy policies. It
does not infer intent, change routing, activate automation, learn policy rules,
or mutate ordinary policy reads and saves.

## Official-Source Research

- [PostgreSQL explicit locking](https://www.postgresql.org/docs/current/explicit-locking.html)
  describes advisory locks for application-defined coordination and warns that
  applications must use a consistent locking approach. A session advisory lock
  therefore owns the cross-replica scheduler opportunity, while the existing
  per-policy authority lock remains inside the conversion transaction.
- [PostgreSQL administrative functions](https://www.postgresql.org/docs/current/functions-admin.html)
  documents advisory-lock functions and session scope. A runner crash or lost
  database session releases its lock, allowing a later schedule to resume.
- [node-cron scheduling options](https://www.nodecron.com/) documents
  `noOverlap` for skipping an in-process scheduled callback while its prior
  callback is still running. It complements, but does not replace, the
  PostgreSQL advisory lock used across application replicas.
- [OWASP API6: Unrestricted Access to Sensitive Business Flows](https://owasp.org/API-Security/editions/2023/en/0xa6-unrestricted-access-to-sensitive-business-flows/)
  supports fixed server-side rate and execution limits for automated sensitive
  work. The scheduler has no request-controlled batch size or deadline.
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
  supports structured, sanitized operational evidence. The runtime result
  contains stable status/error IDs and counts only, not legacy payloads or raw
  exception bodies.

## Implemented Design

- `nativeIntentReconciliationService.mjs` has a fixed batch size of ten and a
  twenty-second execution deadline.
- `schedulerService` registers one ten-minute task and one non-blocking initial
  opportunity ninety seconds after complete service initialization. The
  recurring task enables node-cron's `noOverlap` guard to avoid redundant
  same-process callbacks before database coordination begins.
- Advisory lock key `2008` makes only one application replica eligible to run
  each opportunity. The process that cannot acquire it does no work.
- Candidate selection excludes policies with active native intent and policies
  that have a `rollback_applied` migration event. A normal scheduled run cannot
  undo an intentional rollback.
- The existing conversion gate still performs current-state planning,
  transactional writes, authority locks, snapshots, validation, idempotency,
  and rollback-safe failure handling.
- Automatic events use the distinct `reconciler` actor type and
  `native_intent_reconciliation` metadata source.

## Risk Handling

| Risk | Control |
| --- | --- |
| Two replicas process a batch | Session advisory lock plus existing per-policy authority locks. |
| One replica overlaps its own recurring callbacks | node-cron `noOverlap` skips the redundant callback before it opens a database session. |
| Startup blocks while maintenance runs | Initial work is delayed and never awaited during service initialization. |
| A slow query exceeds the run budget | A transaction-local PostgreSQL statement timeout and deadline checks defer the run. |
| A reversion is immediately undone | The automatic selector excludes `rollback_applied` policies. |
| A native policy is selected again | Active native authority excludes it from the candidate query. |
| Sensitive policy data appears in logs/status | Results are reduced to stable IDs and aggregate counts. |

## Options Considered

### Manual Conversion Only

Pros: direct operator control.

Cons: turns storage maintenance into a recurring authoring task and does not
scale to restored or newly imported legacy data.

### One-Time Post-Upgrade Action

Pros: small initial implementation.

Cons: temporarily blocked candidates can be marked complete permanently and
will not be reconsidered safely.

### Bounded Scheduler Reconciler

Pros: automatic, restart-safe, multi-replica safe, and keeps the proven writer.

Cons: requires durable outcome/retry state before the manual maintenance surface
can be removed.

### Local Overlap Guard Plus Database Coordination

Use node-cron's `noOverlap` only for the reconciliation schedule, alongside the
existing PostgreSQL session advisory lock.

Pros:

- skips a redundant recurring callback in the same process before it uses a
  database connection,
- keeps scheduler pressure bounded when an unexpectedly slow run spans a cron
  boundary,
- leaves the existing cross-replica lock and transaction-level authority
  controls unchanged.

Cons:

- `noOverlap` is process-local and cannot coordinate replicas by itself,
- a skipped local callback is not durable work state and must not be interpreted
  as a completed reconciliation run.

Decision: selected as a narrow defense-in-depth guard. PostgreSQL session
advisory locks remain the only cross-replica scheduler authority.

## Recommendation Stack

1. Keep this bounded scheduler and existing transactional conversion writer.
2. Enable node-cron's process-local `noOverlap` guard for the recurring
   reconciliation callback, but retain the database advisory lock for replica
   coordination.
3. Keep the durable run and candidate-outcome ledger bounded and payload-free.
4. Add retry/quarantine and explicit re-entry guards before deleting the manual
   recovery path.
5. Add circuit breaking and a read-only status projection before compatibility
   storage deletion.

## Verification

Focused tests cover duplicate registration, lock contention, delayed-run reset,
fixed candidate filters, actor audit classification, expired execution budgets,
and sanitized failure results.
