# Native Profile Refresh Terminal Recovery

## Decision

The existing profile-refresh worker remains the sole executor and keeps its
three-attempt cap. When a native-readiness request reaches the durable
`failed` state and the library profile is still stale or missing, the planner
creates one delayed successor record for that specific failed outbox row.

The successor has a new, deterministic source event:

```text
<base-native-readiness-source-event>:retry:<failed-outbox-id>
```

That identity makes a recovery decision idempotent. Repeated planner runs,
concurrent schedulers, and restarts either create the same successor once or
replay it. The existing partial unique index still allows only one active
refresh for a library. The successor's `available_at` is a 15-minute
exponential delay, doubled for each historical terminal failure and capped at
24 hours, with a deterministic zero-to-59-second per-library phase offset.

This is deliberately a new outbox message after a terminal worker result, not
an unbounded worker retry or a mutation of the terminal record. The terminal
record remains available for audit, and each outbox message still has the
worker's finite retry budget.

## Research

Research was retrieved from official sources on 26 July 2026, which is newer
than the requested June 2026 baseline. Microsoft recommends exponential
backoff with jitter for background operations, warns against overly aggressive
or endless retries, and identifies circuit breaking and dead-letter handling
as complementary patterns. [Microsoft transient-fault
guidance](https://learn.microsoft.com/en-us/azure/well-architected/design-guides/handle-transient-faults)

Google similarly recommends truncated exponential backoff with jitter only for
idempotent operations and warns that retrying persistent authorization or
invalid-request failures can create an infinite loop. [Google Cloud retry
strategy](https://docs.cloud.google.com/storage/docs/retry-strategy)

AWS recommends backoff, jitter, maximum retry values, and observability for
repeated failures; it specifically warns against retrying errors known to be
non-transient. [AWS Well-Architected retry
limits](https://docs.aws.amazon.com/wellarchitected/2023-04-10/framework/rel_mitigate_interaction_failure_limit_retries.html)

The implementation uses the existing short transactional persistence boundary
and database uniqueness constraints rather than application-memory locks.
PostgreSQL documents that transaction-scoped lock requests are released at the
end of the transaction, which supports this short durable scheduling decision.
[PostgreSQL explicit locking](https://www.postgresql.org/docs/19/explicit-locking.html)

## Options Considered

### Replay the Exact Failed Source Event

Pros: no new source-event format.

Cons: source-event uniqueness returns the existing `failed` row forever, so
the worker can never receive a new message. Rejected.

### Reopen the Failed Outbox Row

Pros: no additional rows.

Cons: destroys the terminal attempt boundary, weakens auditability, and races
with worker-state transitions. Rejected.

### Retry Immediately From the Scheduler

Pros: shortest possible recovery time.

Cons: can create a retry storm after a dependency failure and disregards the
worker's bounded-retry policy. Rejected.

### Use a Separate Recovery Queue

Pros: isolates long-delay recovery from ordinary outbox processing.

Cons: duplicates the lease, source-event, coalescing, and scheduling
guarantees that the existing outbox already provides. Rejected.

### Create One Delayed, Idempotent Successor per Terminal Record

Pros: preserves the terminal audit row, keeps execution through the existing
worker, applies backoff, coalesces active work by library, and needs no
operator or browser action. Selected.

Cons: repeated terminal failures create retained audit rows and require a
separate terminal-failure eligibility and circuit policy. The next task owns
that operational boundary.

## Final Recommendation Stack

1. Keep worker retries finite and retain the existing lease, claim-token, and
   idempotent profile-upsert boundaries.
2. Make terminal recovery a planner decision only after reading the persisted
   `failed` history in the same transaction as successor enqueueing.
3. Use the failed outbox ID in the successor source event, so the decision is
   naturally deduplicated by the existing source-event unique constraint.
4. Use a capped exponential delay and stable per-library phase offset before
   the next background claim; do not add browser timers, retry controls, or
   direct refresh endpoints.
5. Permit an explicit scheduled time only on the fixed native-readiness source
   and source system. Learning-origin records cannot schedule themselves.
6. Return only the existing bounded recovery state to the browser. A pending
   future successor is presented as `scheduled`; it exposes no outbox ID,
   failure detail, or retry control.
7. Add terminal-failure classification, aggregation, retention, and an
   automatic circuit policy before treating recurring recovery as complete.

## Implementation Outcome

`policyNativeProfileRefreshFailureRepository.mjs` reads the newest terminal
native-readiness failure and the bounded count for one base source event and
its successors. It uses parameterized SQL, accepts only a base source event,
and never returns worker error text.

`policyNativeProfileRefreshSuccessor.mjs` owns the source-event construction,
delay calculation, input validation, and immutable successor record. It
rejects retry-of-retry inputs, unknown sources, invalid library IDs, invalid
timestamps, and overlong source events.

`policyNativeProfileRefreshPlanner.mjs` first enqueues or replays the base
request. Only when that result is persistently `failed` does it read failure
history and enqueue a ready successor. A missing or invalid history fails
closed and is reported as an invalid successor, rather than guessing an ID or
writing unbounded work.

`policyProfileRefreshOutboxRepository.mjs` now persists `available_at` only
for the exact server-owned native-readiness source and returns that timestamp
for active-work status. `policyNativeProfileRecoveryStatus.mjs` reports a
future pending record as `scheduled`; an immediately claimable record remains
`queued`.

## Security Outcome

- No UI, API caller, AI response, provider payload, or media-server payload
  can supply a scheduled recovery timestamp.
- The source event, request type, source system, terminal state, library ID,
  and available timestamp are all checked or fixed server-side.
- All database inputs are parameters; the table name and state vocabulary are
  static source code.
- The source-event unique constraint and active-library partial unique index
  prevent duplicate successor writes and concurrent refresh generation.
- The browser receives only fixed recovery status copy. It cannot observe
  retry counts, source events, errors, or internal queue timestamps.

## Verification

Focused tests cover capped delay calculation, deterministic phase offsets,
successor identity, chained-source rejection, failure-history parameterization,
transactional terminal recovery, invalid-history fail-closed behavior,
scheduled timestamp validation, and scheduled-versus-queued status rendering.

## Next Step

Implement **native profile refresh terminal-failure policy**: classify fixed
retryable and non-retryable failure identifiers, aggregate consecutive terminal
failures per library/source revision, retain or compact completed recovery
history safely, and open an automatic circuit for known persistent failures.
That policy must preserve the no-browser, no-operator recovery path for
transient failures while preventing indefinite retry of a known bad state.
