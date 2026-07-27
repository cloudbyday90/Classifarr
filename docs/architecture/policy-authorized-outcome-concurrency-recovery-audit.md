# Policy Authorized Outcome Concurrency And Recovery Audit

## Decision

Phase 6R.3.3f adds database-backed verification for the authorized-outcome
transaction boundary and the profile-refresh outbox worker. The audit does not
expand the operator workflow, evidence authority, or retry policy. It proves
that the current contracts preserve their safety guarantees when transactions
overlap, state becomes stale, authorization changes, or a writer fails.

## Research

PostgreSQL documents that `FOR UPDATE SKIP LOCKED` is appropriate for multiple
consumers of a queue-like table, but is not a general-purpose consistent read.
The audit uses it only for operational outbox claims and verifies a deterministic
`ORDER BY` plus distinct row ownership. [PostgreSQL 18 `SELECT`
documentation](https://www.postgresql.org/docs/18/sql-select.html)

PostgreSQL's `UPDATE` documentation recommends a CTE with ordered rows for
bounded update batches and notes that `SKIP LOCKED` prevents competing workers
from updating the same row. [PostgreSQL 18 `UPDATE`
documentation](https://www.postgresql.org/docs/18/sql-update.html)

OWASP recommends server-owned workflow state, current-state validation, row
locks or transactions around critical sections, and idempotency keys for
retryable side effects. [OWASP Business Logic Security Cheat
Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Business_Logic_Security_Cheat_Sheet.html)

## Options Considered

### Mock Only Every Boundary

Pros: fast and narrowly isolated tests.

Cons: cannot demonstrate PostgreSQL's actual unique constraints, row locks,
transaction rollback, or `SKIP LOCKED` behavior. Rejected as the sole audit.

### Broad End-To-End API Replay Tests

Pros: follows a user-visible path.

Cons: each live source has a different lifecycle and the test would obscure
which database guarantee failed. It also cannot safely force every worker race.
Rejected for this component.

### Focused Database-Backed Contract Audit

Pros: verifies the exact persistence boundaries with isolated PostgreSQL suite
databases, while preserving focused unit tests for individual normalizers and
repositories.

Cons: requires carefully bounded direct setup SQL. Selected.

## Final Recommendation Stack

1. Retain focused unit tests for pure commands and conditional repository SQL.
2. Add one isolated integration suite that opens real PostgreSQL transactions.
3. Verify concurrent exact source-event execution yields one applied result,
   one replay, one receipt, and one learned effect.
4. Verify renamed destinations and lost authorization block before receipt or
   writer persistence.
5. Inject an outbox failure after the real compatibility writer and assert that
   outcome, receipt, evidence, and outbox rows all roll back.
6. Hold a real first claim transaction while a second claim uses `SKIP LOCKED`,
   then prove stale leases can be reclaimed and stale tokens cannot complete.

## Implementation

`policy-authorized-outcome-concurrency-recovery.test.mjs` uses the existing
Testcontainers PostgreSQL integration harness. It does not connect to a local
operator database or require a media server, provider, credentials, or library
name from a specific installation.

The audit covers:

- concurrent executor calls for one source event, resulting in one durable
  receipt and exact-item effect;
- destination name drift and authorization loss, with no receipt written;
- failure while enqueuing refresh work after compatibility evidence is written,
  with the outer transaction rolling back all effects;
- two overlapping outbox claim transactions, expired-lease reclamation, and
  token-guarded rejection of stale completion.

## Security Outcome

- The transaction executor rechecks state and authorization from server-owned
  rows before it claims idempotency state.
- The test proves a failed evidence/outbox operation cannot leave a partial
  receipt, outcome, evidence row, or runnable refresh command.
- The worker audit proves one claim token cannot complete after a later worker
  recovers the lease.
- No test fixture persists raw AI, provider, Discord, or operator payloads.

## Next Step

Phase 6R.3.3 is complete through the authorized outcome, evidence, refresh
outbox, worker, and concurrency/recovery boundaries. The next Phase 6R work is
**6R.4 Automation Readiness Engine**, beginning with its server-owned readiness
projection and a cutline that removes diagnostic-panel concepts from product
state.
