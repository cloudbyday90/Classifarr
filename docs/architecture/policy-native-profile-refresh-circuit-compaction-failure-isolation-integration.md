# Native Profile Refresh Circuit Compaction-Failure Isolation Integration

## Decision

Native profile-refresh recovery persistence is a required transaction; retention
compaction is independent, best-effort maintenance. The planner persists every
current recovery request before attempting compaction. If compaction fails, the
planner completes with `compactionFailed: true`, zero cleanup counts, and a
stable server-side warning reason. It does not roll back, defer, or expose the
already durable recovery work.

The next scheduled planner invocation attempts compaction again. Its normal
idempotent outbox behaviour replays current pending work and removes any
otherwise expired inactive history once cleanup succeeds. Neither action needs
browser input, an operator acknowledgement, or installation-specific state.

## Research

Research was retrieved from official sources on 29 July 2026. The sources used
were available by the requested June 2026 baseline. Microsoft's [background
job guidance](https://learn.microsoft.com/en-us/azure/architecture/best-practices/background-jobs)
recommends idempotent schedule-driven jobs because overlapping schedules and
restarts can repeat work. Its [Well-Architected background-job guidance](https://learn.microsoft.com/en-us/azure/well-architected/design-guides/background-jobs)
recommends durable checkpoints and automatic resumption so a task failure does
not corrupt prior work. The [transient-fault guidance](https://learn.microsoft.com/en-us/azure/well-architected/design-guides/handle-transient-faults)
recommends retrying transient background failures with a deliberate recovery
strategy rather than making an interactive caller responsible.

## Options Considered

### Fail the Planner When Compaction Fails

Pros: one all-or-nothing status.

Cons: an unavailable cleanup query prevents durable automatic profile recovery
from being scheduled. This incorrectly makes non-critical retention a
dependency of current classification readiness. Rejected.

### Ignore the Cleanup Error

Pros: recovery stays available.

Cons: monitoring cannot distinguish no deletions from an unavailable cleanup
path, so stale history can accumulate unnoticed. Rejected.

### Isolate Cleanup, Report It, and Retry on the Next Scheduler Run

Pros: recovery remains durable, cleanup retries automatically, the structured
result and stable warning preserve observability, and no UI path is needed.
Selected.

Cons: expired inactive circuit and terminal outbox history can remain until a
later successful scheduled run. Monitoring must alert on sustained failures.

## Final Recommendation Stack

1. Commit current recovery scheduling before invoking retention compaction.
2. Treat compaction as server-owned best-effort maintenance, not an operator
   workflow or a prerequisite for readiness.
3. Return `compactionFailed: true` with zero cleanup counts when compaction
   fails, and emit the fixed server warning reason.
4. Keep the durable outbox idempotent so the next planner run safely replays
   current pending recovery work.
5. Retry cleanup on later scheduled runs without a manual reset, browser
   request, or deployment-specific exception.
6. Monitor the stable warning reason for sustained cleanup failure while
   keeping raw database error details out of results and browser surfaces.

## Implementation Outcome

`policy-native-profile-refresh-circuit-compaction.test.mjs` now uses the
planner's injected compaction repository seam to produce one deterministic
compaction outage while all candidate discovery, transaction persistence,
outbox behaviour, and later compaction run execute against PostgreSQL.

The first planner run queues the current native recovery, reports
`compactionFailed: true`, and leaves an unrelated expired closed circuit plus
its terminal outbox row intact. The next run replays the durable pending
recovery, reports successful cleanup, and removes that stale circuit and
terminal history. No product code changed: the planner already persisted before
compacting and exposed this isolated failure contract; this test now protects
the end-to-end composition.

## Security Outcome

- A cleanup outage cannot suppress or roll back automatic recovery work.
- Browser and operator surfaces receive no raw cleanup error, retry control, or
  retention override.
- The planner emits only a fixed reason identifier; no database error details
  enter the result, browser surface, or authored policy state.
- Current outbox work and unrelated recovery history remain independently
  scoped by durable library and source-revision identifiers.

## Verification

Run the focused integration suite with:

```powershell
cd server
node ./scripts/run-jest.mjs -c jest.integration.config.mjs --runInBand --no-coverage --runTestsByPath src/__tests__/integration/policy-native-profile-refresh-circuit-compaction.test.mjs
```

## Next Step

The completed concurrent retention-compaction integration is documented in
[Native Profile Refresh Circuit Concurrent Retention-Compaction
Integration](policy-native-profile-refresh-circuit-concurrent-retention-compaction-integration.md).
The [Native Profile Refresh Recovery-Retention Completion
Audit](policy-native-profile-refresh-recovery-retention-completion-audit.md)
now closes this recovery-retention sequence. Next, start Phase 6R.6 Task
6R.6.1: the server-owned migration preview contract.
