# Native-intent reversion event identity outcome

The rollback event ID now stays exact from PostgreSQL `RETURNING` through
hold creation, active hold selection, and reentry audit metadata. The
hold upsert requires a `rollback_applied` event for the same policy. The
existing transaction rolls back if that write cannot bind its event.
Reentry validates its approval event ID before releasing the hold. The
JSON representation remains numeric for safe IDs and uses strings for
larger IDs. See the [design and tradeoffs](native-intent-reversion-event-id-design.md).

## Verification

The pre-change PostgreSQL probe showed a rollback event with ID
`9007199254740993` committing a hold bound to `9007199254740992`, a
different policy's dry-run event. The approval audit and candidate
projection also rounded an independently seeded exact source. With the
BIGINT maximum, PostgreSQL rejected the rounded value with SQLSTATE
`22003`, and the service rolled back. The authenticated regression suite
reproduced the adjacent misbinding and the HTTP 503 at the maximum.

After the repair, 47 focused unit tests and seven PostgreSQL integration
tests passed. These include authenticated reversion and reentry for a
safe ID, the adjacent large event, and the BIGINT maximum, along with
member refusal, stored hold selection, exact approval metadata, and
completed-request handling. A wrong-kind event was refused. Substituting
a wrong-policy event at the hold write rolled back the authority change,
snapshot update, and new migration event. Invalid diagnostic identity
does not re-admit a held candidate. Astra reviewed the exact reference,
transaction boundary, and lifecycle output handling.

Fresh backend coverage passed with 64,891 tests, one existing skip, and
89.34% statement coverage. The unchanged client inputs and report hash
matched the previous passing run of 7,751 tests at 87.84% statement coverage.
The coverage ratchet, preflight, type checks, lint, migration integrity,
and ESM checks passed. The root, server, and client runtime dependency
audits reported zero known vulnerabilities.

## Follow-up

Earlier holds remain as recorded. The current data alone cannot establish
which event a previously rounded value was intended to reference.

Verify the separate rollback snapshot selector next. It narrows BIGINT
values before the initial lookup and again when marking a snapshot restored.
Test exact targeting, replay, and prospective refusal in isolated
PostgreSQL before widening that contract.
