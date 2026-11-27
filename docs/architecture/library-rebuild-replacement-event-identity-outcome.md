# Library rebuild replacement migration event identity outcome

Replacement verifies the event ID returned by insertion and the event
link saved on the locked execution gate before committing. Replay,
cutover, readiness, and the final removal plan carry the exact event ID.
Safe IDs remain numbers and larger IDs use canonical decimal strings.
See the [design and tradeoffs](library-rebuild-replacement-event-identity-design.md).

## Verification

The baseline production database adapter selected `9007199254740993`
exactly, while the detailed receipts reported `9007199254740992`.
Substituting the neighboring ID into the loaded evidence passed the old
readiness check. A fault-injected completion wrote a different event
link, committed replacement, and reported the newly inserted event.

After the change, 112 focused unit tests and 28 isolated PostgreSQL
tests passed. The extended fixture exercises safe, adjacent, and
maximum BIGINT IDs. It checks the exact live lookup, fresh replacement
via cutover, replay, readiness, the final report, and offline validators.
The fixture uses a seeded verification receipt and a simulated expired,
redacted rollback window. The adjacent evidence was substituted after
the exact SQL lookup.

The completion fault now rolls back the new replacement and event.
The prior snapshot capture remains available, and its original intent
stays active. An unsafe insert acknowledgement blocks completion, and
an unsafe stored reference blocks replay.

The production database adapter independently reproduced the exact
event references and rollback behavior. Fresh backend coverage passed
with 64,906 tests, one existing skip, and 89.35% statement coverage.
Unchanged client inputs and a matching report hash verified the prior
client run's 7,751 passing tests and 87.84% statement coverage.
Preflight, lint, type checks, migration integrity, ESM checks, and
the coverage ratchet passed. The three runtime dependency audits
reported zero known vulnerabilities.

## Follow-up

Verify the capture migration event's own BIGINT identifier next.
The snapshot receipt still narrows that ID, and capture completion
currently acknowledges the gate and snapshot. Exercise the captured
event's identity and saved link in isolated PostgreSQL.
