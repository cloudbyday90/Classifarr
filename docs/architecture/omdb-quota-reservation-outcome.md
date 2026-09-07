# OMDb quota reservation outcome

Date: 2026-09-07. See the separate
[design, official sources and alternatives](omdb-quota-reservation-design.md).

## Result

Configured title, IMDb-ID and search lookups now reserve one local quota unit in
a committed PostgreSQL transaction before each HTTP attempt. The small ESM store
uses the existing provider-writer lock and stable selected configuration ID.
Concurrent workers, configuration saves and backup restores share that protocol.
HTTP and retry delays run outside the transaction. Database admission failures
stop dispatch and cannot enter the provider retry loop.

The local budget uses PostgreSQL statement time in UTC. The first admitted lookup
in a new UTC day resets and increments together. Read-only availability uses the
same calculation. Undated counts are carried forward; null counts represent zero.
Invalid limits, negative counts and future dates fail closed. An exhausted selected
key never causes fallback to another stored credential.

Each retry, not-found result and failed attempt keeps its reservation. The old
post-success increment is removed. A process failure after commit but before HTTP
can consume one unit without a provider call. This conservative accounting avoids
inventing refund rules when provider charging is uncertain. Existing recorded
counts are preserved; previously uncounted failed calls cannot be reconstructed.

Settings copy now identifies recorded local lookup attempts, the UTC reset policy
and separate connection tests. Existing explicit-key health/connection probes and
other applications using the key are outside this local counter. Its value is
neither provider billing usage nor a measure of successful metadata coverage.
There are no new endpoints, schema objects, dependencies or operator steps.
Existing classification routing rules and independent-study readiness gates
remain in force.

## Evidence and validation

The new PostgreSQL regression failed against the original implementation: **12 of
12 concurrent requests were admitted against a limit of three**, with no reservation
persisted. After the fix, exactly three were admitted and nine denied; stored usage
was three. The test uses a private test database and fixture credentials, with no
real provider calls.

The real PostgreSQL quota and provider-configuration suites passed **43 tests across
three suites** in 5.042 seconds. They cover parallel admission, UTC midnight under
UTC/New York/Tokyo session time zones, conservative undated counters, invalid and
missing configuration, maximum integer limits, selected-key exhaustion, rollback,
and concurrent settings/restore with 24 committed reservations.

HTTP dispatch tests separately cover reservation-before-dispatch, commit barriers,
commit/connection failures, not-found results, transient retries and retry denial.
An initial fixture omitted `imdbVotes`, which the existing response formatter
expects; using the provider's `N/A` sentinel completed the fixture. No production
response parsing was weakened to accommodate it.

Server and client typechecks, scoped ESLint, production dependency checks and ESM
static-import/mock-shape checks passed. All **41 existing client provider API tests**
passed in 2.96 seconds. The complete backend run passed **31,217 tests across
1,094 suites** in 192.964 seconds, with two workers and 512 MB idle worker
recycling. Local Compose results will be recorded after the rebuild.
Client changes are explanatory text only, so no new copy-only
test, full client suite or combined coverage ratchet is required for this change.

## Open PR availability

GitHub MCP returned no open pull requests at task start. Final availability will
be checked at delivery; there is currently no population for random selection.

## Recommendation stack and next item

Keep process pacing, committed PostgreSQL reservation, bounded provider attempts,
fresh reservation per retry, fixed SQL and redacted diagnostics. This provides a
cross-worker daily limit without another service or operational workflow. The
tradeoffs are a short serialized write per attempt and possible conservative
overcounting on failures or crashes. Retain this stack unless measured contention
justifies a more complex single-statement/ledger design.

Next, normalize **OMDb provider error responses**. `omdbLookup.mjs` treats every
`Response: False` body as not-found, while `omdbHealth.mjs` treats both True and
False as healthy. Invalid credentials or provider-side exhaustion can therefore
look like missing metadata or healthy service availability. Add a shared bounded
response classifier and tests that distinguish missing titles from authentication,
quota and malformed responses. Preserve existing no-route/pause/fallback behavior;
do not turn unavailable evidence into automatic classification authority.

No release or tag is created.
