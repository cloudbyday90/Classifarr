# Native Profile Refresh Circuit Lifecycle Integration

## Decision

The automatic profile-recovery circuit requires one database-backed lifecycle
test across the real scheduler planner, durable outbox worker, circuit
repository, and read-only readiness summary. The test uses a controlled
profile-generator seam only because a test must not call an external media
server. It does not use a browser, a dialog, a manual retry, or a local timer.

The lifecycle proves this sequence for one current server-derived source
revision:

1. The worker records a terminal fixed configuration failure.
2. A fresh planner observes the terminal failure and opens the durable circuit.
3. The readiness summary reports only `awaiting_automatic_probe`.
4. A fresh planner at the server-owned cooldown boundary creates one probe and
   changes the circuit to `half_open`.
5. The worker completes the probe, persists a current profile, and clears the
   circuit.
6. The readiness summary returns to `not_required` and normal automation
   readiness.

## Research

Research was retrieved from official sources on 28 July 2026, newer than the
requested June 2026 baseline. Microsoft's [Circuit Breaker
pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/circuit-breaker)
describes closed, open, and half-open states, limits trial requests in
half-open state, and returns to normal operation only after successful work.
Microsoft's [self-healing guidance](https://learn.microsoft.com/en-us/azure/architecture/guide/design-principles/self-healing)
recommends decoupled asynchronous work, durable recovery, graceful degradation,
and fault-injection testing. Its [Retry Storm
antipattern](https://learn.microsoft.com/en-us/azure/architecture/antipatterns/retry-storm/)
warns that frequent retries can prevent a dependency from recovering.

## Options Considered

### Keep Isolated Unit Tests Only

Pros: fast, localized failures.

Cons: cannot prove the planner, worker, persisted circuit, and readiness
projection agree on one lifecycle. Rejected.

### Run Against the Operator's Local Compose Database

Pros: resembles a deployed process.

Cons: mutable operator data, external configuration, and timing make the
result non-repeatable and unsuitable for CI. Rejected.

### Use a Database-Backed Integration Test With a Controlled Generator

Pros: exercises actual PostgreSQL persistence and fresh service instances,
keeps the failure/probe/reset sequence deterministic, and prevents provider or
browser side effects. Selected.

Cons: requires Docker/Testcontainers during the integration suite.

## Final Recommendation Stack

1. Seed a native policy, an observed library item, and a server-derived native
   refresh request in an isolated integration database.
2. Trigger a fixed terminal configuration failure through the real worker.
3. Use a newly constructed real planner to open the circuit and a separate
   readiness summary to verify fixed safe display copy.
4. Use another fresh planner at the fixed cooldown boundary to enqueue exactly
   one probe and prove active outbox work takes display precedence.
5. Use a second worker with a controlled generator that writes a current stored
   profile and verify the real circuit repository removes runtime state.
6. Read the same policy again and assert current profile recovery without a
   browser action, internal failure data, or retry control.

## Implementation Outcome

`policy-native-profile-refresh-circuit-lifecycle.test.mjs` is a
Testcontainers-backed integration test. It exercises real production ESM
classes and repositories for the planner, worker, outbox, circuit, and
readiness projection. Its controlled profile generator is the only test seam;
it persists the resulting current profile in the integration database.

The test uses fresh worker and planner instances at each lifecycle boundary.
That verifies recovery state belongs to durable storage rather than a
long-lived process object. It confirms the failed configuration record,
open/half-open probe flow, completed successor, circuit cleanup, and final
current readiness result.

The lifecycle exposed and corrected one readiness edge case: the outbox
repository preserves an empty normalized record when no active row exists.
Readiness now treats that shape as absent unless it has a persisted outbox ID,
allowing the current source revision's circuit state to remain authoritative.

## Security Outcome

- The test does not use an operator database, browser route, provider, or
  media-server connection.
- Test data uses unique server-generated identifiers and is deleted after each
  test.
- The only exposed recovery assertion is fixed status copy; failure code and
  runtime timing remain outside the browser projection.
- The test proves a successful probe clears runtime state automatically rather
  than creating an operator reset path.

## Verification

Run the focused integration suite with:

```powershell
cd server
node ./scripts/run-jest.mjs -c jest.integration.config.mjs --runInBand --no-coverage --runTestsByPath src/__tests__/integration/policy-native-profile-refresh-circuit-lifecycle.test.mjs
```

## Next Step

Add a post-generation claim-loss integration case. It must prove a replacement
worker completes a current profile without a second generator call.
Lease-reclaim verification is documented in [Native Profile Refresh Circuit
Lease-Reclaim
Integration](policy-native-profile-refresh-circuit-lease-reclaim-integration.md).
