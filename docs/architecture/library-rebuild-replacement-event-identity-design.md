# Exact replacement migration event identity during library rebuild

## Evidence

In disposable PostgreSQL, the execution gate stored event
`9007199254740993` and the live lookup selected that exact row. The
cutover, replay, readiness, and final plan reported `9007199254740992`.
At the BIGINT maximum the projections emitted `9223372036854776000`.
When the probe substituted the neighboring ID in loaded evidence,
the readiness comparison accepted it.

A fault-injected completion update linked the gate to a different
existing event. Replacement committed and reported the newly inserted
event because its acknowledgement checked only the gate ID.

## Design

Validate the inserted replacement event with the shared positive BIGINT
normalizer. Bind that exact ID to the existing completion update. Use
`RETURNING` to verify the locked gate and saved event link before commit.
A malformed insert acknowledgement or mismatched completion follows the
existing rollback path. The prior capture and active intent remain
available for recovery.

Preserve the exact event ID in fresh and replayed replacement receipts,
cutover output, readiness, and the detailed removal plan. The matching
replay checks include an exact stored event reference. The relational
lookup stays scoped to the saved event ID and policy. Compare the gate
and loaded event using exact IDs in the readiness builder. Require a
valid ID in successful detailed reports and offline validators.

Safe IDs stay numeric. Larger IDs use canonical decimal strings. The
event's own ID comes from relational columns along this path. The
existing typed JSON checks bind the event's gate and snapshot references.
Live global retirement continues to rebuild and validate detailed evidence.
The aggregate describes its aggregate readiness.

Existing acceptance, transaction lock order, verification, authority,
and removal rules govern the operation. Matching replay uses the saved
execution and verification receipt. The change fits the existing
schema and result shapes.

## Research and recommendation

Reviewed November 26, 2026. PostgreSQL row locks protect the existing
transaction boundaries, and `RETURNING` can verify both stored fields
in the same update. Using values from the modified row makes the receipt
depend on the actual saved link. [PostgreSQL row locks](https://www.postgresql.org/docs/18/explicit-locking.html) ·
[PostgreSQL RETURNING](https://www.postgresql.org/docs/18/dml-returning.html)

RFC 8259 identifies the interoperable range for JSON numbers. W3C guidance
on preserving identifiers and locale-neutral representations informs using
canonical decimal strings beyond that range. The mixed representation is
Classifarr's compatibility choice. [RFC 8259 §6](https://www.rfc-editor.org/rfc/rfc8259.html#section-6) ·
[W3C Data on the Web Best Practices](https://www.w3.org/TR/dwbp/)

| Option | Benefit | Cost |
| --- | --- | --- |
| Fix only receipt projections | Small output change | Completion can still acknowledge a different saved link |
| Use strings for every event ID | Uniform JSON type | Safe-ID callers face a type change |
| Preserve and check the link at each boundary | Exact evidence with safe-ID compatibility | Consumers handle two JSON types |

Use the shared normalizer, parameterized SQL, an exact completion
acknowledgement, and strict evidence comparisons. Review the separate
capture migration event ID afterward.

## Verification

Extend the isolated rebuild fixture with safe, adjacent, and maximum
replacement event IDs. Seed the shared event sequence separately for
capture and replacement. Check exact persistence and the normal
scoped lookup, replay, cutover, readiness, and detailed final report.
Refuse an adjacent ID substituted into loaded evidence and unsafe
numbers in offline validation. Substitute a different valid event
link in the completion update and verify rollback while the prior
capture persists. Run the affected backend quality gates.
