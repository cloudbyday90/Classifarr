# Exact queue task IDs in classification intake receipts

November 26, 2026. The [queue identity inventory](queue-task-identity-inventory-outcome.md)
found that classification intake drops valid large task IDs before SQL.
The maintainer approved a repair at the shared lifecycle writer.

## Scope and contract

Queue admission, dequeue, classification persistence and acknowledged
completion or failure supply the persisted queue row's ID. The database
adapter returns safe integers as numbers and larger BIGINTs as decimal
strings. The intake writer currently checks `Number.isSafeInteger` and
silently declines the latter, even though the receipt column and report
lookup already accept the full range.

Use the shared BIGINT normalizer once at `record`. Preserve positive safe
numbers as numbers, accept their canonical decimal equivalents, and bind
larger canonical decimal strings through `9223372036854775807`. Invalid
or potentially rounded values return false before SQL. History IDs and
the decision context keep their own exact bindings.

The upsert still selects an existing classification task. Missing or
non-classification tasks keep the existing advisory refusal. Successful
acknowledgements still require ownership of the queue claim, and stored
queue state and attempt ordering still govern the receipt. Failures retain
the fixed, rate-limited diagnostics. The change adds no provider calls,
extra queries, retry budget, recovery trigger or replay authority.

Existing reconciliation may repair missing receipts from retained
queue and witness evidence within its current bounds. A past event
whose source is gone cannot be reconstructed by this repair. Receipts
retain their independent lifetime and private, read-only report. This
change requires no schema, retention or report-format changes.

## Research and tradeoffs

RFC 8259 describes exact interoperable JSON integers only through the
binary64 safe range. PostgreSQL BIGINT supports larger values and its
documentation warns about precision loss in external JSON consumers.
Use exact text for the larger values and keep SQL parameters bound.
W3C guidance on preserving identifiers and API compatibility supports
retaining the report's existing representation.
[RFC 8259, section 6](https://www.rfc-editor.org/rfc/rfc8259.html#section-6) ·
[PostgreSQL numeric types](https://www.postgresql.org/docs/18/datatype-numeric.html) ·
[PostgreSQL JSON types](https://www.postgresql.org/docs/18/datatype-json.html) ·
[node-postgres parameterized queries](https://node-postgres.com/features/queries) ·
[W3C Data on the Web Best Practices](https://www.w3.org/TR/dwbp/)

| Option | Benefit | Cost |
| --- | --- | --- |
| Keep the safe-number guard | Accepts the original numeric input type only | Drops valid lifecycle evidence for large queue IDs |
| Bind all IDs as text | Gives the writer one parameter type | Changes existing safe-ID adapter behavior without a storage benefit |
| Reuse the shared BIGINT normalizer | Preserves safe numbers and exact large IDs | Requires the established two-type representation at JavaScript boundaries |

The recommendation is shared validation at intake, existing parameterized
BIGINT storage, existing claim checks, and independent retained reporting.

## Completion

Reproduce the refusal before changing the writer. Exercise safe IDs,
adjacent large IDs and the maximum in isolated PostgreSQL with lifecycle
updates, stale claim refusal, cleanup and private report lookup. Verify
that malformed IDs cannot reach SQL, and that established reconciliation,
expiry and queue behavior still pass.
