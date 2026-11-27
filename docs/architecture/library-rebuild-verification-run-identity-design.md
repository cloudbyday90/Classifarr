# Exact verification-run identity during library rebuild

## Reproduction

In disposable PostgreSQL, two verification runs shared the same policy,
intent, library, accepted transition, verifier fingerprint, and creation
time. The existing ordering chose `9007199254740993`. Capture committed
an execution gate with the foreign key `9007199254740992`. Independently,
the replacement binding reader was given the upper ID as the stored
selector. It queried the lower ID, returned that row, and passed its
binding checks. No production records were involved.

The verification-run repository and handoff also convert the row ID to a
JavaScript number. Replacement metadata and the removal-readiness
projection repeat the conversion. A database foreign key proves the
referenced row exists. It cannot establish which row capture originally
selected if the application had already rounded that ID.

## Proposed contract

Use the shared positive BIGINT normalizer for the verification run's own
ID. Preserve safe numeric IDs and use canonical decimal strings for
larger IDs. Carry the exact ID through claim, idempotent replay, binding,
capture, replacement, cutover, deletion readiness, and the final plan.
Distinguish an insert that returned zero rows from an insert with an
invalid acknowledgement before following the existing replay lookup.

Capture keeps the selected run and fingerprint in its existing event and
verifies the persisted gate's run ID and fingerprint in the completion
update, along with the gate, snapshot, and event links. A mismatch rolls
back capture. Replacement binds the exact saved ID in its existing
query and checks the returned ID and fingerprint.

A large pending gate requires its saved capture event to corroborate the
run ID and fingerprint before capture replay or forward replacement.
Read that event under the existing transaction and bind it to the
gate's policy, intent, snapshot, and accepted transition. The proof
requires a JSON string for the large run ID. This protects the forward
path if an older capture saved a rounded but otherwise valid foreign key.
An unproven gate follows the existing blocked path and expiry rules.
Pending replay continues to use the pinned ID when a newer valid receipt
exists. Safe legacy gates remain eligible. Completed replacement replay
continues to report the exact saved state without a new write.

Replacement keeps the same metadata field, with the exact JSON value.
Readiness reads the value and its JSON type and refuses unsafe numeric
evidence even when its printed digits match the relational link. The
existing intent, context, fingerprint, audit, rollback-window, and
authorization checks still govern the decision. Historical evidence stays
as recorded. Transaction order, idempotency keys, retention, and schema
stay in place. An uncertain commit follows the existing replay boundary.

## Research and recommendation

Reviewed November 27, 2026. PostgreSQL BIGINT stores the full signed
64-bit range. Use bound query parameters for receipt lookup, SQL row
locks for the stored evidence, and `RETURNING` for capture acknowledgement.
[PostgreSQL integer types](https://www.postgresql.org/docs/18/datatype-numeric.html) ·
[node-postgres parameterized queries](https://node-postgres.com/features/queries) ·
[PostgreSQL SELECT](https://www.postgresql.org/docs/18/sql-select.html) ·
[PostgreSQL RETURNING](https://www.postgresql.org/docs/18/dml-returning.html)

I-JSON recommends strings when exact integers exceed the interoperable
number range. W3C recommends standardized, locale-neutral data values.
PostgreSQL can distinguish a JSON number from a string after extraction,
which allows Classifarr to preserve safe historic data and reject
ambiguous legacy values. [RFC 7493 §2.2](https://www.rfc-editor.org/rfc/rfc7493.html#section-2.2) ·
[W3C data best practices](https://www.w3.org/TR/dwbp/) ·
[PostgreSQL JSON functions](https://www.postgresql.org/docs/18/functions-json.html)

| Option | Benefit | Cost |
| --- | --- | --- |
| Correct only the by-ID lookup | Small change | Capture can still save the neighboring row and downstream evidence can still round |
| Cap rebuild at the safe-integer boundary | Blocks ambiguous large selections | Refuses every valid large run going forward |
| Use exact IDs and corroborate large capture links | Supports the full range with safe-ID compatibility | Requires verification across the rebuild stages and an event read for large pending gates |

Use exact IDs at each boundary, the existing transactional completion
update, and capture-event proof for large pending gates. Verify the
rebuild's separate native intent IDs in a follow-up.

## Verification

Exercise real claim and replay, same-context adjacent runs, and the
BIGINT maximum in isolated PostgreSQL. Check capture and replacement
receipts and stored links through cutover, readiness, and final planning.
Verify rollback on a substituted completion link, exact pinned replay
after a newer run, refusal of a historical unproven pending gate before
replacement, and refusal of unsafe legacy event metadata. Cover safe
historical cases and offline validators. Run the affected quality gates
and record results separately.
