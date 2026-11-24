# Exact History IDs in RAG stage logs

Reviewed November 23, 2026.

## Root cause

Classification persistence returns the saved History ID from PostgreSQL and
passes it to the RAG stage producer as `classification_id`. The database driver
already returns BIGINT values above JavaScript’s safe range as decimal text.
`Number.isInteger` in the stage logger discards that text and can accept a
number that has already rounded to a neighboring ID. The existing compatibility
INSERT also omits the ID when expanded columns are unavailable.

## Options

| Approach | Benefit | Tradeoff |
| --- | --- | --- |
| Repair the native write only | Keeps the normal database INSERT and fixes current schemas. | The existing older-schema fallback still loses the association. |
| Validate at the stage boundary and preserve the ID in fallback metadata | Keeps one validator and makes the ID available to the existing administrator reader on either write path. | Adds one allowlisted field to fallback metadata when an ID is available. |
| Store all IDs as strings throughout the application | Makes the transport type uniform. | Changes established safe-ID contracts across callers and readers outside this repair. |

## Recommendation

1. Reuse `normalizeDatabaseBigintId` at the stage contract. Take the first
   valid value in `classification_id`, `classificationId` order. Keep safe
   IDs numeric, preserve larger IDs as exact decimal text through PostgreSQL’s
   positive BIGINT maximum, and leave events with unusable IDs unlinked.
   [PostgreSQL numeric types](https://www.postgresql.org/docs/18/datatype-numeric.html)
   · [ECMAScript safe integers](https://tc39.es/ecma262/2026/multipage/numbers-and-dates.html#sec-number.issafeinteger)
   · [RFC 8259 numeric interoperability](https://www.rfc-editor.org/rfc/rfc8259.html#section-6)
2. Bind the validated value to the existing typed INSERT. When the existing
   compatibility path runs, serialize only the validated ID as
   `metadata.classificationId`. The administrator list and export already
   read that field when the native column is absent or null. Keep the current
   compatibility trigger and ordinary write-failure behavior.
   [node-postgres parameterized queries](https://node-postgres.com/features/queries)
   · [PostgreSQL error codes](https://www.postgresql.org/docs/18/errcodes-appendix.html)
3. Keep severity, suppression, INFO behavior, fingerprints, redaction, and
   administrator response shapes. This applies W3C’s API compatibility
   guidance to existing consumers. History, correlation, queue, and media
   IDs retain their separate meanings.
   [W3C Data on the Web Best Practices](https://www.w3.org/TR/dwbp/)

Verify adjacent large IDs and the BIGINT limit through the real producer,
PostgreSQL, and the administrator list/export. Verify exact fallback JSON,
invalid input, alias order, normal write errors, and cross-ID deduplication.
Keep the current diagnostic behavior for historical rows and use the existing
schema. Audit web-search provider History writes and reads next.
