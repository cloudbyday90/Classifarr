# Capacity-aware image-index maintenance design

## Decision and scope

The disposable study completed 10,000 synthetic 2,000-dimensional vectors but
twice exhausted the two-minute build budget at 50,000. First address the fixed
64 MiB PostgreSQL workspace, not the queue lease or execution deadline.

Only the validated, colocated embedded worker may select a larger workspace.
Standalone and external-database callers retain 64 MiB: application-host memory
does not establish remote database capacity. No template, environment override,
new daemon, privilege, provider call, schema change or release is required.

## Admission and execution

1. Retain restore exclusion, claim fencing and the single image-maintenance lock.
2. Inspect exact index definitions; healthy indexes need no resource assessment.
3. When HNSW needs work, probe at most 10,001 non-null image vectors, bounded by
   the existing SQL deadline. At most 10,000 uses 64 MiB; larger cohorts may use
   512 MiB. This is a cohort threshold, not a capacity or completion guarantee.
4. Before granting 512 MiB, require ingestion/backfill and other due queue work
   to be idle, including for manual jobs. Empty libraries are permitted for manual
   maintenance; automatic jobs still require configured image demand and completed
   inventory. Require available process memory >= 512 MiB + 256 MiB overhead +
   the existing runtime reserve (one eighth of the limit, bounded 128–512 MiB).
5. Unknown or insufficient headroom defers before DDL and before charging an
   automatic attempt. Never silently fall back to a predictably smaller workspace.
6. Keep one PostgreSQL build session, zero parallel maintenance workers, fixed
   concurrent DDL, the 120-second executor, existing claim/supervisor deadlines,
   durable three-attempt budget and one-hour automatic retry cooldown.

Memory admission is a conservative point-in-time check, not a reservation or a
hard PostgreSQL RSS cap. New foreground work can start afterward. Larger or
slower deployments can still reach the deadline; they must remain incomplete.
No vector precision, HNSW parameters or retrieval behavior is weakened.

## Failure contract

Carry allowlisted categories across the worker exit-code and one-byte handoff
boundary: maintenance deadline, lock contention, query cancellation, catalog
mismatch, verification failure and database unavailable. Unknown errors remain
generic. Never forward raw SQL, exception messages, child output or secrets.
SQLSTATE 57014 means cancellation, not necessarily a local timeout. Lost claims
remain deferred. Existing queue failure handling owns retries and error logging.

## Alternatives and recommendation stack

| Option | Advantage | Cost or limitation | Decision |
| --- | --- | --- | --- |
| Fixed, admitted 512 MiB workspace | Can avoid HNSW disk spill without longer ownership | Higher database memory demand; needs measured headroom | Test and prefer first |
| Longer bounded execution | Accommodates genuinely slower builds | Requires coordinated claim, child, broker and shutdown budgets | Follow only if measurements justify it |
| More parallel workers | Potentially faster builds | More CPU and shared-memory pressure; deployment compatibility | Do not enable |
| Different vector/index representation | Potentially smaller indexes | Retrieval-quality and migration implications | Separate evaluation, not a repair shortcut |

Recommended stack: exact catalog checks → colocated capacity admission → bounded
single-worker execution → classified failures → durable retry limits → disposable
capacity/recovery evidence. Preserve fresh-install and ingestion waits.

## Official research

Reviewed 1 October 2026 for the requested September 2026 baseline. These are live
official documents, not an archived September snapshot; no runtime upgrade is
implied by a newer documentation patch version.

- [pgvector index build guidance](https://github.com/pgvector/pgvector/blob/master/README.md):
  fitting the HNSW graph in maintenance memory improves build time; avoid exhausting
  server memory and retain default graph parameters absent retrieval evidence.
- [PostgreSQL 18 resource consumption](https://www.postgresql.org/docs/18/runtime-config-resource.html)
  and [bulk loading guidance](https://www.postgresql.org/docs/18/populate.html):
  maintenance memory is a session-level build resource, separate from application
  heap and other database memory demands.
- [PostgreSQL 18 concurrent rebuilds](https://www.postgresql.org/docs/18/sql-reindex.html):
  concurrent operations retain write availability but require extra work and can
  wait on other transactions; failures need catalog verification.
- [PostgreSQL 18 CREATE INDEX](https://www.postgresql.org/docs/18/sql-createindex.html):
  concurrent creation has multiple phases and waits; an existing index name alone
  does not establish its definition or validity.
- [Node 24 memory APIs](https://nodejs.org/download/release/v24.20.0/docs/api/process.html):
  process-available memory and OS constraints support admission, not a remote
  server capacity estimate.
- [W3C status messages](https://www.w3.org/WAI/WCAG21/Understanding/status-messages):
  preserve meaningful textual states and programmatically exposed updates. This
  backend change adds no chart or UI surface and does not claim WCAG conformance.

## Acceptance

Test boundaries, unknown memory, busy ingestion, claim loss, sanitized result
transport and unchanged queue protocol. Repeat the actual disposable 50,000-vector
study, including interrupted recovery, catalog checks, data preservation, resource
limits and worker cleanup. Report measured failures honestly. Record outcome in
a separate document; retain production data and the live deployment untouched.
