# Exact History IDs for manual exact-item memory

November 22, 2026 Eastern. Follow-up to the
[resolution learning repair](resolution-learning-bigint-outcome.md).

## Boundary

The manual exact-item memory route currently parses its path parameter with
`Number.parseInt`. It can accept a numeric prefix and round a large History
ID before the guarded command locks a row. The client already forwards the
ID in an empty-body POST, and the guarded command preserves canonical decimal
strings through the lock, source-event key and receipt.

Use the existing positive BIGINT validator on the decoded path parameter.
An invalid parameter returns the existing HTTP 400 response before calling
the command. Safe canonical values keep their numeric command and log
representation. Larger canonical values stay strings through PostgreSQL's
positive BIGINT maximum. The empty-body check, read/write middleware,
actor context, History row lock, final-outcome checks and receipt
transaction keep their existing behavior. The response body and pending
answer safe-integer limit keep their existing contracts.

## Official guidance and tradeoffs

Express decodes route parameters. Validate the full decoded value as a
positive decimal identifier and avoid a second decoding pass. Ordinary
percent-encoding for unreserved digits can address the same item. The decoded
value is still subject to the same decimal and range checks. Distinct History
rows require distinct target identifiers.
[Express request parameters](https://expressjs.com/en/5x/api/request/#req.params),
[RFC 3986, percent-encoding normalization](https://www.rfc-editor.org/rfc/rfc3986.html#section-6.2.2.2),
[W3C Web Architecture, Identification](https://www.w3.org/TR/webarch/#identification)

PostgreSQL supports exact BIGINT values above JavaScript's safe range, and
node-postgres can pass a string parameter through unchanged. RFC 8785
recommends strings when a JSON value requires more integer precision than
binary64 can carry. Keep the existing safe number and exact string convention
at this route boundary.
[PostgreSQL numeric types](https://www.postgresql.org/docs/18/datatype-numeric.html),
[node-postgres data type documentation](https://github.com/brianc/node-postgres/blob/master/docs/pages/features/types.mdx),
[RFC 8785, section 3.1](https://www.rfc-editor.org/rfc/rfc8785.html#section-3.1)

The recommended stack is a bounded shared validator, the existing guarded
command and a row-bound replay receipt. It preserves exact targeting and
existing safe audit values without a schema migration. Consumers handle two
scalar types, and callers using padded or partial IDs must send canonical
values. A safe-only ceiling would keep one scalar type while excluding
otherwise valid completed History rows from the manual operation.

## Verification

Cover partial, padded, zero, nondecimal, overflow and decoded invalid values
before command dispatch. Verify safe number and exact decimal inputs through
real HTTP, including adjacent large targets, the BIGINT maximum and the audit
field. Exercise committed PostgreSQL receipts and evidence, exact replay,
invalid input with no durable effect, and a valid missing row. Verify that
the client forwards the canonical string unchanged. Run focused tests, fresh
coverage and normal quality gates.

The next batch should qualify exact pending-answer fingerprints and
completed-receipt replay before lifting the separate pending-answer limit.
