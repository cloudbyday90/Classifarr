# Web-search provider record ID outcome

The two provider history readers now preserve their own BIGINT record IDs
in insert results and administrator diagnostics. Safe IDs remain numbers.
Larger IDs are exact decimal strings, and an invalid identity projects as
null. Route UUIDs and linked History IDs remain independent. The settings
view keeps the existing row keys, and its adapter passes through the JSON
values. See the [design and tradeoffs](web-search-provider-record-id-design.md).

## Verification

Before the change, the same two adjacent PostgreSQL IDs were decoded to one
number in both readers. The isolated insert test also showed that the
BIGINT maximum projected as `9223372036854776000`. Its sequence fixtures
restore each sequence to its last safe allocation after exercising the
maximum.

After the change, all 11 PostgreSQL integration cases passed. The new case
checked generated IDs at a safe numeric value, two adjacent large values,
and the maximum through both writers and the authenticated diagnostics
response. It verified the returned order, linked History values, and
separate route UUIDs. Existing integration coverage checked administrator
access and outcome feedback. The focused backend passed 42 tests and the
focused client passed 50. The Vue refresh test reversed both lists and
verified that each row kept its original DOM element. Astra reviewed the
shared projections, fixture isolation, and Vue row identity check.

The initial overlapping runs hit timeouts in the existing Vue lint-contract
setup and a backend policy-route test. The backend case passed in isolation.
The full serial reruns passed with the original deadlines. The backend passed
64,886 tests with one existing skip and 89.34% statement coverage. The client
passed 7,751 tests with 87.84% statement coverage. Preflight, type checks,
lint, the client build, the coverage ratchet, migration integrity, and ESM
checks passed. The root, server, and client runtime dependency audits reported
zero known vulnerabilities.

## Follow-up

Verify native-intent reversion in isolated PostgreSQL. Its writer converts
the migration event's BIGINT ID to a JavaScript number before binding a
reconciliation hold. Determine whether an adjacent event can receive the
hold and whether the transaction rejects the BIGINT maximum. Trace receipt
and reentry readers before changing the durable binding.
