# Logging persistence fallback design

Date: 2026-10-31 (America/New_York). Status: implemented and verified locally;
see the separate [outcome](logging-persistence-fallback-outcome.md).
Predecessor: [readiness diagnostics outcome](inventory-refresh-readiness-diagnostics-outcome.md).

## Problem and evidence

`persistToDb` currently handles a failed persistence path by printing the caught
value's `message` through `console.error`. That text can expose database paths or
other sensitive content and can repeat for every failed log attempt. Reading a
hostile getter or a null rejection, or encountering a throwing console, can also
make this catch reject instead of returning its documented null result.

The catch includes error extraction, sanitization, context/stack preparation,
the INSERT and returned-row projection. It does not establish database origin or
disk exhaustion. A generic persistence-unavailable notice is therefore accurate;
do not classify the caught value or read any of its properties.

The database-registration guard is before the try block. Public `error` and
`warn` also perform primary sanitization/Pino output before their persistence
try. Those separate exception boundaries remain outside this first batch.

## Agreed contract

Extract a small factory under `server/src/utils/logging`, with an injectable
clock and output sink for tests. The clock is synchronous and numeric; these
injections are test seams, not runtime settings. One reporter instance in `loggerShim` serves
all current logger modules and direct `persistToDb` callers. Its report function
accepts no error or event data. The only fallback output is the fixed text:

> Classifarr log persistence unavailable; check logging and database health.

Reuse the existing `console.error` sink directly, without Pino, LoggerShim,
database calls, dynamic formatting or caller context. Do not emit raw messages,
codes, stacks, SQL, parameters, module names, credentials, paths or event payloads.
Keep normal primary log output and its sanitization/transport unchanged.

Allow the first valid-clock failure immediately, then at most one fallback
attempt every sixty seconds across the current server's reporter. Use a bound
`performance.now` clock rather than wall-clock time. Check and update one timestamp
synchronously at failure completion, before attempting output. This prevents
concurrent delayed completions or reentrant output from bypassing the bound.
An output failure consumes the interval. Invalid/throwing clocks suppress output;
reversed injected times cannot make a repeated-output stream. Swallow synchronous
or asynchronous output failures without recursively logging them.

Successful INSERTs, absent/replaced database registrations and ordinary warning
dedupe resets do not erase this interval. Add no production reset control or
recovery announcement. A new process or isolated module graph starts fresh; this
is not cross-process coordination or a persisted recovery hold.

Limit fallback output only. Preserve every normal persistence attempt, INSERT
and parameter contract, successful ID, failure/null result, no-database behavior,
skip option, warning deduplication and stack policy. Do not retry, replay, queue,
spool or reconnect after an uncertain write. Do not change caller recovery,
ownership, authorization, routing or learning. Fresh setups with no logger database
remain inert; the reporter has no timer, background task or retained payload.

## Resource and failure boundaries

State consists of one optional timestamp and fixed code-owned text. There is no
key/cardinality map, per-module incident state, additional SQL or provider I/O.
Maximum fallback output is one fixed-line attempt per sixty-second interval per
reporter. Normal log INSERT concurrency and database deadlines are unchanged.
The reporter never holds a database transaction while performing new work.

Fallback delivery remains best-effort. The existing console may block or lose
output depending on its backing stream and shutdown timing; this change adds no
durability, flush, stream listener or forced synchronous-write guarantee. It does
not recover missing log rows or establish that logging/storage has recovered.
Other platform error/console paths remain outside this narrow refactor.

No schema, setting, endpoint, UI, routine CLI trigger, release, deployment,
production recovery, cleanup or service restart is added. Work stays on main.

## Official research, tradeoffs and recommendation stack

Sources discovered and read through MCP on 2026-10-31:

- [OWASP logging guidance](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet)
  supports excluding sensitive data, controlling resource exhaustion and testing
  logging failures. Our application is fixed output with independent rate bounds
  and isolation from the persistence result, rather than forwarding another error.
- [Node 24 console documentation](https://nodejs.org/docs/latest-v24.x/api/console.html)
  documents the global console's stderr output and platform/stream-dependent
  synchronous behavior. Our inference: retain the existing sink, bound attempts
  and avoid promising delivery or introducing another recursive logging path.
- [Node 24 performance API](https://nodejs.org/docs/latest-v24.x/api/perf_hooks.html)
  supplies a process-relative high-resolution clock and requires the performance
  receiver. Use its bound method for elapsed-time eligibility.
- [W3C High Resolution Time](https://www.w3.org/TR/hr-time-3/), a September 2026
  Working Draft, distinguishes monotonic elapsed time from adjustable wall-clock
  time. This informs our interval choice; it is not a conformance claim or a
  claim that the draft is a W3C Recommendation. There is no UI/ARIA change.

| Option | Benefit | Cost or limitation | Recommendation |
| --- | --- | --- | --- |
| Fixed generic output with one process-local interval | Removes error-text exposure and bounds fallback noise with minimal state | Omits per-event causes; restart resets bound; output is best-effort | First batch |
| Redact each raw exception | Could retain more cause detail | Arbitrary structures/getters and secret formats need a broader trust contract | Exclude |
| Reuse ordinary warn deduplication | Existing helper | Caller fingerprints and pruning do not provide this independent hard bound | Exclude |
| Retry/spool failed log writes | Could retain more events | Adds disk pressure, uncertainty and lifecycle/ownership complexity | Separate design |
| Harden all primary logging exceptions at once | Broader resilience | Changes public failure semantics beyond this catch | Defer |

Recommended stack: fixed content, independent monotonic rate bound, no recursive
logging, unchanged persistence semantics, then evidence-led review of remaining
logging or readiness boundaries. Keep the operator workflow automatic and quiet.

## Verification and delivery

Test the first failure, exact sixty-second boundary, timestamp zero, invalid and
reversed clocks, delayed/concurrent completions, reentrant/throwing/rejecting sinks
and restart behavior. Verify no caught-value property is read, including null,
primitive and hostile exceptions. Cover preparation and malformed-result failures
without mislabeling them as database faults.

Exercise the real shared reporter across log modules, direct persistence calls,
successful writes and database/dedupe resets. Confirm that attempts continue while
fallback output is suppressed and that failed emissions still preserve null
results. Retain the primary Pino transport/redaction tests.

Use isolated PostgreSQL fixtures for a real error_log INSERT refused by a
read-only transaction, rollback, subsequent successful persistence and pool reuse.
Controlled exceptions may supplement this; do not exhaust a disk or touch live
data. Run focused checks first, then backend coverage/ratchet and applicable
quality gates. Record outcomes separately, update Unreleased, inspect current
PRs and commit/push on main without a release.
