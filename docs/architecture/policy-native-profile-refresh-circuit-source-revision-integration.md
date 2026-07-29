# Native Profile Refresh Circuit Source-Revision Integration

## Decision

Automatic profile recovery must scope a circuit to the exact server-derived
source revision, not only to a library. When observed library content changes,
the current missing-profile request has a new item count and high-water mark.
It must be schedulable even when an older revision remains in a cooldown.

The database-backed integration case preserves an older open circuit, adds a
new observed item, runs a fresh planner, and reads readiness through the
production summary boundary. It proves that the new revision creates its own
pending outbox record and reports `queued`; it neither inherits the old
`awaiting_automatic_probe` presentation nor makes the old circuit eligible to
block the new revision.

## Research

Research was retrieved from official sources on 28 July 2026, newer than the
requested June 2026 baseline. Microsoft's [Circuit Breaker
pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/circuit-breaker)
defines open and half-open states as protection for the failed operation, with
limited probes before normal work resumes. Microsoft's [event-driven
architecture guidance](https://learn.microsoft.com/en-us/azure/architecture/guide/architecture-styles/event-driven)
notes that asynchronous consumers must tolerate duplicates, ordering issues,
and temporary divergent views. Its [transactional outbox
guidance](https://learn.microsoft.com/en-us/azure/architecture/databases/guide/transactional-out-box-cosmos)
recommends durable event persistence and separate workers for reliable,
idempotent processing.

## Options Considered

### Circuit Per Library

Pros: smallest storage footprint and simple lookup.

Cons: a failure for old observed content blocks unrelated current content and
misrepresents recovery state. Rejected.

### Delete the Old Circuit When Content Changes

Pros: one circuit row per library.

Cons: loses failure history during a cooldown, couples content observation to
runtime cleanup, and creates a race between planner instances. Rejected.

### Preserve Circuits Per Exact Source Revision

Pros: binds automatic recovery to the operation that failed, lets current
content progress independently, and retains bounded history for later
compaction. Selected.

Cons: creates short-lived retained rows and requires explicit revision-aware
tests and compaction.

## Final Recommendation Stack

1. Derive the missing-profile source revision only from the library ID,
   observed item count, and observed high-water mark.
2. Use that exact base source event as the circuit and outbox identity; retries
   remain successors of that base revision.
3. Keep an older open circuit durable but never consult it for a newer current
   revision.
4. Let active work for the new revision project `queued`; do not expose old
   failure metadata or waiting state.
5. Retain bounded history through the existing compaction policy rather than
   deleting old recovery state during content observation.

## Implementation Outcome

The database lifecycle suite now opens an old-revision circuit from a terminal
configuration failure, inserts one more observed item, and uses a new planner
instance to queue the newly derived revision. It asserts that the old circuit
remains keyed to the old source event, the new outbox entry remains pending,
and the production readiness summary reports only the new queued recovery.

No browser action, external provider, media-server request, operator database,
or manual circuit reset is involved. The test verifies real PostgreSQL keys,
outbox state, planner transactions, and readiness projection.

## Security Outcome

- Circuit keys are derived server-side from persisted library observations.
- An old failure cannot influence current-content routing or expose its runtime
  status through the read-only policy summary.
- The test uses unique data in an isolated Testcontainers database and cleans
  it after every case.
- The implementation preserves bounded retention instead of trusting a caller
  to delete or reset history.

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
