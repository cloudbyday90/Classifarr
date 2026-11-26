# Manual correction History ID outcome

The existing authenticated correction endpoint now validates a positive
PostgreSQL BIGINT History ID before any row lock. It returns 400 for a
malformed selector and retains 404 for a valid ID with no matching row.
The correction's learning intake keeps safe IDs as numbers and larger
IDs as exact decimal strings. Both the intake item and its final outcome
must identify the locked History row before the executor can persist them.
See the [design and tradeoffs](manual-correction-history-id-design.md).

## Isolated verification

Before the fix, an authenticated correction for `9007199254740993`
changed the selected row but persisted its outcome on `9007199254740992`.
A second direct transaction probe confirmed the adjacent row received
the receipt and exact-item memory. An out-of-range conversion at
`9223372036854775807` caused a 500 from the route. The four new PostgreSQL
regressions failed against that version.

After the fix, the authenticated route applied both large corrections
with the selected row's outcome, matching source-event receipt and
evidence for its TMDb ID. The adjacent row remained unchanged. An injected
intake with a different valid ID rolled back the earlier History and
correction writes and left no receipt or learning evidence. The route
refused malformed selectors and retained existing authentication,
destination validation, and safe numeric responses. The client adapter
retained the exact value in the request body. Astra reviewed the row
binding and verified safe and large outcome-only projections.

Focused verification passed 69 backend unit cases, 62 isolated
PostgreSQL cases, and 29 client API cases. The npm runtime audit reported
zero vulnerabilities in each workspace and the root package.

The backend coverage run passed 64,863 tests with one existing skip and
89.34% statement coverage. Two unchanged Vue tooling suites timed out on the
first full client run. Both passed in isolation, and the full client rerun
passed 7,750 tests at 87.84% statement coverage. The rerun used two local
workers with the existing test deadlines and assertions. The coverage ratchet,
type checks, server, client and Markdown lint, client build, migration integrity,
and ESM import and mock-shape checks passed.

## Follow-up

Historical outcomes remain as recorded. An audit or repair of historical
links would require evidence of both the intended row and the associated
receipt before any mutation.

Qualify the optional History selector in the administrator pgvector recall
audit next. Its parser rejects exact IDs above the JavaScript safe range,
although its PostgreSQL filter and returned rows already support BIGINT.
Preserve sample and result limits and verify exact targeting in PostgreSQL.
