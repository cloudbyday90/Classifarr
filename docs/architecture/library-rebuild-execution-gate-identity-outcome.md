# Library rebuild execution gate identity outcome

Capture, replay, the replacement event, cutover, readiness, and the
detailed final removal plan now carry the exact execution gate ID.
Safe IDs remain numbers and larger IDs use canonical decimal strings.
Replacement verifies that completion returned the same gate it locked
before committing. See the [design and tradeoffs](library-rebuild-execution-gate-identity-design.md).

Readiness compares the locked gate against the replacement event's
typed JSON evidence. A matching safe legacy number still qualifies.
A neighboring ID or an ambiguous large number produces the existing
replacement-event mismatch.

## Verification

The baseline production database adapter and disposable PostgreSQL
stored `9007199254740993` exactly but reported `9007199254740992`
in the detailed evidence. Readiness accepted the neighboring string.
The receipt and event also rounded the BIGINT maximum. A substituted
completion acknowledgement allowed the replacement to commit and
deactivate the original intent.

After the change, 110 focused unit tests and 22 isolated PostgreSQL
tests passed. The extended rebuild fixture verifies independent gate
and snapshot IDs, capture and replacement replay, event JSON type,
readiness and the detailed audit. All five detailed validators reject
unsafe numeric gate IDs. The fixture uses a seeded verification receipt
and a simulated expired, redacted rollback window.

A mismatched completion acknowledgement now rolls back the replacement
intent and event. The previous gate stays in its snapshot-persisted
state, the captured snapshot remains available, and the original
intent remains active.

The production database adapter independently reproduced the exact
gate references and rollback behavior. Fresh backend coverage passed
with 64,904 tests, one existing skip, and 89.35% statement coverage.
Unchanged client inputs and a matching report hash verified the prior
client run's 7,751 passing tests and 87.84% statement coverage.
Preflight, lint, type checks, migration integrity, ESM checks, and
the coverage ratchet passed. The three runtime dependency audits
reported zero known vulnerabilities.

## Follow-up

Verify the replacement migration event's own BIGINT identifier next.
Readiness still narrows the gate's `replacement_event_id` and the
selected event's ID independently. Test adjacent event IDs and trace
the exact reference into receipts and the final removal projection.
