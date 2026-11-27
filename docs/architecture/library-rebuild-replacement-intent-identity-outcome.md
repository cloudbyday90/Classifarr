# Exact generated intent IDs during library rebuild replacement outcome

Replacement now carries the generated intent ID through every dependent
write. The transaction checks both the predecessor link and the gate's
successor and event links. The existing replacement event stores the
exact intent ID for completed replay and removal readiness. Safe IDs
stay numeric and larger IDs use canonical decimal strings. See the
[design and tradeoffs](library-rebuild-replacement-intent-identity-design.md).

## Verification

The production database adapter originally inserted
`9007199254740993`, attempted a child write to `9007199254740992`,
and rolled back at PostgreSQL's deferred purpose-rule check. The
corrected transaction committed the exact upper ID, attached the rule
to it, and left the neighboring row untouched.

A separate isolated probe substituted a neighboring ID in a completed
gate. The old replay and readiness paths accepted the inconsistency.
The corrected paths blocked both. Large historical receipts require
typed evidence in the saved event. Safe historical receipts remain
readable without that field.

The PostgreSQL suite verifies the predecessor and gate links, the
event and its typed metadata, rules, routing, validation, and normal
policy-engine readback at the tested boundaries. The removal fixtures
simulate an expired, redacted rollback window. A different successor
in either real completion update rolls back the replacement and
keeps the original intent active. A real reversion restored the
original authority, cleared its successor link, and left completed
replacement replay available through the saved event.

All 47 focused PostgreSQL tests and 117 focused service tests passed.
The seven replacement-intent cases also passed after adding an
explicit PostgreSQL replay control for a safe legacy event.

Astra identified a detached readiness case where filtering invalid
IDs could hide a second active row. The evaluator now counts every
returned row before checking the sole active ID. The database's
unique active-policy index also remains a guard for persisted rows.
Original-intent admission and purpose lifecycle reporting retain
their existing scope.

Fresh backend coverage passed with 64,936 tests, one existing skip,
and 89.33% statement coverage. The unchanged client inputs and
matching report hash verified the previous run's 7,751 client tests
and 87.84% statement coverage. The coverage ratchet, preflight,
ownership, lint, type, migration, and ESM checks passed. All three
runtime dependency audits reported zero known vulnerabilities.

## Follow-up

Qualify exact original-intent context through acceptance, rollback
fingerprints, migration verification, and capture. The isolated
baseline already shows that a valid large original can round before
the rollback plan check. Preserve safe fingerprint bytes and require
independent proof for any historical large acceptance before it can
authorize a write.
