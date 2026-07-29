# Native Profile Refresh Circuit Post-Generation Claim-Loss Integration

## Decision

A profile-refresh worker can persist a current profile and stop before it
completes its claimed outbox row. That boundary is intentionally recoverable:
after the claim lease expires, a replacement worker must read the durable
profile first. When the profile is current, it must complete the reclaimed row
without calling the generator again, then clear the circuit only after that
token-guarded completion succeeds.

The integration case opens a real native recovery circuit, queues its probe,
and claims it through the production worker boundary. It persists a current
profile to simulate the original worker's completed durable effect, expires the
lease with PostgreSQL time, and runs a replacement worker. The replacement's
generator throws if called. It instead recognizes the current profile, records
`completedAlreadyCurrent`, completes attempt two, and clears the half-open
circuit.

## Research

Research was retrieved from official sources on 28 July 2026. The recommendations
use sources available by the requested June 2026 baseline. Microsoft's
[guidance on message loss and duplicate processing](https://learn.microsoft.com/en-us/azure/service-bus-messaging/service-bus-message-loss-and-duplicates)
states that consumers must be idempotent because lease-based delivery can
redeliver work. Its [Competing Consumers pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/competing-consumers)
also calls for idempotent worker operations when a failed consumer's work can
be retrieved again. Microsoft's [Transactional Outbox guidance](https://learn.microsoft.com/en-us/azure/architecture/databases/guide/transactional-out-box-cosmos)
separates durable state from later worker completion, while its [Circuit Breaker
pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/circuit-breaker)
limits recovery work through a controlled half-open path.

## Options Considered

### Generate Again for Every Reclaimed Claim

Pros: simple worker control flow.

Cons: repeats an already-completed profile operation after a crash, wastes
capacity, can repeat provider work, and makes recovery less predictable.
Rejected.

### Make Profile Generation and Claim Completion One Transaction

Pros: would eliminate this particular acknowledgement gap for exclusively
database-local generation.

Cons: cannot safely cover long-running or separately committed profile work,
would hold a transaction across the operation, and does not remove the need for
idempotent recovery after process loss. Rejected.

### Re-read Durable Freshness Before Reclaimed Work

Pros: makes the persisted current profile the evidence that work already
completed, prevents duplicate generation, works across restarts and replicas,
and preserves token-guarded acknowledgement. Selected.

Cons: requires a small read before generation and explicit integration coverage
of the post-generation crash boundary.

## Final Recommendation Stack

1. Claim work with a server-generated token and database-owned expiry lease.
2. Persist the generated profile before attempting to acknowledge the claim.
3. On every native-readiness claim, derive freshness from the stored profile
   before invoking generation.
4. Treat a current stored profile as a successful idempotent completion, not as
   a reason to repeat generation.
5. Complete only with the currently owned claim token.
6. Clear a recovery circuit only after current-token completion succeeds.
7. Keep the entire recovery path scheduler and worker owned; expose no browser
   retry, acknowledgement, or reset control.

## Implementation Outcome

`PolicyProfileRefreshOutboxWorker.refreshProfile` already checks stored
freshness before generation for native-readiness work. The lifecycle integration
suite now proves that behavior across the difficult crash window. The fixture
persists the original worker's profile without completing its claim, expires the
lease, and lets a replacement worker perform the normal reclaim.

The replacement completes with `completedAlreadyCurrent: 1`, does not invoke
the generator, records the second claim attempt as completed, clears the claim
token, and removes the half-open circuit. The test exercises production SQL and
worker orchestration against the isolated integration database.

## Security Outcome

- Freshness is derived from server-owned stored profile data, not a browser,
  worker-local flag, or provider response supplied by a caller.
- The only acknowledgement authority is the current server-generated UUID claim
  token.
- Circuit cleanup follows durable acknowledgement, so an abandoned worker
  cannot clear recovery state merely because it persisted a profile.
- The test uses unique database records and removes them after every run.

## Verification

Run the focused integration suite with:

```powershell
cd server
node ./scripts/run-jest.mjs -c jest.integration.config.mjs --runInBand --no-coverage --runTestsByPath src/__tests__/integration/policy-native-profile-refresh-circuit-lifecycle.test.mjs
```

## Next Step

Lease-exhaustion terminalization is complete. It proves a maxed expired claim
does no profile work or circuit cleanup, while the planner reopens only its
matching active probe; see [Native Profile Refresh Circuit Lease-Exhaustion
Terminalization
Integration](policy-native-profile-refresh-circuit-lease-exhaustion-terminalization-integration.md).
Post-exhaustion cooldown re-probe coverage is complete; see [Native Profile
Refresh Circuit Post-Exhaustion Cooldown Re-Probe
Integration](policy-native-profile-refresh-circuit-post-exhaustion-cooldown-reprobe-integration.md).
Next, cover repeated automatic probe failures and bounded recovery history.
