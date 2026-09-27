# Owned source-capture lifecycle

## Decision

Extend the [finalization boundary](ingestion-finalization-ownership-design.md) to
capture creation, page storage, and the shared current-capture callback used by
identity recovery. All of these operations now obtain the database facade from the
live, matching-library owner. Remove the store's injected database field instead
of retaining a second, unguarded write path. The store remains small and stateless.

Normal imports already hold that owner for their lifecycle. Controlled maintenance
can use `createMediaSyncOwnership({ pool })(libraryId, callback)` with
`new MediaSourceObservationStore()` inside the callback. `local_capture` remains
supported but is only a provenance label, never permission to bypass ownership.
Deferral (`ingestion_owned` / `ingestion_capacity`) means the callback did not run;
callers must not report success or start another unowned capture. This adds no
automatic takeover, background task, provider call or permission to run maintenance.

## Cause and implementation

Previously `start`, `capture` and `withCurrentCapture` could use an arbitrary injected
adapter, even when capture completion required a leased connection. That permitted
unowned generation replacement, retention deletion, observation updates and recovery
callbacks. The shared callback is not read-only: it also reserves recovery attempts,
persists repaired inventory and records outcomes. Only production sync owns its
current callers; summary/report reads use separate services and stay unchanged.

The existing ownership guard now covers every store entry point. SQL, retention
limits, duplicate handling, generation/phase row locking, rollback and provider
budgets are preserved. Pages are normalized before asynchronous SQL, and capture
coordinates are copied through a small ESM helper. Returned coordinates are frozen.
Recovery readers/writers snapshot coordinates before awaiting so their callback
closures cannot be retargeted by a mutable caller context. This does not freeze the
caller's object or treat a copied generation as an authorization token.

Session ownership does not replace durable generation checks. A newer generation or
completed capture still rejects stale pages/callbacks. A lost or closed owner cannot
fall back to the pool. A correctly configured but empty installation still has no
capture work until ingestion is requested; readiness and music exclusion are unchanged.

## Research verified 2026-09-27

Official pages were found/read through web tools, not invented links.

- [PostgreSQL 18 locking](https://www.postgresql.org/docs/18/explicit-locking.html)
  describes cooperative advisory ownership and transaction-scoped row locks. Keep
  session ownership across the import, with short transactions around page writes.
- [node-postgres transactions](https://node-postgres.com/features/transactions)
  requires one client throughout a transaction. Reject injected pool fallback rather
  than adding a boolean check while leaving writes on another connection.
- [Node.js 24 async context](https://nodejs.org/download/release/v24.0.1/docs/api/async_context.html)
  documents context propagation through `run`; context alone does not establish
  lifetime or connection health. Retain the existing explicit lease/closed checks.
- [W3C PROV overview](https://www.w3.org/TR/prov-overview/) separates the entities,
  activities and agents needed for provenance. Preserve source/generation/run evidence
  separately from execution authority. This applies its concepts, not a claim of RDF
  conformance. No visual/UI change requires an accessibility contract change.

## Options and final recommendation stack

| Approach | Pro | Con | Recommendation |
| --- | --- | --- | --- |
| Guard only page insertion | Small edit | Leaves creation and callback writes open | Reject |
| Guard all capture-store operations | One connection/owner contract; no new dependency | Existing offline callers must enter ownership | Implement |
| Database roles / fenced write API | Stronger isolation from raw-SQL writers | Schema, deployment and upgrade compatibility work | Evaluate after lifecycle evidence |
| Another scheduler or workflow engine | Broader coordination features | Does not itself fix unowned database calls | Not needed for this defect |

Stack: existing session owner and capacity admission, library-bound store guard,
immutable coordinate snapshots, generation checks and transactional rollback, then
the reviewed static drift gate. These are cooperative application safeguards, not
database authorization. Arbitrary SQL, other ingestion writers, and external older
processes are not made safe by this change. No SQL already sent can be cancelled merely
by rejecting a late result; callers must await their work.

## Acceptance

Prove rejection before SQL for unowned/wrong-library/closed/lost calls; prove no
injected adapter is used; prove caller mutation cannot retarget page or recovery
writes. Exercise generation supersession, retention, conflict repair, rollback,
restart recovery, exclusion, disabled maintenance, and fresh-setup readiness using
isolated PostgreSQL. Keep outcomes and next work in a separate document.
