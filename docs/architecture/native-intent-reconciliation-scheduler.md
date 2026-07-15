# Native Intent Reconciliation Scheduler

## Status

Implemented as Phase 8R.3.2.1. This is the first automatic native-intent
reconciliation component; it does not replace the remaining ledger, retry,
circuit-breaker, or read-only-status work.

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
  opportunity ninety seconds after complete service initialization.
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

## Recommendation Stack

1. Keep this bounded scheduler and existing transactional conversion writer.
2. Build the durable run and candidate-outcome ledger next.
3. Add retry/quarantine and explicit re-entry guards before deleting the manual
   recovery path.
4. Add circuit breaking and a read-only status projection before compatibility
   storage deletion.

## Verification

Focused tests cover duplicate registration, lock contention, delayed-run reset,
fixed candidate filters, actor audit classification, expired execution budgets,
and sanitized failure results.
