# Exact execution gate identity during library rebuild

## Evidence

The execution table uses a BIGSERIAL primary key. In disposable PostgreSQL,
the gate stored `9007199254740993`, while capture, replay, cutover,
replacement metadata, readiness, and the final plan reported its lower
neighbor. Readiness also accepted that neighbor as a decimal string.
At the BIGINT maximum, the projections reported `9223372036854776000`.

A real replacement transaction also committed after its completion
acknowledgement was replaced with a different valid gate ID. The earlier
snapshot was still present, and the original intent was deactivated.

## Design

Reuse the shared positive BIGINT normalizer for the execution gate's own
ID. Keep safe IDs numeric and use canonical decimal strings above
JavaScript's safe range. Preserve the ID through capture and replay,
replacement and cutover receipts, both detailed removal projections,
and the replacement event's `executionGateId` field. Require exact IDs
in the corresponding output validators.

Validate the locked gate ID before replacement writes. Bind completion
to that exact ID and check the existing `UPDATE RETURNING` result inside
the transaction. On mismatch, use the existing rollback path. A
previously committed snapshot and its gate remain available. Completed
replay uses the saved gate and current verification binding.

Read the replacement event's JSON text and type. Safe legacy numbers
and canonical decimal strings can qualify when they match the locked
gate. An unsafe historical number or a different gate ID produces the
existing replacement-event mismatch. Keep historical records available
for inspection. The same typed comparison applies to the saved snapshot
reference. Live global retirement continues to rebuild the detailed
evidence. Its standalone aggregate describes aggregate readiness.

Existing acceptance, transaction lock order, replay keys, verification,
authority, snapshot expiry, and removal rules govern the operation.
The repair uses the existing schema and internal services.

## Research and recommendation

Reviewed November 26, 2026. PostgreSQL BIGSERIAL uses a BIGINT column.
Its `RETURNING` clause can verify the actual row updated in the same
statement. PostgreSQL JSON functions expose a value's text and type
separately, which lets Classifarr distinguish a stored number from a
decimal string. [PostgreSQL numeric types](https://www.postgresql.org/docs/18/datatype-numeric.html) ·
[PostgreSQL RETURNING](https://www.postgresql.org/docs/18/dml-returning.html) ·
[PostgreSQL JSON functions](https://www.postgresql.org/docs/18/functions-json.html)

RFC 8259 identifies the interoperable JSON integer range. W3C guidance
on stable identifiers and locale-neutral representations informs the
choice of canonical decimal spelling. The mixed representation is
Classifarr's compatibility choice. [RFC 8259 §6](https://www.rfc-editor.org/rfc/rfc8259.html#section-6) ·
[W3C Data on the Web Best Practices](https://www.w3.org/TR/dwbp/)

| Option | Benefit | Cost |
| --- | --- | --- |
| Fix the receipts alone | Small projection change | Readiness and acknowledgement still accept inexact evidence |
| Use strings for every gate ID | Uniform artifact type | Safe-ID consumers face a type change |
| Preserve and validate the exact gate throughout | Protects completion and evidence while retaining compatibility | Unsafe historic numbers cease to qualify for readiness |

Use the shared normalizer, the existing bound update and acknowledgement,
and typed audit evidence across the detailed contracts. Review the
replacement migration event's own ID as a separate identity boundary.

## Verification

Extend the existing rebuild integration fixture with safe, adjacent,
and maximum gate IDs. Check capture, replay, cutover, stored event type
and text, readiness, the final plan, and offline validators. Reject a
neighboring string and a matching unsafe JSON number. Substitute a
different completion acknowledgement and verify rollback of replacement
while the prior snapshot persists. Run the affected backend gates.
