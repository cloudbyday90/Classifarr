# Native Profile Refresh Circuit Post-Exhaustion Cooldown Re-Probe Integration

## Decision

After an exhausted probe terminalizes and the planner reopens its circuit, the
next due cooldown must create exactly one new automatic probe. The scheduler,
not the worker or browser, owns that decision. A successful worker run for the
new probe persists the profile, completes its claim, clears circuit runtime
state, and returns readiness to current.

The database-backed lifecycle case runs two planner instances concurrently at
the reopened due time. PostgreSQL locking grants one successor probe and makes
the other planner observe the new half-open state. The winning successor then
uses the normal worker path to generate a profile, complete its row, clear the
circuit, and project `not_required` recovery status.

## Research

Research was retrieved from official sources on 28 July 2026. The sources used
were available by the requested June 2026 baseline. Microsoft's [Circuit Breaker
pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/circuit-breaker)
describes allowing limited half-open work, reopening on failure, and returning
to closed state after success. Its [transient-fault guidance](https://learn.microsoft.com/en-us/azure/architecture/best-practices/transient-faults)
recommends finite retries with bounded recovery behavior instead of continual
attempts. Microsoft's [message settlement guidance](https://learn.microsoft.com/en-us/azure/service-bus-messaging/message-transfers-locks-settlement)
also supports preserving completed work and ignoring redelivery after durable
success.

## Options Considered

### Immediately Requeue From the Exhaustion Worker

Pros: starts the next attempt without waiting for a scheduler pass.

Cons: bypasses persisted circuit cooldown, risks rapid retry cycles, and mixes
work execution with scheduling policy. Rejected.

### Require an Operator or Browser Retry

Pros: makes the timing explicit to a human.

Cons: interrupts automation, adds an unnecessary write surface, and does not
scale across independent libraries. Rejected.

### Persisted Scheduler-Owned Cooldown Re-Probe

Pros: preserves one source of scheduling authority, coordinates replicas with
existing circuit locks, limits work to one probe, and completes end to end
without interaction. Selected.

Cons: recovery waits for the bounded cooldown and requires end-to-end coverage
across terminalization, planning, and worker completion.

## Final Recommendation Stack

1. Terminalize exhausted claims before any profile work or circuit mutation.
2. Let the planner reopen only the matching terminal active probe.
3. Store the next probe time in the durable circuit and let only the scheduler
   act when it becomes due.
4. Lock the circuit before queueing so concurrent schedulers create one probe.
5. Use the normal token-guarded worker path for the successor.
6. Clear runtime circuit state only after the successor completes successfully.
7. Project current readiness from server-owned profile and outbox state without
   browser retry, reset, or acknowledgement controls.

## Implementation Outcome

The lifecycle integration case now continues past lease exhaustion. It runs two
fresh planners at the reopened due time and asserts one queued successor, one
blocked planner result, one pending successor outbox row, and no duplicate
probe. A controlled profile service then completes that successor through the
production worker.

The case verifies one profile generation, completed claim state, no retained
circuit row, and the normal `not_required` profile-recovery projection. No new
production branch was needed: the existing persisted cooldown, skip-locked
planner, and token-guarded worker paths already compose correctly; this task
protects their combined contract.

## Security Outcome

- Re-probe timing, source identity, and claim ownership remain server-owned.
- Concurrent schedulers cannot create duplicate recovery work for the same
  circuit state.
- The browser cannot speed up, acknowledge, or reset a recovery cycle.
- A circuit is cleared only after successful durable claim completion.
- The integration suite uses isolated data and cleans it after every case.

## Verification

Run the focused integration suite with:

```powershell
cd server
node ./scripts/run-jest.mjs -c jest.integration.config.mjs --runInBand --no-coverage --runTestsByPath src/__tests__/integration/policy-native-profile-refresh-circuit-lifecycle.test.mjs
```

## Next Step

Add native profile-refresh recovery retention-compaction integration coverage.
It must prove stale terminal circuit and outbox history is removed only after
the retention window, while active circuits and protected current revisions
remain intact.
