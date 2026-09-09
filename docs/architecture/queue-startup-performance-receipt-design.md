# Queue startup performance receipt design

## Decision

Classifarr records passive, fixed aggregate receipts for the two queue-startup
reads introduced by the prior performance change:

- `queue_worker_health`
- `queue_refill_candidates`

Each receipt has a version, an operation ID, duration bucket, scanned-ID bucket,
candidate-count bucket, buffer bucket, aggregate count, and last-observed time.
The database primary key is only those fixed dimensions, so repeated observations
increment a bounded set of counters. No receipt can contain SQL, exact duration,
query plan, buffer count, item ID, media field, library, provider, credential,
configuration, policy, AI result, actor, error text, or route.

## Data boundary

The application measures query duration with `process.hrtime.bigint()` around
the existing read. It converts that measurement to one of five fixed buckets:
`under_5ms`, `5_to_24ms`, `25_to_99ms`, `100_to_499ms`, or
`500ms_or_more`. A malformed timing value becomes `unavailable`.

The refill read supplies only the existing page's scan count and returned
candidate count. The health aggregate uses `not_applicable` count buckets
because it is not an item scan. PostgreSQL buffer data is intentionally not
collected in a runtime read: collecting it would require a plan execution and
would change the workload being observed. Its fixed `not_sampled` bucket is an
explicit statement of that limit, rather than an invented performance fact.

A modular recorder coalesces identical receipts for up to one minute before a
parameterized upsert. The read result and queue operation never await the
observability write. A receipt persistence failure is contained to a fixed,
non-persisted warning, and an optional recorder fault is ignored at the read
boundary. Neither can change health, queueing, retry, policy, AI, or routing
behavior.

## Alternatives

| Option | Benefits | Costs | Decision |
| --- | --- | --- | --- |
| Raw query logging | Exact diagnostics | Retains query and potentially sensitive context; unbounded volume | Reject |
| Per-item receipt rows | Fine-grained analysis | Identifies work and grows with inventory | Reject |
| Add `EXPLAIN` or buffer collection in production | Actual plan data | Changes workload and risks a second expensive query | Reject |
| Fixed aggregate upserts | Stable, low-cardinality evidence with provenance | Buckets lose precision | Adopt |
| In-memory metrics only | No database writes | Loses restart continuity | Reject |

## Security and accessibility

The table constraints allow only two operation IDs, one receipt version shape,
and enumerated bucket values. Repository values are parameterized; no caller can
choose SQL or a dimensional key. The fixed receipt projection prevents sensitive
logging and keeps aggregate persistence from becoming a routing or automation
input.

No UI is introduced. If a later administrator surface presents the aggregate,
it must provide a programmatically determinable status message without moving
focus, following WCAG 2.2 success criterion 4.1.3.

## Research basis

- [W3C Data on the Web Best Practices](https://www.w3.org/TR/dwbp/) calls for
  understandable metadata, provenance, and data quality information. The
  version and explicit `not_sampled` state make the receipt's limits visible.
- [W3C WCAG 2.2 status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages)
  defines the status behavior required if the passive data is later displayed.
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
  recommends excluding secrets, identifiers, connection strings, and sensitive
  data from logs. The schema makes those values unrepresentable.
- [PostgreSQL Using EXPLAIN](https://www.postgresql.org/docs/current/using-explain.html)
  documents that actual plans execute a statement, supporting the decision not
  to sample plans from a routine production health or refill read.
