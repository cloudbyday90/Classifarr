# Classification Progress Stage Storage Cutover

## Status

Implemented on July 11, 2026. Classification progress now uses stage-only
terminology in task queue storage, JSON history, server contracts, WebSocket
events, routes, and Command Center readers.

## Problem

The prior contract migration added stage fields but retained phase-named storage
columns and public aliases. That left permanent delivery-language debt in a
live queue table and allowed callers to keep depending on a terminology that no
longer describes the product.

## Official Guidance Reviewed

- [NIST SP 800-228](https://csrc.nist.gov/pubs/sp/800/228/upd1/final)
  recommends risk-based controls over API lifecycle changes. This cutover
  changes the storage and public contract together, then verifies each server
  and client consumer rather than leaving a silent fallback.
- [PostgreSQL ALTER TABLE](https://www.postgresql.org/docs/current/sql-altertable.html)
  defines column and index rename operations and notes their locking behavior.
  The migration uses one transaction, retains all data, and does not introduce
  a parallel set of progress columns.
- [OpenTelemetry naming guidance](https://opentelemetry.io/docs/specs/semconv/general/naming/)
  favors stable, unambiguous names. `stage` is now the single lifecycle term in
  progress API and event payloads.

## Recommendation

Use one stage-only contract:

```text
task_queue.current_stage
task_queue.stage_index
task_queue.stage_started_at
task_queue.stage_history[].stage

currentStage, stageIndex, totalStages, stages
stage, stageIndex, totalStages
```

Do not retain phase aliases. Existing task rows are migrated in place and all
repository-owned consumers now read the durable names.

## Pros And Cons

Pros:

- Removes lifecycle naming debt from persisted data and public contracts.
- Avoids dual-column synchronization, fallback readers, and a future deletion
  migration.
- Keeps task progress history intact while converting its JSON entry key.
- Makes progress service, route, WebSocket, and UI behavior consistent.

Cons:

- External beta clients using retired phase-shaped payload fields must update.
- The table rename obtains PostgreSQL DDL locks during migration execution.

## Final Implementation Stack

1. Rename the four task queue columns and active-stage index in one migration.
2. Convert each `stage_history` array entry from `phase` to `stage`.
3. Remove stage-to-phase response and event aliases.
4. Update the progress service, queries, route schema, and Command Center
   readers to use only stage fields.
5. Cover the migration contract with server service, route, integration, and
   client composable tests.

## Security Outcome

- The migration preserves queue progress data and does not duplicate it into
  unsynchronized compatibility fields.
- Stage history continues to use application-owned values and bounded JSON
  records; no user input is interpolated into migration SQL.
- Route and WebSocket payloads no longer expose ambiguous duplicate fields.

## Validation

- Focused progress service, route, lifecycle integration, contract, and client
  tests validate stage-only behavior.
- Schema validation confirms the authoritative schema contains the renamed
  fields and index.
- Full server and client suites, security lint, docs lint, and naming
  regression checks run before release.
