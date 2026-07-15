# Policy Native Intent Conversion Reconciler

## Status

Planned Phase 8R.3.2 production replacement for the temporary manual native
intent conversion dialog.

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

## Recommendation

Implement `policyNativeIntentConversionReconciler.mjs` as one server-owned
service. It should run after migrations have completed and on the existing
maintenance scheduler, discover current conversion candidates, and invoke the
existing post-upgrade workflow and transactional writer only for ready policies.

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
