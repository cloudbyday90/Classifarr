# Exact rollback snapshot identity during library rebuild

## Evidence

In disposable PostgreSQL, the execution gate stored `9007199254740993`.
Snapshot capture, replay, replacement, cutover, and both migration events
reported `9007199254740992`. After a simulated closed and redacted window,
deletion readiness and the final removal plan accepted that evidence. A
separate run of readiness also accepted the neighboring ID as decimal text.
At the BIGINT maximum, the same projections emitted `9223372036854776000`.

## Design

Use the shared positive BIGINT normalizer for rollback snapshot identity
from the capture insert through both migration events, the replacement and
cutover receipts, deletion readiness, and the detailed final removal plan.
Keep safe IDs numeric and use canonical decimal strings above JavaScript's
safe range. Require exact IDs in the existing output validators.

Check the capture transition's `UPDATE RETURNING` row against the reserved
execution and generated snapshot inside the existing transaction. An
invalid insert or inconsistent completion acknowledgement rolls back the
capture. Fresh replacement uses the saved snapshot reference and verifies
the locked row's identity alongside the existing policy, intent, expiry,
and restore checks. Completed replay uses the saved execution
and retains its existing verification binding and terminal behavior.

Read the replacement event's JSON value as text with its PostgreSQL JSON
type. Safe legacy numeric IDs and canonical strings can match exact
relational evidence. A historical number beyond the safe range lacks
enough information to prove which snapshot the writer meant. Readiness
uses its existing mismatch result for such evidence and for an adjacent
ID. Preserve historical rows. The detailed final plan retains only the
identity that passed readiness, and the live global retirement gate
continues to rebuild its detailed evidence.

The existing operator acceptance, evidence fingerprints, lock order,
rollback lifetime, and independent replacement and removal stages govern
all decisions. Matching replay uses the existing keys and state checks.
The standalone aggregate retirement report describes its aggregate state.
Capture and replay produce bounded receipts. The change uses the existing
schema and internal entry points.

## Research and recommendation

Reviewed November 26, 2026. PostgreSQL `RETURNING` reports values from the
modified row and can verify linkage in the same statement. Existing row
locks provide the transaction boundary for verifying capture and selecting
replacement evidence. PostgreSQL exposes JSON text and type separately,
which lets the reader tell a legacy number from a decimal string.
[PostgreSQL RETURNING](https://www.postgresql.org/docs/18/dml-returning.html) ·
[PostgreSQL row locks](https://www.postgresql.org/docs/18/explicit-locking.html) ·
[PostgreSQL JSON functions](https://www.postgresql.org/docs/18/functions-json.html)

RFC 8259 describes the interoperable range for JSON integers. W3C guidance
on stable identifiers and locale-neutral representations informs the
choice of canonical decimal spelling. The mixed representation is
Classifarr's compatibility choice. [RFC 8259 §6](https://www.rfc-editor.org/rfc/rfc8259.html#section-6) ·
[W3C Data on the Web Best Practices](https://www.w3.org/TR/dwbp/)

| Option | Benefit | Cost |
| --- | --- | --- |
| Repair capture alone | Small producer change | Replacement and readiness can still round evidence |
| Convert every identifier to a string | Uniform JSON handling | Safe-ID consumers face a type change |
| Preserve snapshot identity across the full handoff | Keeps compatible output and requires exact evidence | Historic unsafe numeric events cease to qualify for readiness |

Use the shared normalizer, existing parameterized SQL, an in-transaction
write acknowledgement, typed event evidence, and exact comparison along
the full snapshot handoff. Keep other BIGINT domains and general snapshot
retention provenance for separate reviews.

## Verification

Use the existing services in isolated PostgreSQL. Exercise safe numbers,
adjacent large IDs, and the BIGINT maximum through capture, replay,
replacement, cutover, readiness, and the final plan. Check both stored
event types and their values. Verify that a mismatched capture completion
rolls back, and that a wrong adjacent ID or legacy unsafe number blocks
readiness. Exercise offline validators and the affected quality gates.
