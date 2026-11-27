# Exact initial native intent establishment outcome

Initial intent establishment now preserves the establishment, intent, and
rollback snapshot IDs through fresh responses, replay, and readiness.
Readiness binds its rules query to the saved intent ID. The native
policy-create summary preserves the exact intent ID. Safe IDs remain
numeric, and larger IDs use canonical decimal strings. See the
[design and tradeoffs](initial-intent-establishment-exact-ids-design.md).

The transaction validates returned identifiers before dependent writes
and verifies that completion returned the reserved establishment. A
malformed reservation acknowledgement aborts the transaction. A genuine
reservation conflict can still recover the matching completed receipt.

## Verification

The baseline stored `9007199254740993` exactly. Establishment and replay
returned `9007199254740992`, and readiness read the lower intent's rules.
At the BIGINT maximum, the write responses rounded the identifiers and
readiness returned 503. The initial HTTP regression also showed a
successful response for a mismatched completion acknowledgement.

All 147 focused unit tests and 32 isolated PostgreSQL tests passed.
The administrator HTTP scenarios cover safe numeric IDs, different rules for
adjacent intents, the BIGINT maximum, lost acknowledgement followed by
exact replay, and rollback using the snapshot returned by readiness.
Injected invalid or missing insert acknowledgements and a mismatched
completion ID left no receipt, intent, snapshot, or migration event.
The fixture uses distinct library names and distinguishes key lookups
from policy lookups so the conflict case reaches the second key read.

The production database adapter also returned both adjacent intents'
own rules and a successful readiness response at the BIGINT maximum.
Fresh backend coverage passed with 64,903 tests, one existing skip, and
89.35% statement coverage. Unchanged client inputs and a matching report
hash verified the prior client run's 7,751 passing tests and 87.84%
statement coverage. The coverage ratchet, preflight, type checks, lint,
migration integrity, and ESM checks passed. The root, server, and client
runtime dependency audits reported zero known vulnerabilities.

## Follow-up

Investigate the library-rebuild snapshot gate next. It converts the
stored rollback snapshot ID in its receipt and in the snapshot creation
event. Trace both into replacement and deletion-readiness checks before
changing those contracts, and reproduce adjacent IDs in isolated
PostgreSQL.
