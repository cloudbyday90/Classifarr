# Queue startup read performance design

## Decision

The queue-health read and metadata-refill reader use different bounded query
shapes because they answer different questions.

The worker-health read separates active work from recently completed work. Two
stable, partial indexes cover those predicates, and a single read combines the
two aggregates. The completed-work index starts with `completed_at`, because
the one-hour horizon is a runtime value and therefore cannot be the predicate
of a PostgreSQL partial index.

The metadata-refill reader captures a fixed upper ID at the start of a pass,
then reads one ordered, 5,000-ID page of supported media types before it loads
any large media payload.
It returns scan progress with every result. A page with no candidates advances
to the next page automatically; a short source page finishes the pass and the
next cycle starts a new snapshot.

Both designs work from the persisted item and queue schema. They make no
assumption about a particular media library, provider, or operator-defined
configuration. Provider checks remain eligibility signals, and no query can
route media, create a policy cohort, label an item, or change a policy.

## Measured problem

On the local September 2026 database, `task_queue` had 59,459 rows. The former
worker-health aggregate performed a sequential scan of 9,114 heap pages to
inspect 229 relevant recent rows. The former refill read loaded and sorted up
to 6,651 wide JSON rows to provide a 5,000-item page; the sort spilled 5 MB to
temporary storage.

The execution plans were collected with `EXPLAIN (ANALYZE, BUFFERS, SETTINGS)`.
PostgreSQL documents that `ANALYZE` executes the statement and that `BUFFERS`
reports cache and I/O use, so this is the appropriate evidence for an
indexing decision rather than an assumption about table size or configuration.

## Design

### Queue worker health

`queueWorkerHealthRead.mjs` owns the read contract. It uses two materialized
aggregate inputs:

1. Active `pending` and `processing` tasks provide counts and their latest
   start time.
2. `completed` tasks from the last hour provide a recent activity time.

The service combines the two timestamps without changing the health endpoint's
response shape or degraded-state rule. The migration adds these indexes:

| Index | Predicate and columns | Reason |
| --- | --- | --- |
| `idx_task_queue_health_active` | active status, then `started_at DESC` | Counts and activity read only active tasks. |
| `idx_task_queue_health_completed` | completed tasks, `completed_at DESC`, including `started_at` | The moving one-hour range is a bounded index range; `started_at` is available for an index-only read when visibility permits. |

### Metadata refill

`queueRefillCandidates.mjs` now has three explicit phases in one SQL statement:

1. `scan_bounds` freezes the high-water ID for the pass.
2. `scan` materializes only ordered movie and TV IDs, bounded by
   `REFILL_QUEUE_BATCH_LIMIT`.
3. The lateral candidate read loads media fields only for those IDs and applies
   existing provider, source-conflict, active-task, and observation rules.

`scan_progress` always produces one row. The JavaScript reader treats a null
candidate as progress metadata, never as a media item. It advances only when a
full raw ID page was scanned and the frozen bound has not been reached. A
failed enqueue restores the previous cursor, preserving the existing retry
guarantee. The reader orders the already-bounded candidate array by ID after
the database read. That keeps queue behavior deterministic without restoring a
database sort of wide media payloads.

## Alternatives

| Option | Advantages | Costs | Decision |
| --- | --- | --- | --- |
| Keep the aggregate `OR` query | Smallest code change | Reads historic queue rows on every health check | Rejected. |
| Add one broad `(status, completed_at)` index | One schema object | Does not express the active versus recent-completed access patterns; adds write cost to every row | Rejected. |
| Separate indexed health reads | Small, stable partial indexes; preserves endpoint contract | Two aggregate inputs and two index writes on status changes | Selected. |
| Filter then sort a candidate page | Existing behavior | Sorts wide payloads and can rescan an empty candidate set | Rejected. |
| ID-first keyset page with progress receipt | Bounded memory/I/O, deterministic pass boundary, automatic progress | A qualifying page can contain fewer than 5,000 candidates | Selected. |
| Use library- or provider-specific selection | May optimize one deployment | Couples correctness and performance to operator configuration | Rejected. |

## Security and accessibility

The new SQL has only fixed identifiers and bound values. The source-conflict
retention placeholder continues to be validated by
`sourceConflictAuthorityExclusionForMediaServerItem`, and no new API field is
introduced. This keeps the existing narrow response contract intact, consistent
with OWASP's guidance to expose only properties needed by an API operation.

The existing status surface remains unchanged. If these metrics later appear in
the UI, use a programmatically determinable status message so non-visual users
receive changes without focus being moved.

## Research basis

- [PostgreSQL: Using EXPLAIN](https://www.postgresql.org/docs/current/using-explain.html)
  describes using actual plans and buffer information to assess scans and I/O.
- [PostgreSQL: Examining Index Usage](https://www.postgresql.org/docs/current/indexes-examine.html)
  advises inspecting real workload and statistics before choosing indexes.
- [PostgreSQL: Multicolumn Indexes](https://www.postgresql.org/docs/current/indexes-multicolumn.html)
  explains why leading columns must match the query's constrained access path.
- [W3C Data on the Web Best Practices](https://www.w3.org/TR/dwbp/) supports
  preserving quality and provenance information that makes automated data
  processing understandable and trustworthy.
- [W3C WCAG 2.2 Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages)
  defines the accessible status-message behavior for any future UI exposure.
- [OWASP API3:2023](https://owasp.org/API-Security/editions/2023/en/0xa3-broken-object-property-level-authorization/)
  recommends returning the minimum required properties and explicitly
  controlling response shapes.
