# Exact task IDs in classifier metadata-failure logs

November 26, 2026. The classifier's metadata-failure projection previously
omitted valid queue task IDs above JavaScript's safe-integer limit. The queue
processor and acknowledgement records already retained the task ID. Astra
traced the missing classifier reference to the projection, before the logger
or PostgreSQL could see it. The maintainer approved fixing that source and
verifying the existing administrator readers.

## Research and tradeoffs

RFC 8259 identifies the binary64 interoperable integer range through
9,007,199,254,740,991. PostgreSQL supports larger BIGINT values and cautions
that JSON clients may lose their numeric precision. Keeping exact large IDs
as decimal text fits the existing JSONB metadata and its JSON readers.
[RFC 8259, section 6](https://www.rfc-editor.org/rfc/rfc8259.html#section-6) ·
[PostgreSQL numeric types](https://www.postgresql.org/docs/18/datatype-numeric.html) ·
[PostgreSQL JSON types](https://www.postgresql.org/docs/18/datatype-json.html)

OWASP recommends preserving event identifiers for correlation, documenting
field types, excluding credentials, and controlling access to logs. W3C API
guidance supports preserving identifiers and existing consumer contracts.
Classifarr uses these principles to retain `metadata.taskId` without changing
its distinct History filter or its existing administrator-only readers.
[OWASP logging guidance](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html) ·
[W3C Data on the Web Best Practices](https://www.w3.org/TR/dwbp/)

| Option | Benefit | Cost |
| --- | --- | --- |
| Keep the safe-integer cap | Keeps all emitted IDs numeric | Drops classifier event correlation for valid large IDs |
| Encode every task ID as a string | Gives readers one type | Changes current saved and exported numeric field behavior for safe IDs |
| Preserve safe numbers and emit large IDs as decimal strings | Keeps existing safe values and exact large references | Consumers must preserve either JSON type |
| Add a queue task filter or relational column | Could support direct cross-event queries | Adds API or storage work beyond restoring the existing diagnostic field |

## Recommended implementation

1. Reuse the shared BIGINT normalizer in the typed classifier failure
   projection. Preserve positive safe IDs as numbers, exact canonical
   decimal strings through PostgreSQL's BIGINT maximum above that range, and
   omission for invalid or already-unsafe inputs. Keep the existing priority
   of the runtime queue task over the fallback context.
2. Use the existing bounded logger and JSONB storage. Keep the failure
   reference, TMDb fields, reason, authorization, redaction, stack boundary
   and retry behavior. The admin detail, bug report and export preserve the
   field. The list and History selectors retain their own contracts.
3. Verify the actual classifier call with a conflicting fallback ID. Exercise
   canonical and invalid values, adjacent IDs and the BIGINT maximum through
   the logger, PostgreSQL and existing HTTP readers. Confirm the diagnostic
   can correlate records without adding untrusted upstream details.

The change is prospective. Earlier records whose classifier projection
omitted the field continue to have no task ID in that event.
