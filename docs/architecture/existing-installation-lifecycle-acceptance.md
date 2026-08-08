# Existing-Installation Lifecycle Acceptance

## Status

Complete: 10R.2.1 adds the persisted conversion-matrix acceptance boundary.
The scope is deliberately limited to the first automatic reconciliation run.
Idempotent re-runs and runtime-native reads are covered independently by
10R.2.2. Compatibility-retirement evidence remains separate 10R.2.3 work.

## Decision

Use an isolated PostgreSQL integration fixture that invokes the same scheduler
and reconciliation service used by the server. Seed database state directly,
not mocked candidate-report objects, so every case traverses the actual loader,
candidate report, lifecycle state service, apply gate, ledger, and database
constraints.

The fixture must be installation-agnostic:

- It generates its own library, policy, preset, and profile records.
- It has no provider credential, outbound provider call, media-server
  connection, UI action, or maintainer command.
- It relies only on platform-owned database state and the scheduler's advisory
  lock boundary.

## 10R.2.1 Matrix

| Persisted starting state | Expected automatic durable outcome | Forbidden outcome |
| --- | --- | --- |
| Library with no policy | No policy intent or reconciliation state for that library | Synthesizing a policy or intent |
| Legacy-only policy with supported preset evidence | One active, valid native intent and conversion history | Operator request or duplicate authority |
| Already-native policy | Existing valid native authority remains unchanged | Compatibility re-materialization |
| Empty policy with current, sufficient library profile | Native intent initialized from bounded profile evidence | Hard-limit, avoid, learning, or external-provider write |
| Unsupported legacy source | No native intent; bounded `requires_maintenance` state with a reason id | Persisting raw source configuration or attempting conversion |

The sparse-evidence row is intentionally profile-backed rather than
AI/provider-backed. A current connected-library profile can establish a bounded
advisory baseline, but it cannot manufacture strict constraints, avoid rules,
or learning actions.

## Research And Recommendation

PostgreSQL documents `INSERT ... ON CONFLICT` as an atomic insert-or-update
outcome when a unique conflict target is selected. The lifecycle implementation
therefore keeps reconciliation persistence inside its existing transactional
and uniqueness boundaries rather than adding an application-side check-then-
insert path. PostgreSQL's transaction-isolation guidance also means acceptance
must validate durable end state, not assume a read made before a concurrent
write remains current. [PostgreSQL INSERT](https://www.postgresql.org/docs/18/sql-insert.html)
[PostgreSQL transaction isolation](https://www.postgresql.org/docs/current/transaction-iso.html)

NIST AI RMF's Manage function calls for responding to and recovering from
unknown risks, with monitoring, incident response, recovery, and change
management. For a policy conversion service, that supports a recoverable,
bounded maintenance state for invalid legacy input instead of silent retries or
an opaque migration failure. [NIST AI RMF Manage](https://airc.nist.gov/airmf-resources/airmf/5-sec-core/)

### Options

| Option | Advantages | Drawbacks |
| --- | --- | --- |
| Unit-test mocked conversion candidates | Fast and precise for a single decision | Cannot prove loader, migration, lock, persistence, and schema constraints compose correctly |
| Connect the test to a live provider or media server | Resembles one deployment | Non-deterministic, credential-dependent, and not representative of every installation |
| Isolated database plus real scheduler and reconciler | Deterministic, exercises production service boundaries, and needs no installation-specific setup | Slower than a unit test and requires the integration PostgreSQL runtime |

### Recommendation Stack

1. Use the isolated real-database scheduler boundary as the 10R.2.1 primary
   acceptance test.
2. Keep deterministic unit coverage for candidate and state contracts; use the
   integration matrix only to prove their composition.
3. Keep provider and media-server dependencies out of lifecycle conversion
   acceptance. Their separate acceptance boundaries already verify authority
   and recovery behavior.
4. Record invalid input using bounded lifecycle state and reason identifiers;
   never persist or expose raw legacy configuration through reconciliation
   diagnostics.

## Completion Criteria

- Every matrix row reaches its expected persisted outcome from a newly created
  database fixture.
- The scheduler path needs no human action and the test imports no provider or
  media-server client.
- Convertible cases create native authority only when the persisted state
  supports it; invalid input remains bounded and non-convertible.
- Follow-on 10R.2.2 and 10R.2.3 evidence remains independently testable.

## Implementation

- Scheduler/reconciler: `server/src/services/scheduler.mjs` and
  `server/src/services/nativeIntentReconciliationService.mjs`.
- Candidate and conversion boundary:
  `server/src/services/nativeIntentReconciliationExecutionService.mjs`.
- Isolated acceptance suite:
  `server/src/__tests__/integration/native-intent-installation-lifecycle-acceptance.test.mjs`.

## Next Task

10R.2.2 is complete. See
[Reconciliation Idempotence And Native Runtime Read Acceptance](reconciliation-idempotence-native-runtime-read-acceptance.md).

Implement **10R.2.3 Bounded Lifecycle Diagnostics And Release-Evidence
Separation**. It must verify bounded non-convertible state and keep ordinary
native policy operation separate from installation-specific compatibility-code
retirement evidence.
