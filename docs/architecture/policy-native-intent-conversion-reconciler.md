# Policy Native Intent Conversion Reconciler

## Status

Phase 8R.3.2 production replacement for the temporary manual native-intent
conversion dialog. Scheduler ownership, single-runner exclusion, and the
durable bounded ledger are implemented; retry semantics, circuit breaking, and
read-only status remain follow-on components.

## Problem

Native intent conversion is currently safe but operator-driven: an
administrator must open a maintenance page, select policies, enter a
confirmation phrase, and apply each conversion batch. That friction was useful
while native storage was first proven, but it conflicts with Classifarr's
hands-off intent model. Conversion is storage maintenance, not policy authoring
or a routing decision.

Adding the existing conversion action as a one-time post-upgrade task would be
incorrect. `post_upgrade_tasks` records a task as complete even when its work is
skipped by a guard. A policy that is temporarily blocked would therefore not be
retried, and a newly restored legacy policy would be missed.

## Official-Source Research

- [PostgreSQL transaction isolation](https://www.postgresql.org/docs/current/transaction-iso.html)
  requires applications to handle concurrent write behavior at the transaction
  boundary. The reconciler must rebuild eligibility and rely on the existing
  transactional apply gate rather than trust an earlier scan.
- [PostgreSQL explicit locking](https://www.postgresql.org/docs/current/explicit-locking.html)
  describes row-locking and deadlock concerns. The implementation must preserve
  deterministic policy-authority locking and keep batches short.
- [OWASP API6: Unrestricted Access to Sensitive Business Flows](https://owasp.org/API-Security/editions/2023/en/0xa6-unrestricted-access-to-sensitive-business-flows/)
  recommends appropriate controls for automated sensitive workflows. The
  reconciler therefore has a fixed batch limit, one active runner, auditable
  outcomes, and no user-controlled conversion write endpoint.
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
  recommends correlation, sanitization, protected access, and retention limits
  for operational logs. Reconciliation state must retain reason IDs and counts,
  not raw legacy policy payloads, credentials, sessions, or exception bodies.

## Recommendation

Implement one server-owned reconciliation service. It runs after service
initialization and on the existing maintenance scheduler, discovers current
conversion candidates, and invokes the existing post-upgrade workflow and
transactional writer only for ready policies.

The reconciler must not own conversion rules. It composes:

1. `policyIntentMigrationCandidateReport.mjs` for current eligibility.
2. `policyPostUpgradeDryRun.mjs` for a current conversion plan.
3. `policyPostUpgradeApplyGate.mjs` for locking, snapshots, validation,
   idempotency, migration events, and rollback-safe writes.

Each run processes one small batch. Ready policies convert; blocked policies are
recorded as blocked and revisited later. No routing, activation, learning, or
constraint mutation is permitted.

## Options Considered

### Keep The Dialog

Pros:

- Maximum human visibility before every conversion.
- No new lifecycle service.

Cons:

- Makes platform storage maintenance a recurring manual task.
- Encourages operators to treat native conversion as policy authoring.
- Does not scale to upgrades, restored data, or future legacy imports.

### One-Time Post-Upgrade Task

Pros:

- Smallest apparent implementation change.
- Reuses existing task dispatch.

Cons:

- Blocked or empty runs become permanently complete.
- Cannot safely retry or observe progress across later data changes.
- Couples a durable batch write to release startup.

### Dedicated Reconciler

Pros:

- Fully automatic without making ordinary reads or saves write policy storage.
- Preserves current transactional conversion behavior.
- Retries only current eligible candidates and makes blocked reasons observable.
- Keeps routing and automation decisions outside storage migration.

Cons:

- Requires durable run/progress state and scheduler lifecycle wiring.
- Needs careful concurrency, transaction, and retry coverage.

## Final Recommendation Stack

1. Implement a bounded, single-runner reconciliation service.
2. Persist concise run and candidate-outcome state for retry and support.
3. Reuse the existing transactional conversion gate without a parallel writer.
4. Replace the dialog's apply controls with read-only status and blocked reasons.
5. Retain a server-side emergency disable switch and the manual path only until
   automatic reconciliation passes production verification; then remove it.

## Required Guarantees

- Current-state eligibility is recomputed immediately before conversion.
- Existing native authority locks, snapshots, validation, and idempotency keys
  remain mandatory.
- A conversion failure rolls back; a blocked policy remains untouched.
- The reconciler never configures a routing target or activates automation.
- Status output is bounded and does not expose raw legacy policy payloads.

## Component Sequence And Edge Cases

### 8R.3.2.1 Scheduler Ownership And Single-Runner Exclusion

Implemented with `nativeIntentReconciliationService.mjs` and
`schedulerService`. The scheduler owns a ten-minute task and a one-time
post-readiness opportunity after ninety seconds. Both use a dedicated session
advisory lock; duplicate registration is ignored and reset cancels the pending
initial timer. Each execution has a fixed ten-policy, twenty-second budget;
per-policy conversion continues to use the existing authority lock inside its
own transaction.

This prevents two replicas from processing the same batch while allowing a new
run after a process or database-session failure releases the session lock.
The automatic selector excludes already-native policies and every policy with a
persisted `rollback_applied` event. Re-entry after an intentional rollback is
reserved for the explicit, future 8R.3.2.4 contract.

### 8R.3.2.2 Durable Run And Candidate Outcome Ledger

Implemented through [Native Intent Reconciliation Ledger](native-intent-reconciliation-ledger.md).
The run header and per-policy outcome contract retains only timestamps, state,
policy references, candidate fingerprints, stable IDs, and compact counts. An
empty evaluation is explicitly `evaluated`, a scheduler lock skip creates no
ledger row, and a ledger write failure cannot relabel a committed conversion as
failed. Bounded retention and backup/restore preserve support evidence without
creating a second compatibility store.

### 8R.3.2.3 Eligibility, Retry, And Quarantine Semantics

The service separates four outcomes:

- `applied`: native authority was written transactionally.
- `deferred_retry`: an eligible policy encountered a transient system failure.
- `blocked_current_state`: current authority, validation, or verifier evidence
  makes conversion unsafe.
- `requires_maintenance`: the legacy policy shape has no supported automatic
  resolution and must block compatibility deletion.

Retry only system failures with bounded backoff. Reevaluate blockers when their
candidate fingerprint changes or a conservative retry interval expires. Routing
and profile freshness remain automation-readiness information and are never
conversion retry triggers.

### 8R.3.2.4 Reversion, Restore, And New-Policy Guards

A rollback is an intentional authority change. Reversion must add a hold that
prevents immediate reconversion until an approved future re-entry condition.
Restore suppresses reconciliation until schema, restore, and active-authority
integrity checks complete. Already-native policies are excluded from discovery.

### 8R.3.2.5 Circuit Breaker

Use one default-enabled server-side operational setting and a persisted circuit
breaker. It opens only for systemic faults, such as database availability,
schema incompatibility, or integrity violation. Policy-local blockers do not
open it. The emergency stop does not change native reads, policy editing,
routing, or rollback behavior.

### 8R.3.2.6 Status And Deletion Safety

The maintenance UI becomes read-only: current run state, counts, next attempt,
bounded blocker categories, and circuit status. Logs carry a correlation ID,
sanitized event category, and counts. Compatibility deletion remains blocked
until every legacy policy has native storage or a real supported resolution;
acknowledging a blocker is not sufficient.

### 8R.3.2.7 Verification

Focused tests must cover lock contention, duplicate scheduler calls, runner
restart, backoff, changed candidate state, mixed batches, transaction rollback,
reversion, restore suppression, circuit recovery, status sanitization, and a
full scheduler-driven conversion without a client request.

## Explicit Non-Goals

- It does not infer policy intent from absence or alter explicit constraints.
- It does not set routing targets, enable automation, or write learning data.
- It does not add a per-policy opt-in switch to routine authoring.
- It does not retain raw legacy payloads outside the existing bounded rollback
  snapshot window.
