# Native Profile Refresh Circuit Concurrent-Worker Integration

## Decision

After a scheduler creates one pending half-open probe, multiple worker
processes can poll the outbox concurrently. Exactly one worker must claim that
record, generate the profile, complete the claim, and clear the circuit. Other
workers must find no eligible work and perform no profile generation or circuit
mutation.

The database-backed integration case opens a real circuit, queues its due
probe, and starts two new production worker instances concurrently. A shared
controlled profile service records generation calls while real PostgreSQL claim,
completion, and circuit repositories run. The case proves one claim, one
generation, one completed probe, and one automatic circuit clear.

## Research

Research was retrieved from official sources on 28 July 2026, newer than the
requested June 2026 baseline. Microsoft's [Competing Consumers
pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/competing-consumers)
requires coordinating concurrent consumers so each message is processed by one
consumer. Microsoft's [Circuit Breaker
pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/circuit-breaker)
recommends a limited half-open trial before returning to normal operation.
Its [transactional outbox
guidance](https://learn.microsoft.com/en-us/azure/architecture/databases/guide/transactional-out-box-cosmos)
recommends durable event state and a separate worker for reliable processing.

## Options Considered

### Process-Local Worker Flag

Pros: minimal code and no database contention.

Cons: cannot coordinate containers, restarts, or independent workers. Rejected.

### Multiple Workers Without a Claim Lease

Pros: simple polling.

Cons: allows duplicated profile generation and ambiguous circuit cleanup.
Rejected.

### Durable Claim Lease With Skip-Locked Selection

Pros: lets workers process different records concurrently while one worker owns
this probe, and token-guarded completion prevents a stale worker from closing a
record it no longer owns. Selected.

Cons: requires lease-expiry recovery and database-backed concurrency tests.

## Final Recommendation Stack

1. Select eligible outbox rows with `FOR UPDATE SKIP LOCKED` inside a short
   claim transaction.
2. Persist a unique claim token, attempt count, and expiry lease before profile
   generation starts.
3. Require the same token for completion or failure transitions.
4. Clear the native circuit only after a successful token-guarded completion.
5. Test two workers against one pending probe and assert one generation and one
   circuit clear.

## Implementation Outcome

The lifecycle integration suite now runs two fresh workers against one real
pending probe. PostgreSQL grants one claim; the winning worker generates one
current profile, completes the outbox row, and clears the circuit. The other
worker exits with zero claims. The test asserts the completed attempt count,
cleared token, single stored profile, and absent circuit.

No browser action, operator lock, local mutex, external provider, or media
server is involved. The controlled generator is test-only and persists into an
isolated Testcontainers database.

## Security Outcome

- Ownership is represented by a server-generated UUID claim token in durable
  storage, never by a browser or caller flag.
- Token-guarded completion prevents a non-owner from acknowledging a probe.
- One successful generation clears recovery state automatically without an
  operator reset path.
- The integration case uses unique data and cleans it after every execution.

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
Lease-exhaustion terminalization is complete; see [Native Profile Refresh
Circuit Lease-Exhaustion Terminalization
Integration](policy-native-profile-refresh-circuit-lease-exhaustion-terminalization-integration.md).
Post-exhaustion cooldown re-probe coverage is complete; see [Native Profile
Refresh Circuit Post-Exhaustion Cooldown Re-Probe
Integration](policy-native-profile-refresh-circuit-post-exhaustion-cooldown-reprobe-integration.md).
Next, cover repeated automatic probe failures and bounded recovery history.
