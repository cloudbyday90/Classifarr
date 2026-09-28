# Unfinished backfill restart acceptance

## Decision (September 28, 2026)

Extend the opt-in installation resource-budget drill, not the production
orchestrator. The existing four-item crash case stops before queue materialization;
it does not establish that already-claimed work survives an abrupt restart.

The additional case ingests 300 movies and 300 TV items through the synthetic
Jellyfin endpoint and the normal startup scheduler. Each library crosses the
250-item backfill page boundary. Music remains excluded. External metadata and
AI providers remain disabled. No live library or routing setting is changed.

## Safety and evidence boundary

1. Use only the existing collision-checked disposable Compose project, internal
   network and owned named volume, with 2 CPUs, 2 GiB and 128 PIDs.
2. A guarded fixture-only database trigger pauses movie processing after the
   real queue has committed its claim. A session advisory lock is the gate;
   the production worker, retry policy and ten-minute visibility lease are unchanged.
3. A transactional fixture ledger records claim and completion transitions. It
   observes task updates; it never repairs or replaces them.
4. Flush a bounded checkpoint containing the committed backfill generation,
   completed sync receipt and source-capture generation, inventory identities,
   task IDs, claims and visibility deadlines. Require both pending
   and processing tasks, complete queue materialization, and a verified blocker.
5. Kill only the owned app with SIGKILL; require exit 137 without OOM. Restart the
   normal entrypoint on the same volume. The killed database session releases
   the gate; the trigger remains present and uncontended.
6. A read-only observer checks sibling TV progress before the old movie claims
   expire, then waits for normal reclamation and current library profiles. It
   neither reseeds nor invokes workers nor alters statuses or deadlines.
7. Require unchanged committed capture/handoff, inventory and task identities, one necessary reclaim per
   interrupted task, no early reclaim, one durable completion per task, no
   routing tasks and no resource-limit denial. Compare resource observations
   within each process epoch, never subtract counters across restarts.

Normal startup schedules another library scan after two minutes. The synthetic
HTTP source dies with the crashed container, so later scan attempts can enter
retry-wait. The mutable `library_ingestion_state.run_id` is not a durable receipt:
the proof instead checks the original `backfill_run_id`, completed sync row and
completed source-capture generation. New retry attempts must not replace those
receipts, inventory or queued work. The observer does not restart the source or
suppress normal startup scans. This also verifies backfill completion while the
source is temporarily unavailable, but not source reconnection itself.

The existing small crash proof and default installation receipt remain intact.
The opt-in budget proof additionally requires this case for both fresh and
published-release-upgraded data. Waiting for the real lease costs approximately
ten minutes per case; a bounded observer fails rather than shortening the lease.

## Options and trade-offs

| Option | Benefit | Cost / limitation | Decision |
| --- | --- | --- | --- |
| Extend the real isolated installation drill | Exercises actual scheduler, queue, WAL recovery and profiles | Slower opt-in validation | Adopt |
| Short lease or direct status repair | Fast feedback | Does not prove default restart behavior | Reject for acceptance |
| New recovery orchestrator | Could add centralized policy | Duplicates existing ownership and scheduling before a gap is demonstrated | Defer |
| Claim-token fencing for live slow workers | Rejects stale acknowledgements | Separate production contract and migration work | Evaluate next using a targeted overlap test |

## Research and recommendation stack

- PostgreSQL explains recovery of committed changes through
  [write-ahead logging](https://www.postgresql.org/docs/18/wal-intro.html).
  Preserve the volume and verify durable identities after the crash.
- PostgreSQL's [advisory-lock documentation](https://www.postgresql.org/docs/18/explicit-locking.html)
  distinguishes session and transaction ownership. Use session death to release
  only the synthetic gate; elapsed age is not evidence about unrelated legacy writers.
- Docker documents [explicit service SIGKILL](https://docs.docker.com/reference/cli/docker/compose/kill/).
  Abrupt death must be distinguished from graceful shutdown and OOM termination.
- Microsoft's [idempotent consumer guidance](https://learn.microsoft.com/en-us/azure/architecture/patterns/idempotent-consumer)
  recommends stable identities and durable atomic evidence. Necessary redelivery
  is not a duplicate-completion failure. This test does not claim exactly-once
  remote side effects or cover a crash between a remote write and acknowledgement.
- W3C recommends meaningful [table captions and summaries](https://www.w3.org/WAI/tutorials/tables/caption-summary/).
  The human receipt uses a descriptive section, explicit column labels and units;
  counts distinguish pending, interrupted, reclaimed and completed work. This is
  not a claim of full UI accessibility conformance.

Recommended stack: existing PostgreSQL durable queue and scheduler → isolated
fixture fault injection → immutable restart checkpoint → bounded read-only
observer → validated aggregate receipt. No new runtime dependency is required.

See [validation](unfinished-backfill-restart-validation.md) for measured outcomes
and remaining gaps.
