# Selective gateway catalog dependency reads

Agreed scope, 2026-10-18: implement the selective-read recommendation described in
the [risk review](gateway-catalog-scan-reduction-review.md). The user requested
implementation after the scope, safeguards and comparison method were explained.
No additional product decision is needed for this bounded change.

## Contract

Dependency inspection currently transfers every job's complete canonical JSON,
then ignores failed history and verified archives outside its required set.
Use a shared cursor implementation with separate full-content and dependency
projections. Every dependency row still returns its canonical byte length and a
required/not-required flag; only required verified rows return full JSON. This
keeps validation of excluded history independent of an earlier full capture,
including standalone retention registration.

Preserve fixed schema validation, UUID ordering, FETCH 16, the 10,000-job limit
and the 131,072-byte per-row limit. Reject invalid metadata and oversized rows
before a body reaches the consumer. Empty selection still scans and validates
all rows. Bind a bounded UUIDv7 selection array as a query parameter; null means
all verified dependencies. Never interpolate IDs or choose table names from input.

Keep full canonical capture/dump contents and hashes unchanged. Version 1 still
requires every verified dependency; version 2 still requires the newest pair and
protected archives using its existing selection function. Retain both file
inspection passes, independent restore, protection markers, receipt validation
and retention pins. No stored validation credit or trust across runs.

This is a read-path optimization. Existing read-only repeatable-read transactions,
maintenance ownership, 120-second assessment, statement timeouts, three attempts,
cooldowns, cancellation, storage/resource limits and durable restart behavior
remain in force. A refused or cancelled scan cannot complete publication or
registration. Unknown/partial filesystem evidence remains a refusal. No schema,
database, timer, provider call, purge, new admin function or production activation.
Disabled/fresh installations perform no new work.

## Research and tradeoffs

Official sources found and opened through MCP on 2026-10-18:

- [PostgreSQL SELECT](https://www.postgresql.org/docs/18/sql-select.html):
  projection and deterministic ordering are distinct from filtering the rows.
  Our application is to omit unneeded bodies while retaining guard metadata.
- [PostgreSQL transaction settings](https://www.postgresql.org/docs/18/sql-set-transaction.html?trk=article-ssr-frontend-pulse_little-text-block):
  keep the existing transaction snapshot and access mode. That snapshot does
  not establish immutability of external archive files.
- [PostgreSQL cursors](https://www.postgresql.org/docs/18/plpgsql-cursors.html):
  incremental fetching bounds client-side accumulation. Keep the existing small
  cursor pages instead of materializing all job bodies.
- [PostgreSQL EXPLAIN](https://www.postgresql.org/docs/18/sql-explain.html):
  execution, serialization and buffer observations help evaluate SQL costs, but
  EXPLAIN does not transmit result data and cannot measure network savings.

| Approach | Advantages | Disadvantages | Decision |
| --- | --- | --- | --- |
| Existing full-body cursor | Simple established semantics | Transfers/parses excluded history repeatedly | Differential baseline |
| Guard metadata for all rows, selected bodies | Preserves per-caller guards; smaller transfer | Still computes canonical sizes in SQL and visits every row | Implement |
| SQL WHERE on selected rows only | Fewer result rows | Bypasses excluded-history size/count validation | Reject |
| Cache a prior validation or skip a pass | Could avoid more work | Additional invalidation/crash rules; stale external files | Defer |

Recommended stack: modular ESM, the existing PostgreSQL snapshot and cursor,
parameterized conditional projection, unchanged streaming file verification,
and differential real-SQL plus immutable-image tests. Reduced transfer/parsing
is expected; SQL CPU and elapsed time require measurement. Full dump I/O and
file-cache peaks may remain similar.

## Verification

Compare complete selected row text, order and hashes against the full reader on
one real read-only SQL snapshot, including Unicode, microsecond timestamps,
null/empty selection, failed/retired rows and version-2 timestamp ties/protection.
Prove schema drift, oversized excluded rows, 10,001 total jobs, cancellation and
consumer failures still refuse and release the cursor. Retain source-history
hashes and limits. Exercise capture, isolated restore and standalone retention.

Measure returned field bytes independently from query plans/time. Use the existing
wide-history and valid-archive rehearsals without overlaying application modules.
Retain corruption, retry/interruption and resource cleanup assertions. Run scoped
quality checks, build local Compose without cache, evaluate the exact image and
document the outcome separately. Commit and push on main; no release.
