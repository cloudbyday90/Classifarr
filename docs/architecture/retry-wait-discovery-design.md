# Selective waiting-backlog discovery: design

Date: 2026-09-30. Scope: read-only retry candidate pages and scheduler availability
checks for OMDb, native web search and the legacy Tavily bridge. The selectors
introduce no provider requests, timer, routing changes or release. A subsequent
user request authorizes a no-cache local Compose rebuild after validation.

## Decision

Add a conservative negative check inside the existing SQL statement. If neither
a pending, normally due row nor a pending row with matching wait provenance
exists for this retry type, skip the candidate scan. Otherwise execute the same
ordered, guarded selector. A positive check is **not** permission to retry.

Apply the same check to the scheduler's earlier dispatch probe; otherwise an idle
wake would still scan waiting rows before reaching the optimized page selector.
The dispatch probe remains deliberately weaker than item admission: it only
decides whether to invoke the existing bounded batch planner.

The existing due index supports the first existence check. A new partial B-tree
on `enrichment_type` supports the second, with this static predicate:

```sql
status = 'pending' AND retry_wait_context IS NOT NULL
  AND retry_wait_until = next_attempt_at
```

The index contains neither credentials nor media metadata. Eligibility still
compares secret-free provider context, exact deadlines, quotas, cooldowns, active
libraries, supported media, existing metadata, attempts and source conflicts.
Claims and fenced writes recheck live authority. Unknown legacy waits remain
waiting; this change neither guesses their provenance nor resets their deadlines.

Both checks and the full selector use one statement snapshot and database clock.
No persistent negative cache can strand newly due or recovered work. A change
committed after that snapshot becomes visible on the next normal scheduler wake.
Known but unrecovered provenance intentionally causes a false positive: the full
selector rejects it. That conservative behavior avoids duplicating recovery rules.

## Official research and alternatives

Sources verified through online tools on 2026-09-30:

- [PostgreSQL 18 partial indexes](https://www.postgresql.org/docs/18/indexes-partial.html):
  the query must imply the predicate. Keep its fixed status/provenance conditions
  explicit; the parameter binds only the retry type, not the partial predicate.
- [Multicolumn indexes](https://www.postgresql.org/docs/18/indexes-multicolumn.html):
  leading keys matter. An existence lookup needs one type key, not a broad
  four-column ordered index or wide JSON covering payload.
- [Examining index usage](https://www.postgresql.org/docs/18/indexes-examine.html):
  use analyzed, representative data and actual plans, not an assumed index win.
- [CREATE INDEX](https://www.postgresql.org/docs/18/sql-createindex.html): index
  predicates must be immutable; ordinary builds block writers. Concurrent builds
  cannot execute inside the repository's transaction-wrapped migration runner.
- [W3C status messages](https://www.w3.org/WAI/WCAG21/Understanding/status-messages):
  status changes should be available to assistive technology without taking focus.
  No UI or polling changes are needed here; retain the existing status controls
  and do not present candidate discovery as completed enrichment.

| Option | Benefit | Cost / drawback | Decision |
| --- | --- | --- | --- |
| Keep scanning all waiting rows | No new index | Repeated idle work | Replace the empty-work path |
| Split due/recovered queries and merge | Fast waiting and sparse-due paths | Prototype regressed credential-recovery head from about 1.5 to 551 ms | Reject |
| Conservative existence check plus narrow partial index | Skips provably empty work; preserves guarded ordering | Small write/storage cost; no improvement for known unrotated waits or sparse due tails | Adopt after validation |
| Persistent summaries or new scheduler | Could avoid more reads | New invalidation, ownership and recovery complexity | Not needed |

## Deployment and recovery

The additive migration runs at startup under the existing migration transaction.
Use a five-second lock timeout and sixty-second statement timeout; failure rolls
back the index and migration receipt rather than silently ignoring a missing
index. Quiesce writers for upgrade. Do not run this DDL against the live database
as routine maintenance. A large installation unable to build within the bound
needs an explicitly reviewed online-index procedure, not a larger automatic
timeout or a new migration framework in this patch.

Fresh installations receive the same index from the canonical schema snapshot.
Removing the application check is a code rollback; the extra index is harmless
to the old selector. No inventory, retry status, deadline or history is deleted.

## Acceptance

Compare actual IDs and plans with the pre-change query at head/middle/tail across
all retry types, including absent, sparse, dense and mismatched provenance.
Include priority/time skew, null/infinite timestamps, concurrent transitions,
read-only transactions, migration rollback/replay and bounded update cost. Run
the benchmark only in its owned disposable PostgreSQL database. Publish measured
limitations and validation in the separate outcome document.
