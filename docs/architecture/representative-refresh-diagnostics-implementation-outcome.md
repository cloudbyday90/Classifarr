# Representative refresh diagnostics implementation outcome

## Implemented scope

Implemented the approved
[diagnostic design](representative-refresh-failure-diagnostics-design.md) on main
on 22 October 2026. Small ESM observation and projection modules retain fixed
stages/categories, capped durations, allowlisted SQLSTATE and a per-attempt
incident reference through worker, scheduler envelope and persisted scheduler log.
Raw causes, messages, response bodies, SQL, endpoints, descriptions and vectors
are not included. No schema, endpoint, UI or dependency contract changes.

Query observations preserve error identity. Acquisition/commit failures are
distinguished from unfinished transaction callbacks. In particular, warm consumer
callbacks cannot impersonate PostgreSQL by supplying a SQLSTATE-looking property.
The existing description repository's trusted observation supplies state-read
database attribution. A separately retained deadline signal identifies task
expiry even when fit/admission replace the thrown error; a private per-run origin
retains the inner stage. Cancellation and resource deferral discard observations
without adding failure debt or leaking a stale stage into a later reused error.

The retry module, process-local eligibility, memory admission, provider deadlines,
configuration/revision checks, verification/publication order and no-overlap
rules remain unchanged. Initial state reads still precede retry eligibility; this
change does not silently add backoff around them or persist cooldowns on restart.

## Verification record

Using pinned Node 24.21.0/npm 12.2.0:

- Affected representative, scheduler, readiness/admission, provider and ownership
  regressions: 71 suites / 775 tests passed. The final diagnostic suite then passed
  31 tests after adding a cancellation/error-reuse regression.
- Real HTTP regressions exercise HTTP 503, malformed JSON and cancellation of a
  pending loopback response; no real provider is contacted or inference generated.
- Isolated PostgreSQL attribution plus scheduler lifecycle: 3 suites / 17 tests
  passed. Real statement timeout and explicit self-cancellation both produce
  57014 and persist database_query_cancelled, not an assumed statement-timeout
  cause. Pooled connections remain usable after rollback.
- Server test/security lint, typecheck and normal/production knip passed.
- Copyright, npm CLI flags, static imports, whitespace and Markdown checks passed
  before freezing the source; no coverage-baseline update was performed.

No image acceptance is claimed by this source commit. The final results and
exact frozen-source/image identity will be added after the approved isolated
no-cache rehearsal. The historical
[incident investigation](representative-refresh-failure-diagnostics-outcome.md)
remains distinct: tests cannot reconstruct its discarded original cause.

The new regression suite initially failed because the implementation modules did
not exist. Subsequent test-fixture corrections retained existing behavior: state
reads precede eligibility, each attempt has its own timeout signal, and observer
fixtures implement the existing stop contract. No runtime safeguard was relaxed.

The ownership gate correctly refused the changed repository source digest.
Reviewed the complete three-line instrumentation diff: query text/parameters,
read-only isolation, deadlines, budgets and callback lifetime are unchanged.
All inventory entries except this source digest matched the existing review;
its analysis digest remains
93d6e3fa8502e42affd4fa42cf775c3dfd9c62e7d96ce044398290ea165c0c08,
candidate/gap counts remain 151/348, and comparison_cache_readiness classification
is unchanged. Updated only that reviewed source digest, not the scanner,
classification, parser, baseline revision or any other entry. The gate then passed.

## Open PR and recommendation stack

The current random selection returned the only open PR, #568, already adopted
locally. Its exact pin and integrity remain unchanged; see the separate
[ESLint outcome](server-eslint-10-13-outcome.md). No merge or fabricated update.

1. Retain bounded diagnostics and all existing recovery safeguards.
2. Use the next naturally occurring failure's stage/category/reference to select
   a targeted investigation; unknown remains unknown.
3. Consider retry/deadline/provider changes only after that evidence establishes
   a cause. No live replay, VM recovery, shared-provider request, release or
   production deployment is authorized by this observability implementation.

Full frontend tests, coverage ratchets, remote CI and native ARM image checks are
not claimed. No client code changes are needed. The complete tooling preflight is
not run because its gateway group includes unrelated native Hyper-V checks;
the relevant backend, ownership and static quality gates are run explicitly.
