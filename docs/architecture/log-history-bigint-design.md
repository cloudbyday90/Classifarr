# Exact History IDs in application logs

Reviewed November 23, 2026.

## Cause and scope

The log filter parsed the requested History ID as a JavaScript number and
cast saved IDs to PostgreSQL `integer`. The list projection also used that
cast, so a valid History ID above `2147483647` could fail an unfiltered page.
The database column already supports `bigint`.

Keep the administrator routes `GET /api/logs` and `GET /api/logs/export`. Accept either
`classification_id` or `classificationId` as one canonical positive decimal
string through `9223372036854775807`. Both aliases may appear if their values
agree. Explicit empty values, repetitions, bracketed forms, conflicting
aliases, leading zeros, and out-of-range values receive a fixed `400` before
the log query. Omitting both keys leaves the list unfiltered by History ID.
The message identifies the field and its accepted format, consistent with the
W3C guidance on identifying input errors in text.
[Express request query](https://expressjs.com/en/5x/api/request/)
· [PostgreSQL numeric types](https://www.postgresql.org/docs/18/datatype-numeric.html)
· [W3C error identification](https://www.w3.org/WAI/WCAG22/Understanding/error-identification)

## Approaches

| Approach | Benefit | Tradeoff |
| --- | --- | --- |
| Compare canonical text | Matches the full BIGINT range without casting saved values. Preserves legacy digit strings with leading zeros. | Keeps the existing per-row expression rather than using a direct native-column index lookup. |
| Guard a BIGINT cast with `CASE` | Produces a native type in the projection. | Must express a total grammar and range guard in SQL. A separate regex condition does not guarantee evaluation order. |
| Normalize saved data and add an indexed lookup | Could improve selective filters if measured hot. | Requires migration, compatibility work for raw exports, and a policy for malformed history. |

PostgreSQL's JSON text extraction lets the query compare saved values before
JavaScript parses the JSON. PostgreSQL may reorder Boolean conditions, so the
filter must be safe for every saved value without relying on predicate order.
[PostgreSQL JSON operators](https://www.postgresql.org/docs/18/functions-json.html)
· [PostgreSQL expression evaluation](https://www.postgresql.org/docs/18/sql-expressions.html)

## Recommendation

1. Reuse the shared BIGINT validator for request admission. Bind the result as
   text and compare using the `C` collation after stripping leading zeros from
   saved values. Preserve native-column precedence and the legacy metadata
   fallback where the column is null or absent.
2. Project bounded candidate text for the list and reuse the existing JSON ID
   normalization. Positive safe integers remain numbers, larger IDs are exact
   decimal strings, and unusable saved IDs become `null`.
   [RFC 8259, numeric interoperability](https://www.rfc-editor.org/rfc/rfc8259.html#section-6)
3. Share admission and matching across count, list, and export. Keep the raw
   export payload, including its existing legacy JSON metadata decoding. Keep
   detail, report, authorization, pagination, and retention behavior.

Verify the real router with PostgreSQL records at the integer boundary, the
JavaScript safe-integer boundary, adjacent larger IDs, and the BIGINT maximum.
Cover padded legacy values, invalid stored values, alias agreement, raw export
shape, exact counts, and authorization before log access. Verify the client
adapter forwards large IDs verbatim. Use the existing schema and identity
contract. Inventory diagnostic producers before choosing a UUIDv7 contract.
