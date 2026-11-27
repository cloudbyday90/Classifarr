# Library rebuild rollback snapshot identity outcome

Snapshot capture, both migration events, replacement and cutover receipts,
deletion readiness, and the detailed final removal plan now carry the
same exact snapshot ID. Safe IDs remain numbers. Larger IDs use
canonical decimal strings. The capture transaction verifies that its
completion linked the generated snapshot to the reserved execution. See the
[design and tradeoffs](library-rebuild-snapshot-identity-design.md).

Readiness compares the replacement event with the locked execution and
snapshot. Legacy safe numeric values still qualify when they match.
Ambiguous large numeric values and adjacent IDs produce the existing
replacement-event mismatch. The saved audit records remain available
for inspection.

## Verification

The pre-change production database adapter and disposable PostgreSQL
stored `9007199254740993` in the execution and reported its neighbor
through the receipt and event paths. Readiness accepted the neighboring
decimal string and the final removal plan accepted the originally rounded
event. The BIGINT maximum was also rounded.

After the fix, 110 focused unit tests and 17 isolated PostgreSQL tests
passed. They verified exact capture and replay, cutover, the JSON type
and value of both events, readiness, and the detailed final plan through
the BIGINT maximum. Readiness blocked an adjacent string and a matching
large JSON number. All five detailed validators refused unsafe JavaScript
numbers. A mismatched completion acknowledgement left zero committed
execution gates, snapshots, or creation events for that capture.

The production database adapter reproduced the passing handoff for the
adjacent pair and BIGINT maximum. The fixtures used a seeded valid
verification receipt and a simulated expired, redacted rollback window.

Fresh backend coverage passed with 64,904 tests, one existing skip, and
89.35% statement coverage. Unchanged client inputs and a matching report
hash verified the prior client run's 7,751 passing tests and 87.84%
statement coverage. The coverage ratchet, preflight, type checks, lint,
migration integrity, and ESM checks passed. The root, server, and client
runtime dependency audits reported zero known vulnerabilities.

## Follow-up

Investigate the rebuild execution gate's own BIGSERIAL ID. Capture and
replacement receipts, replacement-event metadata, and readiness
comparisons still narrow that separate reference. Test adjacent gate IDs
and their relationship to the cutover and final removal projections in
isolated PostgreSQL.
