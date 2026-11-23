# Exact History IDs for historic refresh design

November 22, 2026 Eastern. Approved follow-up to the
[ordinary retry outcome](classification-retry-bigint-outcome.md).

## Observed boundaries

Historic refresh reads History in ascending primary-key pages. A cursor and
the two displayed forms of each History ID can round in JavaScript before
they reach the browser. Browser selection narrows IDs again. The command
admits only 32-bit targets, and receipt creation, finalization, result matching,
and reconciliation each have their own numeric conversion. Two adjacent
History IDs beyond the safe integer range must remain distinct throughout.

The receipt already stores BIGINT History references. Its existing recursive
reader follows positive decimal replacement links from saved JSON. It casts
digit text without checking the BIGINT range, so an oversized link can stop
the entire authorized receipt read. Shared pending-answer fingerprints also
contain the existing candidate projection. Widening that shared projection
would change a separate command contract. Astra reviewed these boundaries.

## Agreed change

- Normalize History IDs consistently across inventory, request selection,
  result matching and receipt reads and writes. Accept positive safe integer
  numbers and canonical decimal strings through `9223372036854775807`.
  Keep safe outputs numeric and larger outputs as exact strings. Leave receipt
  UUIDs, actor IDs, task IDs, counts and provider identifiers in their existing
  domains. Reject duplicate selections and retain the limit of fifty.
- Keep the indexed `id > cursor` query, stable ascending order and the existing
  bounded scan and eligibility filters. An absent cursor starts the first
  page. An explicitly malformed cursor returns the existing HTTP 400 envelope.
  Use the exact selected row ID for the historic-only candidate display after
  eligibility. Keep shared pending-answer contracts and fingerprints intact.
- Keep browser selection and navigation exact. Send unchanged wire values
  through the existing client API, buttons and actor-scoped status reads.
- In the existing recursive read, cast only canonical positive digit text
  within the BIGINT range. Use a bounded digit check and byte-order comparison
  for nineteen digits before the cast. Keep the indexed numeric join and the
  eight-hop limit. An invalid link ends that branch at its last valid row, and
  the existing status projection decides what the receipt can report.

## Authority and verification

Inventory and receipt reads stay read-only. Execution retains administrator
and actor checks, the locked current-eligibility recheck, and the existing
receipt creation, queue callback and finalization order. A lost write reply
can leave recoverable receipt evidence. Retain the existing read-only receipt
discovery and polling behavior and the existing one-attempt POST. Keep budgets,
statuses, routing and learning authority, schema, and receipt versions.

Verify exact numeric and string compatibility, adjacent large rows across
pages and in one execution, maximum-range and invalid inputs, duplicates
before receipt creation, expected pending status, wrong actor refusal,
existing valid links, and malformed or oversized stored links with a valid
prefix. Exercise isolated PostgreSQL and HTTP plus browser navigation and
selection, shared answer fingerprint tests, and affected quality gates.

## Official guidance and tradeoffs

Sources checked on November 22, 2026 through the connected search service.
JSON has a widely interoperable safe integer range. Higher precision can
travel as strings, preserving the underlying resource identity and its
existing URI. [RFC 8259](https://www.rfc-editor.org/rfc/rfc8259.html#section-6),
[RFC 8785](https://www.rfc-editor.org/rfc/rfc8785.html#appendix-D),
[W3C Web Architecture](https://www.w3.org/TR/webarch/)

Use a unique primary-key order for bounded pages and a guarded row-dependent
cast for the lineage lookup. Read-only HTTP receipt recovery can safely query
the existing receipt after a lost acknowledgement of an ordinary POST.
[PostgreSQL pagination](https://www.postgresql.org/docs/18/queries-limit.html),
[PostgreSQL expression evaluation](https://www.postgresql.org/docs/18/sql-expressions.html),
[PostgreSQL JSON operators](https://www.postgresql.org/docs/18/functions-json.html),
[RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html#section-9.2.2)

The recommended stack uses exact decimal text at unsafe JSON boundaries,
existing BIGINT storage and indexing, and the existing actor-bound receipt.
It preserves old values and avoids a migration. The cost is a mixed JSON ID
type and a coordinated server/client change. Changing all IDs to strings
would simplify new consumers while changing established response types.
Keep UUIDv7 as a separate decision tied to a concrete identity requirement.
