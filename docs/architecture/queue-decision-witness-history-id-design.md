# Exact History IDs in queue decision witnesses

November 26, 2026. The queue witness repository already stores the
classification History link as a PostgreSQL BIGINT and joins on the exact
value. The reader narrows both returned IDs to JavaScript safe integers.
This withholds an otherwise valid witness above that range. The queued
evaluation report also discards large History IDs in its witness summary.
The maintainer approved addressing both consumers in this change.

## Research and tradeoffs

PostgreSQL BIGINT supports positive integers through 9,223,372,036,854,775,807.
RFC 8259 identifies the smaller range through 9,007,199,254,740,991 as
interoperable across JSON number implementations using binary64. The W3C
recommends documenting data structure for consumers. For this endpoint, that
means specifying the type of both History ID fields and when it changes.
[PostgreSQL numeric types](https://www.postgresql.org/docs/18/datatype-numeric.html) ·
[RFC 8259, section 6](https://datatracker.ietf.org/doc/html/rfc8259#section-6) ·
[W3C Data on the Web Best Practices](https://www.w3.org/TR/dwbp/)

| Option | Benefit | Cost |
| --- | --- | --- |
| Continue withholding large IDs | Keeps the response numeric | Drops usable diagnostic evidence after valid persistence |
| Use decimal strings for every History ID | Gives consumers one type | Changes the type of existing safe IDs |
| Preserve numbers through the safe limit and use canonical decimal strings above it | Preserves exact IDs and existing safe responses | Consumers must handle the documented number-or-string representation |
| Introduce UUIDv7 | Supports a future independent generation requirement | Requires a separate identity, compatibility and recovery design |

## Recommended implementation

1. Reuse the common database ID normalizer for `classificationId` and
   `history.id`. Validate both before comparing them by strict equality.
   Reject invalid or mismatched values with the existing unavailable reason.
2. Use the same normalizer in the queued sweep report summary. Keep the
   report's existing diagnostic fields and the History ID representation
   already carried by its bounded History projection.
3. Keep the endpoint path, queue task ID contract, route authorization,
   parameterized join and ordering, witness fingerprint, and storage
   lifecycle. The larger classification IDs require no schema change.
4. Exercise the Express response backed by isolated PostgreSQL. Read two
   adjacent IDs above the safe boundary for the same task and test the
   latest-witness tie-breaker at equal timestamps. Cover the safe boundary,
   the BIGINT maximum, and refusal of an invalid or mismatched projection.
   Verify the queued report and the existing scoped authorization cases.

Astra reviewed the repository and consumer boundary. The database driver
already retains large BIGINT values as text. That permits the existing
join and tie-breaker to remain the authority for the read. Queue task IDs
also appear in witness fingerprints, request admission and polling. They
need a separate compatibility review.
