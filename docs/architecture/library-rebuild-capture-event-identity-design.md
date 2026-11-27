# Exact capture migration event identity during library rebuild

## Evidence

Disposable PostgreSQL stored and joined the exact capture event
`9007199254740993`. The fresh and replayed receipts reported
`9007199254740992`. At the BIGINT maximum, both reported
`9223372036854776000`. The downstream orchestrator checks the capture
receipt's validity and uses the saved gate for the replacement stage.

A fault-injected completion update linked the gate to a different
existing event from the same policy. The transaction committed the
gate, snapshot, and new event, and the receipt described the inserted
event. The acknowledgement covered the gate and snapshot IDs.

## Design

Validate the inserted migration event ID with the shared positive
BIGINT normalizer before binding the gate update. Extend the existing
`RETURNING` clause to confirm the saved migration event reference
alongside the gate and snapshot. An invalid insert acknowledgement
uses the existing migration-event failure. A mismatched completion
uses the existing transaction failure and rolls back all three writes.

Carry the exact event ID through fresh capture and matching replay.
Require the ID in successful snapshot gate receipts and audits.
A persisted gate with an invalid event reference blocks reuse through
the existing unsafe-evidence path. Safe IDs remain numbers and larger
IDs use canonical decimal strings. The existing event link is a
relational foreign key, and the current audit metadata describes
the snapshot and the accepted transition.

The existing policy and intent locks, acceptance and expiry rules,
verification receipt, and replay key govern admission. Capture and
its acknowledgement stay inside the current transaction. A matching
completed request recovers its persisted gate without a second
capture. This design fits the existing schema and internal interfaces.

## Research and recommendation

Reviewed November 27, 2026. PostgreSQL `RETURNING` can expose the actual
event foreign key in the existing update. Transaction atomicity keeps
the gate, rollback snapshot, and migration event together if the
acknowledgement fails verification. [PostgreSQL RETURNING](https://www.postgresql.org/docs/18/dml-returning.html) ·
[PostgreSQL transactions](https://www.postgresql.org/docs/18/tutorial-transactions.html)

RFC 8259 identifies the interoperable integer range for JSON. W3C
guidance on stable identifiers and locale-neutral representations
informs the canonical decimal spelling outside that range. The mixed
representation is Classifarr's compatibility choice.
[RFC 8259 §6](https://www.rfc-editor.org/rfc/rfc8259.html#section-6) ·
[W3C Data on the Web Best Practices](https://www.w3.org/TR/dwbp/)

| Option | Benefit | Cost |
| --- | --- | --- |
| Repair the receipt alone | Small projection change | Completion still lacks proof of the stored event link |
| Use strings for every event ID | Uniform artifact type | Safe-ID consumers face a type change |
| Preserve exact IDs and verify the stored link | Correct capture and replay with safe-ID compatibility | Consumers handle two JSON types |

Use the shared normalizer, bound SQL parameters, an in-transaction
acknowledgement of all three IDs, and exact receipt validation. Review
the stored verification-run selector as the next identity boundary.

## Verification

Use the existing isolated PostgreSQL fixture with safe, adjacent, and
maximum capture event IDs. Check the saved foreign key, selected event,
fresh and replayed receipts, and offline validation. Substitute a
different existing event into the update and verify that capture
rolls back while the preexisting event remains. Verify unsafe insert
and replay references with focused tests, then run the affected
backend quality gates.
