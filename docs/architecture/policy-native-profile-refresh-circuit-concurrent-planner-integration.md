# Native Profile Refresh Circuit Concurrent-Planner Integration

## Decision

Two scheduler processes can discover the same due native profile recovery at
the same time. The circuit must allow exactly one of them to create the
half-open probe. The other must see the persisted transition and block without
creating duplicate background work or a second recovery state.

The integration test opens a real circuit through the worker and planner,
starts two new planner instances concurrently at the cooldown boundary, and
checks the resulting PostgreSQL state. It asserts one pending retry outbox row,
one `half_open` circuit with its probe reference, one planner that queued the
probe, and one planner that blocked. Readiness then reports only the normal
queued automatic recovery.

## Research

Research was retrieved from official sources on 28 July 2026, newer than the
requested June 2026 baseline. Microsoft's [Circuit Breaker
pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/circuit-breaker)
recommends limiting half-open trial requests before normal operations resume.
Microsoft's [event-driven architecture
guidance](https://learn.microsoft.com/en-us/azure/architecture/guide/architecture-styles/event-driven)
identifies concurrent consumers, ordering, and idempotency as core asynchronous
processing concerns. Its [transactional outbox
guidance](https://learn.microsoft.com/en-us/azure/architecture/databases/guide/transactional-out-box-cosmos)
recommends durable event state and separate workers for reliable processing.

## Options Considered

### In-Process Mutex

Pros: easy to implement and fast in one Node process.

Cons: does not protect multiple containers, restarts, or independently running
scheduler instances. Rejected.

### Unlocked Read Plus Unique Outbox Insert

Pros: relies on a database uniqueness constraint for duplicate outbox rows.

Cons: does not make the circuit state transition atomic, so the losing planner
can observe or report an inconsistent recovery state. Rejected.

### Exact Circuit Row Lock Plus Idempotent Outbox Insert

Pros: serializes the state transition across processes and makes the durable
outbox the single probe record. Selected.

Cons: a competing planner waits briefly for the transaction that owns the
transition; this is acceptable bounded scheduler contention.

## Final Recommendation Stack

1. Lock the exact persisted circuit row inside the planner transaction before
   evaluating a due probe.
2. Transition the same row to `half_open` only after enqueueing one probe.
3. Use the outbox source-event uniqueness constraint as a second durable
   idempotency boundary.
4. Let later planners read the committed half-open state and block.
5. Project only the active queued recovery through readiness; do not expose
   planner races, lock waits, or circuit internals.

## Implementation Outcome

The lifecycle integration suite now runs two fresh planner instances
concurrently against the same due circuit. Real PostgreSQL locking leaves one
half-open circuit and exactly one pending successor. The second planner blocks
after the first commits, and the production readiness summary still reports
the single queued recovery path.

No browser action, operator lock, local process mutex, external provider, or
manual retry is involved. The test uses only unique data in Testcontainers and
cleans it after each case.

## Security Outcome

- The concurrency authority is durable PostgreSQL state, not caller-supplied
  flags or process-local memory.
- The exact source revision scopes both the lock and outbox idempotency key.
- The read-only readiness response reveals neither contention details nor
  internal recovery timing.
- The test avoids an operator database and any live media-server action.

## Verification

Run the focused integration suite with:

```powershell
cd server
node ./scripts/run-jest.mjs -c jest.integration.config.mjs --runInBand --no-coverage --runTestsByPath src/__tests__/integration/policy-native-profile-refresh-circuit-lifecycle.test.mjs
```

## Next Step

The post-generation claim-loss case now proves a replacement worker completes a
durably current profile without a second generation; see [Native Profile Refresh
Circuit Post-Generation Claim-Loss
Integration](policy-native-profile-refresh-circuit-post-generation-claim-loss-integration.md).
Next, verify terminal handling after the final reclaim lease expires.
