# Native Profile Refresh Circuit Repeated-Probe-Failure Integration

## Decision

Repeated terminal failures of automatic native-profile recovery probes must
remain completely server-owned. A failed half-open probe reopens the same
durable circuit, preserves the exact failed outbox identity and approved
failure code, caps the circuit failure counter at its configured threshold,
and waits for the next cooldown. When that cooldown is due, concurrent
schedulers must create one successor probe, not one probe per scheduler.

The bounded circuit counter is runtime recovery state, not a claim that all
terminal outbox history is deleted immediately. Failed and completed outbox
rows remain durable for audit and recovery until their separately defined
retention-compaction boundary can remove only inactive, unprotected history.

## Research

Research was retrieved from official sources on 28 July 2026. The sources used
were available by the requested June 2026 baseline. Microsoft's [Circuit
Breaker pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/circuit-breaker)
recommends a limited half-open trial and immediate return to open when that
trial fails, including safe concurrent access to the circuit. Microsoft's
[transient-fault guidance](https://learn.microsoft.com/en-us/azure/architecture/best-practices/transient-faults)
recommends finite retry limits and a circuit breaker to prevent continual work
against a failing dependency. Its [background-job guidance](https://learn.microsoft.com/en-us/azure/architecture/best-practices/background-jobs)
recommends distinguishing permanent from transient failures, retaining failed
messages after bounded delivery, and making redelivery-safe work idempotent.

## Options Considered

### Let Every Scheduler Requeue a Failed Probe

Pros: minimal scheduler logic.

Cons: creates duplicate profile work, makes recovery rate depend on replica
count, and permits a failing dependency to be retried aggressively. Rejected.

### Permanently Stop After the First Failed Automatic Probe

Pros: strictest protection of the downstream dependency.

Cons: turns transient service interruptions into permanently stale profiles and
requires a manual intervention path. Rejected.

### Durable Circuit With Capped State and One Cooldown Successor

Pros: controls retry load, retains enough durable terminal evidence for safe
recovery and audit, coordinates multiple schedulers through PostgreSQL locks,
and stays automatic for every library configuration. Selected.

Cons: an unresolved dependency remains in delayed recovery and durable history
requires a separate retention policy.

## Final Recommendation Stack

1. Classify terminal worker failures using the fixed server-owned vocabulary.
2. Reopen only when the failed row exactly matches the active half-open probe.
3. Cap `consecutive_failure_count` at the configured threshold instead of
   growing a runtime counter without bound.
4. Persist the cooldown and let the planner, not a worker or browser, create
   the successor.
5. Lock the circuit before queueing so concurrent schedulers leave one active
   successor.
6. Keep terminal outbox history until its independent retention gate confirms
   it is inactive and not protected by a live circuit or current revision.
7. Expose no browser action to retry, reset, or acknowledge automatic recovery.

## Implementation Outcome

The database lifecycle integration now executes two automatic failure cycles.
The first due probe expires at its one-attempt limit without profile work. The
planner records that exact terminal lease failure, reopens the circuit, and
concurrent schedulers create one successor at the next due time. That successor
then fails during profile generation at its one-attempt limit.

The planner recognizes only the matching failed half-open probe, reopens the
circuit with a capped count of three, and keeps the terminal outbox identity
and failure code. At the following cooldown, two planners again yield one
pending successor and one blocked result. The test asserts exactly two failed
historical probes and one active successor, no profile generation from an
expired claim, and no persisted profile or browser intervention.

No production branch was added. The existing circuit transition, row-locking,
and lease-protected outbox behavior already provide the selected design; this
test protects their repeated-failure composition.

## Security Outcome

- Failure classification, circuit identity, cooldown, and successor creation
  remain server-owned.
- A stale or unrelated terminal outbox row cannot reopen a circuit.
- Concurrent scheduler processes cannot multiply recovery work.
- Bounded circuit state prevents unbounded runtime failure metadata.
- Terminal history is retained only until its server-side compaction policy can
  remove it safely; the browser cannot delete or alter it.

## Verification

Run the focused integration suite with:

```powershell
cd server
node ./scripts/run-jest.mjs -c jest.integration.config.mjs --runInBand --no-coverage --runTestsByPath src/__tests__/integration/policy-native-profile-refresh-circuit-lifecycle.test.mjs
```

## Next Step

Add concurrent planner-and-compaction interleaving integration coverage. It
must prove an overlapping scheduler cannot compact a current source revision
while another scheduler is planning its active recovery work.
