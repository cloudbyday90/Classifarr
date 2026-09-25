# Durable cached-evaluation history: outcome

Status: Unreleased, September 25, 2026. See the separate
[design, official sources and option trade-offs](evaluation-history-design.md).

## Delivered

The automatic source-pair worker now emits at most 25 categorical movie/TV case
facts for a completed replay. Publication validates those facts against the window
report and stores them in the same transaction as the accepted singleton result.
Superseded work does not append history. Unchanged evaluations reuse their report.
The computation revision advances once so upgraded installations generate real
case history; historical singleton aggregates are not fabricated into case records.

Three small ESM services own the history contract, persistence and aggregate
projection. Records contain private, revision-scoped hashed item references and
boolean outcome categories. They do not contain media titles, provider IDs,
prompts, responses, destination IDs, model names, endpoints or credentials.

Counts represent distinct selected items and latest completed pairs per item in
each evidence/model/cohort revision. Paired responses may both abstain. Labelled
coverage uses the existing screened correction evidence; it is not an independent
representative gold-standard dataset. Gains/regressions and deferral changes are
descriptive observations, not accuracy or authorization to change routing.

Content-deduplication preserves first-observed retention and separately updates
last-observed ordering. This handles A→B→A outcome recurrence correctly. Retention
is at most 500 distinct result windows and 30 days from first observation. Cache
misses do not erase retained completed pairs. Expired/future rows are hidden on
reads and pruned by the worker; database backups have separate retention.

## API and Command Center

`GET /api/stats/evaluation-history` is authenticated, administrator-only,
rate-limited, parameter-free and `Cache-Control: no-store`. Its database transaction
is read-only with a five-second statement timeout. It returns aggregate counts
for at most six revisions; no private hashes or case rows leave the service.
Database or validation failures produce a fixed 503 response without private
error details. There is no corresponding write, replay or generation endpoint.

The named client API method is exposed through the stats aggregator. Command
Center shows a compact Evaluation progress panel with collapsed detail,
movie/TV coverage, unknown labels, historical timestamps and limitations.
Existing SWR polls every five minutes while visible, using `persist: false`.
Nothing is placed in localStorage. A keyboard-operable pause freezes presentation,
not evaluation; failure/denial still clears even a paused snapshot. Lost access
hides the panel and stops polling. No new frontend dependency was added.

## Verification

- Full backend: 1,437 suites / 42,474 tests passed.
- Full PostgreSQL integration: 162 suites / 1,876 tests passed; one existing
  suite/test skipped. Final focused PostgreSQL rerun covers the ordering fix and
  real worker-to-history publication: three suites / 30 tests passed.
- Full frontend: 383 files / 5,325 tests passed.
- Focused backend: eight suites / 100 tests passed after final changes.
- Chromium regression passed: keyboard disclosure and pause/resume, live refresh,
  lost authorization, zero write requests, no browser persistence and 390px
  mobile layout. Desktop/mobile screenshots were visually inspected. The first
  mobile screenshot caught a test timing issue; the test now waits for the
  existing sidebar transition before checking and capturing the layout.
- Coverage ratchet passed: server statements/lines 90.35%, branches 84.15%,
  functions 92.21%; client statements 85.71%, branches 77.81%, functions 85.27%,
  lines 87.78%.
- A local projection-only benchmark over 500 windows / 12,500 categorical facts
  took 6.4 ms median and 13.2 ms maximum across 20 runs. This excludes database
  and network time and is not a production latency guarantee.
- Type checking, lint, ESM imports, unused-code checks, copyright, documentation
  and migration checks passed. The existing non-literal-file-path lint warning in
  `captureOperatorCorrectionFrozenPolicy.mjs` remains; no new warning is introduced.

Tests use synthetic data and cached/fake responses. No live library was evaluated,
real model called, inference budget enabled or routing setting changed.

## Container verification

The final image `classifarr:evaluation-history-test` built successfully. Its local
manifest digest is `sha256:5272a42344ff10586bd55c8ac657e09102bb7fc79f42c7dd6aaded345ad5babd`.
An upgrade fixture applied the migration; a fresh final-image fixture matched the
generated schema and booted healthy. One earlier fixture was restarted during
initial database bootstrap and reported recovery-mode startup errors; it was
discarded. Subsequent checks waited for a healthy initial boot before restarting.

The final isolated fixture had no host mounts, published ports or external network.
It contained 400 synthetic items across four movie/TV libraries, cached vectors
and 50 synthetic responses; recurring inference remained disabled. Normal
background work drained, and evaluation respected its saved cooldown without
overriding timestamps. At `2026-09-25T21:20:28Z`, the standard worker persisted
25 pairs (13 movies / 12 TV shows) from a 300-item cohort. No eligible labels were
available, correctly yielding zero quality gains/regressions. Restart preserved
the complete history, counts and observation timestamps, with zero provider calls
or reservations. Disposable containers were removed; fixtures can be regenerated.
The user's live container was never changed.

## PR selection and scope

The GitHub MCP query for open PRs in `cloudbyday90/Classifarr` returned an empty
list on September 25, 2026. Therefore no PR could be randomly selected or locally
applied. No PR was merged/closed and no release/version change was created.

## Recommendation and next component

Keep the existing stack: ESM replay services → bounded PostgreSQL history →
administrator aggregate GET → nonpersistent SWR → accessible Vue summary.
The benefit is restart-safe, non-inflated coverage with no new infrastructure;
the trade-off is finite retention and conservative splitting when evidence changes.
Do not compare different revisions as controlled experiments or promote routing
based on unlabelled agreement.

Follow-up implemented: [coverage-gap diagnosis](evaluation-coverage-gaps-design.md)
and [verification outcome](evaluation-coverage-gaps-outcome.md). Selected-but-unpaired
cases now retain fixed causes alongside separate reference-label coverage. Cache
backfill stays under existing admission and budget controls; invalid outputs remain
measured failures, not retries until success. See the outcome for the next component.
