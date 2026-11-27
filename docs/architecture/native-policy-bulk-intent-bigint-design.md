# Exact intent IDs in the bulk native policy reader

## Reproduction

The native policy header and its child tables use BIGINT intent IDs.
The single-policy reader passed each stored ID directly to PostgreSQL
and loaded an authoritative intent at `2147483648`, both sides of a
JavaScript precision collision, and PostgreSQL's BIGINT maximum.
The bulk reader returned SQLSTATE `22003` for each of those valid IDs.
Its five child lookups bind the IDs as `integer[]`. A mixed batch of a
safe policy and a large intent fails as a whole. The normal policy
engine returns an empty active-policy list on that error unless its
caller requests propagation.

A separate disposable test found that rebuild replacement inserted
intent `9007199254740993` and attempted to attach rules to its lower
neighbor. PostgreSQL's deferred purpose-rule constraint rolled the
transaction back. If replacement simply started preserving the new
intent ID, its newly active policy could still fail the bulk reader.
No live data was involved in either test.

## Proposed contract

Bind BIGINT arrays in the five existing bulk lookups for rules,
templates, validation, routing targets, and observed evidence. Keep
the policy-ID query on INTEGER, the existing row ordering and latest
child selection, and exact grouping by the driver-decoded intent ID.
The database adapter already returns safe intent IDs as numbers and
larger IDs as canonical decimal strings.

The same bulk read serves the runtime policy engine, preview, and
native readiness reporting. Its ranked header query and authority
checks still select eligible policies and exclude non-authoritative
intents before child reads. Keep the current error handling and query
fan-out. This batch performs reads and needs no persisted progress,
retry, or migration. Replacement writes and acceptance of large
original IDs have separate authorization and receipt boundaries.

## Research and recommendation

Reviewed November 27, 2026. PostgreSQL documents the distinct INTEGER
and BIGINT ranges and typed array comparisons. Bind parameters through
node-postgres and use the column's type for the intent array. This keeps
the SQL static and preserves exact values through the driver.
[PostgreSQL integer types](https://www.postgresql.org/docs/18/datatype-numeric.html) ·
[PostgreSQL array comparisons](https://www.postgresql.org/docs/18/functions-comparisons.html) ·
[node-postgres query parameters](https://node-postgres.com/features/queries)

I-JSON recommends decimal strings for exact integers outside the
interoperable number range. W3C's locale-neutral data guidance supports
using a single canonical spelling for those strings. The read change
preserves Classifarr's existing representation and public policy shape.
[RFC 7493 §2.2](https://www.rfc-editor.org/rfc/rfc7493.html#section-2.2) ·
[W3C Data on the Web Best Practices](https://www.w3.org/TR/dwbp/)

| Option | Benefit | Cost |
| --- | --- | --- |
| Align the five existing arrays with their columns | Preserves query count, authority checks, and exact grouping | Requires all five queries to agree on the type |
| Fall back to one child-query batch per policy | Reuses the single-policy reader | Adds requests with every selected policy and can obscure a real database error |
| Couple the read fix to replacement writes | Qualifies activation and readback together | Expands a proven read defect into a transaction and replay change |

Align the existing batched SQL with the BIGINT schema first. Then repair
replacement's generated intent ID through dependent writes and receipts
and verify that the committed intent loads on the normal runtime path.

## Verification

Seed a safe intent, the first ID above INTEGER, two adjacent large IDs
on different policies, and the BIGINT maximum in isolated PostgreSQL.
Attach distinct child evidence to the adjacent rows. Check bulk and
single-policy parity, every attached child, latest-row selection, the
number of batched reads, and the normal policy-engine entry point.
Check focused authority tests and the normal local quality gates. Record
results in a separate outcome document.
