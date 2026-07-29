# Native Profile Refresh Circuit Lease-Reclaim Integration

## Decision

An outbox worker can stop after claiming a pending circuit probe and before it
starts profile generation. After the database-owned lease expires, a later
worker must be able to reclaim the probe. The prior claim token must no longer
complete the row or cause its circuit to be cleared.

The integration case opens a real circuit and queues its probe, invokes the
production claim boundary without processing the record, and expires that
lease using PostgreSQL time. A replacement worker claims the expired record and
pauses before completion. While it owns the row, the original token's real
completion command returns false and the circuit remains half-open. The
replacement then generates the profile, completes attempt two, and clears the
circuit.

## Research

Research was retrieved from official sources on 28 July 2026, newer than the
requested June 2026 baseline. Microsoft's [Competing Consumers
pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/competing-consumers)
requires each message to be delivered to one coordinated consumer, while
handling consumer failure and redelivery. Microsoft's [Circuit Breaker
pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/circuit-breaker)
supports limited half-open recovery work and failure-aware state transitions.
Its [transactional outbox
guidance](https://learn.microsoft.com/en-us/azure/architecture/databases/guide/transactional-out-box-cosmos)
uses durable worker-owned state for reliable processing.

## Options Considered

### Leave Processing Rows Forever

Pros: eliminates duplicate execution after a crash.

Cons: permanently abandons recovery and leaves stale circuits. Rejected.

### Reclaim by Row ID Without Ownership Token

Pros: simple reclaim query.

Cons: an old worker can acknowledge a row after another worker owns it and
clear recovery state incorrectly. Rejected.

### Expiring Lease With Token-Guarded Completion

Pros: recovers abandoned work while rejecting stale acknowledgements and
preserving one authoritative worker. Selected.

Cons: requires bounded lease configuration and tests for both pre- and
post-generation failures.

## Final Recommendation Stack

1. Persist a server-generated claim token and expiry lease before a worker
   performs profile work.
2. Allow only expired processing rows to return to eligibility.
3. Reassign a new token and increment the attempt count during reclaim.
4. Require the current token for completion or failure transitions.
5. Clear the circuit only after a current-token completion succeeds.
6. Use database time for expiry decisions; do not depend on a worker's local
   clock.

## Implementation Outcome

The lifecycle integration suite now simulates an abandoned pre-generation
probe. It uses the real claim API, expires the durable lease with PostgreSQL
time, and starts a replacement worker. The stale token cannot complete the
row while the replacement owns it, so the half-open circuit remains intact
until the replacement completes. The replacement creates one profile, records
attempt two, clears the token, and removes the circuit.

No browser action, operator reset, local-clock wait, provider request, or live
media-server call is involved. The generator is test-only and persists data in
an isolated Testcontainers database.

## Security Outcome

- Claim ownership is a server-generated UUID stored in PostgreSQL.
- A stale worker cannot use its old token to acknowledge the re-owned probe.
- Circuit cleanup stays causally behind the current-token completion boundary.
- Test data is unique, isolated, and cleaned after every case.

## Verification

Run the focused integration suite with:

```powershell
cd server
node ./scripts/run-jest.mjs -c jest.integration.config.mjs --runInBand --no-coverage --runTestsByPath src/__tests__/integration/policy-native-profile-refresh-circuit-lifecycle.test.mjs
```

## Next Step

The post-generation claim-loss case is complete. It proves a replacement worker
recognizes a current persisted profile and completes without a second generation;
see [Native Profile Refresh Circuit Post-Generation Claim-Loss
Integration](policy-native-profile-refresh-circuit-post-generation-claim-loss-integration.md).
Lease-exhaustion terminalization is complete; see [Native Profile Refresh
Circuit Lease-Exhaustion Terminalization
Integration](policy-native-profile-refresh-circuit-lease-exhaustion-terminalization-integration.md).
Post-exhaustion cooldown re-probe coverage is complete; see [Native Profile
Refresh Circuit Post-Exhaustion Cooldown Re-Probe
Integration](policy-native-profile-refresh-circuit-post-exhaustion-cooldown-reprobe-integration.md).
Next, cover repeated automatic probe failures and bounded recovery history.
