# Native Profile Refresh Circuit Lease-Exhaustion Terminalization Integration

## Decision

An expired profile-refresh claim at its retry limit must become a durable
terminal `profile_refresh_lease_expired` outbox row without reading or
generating a profile. The worker must not clear or otherwise mutate the native
recovery circuit: it owns work execution, not circuit policy.

On the next scheduler pass, the planner reconciles that terminal failure only
when the failed row exactly matches the circuit's active half-open probe and
the failure code is allowlisted. It records the failure through the existing
circuit transition, returning the circuit to `open` with its bounded cooldown.
An unrelated, stale, or unknown failed row cannot change circuit state.

The database-backed integration case opens a real circuit, starts one probe,
claims it with a one-attempt budget, and expires the lease using PostgreSQL
time. A worker terminalizes the row without profile work. The next planner pass
recognizes the matching failed probe, reopens the circuit, and queues no new
work before the cooldown is due.

## Research

Research was retrieved from official sources on 28 July 2026. The sources used
were available by the requested June 2026 baseline. Microsoft's [message-loss
and duplicate-processing guidance](https://learn.microsoft.com/en-us/azure/service-bus-messaging/service-bus-message-loss-and-duplicates)
describes lease expiry, finite delivery limits, and explicit handling after
maximum delivery count. Its [transient-fault guidance](https://learn.microsoft.com/en-us/azure/architecture/best-practices/transient-faults)
recommends finite retries and a defined path for work that fails every attempt.
The [Circuit Breaker pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/circuit-breaker)
requires a failed half-open probe to return to open state instead of continuing
unbounded attempts.

## Options Considered

### Let the Worker Reopen or Clear the Circuit

Pros: fewer scheduler passes before circuit state changes.

Cons: mixes execution and circuit-policy authority, makes a lease cleanup
worker responsible for recovery timing, and broadens the race surface. Rejected.

### Leave the Circuit Half-Open After Probe Terminalization

Pros: no planner change.

Cons: blocks all later work indefinitely because the probe is no longer active
but the circuit still appears in progress. Rejected.

### Planner-Reconcile Only the Active Failed Probe

Pros: preserves worker and planner ownership boundaries, uses the existing
allowlisted circuit transition, restores bounded cooldown, and rejects unrelated
terminal rows. Selected.

Cons: requires one later scheduler pass and exact probe-to-outbox identity
checks.

## Final Recommendation Stack

1. Use database time and a finite attempt budget to terminalize expired claims.
2. Close an exhausted row with a fixed `lease_expired` failure identifier and
   remove its claim token.
3. Do no profile read, generation, or circuit cleanup while terminalizing it.
4. On planning, reconcile a failure only when its outbox ID equals the active
   half-open probe ID and its code is allowlisted.
5. Reuse the circuit's failure transition to return that failed probe to open
   state and schedule the normal cooldown.
6. Keep unrelated, stale, and unknown failures fail-closed for circuit state.
7. Expose no browser retry, reset, or acknowledgement action.

## Implementation Outcome

`policyNativeProfileRefreshCircuit.mjs` now provides a pure ESM predicate for
matching a known terminal failure to a valid active half-open probe.
`PolicyNativeProfileRefreshPlanner` uses it in
`reconcileFailedCircuitProbe` before applying its usual circuit decision. A
matching terminal probe is recorded through the existing circuit repository,
then the reopened circuit blocks ordinary work until its next scheduled probe.

The lifecycle integration suite proves terminalization at a one-attempt budget,
zero profile-service calls, a durable failed outbox row with cleared token, and
a planner-owned `half_open` to `open` transition. Unit coverage rejects a
mismatched outbox ID and unknown failure code, and confirms no enqueue happens
while the reopened circuit cools down.

## Security Outcome

- Attempt budgets, lease expiry, failure codes, and probe identity are all
  server-owned database data.
- A failed row cannot transition a circuit unless it matches the currently
  active probe exactly.
- The worker cannot clear a circuit while terminalizing abandoned work.
- Unknown failure codes remain in a safe blocked state rather than being
  interpreted as recoverable circuit input.
- Integration data is isolated and removed after each test.

## Verification

Run the focused coverage with:

```powershell
cd server
node ./scripts/run-jest.mjs --runInBand --no-coverage --runTestsByPath src/__tests__/services/policyNativeProfileRefreshCircuit.test.mjs src/__tests__/services/policyNativeProfileRefreshPlanner.test.mjs
node ./scripts/run-jest.mjs -c jest.integration.config.mjs --runInBand --no-coverage --runTestsByPath src/__tests__/integration/policy-native-profile-refresh-circuit-lifecycle.test.mjs
```

## Next Step

Add a post-exhaustion cooldown re-probe integration case. It must prove the
reopened circuit queues exactly one later automatic probe and returns to current
after that probe succeeds, without browser or operator intervention.
