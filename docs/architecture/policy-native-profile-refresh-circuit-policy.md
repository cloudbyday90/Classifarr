# Native Profile Refresh Automatic Circuit Policy

## Decision

Native profile-refresh recovery has a durable, automatic circuit per
`library_id` and server-derived base `source_event_id`. It owns runtime
recovery state only; it is not policy configuration, browser state, or a
portable backup payload.

The circuit has three states:

- `closed`: normal native readiness work may be queued.
- `open`: ordinary work is suppressed. After a two-hour cooldown, the existing
  scheduler may enqueue one delayed-successor probe.
- `half_open`: one persisted outbox-backed probe is active. No further native
  work is queued until that probe completes or reaches a terminal failure.

Three terminal fixed recoverable failures open the circuit. A known local
configuration failure opens it on the first terminal failure because another
ordinary retry cannot change that configuration. The automatic probe remains
the only recovery route in both cases. A completed profile refresh for the
library clears its runtime circuits, including a completion that finds another
path has already made the profile current.

When a due probe coalesces with active work, the circuit stays open and moves
its next probe five minutes forward. This bounds repeated scheduler work while
allowing the active profile refresh to reset the circuit on success. Old
circuit rows and terminal native outbox history compact after 30 days only
when they are no longer tied to a current source revision or a retained circuit
state.

## Research

Research was retrieved from official sources on 28 July 2026, newer than the
requested June 2026 baseline. Microsoft describes a circuit breaker with
closed, open, and half-open states; it should fail fast during a persistent
fault and allow limited automatic probes after a timeout. It also calls for
observable state transitions. [Microsoft Circuit Breaker
pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/circuit-breaker)
supports the durable state machine and one-at-a-time probe.

Microsoft's self-healing guidance distinguishes transient retry from a circuit
for persistent failure so an unhealthy dependency is not repeatedly loaded.
[Microsoft self-healing design guidance](https://learn.microsoft.com/en-us/azure/architecture/guide/design-principles/self-healing)
and its [retry-storm antipattern](https://learn.microsoft.com/en-us/azure/architecture/antipatterns/retry-storm/)
support bounded retries, cooldowns, and suppression of repeated automatic
calls.

OWASP recommends structured, purpose-limited logs that avoid retaining
sensitive exception content. [OWASP Logging Cheat
Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
supports persisting only fixed failure codes, identifiers, timestamps, and
counts.

## Options Considered

### Reuse the Generic In-Memory Circuit Breaker

Pros: little new code.

Cons: state disappears on restart, diverges across replicas, cannot bind a
probe to the durable outbox, and is keyed for generic process-local service
calls. Rejected.

### Keep Creating Delayed Successors Indefinitely

Pros: minimal state and no new table.

Cons: persistent faults consume scheduler capacity forever and provide no
bounded recovery boundary. Rejected.

### Expose Retry or Reset Controls in the Browser

Pros: an operator can intervene immediately.

Cons: makes recovery depend on a browser session, creates an unnecessary write
surface, and contradicts the scheduler-owned policy model. Rejected.

### Persist a Per-Revision Circuit and Recover Through the Existing Outbox

Pros: survives restarts and replicas, preserves current claim-token and
idempotency guarantees, uses a bounded automatic probe, and requires no
operator or browser action. Selected.

Cons: adds compact runtime storage, transition tests, and retention work.

## Final Recommendation Stack

1. Use a compact PostgreSQL row keyed by library and base native source
   revision as the sole circuit authority.
2. Lock that row in the planner transaction before deciding whether to queue,
   block, or probe.
3. Feed only fixed, allowlisted terminal failure codes into circuit state; fail
   closed for missing or unrecognized history.
4. Open after three recoverable terminal failures and immediately for a known
   Classifarr-owned configuration failure; schedule only one two-hour
   half-open probe.
5. Clear a library's runtime circuits only after the existing claim-token
   guarded outbox completion succeeds.
6. Clear circuit runtime state during replace restore and compact obsolete
   circuit/history rows only after the retention window and source-revision
   protection checks pass.

## Implementation Outcome

`policyNativeProfileRefreshCircuit.mjs` contains the pure ESM normalizers and
transition rules. `policyNativeProfileRefreshCircuitRepository.mjs` applies
those rules through parameterized SQL and `SELECT ... FOR UPDATE` locking.
`policyNativeProfileRefreshCircuitCompactionRepository.mjs` performs bounded,
revision-aware retention cleanup.

`PolicyNativeProfileRefreshPlanner` checks the durable circuit before it
enqueues ordinary native work. It suppresses work while open, creates a
successor-backed probe when due, transitions the circuit to `half_open` only
when that probe is active, and defers a coalesced probe. It records a terminal
failure before deciding whether a normal successor is permitted.

`PolicyProfileRefreshOutboxWorker` clears runtime circuits after a successful
profile-refresh claim. Replace backup restore clears the same operational rows
with the outbox. The migration constrains states, fixed failure codes, source
identity, and lifecycle fields in the database.

## Security Outcome

- Circuit keys and source revisions are server-derived; the browser, AI
  provider, and external media services cannot create or reset a circuit.
- All persistence uses parameterized SQL and transaction-scoped row locks.
- The table retains fixed identifiers, counts, and timestamps only. It stores
  no exception message, stack trace, media metadata, credentials, or provider
  response.
- Invalid stored state or an unknown failure code blocks automatic successor
  creation rather than guessing whether retry is safe.
- Replace restore treats circuit rows as non-portable runtime work and removes
  them with the outbox.

## Verification

Focused tests cover threshold and configuration opening, half-open probe
exclusivity, coalesced-probe deferral, invalid-code rejection, locked row
persistence, revision-aware compaction, planner suppression and due-probe
behavior, successful worker reset, and replace-restore cleanup.

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
