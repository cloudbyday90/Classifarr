# Owned ingestion finalization

## Decision and scope

Require a live, library-bound ingestion database scope before inventory pruning,
collection pruning, or source-capture completion/failure. Keep ordinary read helpers
and separately controlled maintenance available. No release, deployment, database
migration, new worker, provider call, or routing change is required.

The current full-sync runner already holds a PostgreSQL session advisory lock and
commits capture completion, pruning and run completion together. The shared helpers,
however, could also be called without that runner and silently use the database pool.
An owned callback for one library could accidentally target another library. Checking
`isOwned()` alone would not validate the library, lease health, or callback lifetime.

## Runtime contract

- `createMediaSyncOwnership` acquires the library lock and a capacity slot before
  entering `withMediaSyncDatabase`, supplying its validated library ID.
- `requireOwnedMediaSyncDatabase(libraryId)` checks the private async-local scope,
  closed state, connection lease, and canonical library ID. It returns the pinned
  database facade, never the general pool. Failure occurs before helper SQL/logging.
- Both pruning helpers and `MediaSourceObservationStore.finish` require this guard.
  Capture finalization uses the owner's database even if the store was constructed
  with another adapter. A private capture helper retains the generation/phase check
  and row lock; the caller cannot supply a replacement database to `finish`. Capture
  keys are snapshotted before awaiting SQL so a mutable caller context cannot retarget
  an already-admitted completion.
- Per-query checks reject a lost connection or closed scope, including a result that
  arrives after closure. The facade is frozen. Existing nested savepoints and atomic
  full-sync finalization remain in place. Callers must await their work: rejecting a
  late acknowledgement does not cancel SQL already submitted to PostgreSQL.
- `local_capture` is provenance, not a bypass. Controlled maintenance must enter the
  same ownership wrapper before finishing a capture; it need not claim a normal
  ingestion run. Disabled-library legacy reconciliation remains separately reviewed
  and does not acquire completion authority merely from a status flag.

This is a cooperative in-process correctness boundary, not a database authorization
boundary. Trusted code can still issue raw SQL or import internal scope primitives.
Unowned capture start/page mutation and other shared writers remain tracked debt.
Do not relabel their whole files as ownership-safe. This change also does not prove
provider pagination completeness or permit new automatic destructive maintenance.

## Official research, checked 2026-09-27

URLs were discovered and read through the available web tools.

- [PostgreSQL 18 explicit locking](https://www.postgresql.org/docs/18/explicit-locking.html):
  advisory locks are cooperative and session locks outlive transaction rollback.
  Keep ownership on the same connection and release in the existing reverse order.
- [node-postgres transactions](https://node-postgres.com/features/transactions):
  statements in one transaction must use one client. The guard therefore returns the
  owning facade instead of merely permitting a pool-backed mutation.
- [Node.js 24 asynchronous context](https://nodejs.org/download/release/v24.0.1/docs/api/async_context.html):
  `run` propagates context to descendant asynchronous work; outside it, `getStore`
  returns undefined. Explicit closed/lease checks supplement context presence.
  Only APIs supported by the repository's Node 24.18.1 minimum are used.
- [W3C PROV overview](https://www.w3.org/TR/prov-overview/): provenance describes
  entities, activities and responsible agents. Preserve source, generation and run
  evidence; do not equate such labels with execution authority. This is an application
  of its concepts, not a claim of PROV serialization conformance. No UI is changed.

## Alternatives and recommendation stack

| Option | Benefit | Cost / limitation | Decision |
| --- | --- | --- | --- |
| Boolean owned flag | Minimal code | Misses wrong library, expired lease and pool adapter | Reject |
| Library-bound live scope | Small change; same-client enforcement; preserves callers | Cooperative, process-local | Implement now |
| Explicit run/capture capability at every writer | Stronger operation-level contract | Requires migration of start, page and maintenance callers | Next step |
| Database roles / fenced mutation API | Can constrain non-cooperating code | Larger schema, deployment and compatibility work | Evaluate after writer migration |

Keep the existing ownership drift gate and conservative readiness checks. First
close these destructive helper escape paths; next bind capture start and page writes
to owned sessions and test controlled maintenance end to end. Then assess database
fencing without pretending the static inventory is a proof of runtime safety.

## Verification plan

Test unowned calls, forged adapters, wrong-library and invalid IDs, expired callbacks,
lost connections, retained facades, normal completion, generation mismatch, failed and
incremental capture semantics, and empty full-library pruning. Run isolated PostgreSQL
recovery/reconciliation tests, backend checks and the reviewed ownership drift gate.
Record actual outcomes separately; never use live library data for destructive tests.
