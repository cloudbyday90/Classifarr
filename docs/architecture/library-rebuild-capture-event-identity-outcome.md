# Library rebuild capture migration event identity outcome

Capture and replay now return the exact migration event ID. Safe IDs
stay numeric and larger IDs use canonical decimal strings. Before
committing, capture verifies the event link returned by PostgreSQL
alongside the locked gate and saved snapshot. See the
[design and tradeoffs](library-rebuild-capture-event-identity-design.md).

## Verification

The production database adapter showed that capture and replay
reported `9007199254740992` for the stored event `9007199254740993`.
The same probe showed rounding at PostgreSQL's BIGINT maximum.
After the change, the database link and both receipts agree for a
safe ID, both adjacent large IDs, and `9223372036854775807`.

The fault-injection control substituted another same-policy capture
event in the completion query. The old path committed the gate and
snapshot with that link. The corrected path rolls back the gate,
snapshot, and new event and preserves the earlier event.

All 114 focused unit tests and 33 isolated PostgreSQL tests passed.
The focused checks cover a malformed insert acknowledgement, an
invalid saved replay reference, and rejection of unsafe numeric
values in the receipt validator. The first integration run reused
event IDs already seeded by the replacement cases. Both suites now
use the shared fixture setup with separate disposable databases.

Fresh backend coverage passed with 64,910 tests, one existing skip,
and 89.35% statement coverage. Unchanged client inputs and a matching
report hash verified the prior client run's 7,751 passing tests and
87.84% statement coverage. Preflight, policy checks, lint, type
checks, migration integrity, ESM checks, and the coverage ratchet
passed. The three runtime dependency audits reported zero known
vulnerabilities.

## Follow-up

Qualify exact verification-run IDs before the rebuild gate's receipt
lookup. The stored selector still crosses a numeric conversion before
the SQL query. Test adjacent runs for the same policy and confirm
that the candidate receipt, saved gate, and returned run agree.
