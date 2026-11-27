# Exact native intent change receipt identity

A disposable PostgreSQL probe used the real receipt builder, insert, and
locked lookup with two adjacent intents and migration events. Given
`9007199254740993` for both links, the old builder saved
`9007199254740992` in both foreign keys. The neighboring records existed,
so PostgreSQL accepted the receipt. The returned receipt ID also rounded.
Invalid foreign keys would instead have caused the transaction to fail.

## Proposed contract

Use the shared positive BIGINT validator for the receipt ID, target
intent ID, and migration event ID. Keep safe IDs numeric and larger IDs
as canonical decimal strings. Normalize the new intent before dependent
writes and use its exact ID for the existing response fields. Preserve
the command fingerprint, request, actor, policy, and revision contracts.
The receipt's own ID stays private.

Bind the new migration event to the native change with a domain-separated
SHA-256 digest over the admitted idempotency key, existing command
fingerprint, and target intent ID. Keep the raw key and command fingerprint
out of event metadata. This is a same-attempt check inside Classifarr's
trusted storage. The event and receipt writes must acknowledge the expected
target, event, and receipt context before commit.

An existing receipt always owns its key. Malformed saved data fails before
any fresh mutation. A matching receipt with a large target intent or event
link needs its exact stored event, policy, actor, versions, target intent,
and attempt digest to agree before replay. A neighboring intent and event
can form a coherent pair, so relational consistency alone cannot identify
the original attempt. Historical receipts with unproven large links return
the existing unavailable response. A large receipt primary key alone can
replay with safe links. Safe legacy receipts keep their current behavior,
including replay after a later policy revision. Keep the existing
advisory key lock, row locks, stale-revision checks, retention window,
and uncertain-commit retry behavior.

## Research and recommendation

Reviewed November 27, 2026. PostgreSQL supports exact signed BIGINT values
and exposes stored values in `RETURNING`. Verify the links returned by each
write before the existing transaction commits. I-JSON recommends strings
for integers outside the interoperable numeric range. W3C guidance about
data provenance and locale-neutral representation supports decimal strings
for high IDs and an attributable stored link.
[PostgreSQL numeric types](https://www.postgresql.org/docs/18/datatype-numeric.html) ·
[PostgreSQL RETURNING](https://www.postgresql.org/docs/18/dml-returning.html) ·
[RFC 7493 §2.2](https://www.rfc-editor.org/rfc/rfc7493.html#section-2.2) ·
[W3C data best practices](https://www.w3.org/TR/dwbp/)

| Option | Benefit | Cost |
| --- | --- | --- |
| Widen the ID conversions alone | Repairs new receipt formatting | Cannot distinguish a historically rounded receipt from an exact replay |
| Verify writes and require attempt evidence for large replay links | Keeps exact results and blocks ambiguous replay | Adds one event metadata field and one indexed read for affected replays |
| Rewrite existing receipts or expand database constraints | Could standardize future enforcement centrally | Needs a migration and independent proof for each historical link |

Use the shared validator, the existing receipt and event persistence
modules, and the current transactional idempotency owner. Keep the
established response fields and safe JSON types. Leave stored history
intact and retain the current receipt-discovery and observation contracts.

## Verification

Exercise the production writer and authenticated replay in isolated
PostgreSQL. Verify safe IDs, different adjacent target/event/receipt
IDs, the BIGINT maximum, later-revision replay, actor and command
conflicts, and lost commit acknowledgement. Store a neighboring reference
during an event or receipt write and verify rollback. Test a historical
large receipt with a coherent but unproven neighboring pair and verify
that replay stops without a new write. Verify safe legacy receipt replay
and run the affected backend and client checks.
