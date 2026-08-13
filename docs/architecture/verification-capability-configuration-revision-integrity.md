# Verification Capability Configuration Revision Integrity

## Status

11R.9 is complete on 2026-08-13. The private revision used by the
candidate-bound verification capability receipt is now database-authoritative,
exact across PostgreSQL `BIGINT` values, safe on a missing singleton row, and
covered for fresh and existing installations.

This document does not introduce a provider audit trail, provider telemetry,
configuration history, a provider probe, policy authority, routing authority,
or a classification action.

## Problem

11R.8 added a status-only receipt keyed by a monotonic configuration revision.
The initial implementation relied on `SELECT ... FOR UPDATE` and JavaScript
arithmetic. `FOR UPDATE` locks an existing row, but it cannot lock the absence
of the singleton row. Concurrent first saves could therefore both calculate the
same revision. JavaScript `Number` also cannot represent every valid PostgreSQL
`BIGINT` revision exactly.

Replace restore also retained local actor-scoped receipt history even though
the portable backup format does not include current `ai_provider_config` data
or actor identity remapping. That made the receipts operationally stale after a
cross-installation replacement.

## Official Research Basis

This implementation was reviewed against official guidance available in August
2026:

- PostgreSQL states that row locks acquired through `SELECT ... FOR UPDATE`
  apply only to rows actually returned. A transaction-scoped advisory lock is
  therefore used before that row lock to cover the missing-row case, and is
  released automatically when the transaction ends. [PostgreSQL Explicit
  Locking](https://www.postgresql.org/docs/current/explicit-locking.html)
- PostgreSQL documents the concurrency behavior of `INSERT ... ON CONFLICT`.
  The upsert performs `configuration_revision + 1` in the database so a
  successful conflict update cannot reuse a JavaScript-computed revision.
  [PostgreSQL INSERT](https://www.postgresql.org/docs/current/sql-insert.html)
- PostgreSQL constraints are used to make the non-negative baseline a durable
  schema invariant rather than relying on route validation alone. [PostgreSQL
  Constraints](https://www.postgresql.org/docs/current/ddl-constraints.html)
- PostgreSQL recommends `pg_dump` for logical database backup. The application
  backup format is intentionally narrower and must make its non-portable
  operational data policy explicit instead of accidentally carrying actor
  receipts between installations. [PostgreSQL pg_dump](https://www.postgresql.org/docs/current/app-pgdump.html)

## Decision

### Revision Scope

`configuration_revision` is a private sequence for successful AI Settings
saves. It gives a capability transition receipt an ordered, transaction-bound
identifier. It is not a general revision of every `ai_provider_config` field:
runtime usage counters, RAG rollout state, embedding metadata caches, and
other operational maintenance writes neither alter strict-verification
admission nor produce a receipt.

Only AI Settings may change the strict-verification inputs used by the receipt:
the primary provider/model and the budget-fallback controls. Any future writer
of those inputs must use the same persistence boundary or be rejected during
review.

### Write Boundary

An AI Settings transaction now:

1. Acquires a fixed transaction-scoped advisory lock.
2. Locks the existing singleton row with `SELECT ... FOR UPDATE` when present.
3. Performs the insert/upsert. Insert starts at revision `1`; conflict update
   uses `ai_provider_config.configuration_revision + 1` in PostgreSQL.
4. Reads the persisted value as an exact positive decimal string.
5. Appends one status-only receipt only when strict-verification admission
   changed. Any receipt failure rolls back the settings save.

The receipt contract accepts only exact positive `BIGINT` decimal values. It
does not pass a value through an unsafe JavaScript `Number` before persistence.

### Migration and Restore Policy

The integrity migration repairs only negative persisted values to `0`, keeps
the default at `0`, validates a non-negative check constraint, and installs a
database append-only guard for capability receipts. Normal update and delete
attempts fail. A replace restore supplies a transaction-local maintenance
permit and clears receipts; it does not import them from a backup.

This is intentional. The existing portable backup format does not add
`ai_provider_config` or capability receipts, and there is no actor identity
remapping contract. Keeping receipts after a replacement would create stale
actor-scoped operational history without restoring the configuration that
produced it.

## Alternatives

### Keep Only `SELECT ... FOR UPDATE`

Pros: one familiar row-lock mechanism.

Cons: a missing singleton row yields no lock; concurrent first saves can
calculate the same revision.

Decision: rejected.

### Increment in JavaScript

Pros: simple parameter construction.

Cons: loses precision beyond the JavaScript safe-integer range and permits
stale read-modify-write calculations.

Decision: rejected.

### Revision Every Operational Config Field Change

Pros: one apparent generic counter.

Cons: turns a sparse strict-capability receipt key into a high-churn
configuration audit and makes receipt gaps meaningless.

Decision: rejected. The revision remains narrow and documented.

### Preserve Receipts Through Replace Restore

Pros: historical records remain visible.

Cons: receipt actors and revisions no longer describe the destination
installation's current provider configuration, and no actor-remapping contract
exists.

Decision: rejected. Replace restore explicitly clears them under a
transaction-local database permit.

## Final Recommendation Stack

1. Keep the revision private, positive, and scoped to successful AI Settings
   saves rather than generic runtime maintenance.
2. Use a transaction-scoped advisory lock plus `FOR UPDATE` to serialize both
   present-row and first-row writes.
3. Increment in PostgreSQL and preserve `BIGINT` values as decimal strings at
   the receipt boundary.
4. Enforce a non-negative configuration baseline and append-only receipts in
   the database.
5. Retain receipts only within their current installation; clear them during
   replace restore through a narrowly scoped transaction-local permit.
6. Continue actor-scoped, read-only receipt access and never use a receipt for
   provider, policy, route, retry, or configuration authority.

## Acceptance Evidence

- `server/src/__tests__/services/aiProviderConfigurationRevisionIntegrity.test.mjs`
  proves exact `BIGINT` normalization and the advisory-lock query contract.
- `server/src/__tests__/aiSettingsPersistence.test.mjs` proves lock ordering,
  database-side increment expression, insert baseline, and status-transition
  receipt revision.
- `server/src/__tests__/integration/verification-capability-configuration-revision-integrity.test.mjs`
  proves fresh-install baseline and constraint, a real pre-receipt upgrade,
  migration replay, append-only receipt handling, concurrent first-row saves,
  monotonic revisions, and idempotent no-transition replay.
- `server/src/__tests__/services/backupRestore.authorizedOutcomeReceipt.test.mjs`
  proves replace restore obtains the explicit receipt maintenance permit before
  clearing non-portable receipts.

## Follow-On

**11R.10 AI Settings Stale-Write Conflict Acceptance** is complete. It adds
an opaque, server-issued write precondition to the administrator settings page
without exposing the private revision or changing provider, policy, route,
retry, or receipt authority. See [AI Settings Stale-Write Conflict
Acceptance](ai-settings-stale-write-conflict-acceptance.md).
