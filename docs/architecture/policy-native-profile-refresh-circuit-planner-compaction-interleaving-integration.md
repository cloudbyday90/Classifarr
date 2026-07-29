# Native Profile Refresh Circuit Planner-Compaction Interleaving Integration

## Decision

Native profile-refresh planning and retention compaction may overlap across
scheduler processes. Every ready source revision selected by a planner is
passed to compaction as a protected revision after its recovery work has been
persisted. The planner locks the exact circuit row while it makes the recovery
decision; the durable outbox source-event identity coalesces duplicate
successor requests.

As a result, an old closed circuit that is otherwise eligible for retention
cleanup remains intact while either concurrent planner is processing its
current source revision. The planners create at most one pending successor.
The other planner replays that durable successor. This is automatic runtime
coordination, not a browser or operator workflow.

## Research

Research was retrieved from official sources on 28 July 2026. The sources used
were available by the requested June 2026 baseline. Microsoft's [background
job guidance](https://learn.microsoft.com/en-us/azure/architecture/best-practices/background-jobs)
states that work which does not require user interaction belongs in background
processing. Its [Well-Architected background-job guidance](https://learn.microsoft.com/en-us/azure/well-architected/design-guides/background-jobs)
calls for duplicate-safe, durable scheduled work because schedules and workers
can overlap. PostgreSQL's [explicit locking documentation](https://www.postgresql.org/docs/current/explicit-locking.html)
specifies that `SELECT FOR UPDATE` blocks conflicting writers and lockers on
the same row until the transaction ends.

## Options Considered

### Let Every Planner Compact Without Current-Revisions Protection

Pros: a smaller compaction call.

Cons: an expired circuit can be deleted while another planner is deciding
whether to create its automatic successor. This loses the recovery boundary
and makes scheduler overlap depend on timing. Rejected.

### Use One Process-Wide Scheduler Lock

Pros: avoids overlap by serializing all planners.

Cons: reduces availability, turns a local recovery delay into a global
scheduler dependency, and is unnecessary for per-source work. Rejected.

### Protect Current Revisions and Coordinate Per Circuit

Pros: compaction remains independent and idempotent, only related recovery
decisions serialize, and a durable outbox record makes the losing planner a
safe replay. Selected.

Cons: the protected revision is retained until the current planning pass
finishes, even when its ordinary retention duration has elapsed.

## Final Recommendation Stack

1. Keep profile recovery and compaction server-owned scheduled work.
2. Pass every current planner source revision to compaction as protected.
3. Lock the exact circuit row only while making its transition decision.
4. Use the durable outbox source-event identity to coalesce recovery
   successors across schedulers.
5. Keep cleanup independent of browser requests, operator action, and library
   naming conventions.
6. Test the composed behaviour with real concurrent PostgreSQL planners rather
   than mocks or synthetic in-memory locks.

## Implementation Outcome

`policy-native-profile-refresh-circuit-compaction.test.mjs` now creates a real
active native policy, its observed library item, and an intentionally expired
closed circuit for the resulting current source revision. Two independent
`PolicyNativeProfileRefreshPlanner` instances then run concurrently against
PostgreSQL.

The test proves that both planners report no compaction of that current
revision; one queues the recovery successor and the other replays it. The
database retains the closed circuit and has exactly the original terminal
outbox row plus one pending successor. No production branch was added because
the existing protected-revision, row-lock, and durable-outbox contracts already
provide the selected design.

## Security Outcome

- Retention cannot erase a current automatic recovery decision because of
  concurrent scheduler timing.
- Source revisions and recovery successors remain derived from durable server
  state, never from browser-provided identifiers.
- A second scheduler cannot multiply recovery work for the same source
  revision.
- The test uses isolated database fixtures and removes all generated policy,
  intent, outbox, circuit, and library rows after each run.

## Verification

Run the focused integration suite with:

```powershell
cd server
node ./scripts/run-jest.mjs -c jest.integration.config.mjs --runInBand --no-coverage --runTestsByPath src/__tests__/integration/policy-native-profile-refresh-circuit-compaction.test.mjs
```

## Next Step

Add compaction-failure isolation integration coverage. It must prove a cleanup
failure is reported and does not prevent the planner from durably scheduling
current automatic recovery; the following successful scheduler run must resume
cleanup without an operator action.
