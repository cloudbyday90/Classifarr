# Inventory refresh readiness diagnostics outcome

Date: 2026-10-31. Status: implemented and verified locally on main.
See the separate [design, official sources and tradeoffs](inventory-refresh-readiness-diagnostics-design.md).

## Implemented behavior

Description and representative refreshes opt into a small readiness reader that
reuses the existing SQL and three-second statement timeout. It observes actual
queries and transaction entry/completion failures through existing instrumentation.
An application projection failure inside an unfinished callback cannot acquire
database proof. Other readiness consumers and the shared readiness policy are
unchanged.

A separate diagnostic service mints immutable, weakly tracked capsules containing
only fixed stage/category, incident reference, proven allowlisted SQLSTATE and
bounded database duration. Unobserved codes, raw messages, nested causes and
hostile accessors cannot become database evidence. Cloned or foreign capsules
cannot become logged proof. No raw error or payload is retained in diagnostic
state. Storage-check prose is shared with worker diagnosis, without importing its
one-hour retry statement into readiness warnings.

The existing scheduler loggers emit fixed warnings only for minted
`deferred/unavailable` failures after the readiness wrapper returns. A finite
category/time map enforces at most one warning per category per registered
refresh scheduler per thirty minutes. Successful probes and category changes do
not erase this bound; invalid/reversed clocks cannot cause a warning stream.
Synchronous or asynchronous logging failures remain isolated from work admission.
Normal warning persistence uses no stack capture or raw failure.

Readiness errors remain deferred. Scheduler callbacks still complete normally,
retaining their existing execution receipt meaning. No worker cooldown is started
or cleared; completed cache entries, published private models and genuine retry
debt survive preflight errors. A ready probe permits only ordinary worker checks.
There is no new recovery announcement, API/UI, CLI requirement, job, setting,
schema, provider request, routing change or learning authority. Work stays on main,
without a release, deployment, cleanup or service restart.

## Verification

Focused checks passed thirteen suites / 185 tests. They cover trusted versus
unobserved/spoofed errors, unknown resource codes, transaction and projection
boundaries, fixed redacted evidence, immutable/foreign capsules, exact warning
intervals, clock problems, logger failures, coalescing, stop during a failed probe,
automatic admission, preserved completed caches/private availability and existing
worker retry debt. Existing fresh/disabled/busy and comparison paths remain covered.

Isolated PostgreSQL checks passed four suites / fifteen tests. The two real
refresh runtimes preserve deferral and completed scheduler receipts while their
safe warnings persist. Controlled `RAISE` exceptions exercise SQLSTATE `53100`
and `42501`; actual statement deadlines exercise `57014`. Tests verify rollback,
pool reuse, no heavy lock/provider work and subsequent fresh-setup refusal. They
do not fill a disk or establish physical storage recovery. Existing refresh and
comparison attribution tests also pass.

The broad run also exposed an existing refresh-token test's strict 49-hour upper
bound at the autumn DST transition. Its existing allowance is 47–49 hours. The
test now brackets token creation and includes both endpoints; authentication
code and expiry policy are unchanged. Its entire 47-test suite passed after the
correction. The completed broad execution recorded 1,903 passing suites and one
failing suite out of 1,904; 61,771 tests passed, one failed and one existing test
was skipped. Its sole failure was that old assertion. The final failed-suite
rerun passed all 47 auth tests. No production code changed after the broad run
started, so its complete production-coverage report remains applicable. This is
a broad run plus a successful failed-suite rerun, not a claim that the original
broad execution was all green.

Backend coverage was 89.21% statements/lines, 86.61% branches and 90.73% functions.
The coverage ratchet passed without changing its baseline. It reused the October
30 client coverage report because client source is unchanged; no fresh client
test/build run is claimed.

Backend lint/type checking, both dependency scans, static ESM imports and mock
shape checks passed. The ownership gate initially refused the new indirect-query
adapter as unreviewed. After reviewing its complete source, fixed SQL caller,
transaction helpers, two scheduler callers and integration evidence, the ledger
adds one exact entry and extends the existing diagnostic-wrapper rationale,
classified `unresolved`. The ledger's one-hundred-group limit, existing entries,
baseline revision and classifications remain intact. The final ownership gate
passed and still reports `productionCompatible: false`; this is reviewed drift,
not release-readiness evidence. Copyright, four policy gates, Markdown lint,
whitespace checks and staged secret scanning also passed.

Artifact maintenance reused the same-day verified inventory and preserved current
results and recovery assets. The disposable PostgreSQL container is gone. The
local Classifarr container retained its identity, image, start time and healthy
state. No additional artifact/image removals, builds or service restarts occurred.

## Limits and next item

Warning intervals reset with process restart or scheduler re-registration. They
are diagnostic state, not persisted recovery holds. Logging failure consumes the
current warning interval; failed database persistence is not replayed. The current
logger's own [database-persistence failure fallback](../../server/src/utils/logging/loggerShim.mjs)
is unchanged and can print its raw database error message. This batch bounds its new readiness warning attempts,
not every logging path in the platform.

The preliminary probe still does not forward caller cancellation to its database
read; statement timeout begins after BEGIN. No acquisition deadline or active
query cancellation is newly promised. Returned unavailable states without an
exception do not invent a cause. Ready checks establish neither storage health
nor successful refresh completion.

Recommended next batch: harden the shared logging-persistence failure fallback
with fixed, sanitized output and bounded repetition. Its raw `err.message` output
is a concrete remaining privacy/noise gap during database outages. Preserve the
existing logging failure isolation and persistence semantics; scope that shared
change separately. Then evaluate remaining probe acquisition/cancellation bounds
and return to automatic classification evidence after an authorized deployment.

GitHub MCP found no open PRs, including Dependabot, so no random PR or stale
dependency PR was applicable. Dependencies remain unchanged. Unreleased records
this batch. The existing low-severity dependency alert is not resolved here.
