# Durable Library Profile Upgrade Queue — Outcome

## Implemented

- A focused `libraryProfileUpgradeQueue.mjs` records the one-time task and
  dirties eligible library revisions in one transaction. Repeating a recorded
  task performs no revision mutation.
- Historical profile upgrade actions hand off to the existing per-library
  inventory planner and leased outbox worker. A new `v2` task requeues
  libraries whose old observation task was already recorded.
- Startup no longer starts a second, unbounded `generateAllProfiles()` pass.
  Inventory triggers and the scheduled profile-refresh automation remain
  responsible for ordinary generation and recovery.
- Fresh installations still pre-seed upgrade task identities; future library
  inventory inserts create dirty revisions through the existing trigger.

## Verification

Focused unit tests cover atomic call order, replay idempotency, failure
propagation, profile-task ordering, and lack of duplicate startup rebuilding.
PostgreSQL integration coverage checks that eligible active and inactive
libraries are dirtied exactly once, processed under the existing admission
limit, and resumed after reactivation. It also checks transaction rollback and
that an older in-flight claim cannot acknowledge a newer upgrade revision.
The full backend run passed 1,389 unit suites (40,757 tests) and 148
PostgreSQL integration suites (1,712 tests; one existing skipped suite).
Server lint, typecheck, and Markdown lint passed. No live user library was
modified.

## Limits and rollback

The upgrade seeding statement is set-based rather than cursor-batched, though
the expensive profile generations are bounded by the existing planner/worker.
The task ledger means work was *queued*, not that every library completed; use
`library_profile_inventory_state.revision > refreshed_revision` and the outbox
state to diagnose pending work. The previous image can be restored without a
schema rollback; already-dirtied revisions remain safe for the existing
worker. No release or local-container restart was performed.

## External PR

The repository's open pull-request collection was empty on 2026-09-23. There
was no open PR to select or implement locally; none was merged.
