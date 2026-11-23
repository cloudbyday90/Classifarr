# Exact History IDs in learning receipt validation

November 23, 2026 Eastern. Follow-up to the
[pending-answer replay repair](pending-answer-fingerprint-replay-outcome.md).

## Contract

Exact-item memory and destination evidence share one transaction reader. Both
read the completed Policy Question answer before claiming a learning receipt.
The reader checks its version, fingerprint format, action and destination.
It previously accepted a stored History binding from another row because it
never compared that field with the locked row.

Reuse the existing answer-receipt predicate before loading the destination.
Keep unbound historical answers eligible only for safe positive History IDs.
For larger IDs require an exact binding. A present invalid or mismatched
binding fails using the existing invalid-answer reason, including when a
learning receipt already exists. Leave stored receipts and evidence intact.

Use canonical positive BIGINT strings for direct and intake History selectors,
the locked row ID and source-event IDs. Refuse invalid or conflicting selectors
before SQL. Keep existing event bytes for valid IDs, destination and TMDB ID
contracts, authority, locks, and command replay order. Public pending answer
admission keeps the existing safe-integer ceiling.

## Official guidance and tradeoffs

Check the object identity at the server's decision point on every operation.
W3C Web Architecture's requirement for distinct resource identifiers supports
keeping adjacent History rows distinct throughout the lookup and receipt.
[OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html),
[W3C Web Architecture, Identification](https://www.w3.org/TR/webarch/#identification)

Retain the existing lock and transaction around each evidence write. Use
decimal strings where binary64 cannot carry an exact History ID.
[PostgreSQL explicit locking](https://www.postgresql.org/docs/18/explicit-locking.html),
[RFC 8785, section 3.1](https://www.rfc-editor.org/rfc/rfc8785.html#section-3.1)

The recommended stack is canonical History selectors, locked-row receipt
validation, and the existing learning transaction and replay key. It checks
both learning paths at one point and preserves legacy safe receipts. The
tradeoff is that an unbound large answer cannot authorize learning. A larger
historical ID cannot be recovered from an old rounded fingerprint alone, and
a blanket migration would create claims the stored data cannot verify.

## Verification

Exercise direct and intake selectors, same-row and adjacent-row bindings,
legacy safe and unbound large receipts, the BIGINT maximum, and source event
compatibility. Verify both learning paths refuse a mismatch before destination
lookup. In isolated PostgreSQL verify valid writes, repeat receipt replay,
and refusal without new learning when a previously successful row no longer
has matching answer provenance. Run fresh backend coverage and quality gates.

The next step is to assess exact History ID transport, responses and replay
through web and bulk pending-answer commands before lifting their limit.
