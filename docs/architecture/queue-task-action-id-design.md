# Exact BIGINT IDs for queue task actions

November 26, 2026. The pending and failed queue lists already carry task IDs
as safe JavaScript numbers or exact decimal strings. Before this change, the
retry, dismiss, cancel and manual-classification routes parsed their task path
parameter as a JavaScript number. Adjacent valid BIGINT IDs could then identify
the same row. The parser also accepted an otherwise invalid value when its
prefix contained digits.

## Research and tradeoffs

PostgreSQL BIGINT accepts positive IDs through 9,223,372,036,854,775,807.
RFC 8259 identifies the smaller binary64 integer range through
9,007,199,254,740,991 as interoperable for JSON numbers. ECMAScript defines
`parseInt` to accept a numeric prefix, so it is unsuitable for validating an
entire row selector. The existing node-postgres bound parameters can carry an
exact decimal string to a BIGINT predicate. W3C structural metadata guidance
supports documenting both forms of the ID for consumers.
[PostgreSQL numeric types](https://www.postgresql.org/docs/18/datatype-numeric.html) ·
[RFC 8259](https://www.rfc-editor.org/rfc/rfc8259.html#section-6) ·
[ECMAScript 2026 parseInt](https://tc39.es/ecma262/2026/multipage/global-object.html#sec-parseint-string-radix) ·
[node-postgres queries](https://node-postgres.com/features/queries) ·
[W3C Data on the Web Best Practices](https://www.w3.org/TR/dwbp/)

| Option | Benefit | Cost |
| --- | --- | --- |
| Enforce a safe-integer cap | Prevents rounding with a numeric-only contract | Leaves valid large queue rows unactionable |
| Accept canonical positive BIGINT IDs | Preserves access to all existing rows and safe-ID compatibility | Requires consumers to retain decimal text above the safe range |
| Migrate queue task identity to UUIDv7 | Could support independent identity generation | Requires separate relational, API, fingerprint and replay compatibility work |

## Recommended implementation

The contract applies to `POST /api/queue/task/:id/retry`,
`POST /api/queue/task/:id/dismiss`, `POST /api/queue/task/:id/cancel`, and
`POST /api/queue/tasks/:id/classify`. The decoded path parameter contains only
ASCII decimal digits, starting with `1` through `9`, up to the BIGINT maximum.

1. Reuse the existing server BIGINT normalizer behind a small queue task ID
   entry point. Apply it to the four task path parameters and again at their
   direct service boundaries. Invalid selectors produce the existing 400
   `invalid_task_id` response and fail before a lookup or transaction.
2. Validate before constructing URLs in the four client API methods. Accept
   safe positive numbers or canonical positive decimal strings. Keep large
   strings exact at the browser, HTTP and SQL boundaries. The existing
   pending and failed list responses already support those representations.
3. Keep authorization, SQL parameters and state predicates, the manual
   selection transaction, routing admission, and uncertain outcome behavior.
   Destination library IDs, other queue controls and response bodies retain
   their own contracts.
4. Test exact targeting on adjacent large rows and at the BIGINT maximum
   through the existing HTTP router and real PostgreSQL writers. Check invalid
   selectors, the existing permission boundary, and the manual action's
   no-replay behavior with an isolated provider double.

Astra reviewed the paths independently. The queued routing replay guard
already validates task IDs as exact decimal text. Witness persistence and
sweep polling are a separate follow-up because the saved v1 fingerprint
contains the numeric task ID. Metadata review and identity repair also have
their own task ID limits.
