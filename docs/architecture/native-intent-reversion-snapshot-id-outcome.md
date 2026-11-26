# Native-intent snapshot and authority identity outcome

The reversion command now validates the exact snapshot selector before it
opens the transaction. It checks both the locked row and the ID returned by
the restore update. Success, replay, and audit metadata retain that same
ID. Safe snapshot IDs remain numeric. Exact matching also applies to the
current and prior intent IDs within reversion. See the
[design and tradeoffs](native-intent-reversion-snapshot-id-design.md).

## Verification

The isolated baseline requested `9007199254740993`, restored its lower
same-policy neighbor, and reported the lower ID again on replay. At the
BIGINT maximum the operation rolled back. The initial HTTP regressions
also showed a malformed selector accepted and both large-authority
restorations refused.

After the change, 42 focused tests and 11 isolated PostgreSQL tests passed.
The real administrator endpoints exercised adjacent snapshots, both
restore targets, the BIGINT maximum for a snapshot and an intent, safe
numeric compatibility, replay, invalid and wrong-policy 404 responses,
and exact audit metadata. An injected mismatched `UPDATE RETURNING` ID
rolled back the completed SQL update and the authority change. The unit
tests refused an adjacent intent that was different from the saved successor.

The expanded regression suite initially rewound the shared test event
sequence after ordinary allocations and ran into duplicate primary keys.
Following Astra's review, the fixture restores the sequence only when
the test explicitly changes it. The PostgreSQL suite passed with that fix.

Fresh backend coverage passed with 64,901 tests, one existing skip, and
89.34% statement coverage. Unchanged client inputs and a matching report
hash verified the prior client result of 7,751 passing tests and 87.84%
statement coverage. Preflight, type checks, lint, migration integrity,
ESM checks and the coverage ratchet passed. The root, server, and client
runtime dependency audits reported zero known vulnerabilities.

## Follow-up

Verify initial intent establishment's rollback snapshot projection. Its
fresh result, replay result, and readiness projection still narrow the
saved snapshot ID to a JavaScript number. Exercise those three surfaces
with the same exact ID before broadening any other producers.
