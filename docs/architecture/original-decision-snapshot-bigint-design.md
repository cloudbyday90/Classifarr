# Exact History IDs in original-decision snapshots

November 23, 2026 Eastern. This follows the
[Discord completed-correction outcome](discord-completed-correction-bigint-outcome.md).

## Scope and recommendation

Original-decision snapshots previously lost their History reference above
2,147,483,647 even when the correction event and intake receipt retained it.
Extend the existing snapshot envelope to the positive PostgreSQL BIGINT
range. Persist safe IDs as JSON numbers and larger IDs as canonical decimal
strings. Use the same normalized identity in memory and keep the nested capture
version, media identity, and destination fields. Reject noncanonical and unsafe
stored values. The existing JSONB columns and bound sizes support this change.

Reuse the shared snapshot reader and builder in corrections, feedback, intake
receipts, and authorized-outcome evidence. Evaluation compares the snapshot's
History ID with the independently retained row identity when available. Group
using exact IDs, so missing or conflicting evidence can exclude its own row
without merging adjacent values. A retained correction snapshot still supports
evaluation after its correction event is gone. Histories and receipts with
missing source evidence retain an explicit gap.

## Recovery contract

The existing intake sweep examines at most 500 linked, missing-context receipts
within 30 days. Keep its cursor, single-flight behavior, and skip-locked receipt
writes. Decode candidates using PostgreSQL BIGINT and require the embedded
History ID to match the exact linked receipt before copying the saved capture.
Recheck the original capture and typed item at the write, preserving newer live
writes. Absent or invalid originals remain unavailable. A failed batch retains
its cursor and can safely retry the same bounded read. The repair has database
side effects only and has no routing or learning authority.

## Tradeoffs and sources

The number-or-string representation preserves old numeric snapshots and exact
large IDs without a table change. All-string IDs would simplify the type but
would change existing snapshots or require another compatibility layer. A new
envelope would add format negotiation without changing the meaning of the
original decision. Older binaries keep their original range and may reject
newly written large snapshots in reports after a rollback. I-JSON recommends
strings when exact interchange exceeds the safe number range. W3C identifier
opacity applies by analogy: the ID selects the evidence and carries no claim
about what the decision was. [I-JSON](https://www.rfc-editor.org/rfc/rfc7493.html#section-2.2),
[ECMAScript numeric limits](https://tc39.es/ecma262/2026/multipage/numbers-and-dates.html),
[W3C Web Architecture](https://www.w3.org/TR/webarch/#uri-opacity)

PostgreSQL converts recordset fields to their declared types. Pair its BIGINT
conversion with a separate snapshot-to-receipt equality check and deterministic
lock ordering on the existing repair path. [PostgreSQL JSON record conversion](https://www.postgresql.org/docs/18/functions-json.html),
[PostgreSQL row locking](https://www.postgresql.org/docs/18/sql-select.html),
[PostgreSQL integer types](https://www.postgresql.org/docs/18/datatype-numeric.html)

## Verification

Test old numeric snapshots, the former INTEGER ceiling, adjacent IDs above
JavaScript's safe boundary, and BIGINT max. Verify live intake capture, bounded
recovery, rollback and replay behavior, conflicting evidence attribution, and
correction and evaluation readback on isolated PostgreSQL. Confirm malformed
and mismatched snapshots fail closed. A later batch can assess which other
History-facing entry points still need exact ID representation.
