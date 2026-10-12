# Description refresh timeout — investigation outcome

Inspected 2026-10-11, read-only, in local Docker. No Unraid, Plex, Ollama,
database-setting, retry-budget, ownership or memory-safeguard changes.

## Confirmed failure

Report `3cb12fef-9cef-4607-9dc7-bd883ede39cc` is present in the local database.
The scheduler recorded it at 19:12:16.384 UTC (15:12:16 Eastern), on container
`a312528616c9`. The retained PostgreSQL log records **statement timeout** for
the description-corpus SELECT at 15:12:16.369 Eastern, about 15 milliseconds
earlier. The same SELECT timed out at 15:07:16.811 and 15:09:18.262.

The query reads active-library inventory, excludes conflicting source identities,
includes eligible materialized season mappings, and falls back to the latest
classification overview only when needed. It is not an embedding-provider request
or a media-server write. The repository sets a local 15-second statement timeout
and a two-second lock timeout. The recorded error is statement timeout, not an
ownership rejection or the application's memory-pressure admission result.

The 15:07 recovery warning recorded `code: unknown`, `phase: refresh` and a
67-second retry delay. The scheduler then discarded that report and threw
`inventory_description_refresh_unavailable`; its logger-generated stack is not
the original database stack. Three scheduler errors and one deduplicated warning
describe this episode. The app's report alone could not identify the cause.

The code path is
[repository](../../server/src/services/inventoryDescriptionRefreshRepository.mjs)
→ [worker](../../server/src/services/inventoryDescriptionRefreshWorker.mjs)
→ [recovery](../../server/src/services/inventoryDescriptionRecovery.mjs)
→ [refresh scheduler](../../server/src/services/inventoryDescriptionRefreshScheduler.mjs)
→ [task runner](../../server/src/services/schedulerTaskExecutionRunner.mjs).
The repository's timeout is local to the operation, not a global database change.

## Recovery and present observation

The retained application log records `up_to_date` at **19:17:05.297 UTC**:
6,501 eligible descriptions, 6,501 cache hits, no remaining descriptions and no
new embeddings. It recovered without manual repair or an increased timeout.
At 23:53:02.025 UTC the corresponding counts were 6,514 / 6,514 / zero remaining.
No subsequent warning/error for this task was found in the two retained file-log
segments inspected through that observation. This does not clear historical errors
or prove every other background task is healthy.

A bounded `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` of the current image's SELECT
ran in a read-only transaction, with the existing 15-second deadline and a tighter
one-second lock deadline. It returned 6,539 rows: 24.798 ms planning, 599.702 ms
execution, approximately 670 ms client elapsed. Only plan aggregates were printed;
no descriptions, identifiers or provider payloads were exported. There were no
provider calls or application writes.

The plan used cached blocks, a 3,192 KiB disk sort and 20 indexed history fallback
lookups. The final estimate was 263 rows versus 6,539 actual. The current image is
revision `700bf66e5b8496c42b5202e38d1fef2426411e98`; it adds typed season-document
filters compared with the historic failed SELECT. This warm, later observation is
**not** a replay of the failing image, data, load or plan, and excludes ordinary
result serialization/transfer. It cannot establish why the old SELECT took over
15 seconds. Nearby pool-wait and execution delays show competing work existed,
but do not prove CPU, disk, locks or pool contention caused this specific timeout.

## Recommendation and limits

The immediate cause is established: PostgreSQL cancelled the corpus read after
its deadline. The underlying performance cause remains unproven. Keep the timeout,
cache checkpoint, admission controls and automatic cooldown unchanged; do not
reset imports or regenerate vectors merely because of this historical warning.

Next prioritize bounded failure attribution before another performance fix:

| Option | Benefit | Cost / risk | Recommendation |
| --- | --- | --- | --- |
| Record allowlisted stage, SQLSTATE, elapsed time and shared incident reference | Identifies the failed operation without provider data or SQL parameters | Requires regression tests for redaction, cancellation and scheduler propagation | Next bounded code change |
| Profile the corpus query under controlled load on a disposable restored fixture | Can separate plan, serialization and resource contention | More expensive; must preserve identity and memory boundaries | After attribution |
| Increase deadlines, work memory or disable safeguards immediately | May conceal a transient timeout | No demonstrated bottleneck; increases shared-resource risk | Reject |

Do not call SQLSTATE `57014` a timeout without supporting context: it denotes
query cancellation, which has multiple causes. Here the PostgreSQL log supplies
that context. Prefer fixed error categories over arbitrary raw error text.

Official PostgreSQL sources discovered through MCP on 2026-10-11:

- [Connection defaults and timeouts](https://www.postgresql.org/docs/18/runtime-config-client.html).
- [Error codes](https://www.postgresql.org/docs/current/errcodes-appendix.html).
- [EXPLAIN](https://www.postgresql.org/docs/18/sql-explain.html): ANALYZE actually
  runs the query; default output excludes serialization and network-transfer
  costs, and profiling adds overhead.

This is a diagnosis, not a claimed query-performance or logging fix. The recovery
skill kept the investigation read-only and required separating the logger's stack,
the PostgreSQL evidence, and unproven resource explanations.
