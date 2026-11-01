# Logging persistence fallback outcome

Date: 2026-10-31 (America/New_York). Status: implemented and verified locally on main.
See the separate [design, official research and tradeoffs](logging-persistence-fallback-design.md).

## Implemented behavior

A small logging utility owns a fixed generic notice, one monotonic timestamp and
a sixty-second output bound. `loggerShim` creates one shared reporter for its
current application module instance. The persistence catch invokes it without
passing or inspecting the caught value. This covers preparation, database and
returned-row failures without claiming a specific database/storage cause.

The first valid-clock failure attempts output immediately. The reporter consumes
its interval synchronously before output, preventing concurrent late failures or
reentrant sinks from bypassing the bound. Invalid/throwing clocks suppress output;
reversed times do not erase it. Synchronous and asynchronous sink failures are
swallowed. Reporter state contains no keys, exception, event data or payloads.

Successful writes, missing/replaced database registrations and ordinary warning
dedupe resets do not reset the bound. Every normal INSERT attempt, successful ID,
failure/null result, primary output, warning deduplication and stack/skip policy
remains unchanged. No write retry, replay, queue, spool, recovery announcement,
setting, endpoint, UI, CLI requirement or background job is added. Ownership,
authorization, routing and learning authority remain unchanged. Work stays on
main without a release, deployment, cleanup or service restart.

## Verification

The regression test failed on the old catch: a hostile message getter made direct
`persistToDb` reject. It passes with the fixed fallback, including a throwing
console and reversed completion order across several loggers/direct callers.
Query counts verify that suppressed output does not suppress persistence.

Focused checks passed fifteen suites / 209 tests, covering exact boundaries and
time zero, invalid/reversed clocks, reentrant/throwing/rejecting output, wall-clock
independence, hostile unused payloads, shared state across registration/dedupe
changes, preparation and malformed-result failures, primary-output boundaries and
the existing real Pino transport/redaction checks.

Isolated PostgreSQL checks passed three suites / nine tests. Actual error_log
INSERTs are refused in a read-only transaction and then in its aborted state.
Rollback restores the client; normal sanitized persistence subsequently succeeds
and returns IDs. A second refusal after successful writes/database replacement
does not reset fallback suppression. Existing request-identity and readiness-log
integration tests pass. No physical disk was filled or production database used.

Full backend coverage passed 1,906 suites / 61,804 tests, with one existing skipped
test. Coverage was 89.21% statements/lines, 86.61% branches and 90.73% functions.
The new fallback utility reached 100% across these metrics. The coverage ratchet
passed without baseline changes. It reused the October 30 client coverage report
because client source is unchanged; no fresh client test/build run is claimed.

Backend lint/type checking, both dependency scans, static ESM imports and mock
shape checks passed. The ownership gate passed without changing any review entry
or baseline and retains `productionCompatible: false`; this is not release
evidence. Copyright, four policy gates, Markdown lint, whitespace checks and
staged secret scanning also passed.

Artifact maintenance reused the same-day verified inventory. Current results and
recovery assets remain protected. The disposable PostgreSQL container is gone;
the local Classifarr container retained its identity, image, start time and healthy
state. This batch performed no image build, housekeeping removal or service restart.

## Limits and next item

Only fallback output is limited; normal log-write load is unchanged. The generic
notice deliberately omits individual causes. Restart/new isolated module graphs
lose the interval, and independent processes do not share it. Console delivery
remains best-effort and may block or be lost with its backing stream/shutdown.
Invalid clocks or failed output can therefore hide a fallback notice. No missed
row is replayed and no successful write is treated as proof of recovery.

The database-registration guard and primary sanitization/Pino exception boundaries
remain outside this catch. A separate read-only synthetic probe confirmed a
remaining gap: a cyclic payload makes primary `LoggerShim.error` normalization
reject with a RangeError before either primary output or the database is called.
That gap is not changed or hidden by this fallback.

Recommended next batch: design bounded primary log normalization for cyclic,
hostile and oversized payloads. Establish the retained safe context, redaction,
truncation and failure behavior before changing primary logging semantics. Reuse
the existing logging module and sinks; add no dashboard or operator trigger.
Then reassess remaining readiness cancellation/acquisition boundaries and resume
automatic classification evidence after a separately authorized deployment.

GitHub MCP found no open PRs, including Dependabot; no applicable random PR or
stale dependency PR required local implementation/rebase. Dependencies and the
existing low-severity dependency alert remain unchanged. Unreleased records the
behavior change.
