# Manual correction History ID binding

## Decision

The authenticated `POST /api/classification/corrections` transaction
locks the selected History row and records the correction. The learning
executor then uses the projected History ID for a second locked lookup.
In isolated PostgreSQL, correcting `9007199254740993` updated that row,
while exact-item evidence, the outcome link, and the receipt were written
for `9007199254740992`. The projection converted the ID to a JavaScript
number. A correction at `9223372036854775807` failed with SQLSTATE `22003`.

Validate the selector before the first row lock. Accept positive safe
integer numbers and canonical decimal strings through PostgreSQL's
BIGINT maximum. A malformed selector returns 400, and a valid absent
row returns 404. Use decimal text for database identity comparison and
preserve safe numbers and exact large strings in the learning projection.
Check the intake's item and final-outcome item against the locked History
ID before invoking the existing authorized executor. A failed check rolls
back the transaction through its existing authorization failure path.

Keep the current authentication, destination and actor checks, lock order,
atomic writes, and outcome-only behavior for rows without an exact media
reference. Established safe-ID response types, receipt formats and
correction event keys remain compatible. Historical rows stay as recorded.

## Research and tradeoffs

RFC 8259 defines the interoperable integer range for binary64 JSON
consumers. PostgreSQL supports larger BIGINT IDs and cautions about JSON
number precision at interchange boundaries. W3C guidance favors stable
identifiers and compatible data formats.
[RFC 8259 §6](https://www.rfc-editor.org/rfc/rfc8259.html#section-6) ·
[PostgreSQL JSON types](https://www.postgresql.org/docs/18/datatype-json.html) ·
[W3C Data on the Web Best Practices](https://www.w3.org/TR/dwbp/)

PostgreSQL row locks protect the row identified by each query. Identity
agreement has to be checked before the second lookup. Existing same-client
transaction ownership makes a rejected projection roll back earlier writes.
[PostgreSQL row locks](https://www.postgresql.org/docs/18/explicit-locking.html) ·
[PostgreSQL ROLLBACK](https://www.postgresql.org/docs/18/sql-rollback.html) ·
[node-postgres transactions](https://node-postgres.com/features/transactions)

| Option | Benefit | Cost |
| --- | --- | --- |
| Shared validator, exact projection and transaction binding | Preserves existing safe values and checks one row throughout correction | Requires consistent validation at admission and before execution |
| Change only the numeric conversion | Small change to the learning projection | Leaves malformed selectors and later projection errors without an explicit guard |
| Use strings for every ID | One wire type for all values | Changes current safe-ID response types and requires client migration |
| Change generic outcome parsing | Centralizes behavior for more producers | Expands the compatibility boundary across unrelated workflows |

Use the shared BIGINT validator, the existing mixed JSON representation,
and a transaction-local equality check before the executor. Use the
existing API and transaction without a schema or client interface change.

## Verification

Exercise the authenticated HTTP route in isolated PostgreSQL. Verify two
adjacent large IDs and PostgreSQL's maximum, correct receipt and evidence
targeting, safe numeric compatibility, and malformed selectors. Inject a
valid learning projection with the adjacent ID inside the real transaction
and verify rollback. Run the existing authorized outcome and correction
coverage, the client adapter tests, and repository quality gates.
