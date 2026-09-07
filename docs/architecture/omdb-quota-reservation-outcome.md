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
recycling.
Client changes are explanatory text only, so no new copy-only
test, full client suite or combined coverage ratchet is required for this change.

## Local Compose validation

The no-cache build passed from clean revision
`d501add9f81ca0abd12268a961168d276b6a1c55`. Both dependency installs reported zero
audit vulnerabilities. Before recreation, a 44,517,446-byte custom-format database
backup was copied to ignored local storage, checksum-verified and inspected with
`pg_restore --list`. The previous image is retained locally for rollback.

The recreated container is healthy and reports that source revision. All ten
authenticated smoke GETs returned 200, including masked TMDb/OMDb/Tavily settings.
Anonymous settings, overview, health and overlap requests returned 401. Health and
overlap retained `no-store`, rejected unexpected query parameters with 400, and
remained available with 6,692 inventory rows across ten selected libraries. Their
sample times were 906 ms and 914 ms. History remained at 6,775 records, with ten
libraries, zero feedback records and 250 applied migrations. No migration or
schema regeneration was needed.

The new quota store returned available quota using a PostgreSQL read-only
transaction. The provider integrity audit reported zero invalid providers. The
smoke helper requested zero writes and no provider probes; paid API calls were
not used for validation. Live credentials, configured quota values, backups and
raw logs remain outside committed artifacts.

The startup/smoke sample contained **312 informational records, seven slow-query
warnings, zero provider-drift warnings and zero error/fatal records**. Existing
background work remained enabled; these measurements do not claim provider-side
quota accuracy or that all runtime activity was read-only. The final outcome
documentation is the only difference from the tested image source.

## Open PR availability

GitHub MCP returned no open pull requests at task start and final readback. There
was no population for random selection; no closed PR was substituted or merged.

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
