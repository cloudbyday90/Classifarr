# Compatibility Deletion Resolution Gate

**Status:** Implemented

## Problem

Compatibility storage cannot be removed simply because enabled policies have
been converted to native intent. A policy can still have a current
`requires_maintenance` reconciliation state that represents unresolved
authority, conversion, or recovery work. A support acknowledgement, alert
deduplication transition, or time-bound support statement does not resolve
that state.

## Research And Recommendation

The recommended design is a server-owned, fail-closed deletion gate that
requires both of these independently measured facts:

1. The enabled-policy inventory reports zero unconverted policies.
2. The current reconciliation-state inventory reports zero
   `requires_maintenance` states.

The inventories are collected in one `REPEATABLE READ READ ONLY` PostgreSQL
transaction. PostgreSQL documents that this isolation level gives a
transaction-level snapshot and that read-only transactions disallow
data-modification commands. This prevents a deletion plan from combining a
conversion count and reconciliation-state count observed at different database
moments. [PostgreSQL transaction isolation](https://www.postgresql.org/docs/current/transaction-iso.html)
[PostgreSQL SET TRANSACTION](https://www.postgresql.org/docs/current/sql-set-transaction.html)

The count and gate are enforced by trusted server-side services and default to
blocked when the count is unknown. This follows OWASP guidance that access and
transaction decisions must be enforced server-side and should deny by default.
[OWASP Transaction Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Transaction_Authorization_Cheat_Sheet.html)

PostgreSQL explicitly cautions that `CHECK` constraints cannot safely express
cross-row or cross-table constraints. The gate is therefore an application
transaction that consumes bounded, read-only database evidence rather than an
unsafe cross-table `CHECK` constraint. [PostgreSQL constraints](https://www.postgresql.org/docs/current/ddl-constraints.html)

## Options Considered

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Require only converted enabled policies | Simple and already available | Leaves unresolved reconciliation state invisible | Rejected |
| Treat support, acknowledgement, or alerts as clearance | Minimal workflow friction | Does not resolve stored state and is user-controlled | Rejected |
| Add a cross-table database `CHECK` | Centralized in schema | PostgreSQL does not support this safely for changing cross-row state | Rejected |
| Count current unresolved state in a server-owned transaction | Fail-closed, bounded, current, and auditable | Adds one lightweight read query to plan collection | Adopted |

## Implemented Design

- `policyCompatibilityDeletionReconciliationStateInventory` counts only current
  `requires_maintenance` rows from
  `policy_native_intent_reconciliation_states`.
- The inventory exposes a count, bounded status and risk IDs only. It does not
  expose policy IDs, failure reasons, legacy payloads, or raw exceptions.
- Compatibility deletion gates require `requiresMaintenanceStateCount === 0`.
  `null`, malformed, or positive counts block deletion.
- Deletion readiness and execution-plan evidence bind the measured count across
  the reconciliation inventory, deletion gate plan, and readiness report.
- Evidence collection requires `REPEATABLE READ READ ONLY` through the
  existing transaction helper. Callers without transaction-owned database
  access cannot produce a live deletion-evidence bundle.
- The existing reconciliation-state outcome index supports the count query, so
  no schema migration is required.

## Security And Operational Properties

- No client request, support stance, acknowledgement, alert state, or UI flag
  can supply clearance for unresolved reconciliation state.
- Unknown or invalid evidence blocks deletion.
- Collection performs no writes, schema changes, deletion, or archive action.
- Evidence timestamps must remain within the existing bounded observation
  window.
- Storage removal remains a later explicit controlled-removal action; this
  change only makes the planning gate truthful.

## Verification

- Unit tests cover unknown, positive, and zero state counts; bounded output;
  gate and readiness blocking; evidence count mismatches; and the read-only
  repeatable-read collection path.
- Existing execution-plan, artifact, execution-gate, and controlled-removal
  tests now require the new evidence, proving a missing state count cannot
  accidentally create a ready downstream artifact.
