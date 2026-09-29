# OMDb pre-claim admission outcome

Implemented September 29, 2026. No release, version change, migration, provider
settings change or live deployment.

## Delivered behavior

OMDb retry dispatch now inspects at most 50 eligible candidates and reads current
quota before claiming each one. Disabled, missing, invalid or exhausted
configuration leaves pending work untouched. A quota-read failure also withholds
admission. An empty or ineligible queue does not need a quota read.

The existing minute scheduler resumes eligible work after configuration or local
quota recovery, including after restart. There is no new waiting loop, persisted
pause or invented reset. A fully visited page can request one coalesced
continuation; cancellation prevents a stale plan from offering further work.

This is a scheduling optimization, not a new source of authority. ID-targeted
atomic claims, credential/source checks, lease-fenced persistence and per-request
quota reservation remain in force. When settings or usage change after the read,
normal execution safeguards still apply and may persist one legitimate deferral.
An IMDb miss does not authorize a second title request without its own credit.
Existing maintenance of completed, exhausted and expired-claim work still runs.

Fresh setups do not generate provider requests or claim-and-defer churn while
OMDb is unconfigured. Plex, Jellyfin and Emby use the same media-server-neutral
queue path; movie/TV eligibility remains required and music stays excluded.
The existing read-only Vue/SWR readiness view needs no contract or visual change.

## Verification

- Focused backend checks: 75 tests across four suites passed.
- Isolated PostgreSQL regressions: 116 tests across eight suites passed, covering
  retry scheduling/ownership, legacy recovery, credential recovery, quota
  reservation, cache-aware web dispatch and OMDb readiness/admission.
- The 17 new admission integration cases include a strengthened concurrency
  barrier. Two workers both hold claims before reservation; only one
  HTTP request can consume the last credit, and the other preserves its attempts.
- Fixtures prove byte-for-byte queue/configuration/inventory preservation while
  blocked, restart/settings/day recovery, a separately reserved title lookup,
  changed-library rejection, failed quota observations, independent web-search
  progress, maintenance during quota waits and 51-item continuation.
  Requests use synthetic transports and disposable databases, not live accounts.
- Lint, both typechecks, dependency boundaries, copyright, ESM checks and the
  existing 32 YAML/Markdown tooling regressions passed. Policy naming, language,
  delivery and maintenance gates passed.
- The ownership gate passed after reviewing the two changed source fingerprints.
  Claim and result-writing code is unchanged. The service's `shared_writer_debt`
  classification remains unresolved; no new ownership approval or waiver exists.
- Full backend coverage run: 1,541 suites / 46,745 tests executed. Its only
  failure was the ownership-review fingerprint assertion, observed before the
  reviewed metadata update. All other 46,744 tests passed. The affected suite
  was rerun after the update: all 39 tests passed. A broader focused recheck of
  ownership and retry modules also passed all 114 tests across five suites.
- Backend coverage: 90.21% statements/lines, 84.96% branches and 92.02% functions.
  The new planner has 100% coverage on all four metrics.
- Full frontend coverage: 411 suites / 5,795 tests passed; 86.11% statements,
  78.76% branches, 85.56% functions and 88.03% lines. Production build passed.
- The coverage ratchet passed against both fresh reports without changing the
  baseline or thresholds. Documentation lint and whitespace checks passed.

No reported validation failure remains after the focused recheck. The complete
backend suite was not repeated a second time; the report above distinguishes
that initial run from the passing ownership-suite rerun.

## PR disposition

The initial and final GitHub MCP open-PR searches returned no open pull requests
for this repository.
There was no eligible PR to randomly select or implement. No PR was merged,
closed or reopened.

## Recommendation and next component

Retain the existing stack: small ESM services, bounded PostgreSQL reads, atomic
claims/reservations and the existing scheduler. Benefit: fewer unnecessary
claim/status/cooldown writes. Cost: an extra candidate read and a fresh quota read
per offered item; concurrent changes still require execution-time checks. No new
dependency or distributed queue is justified for this fix. See the
[design and official research](omdb-preclaim-admission-design.md) for alternatives,
pros/cons, W3C considerations and the full decision.

Next: **bounded, transactional retry maintenance**. The candidate plan and
expired-claim recovery are bounded, but `resolveRetriesWithExistingMetadata`,
`failExhaustedPendingRetries` and `normalizeTavilyMonthlyDeferredRows` in
`enrichmentRetryMaintenance.mjs` still update every matching row and then
synchronize returned item IDs separately. A large restored/backfilled queue can
therefore create a large maintenance batch before provider admission even runs.

Refactor those existing maintenance paths into small, resumable transactions:
select a bounded set with appropriate row locks, apply only current predicates,
and synchronize derived item state in the same transaction. Use the existing
scheduler, not another daemon or destructive cleanup. Preserve completed
evidence, active/unknown claims and retry budgets. Verify large backlog progress,
rollback, concurrent claims, restart and provider-disabled behavior with real
PostgreSQL. Measure rows changed, elapsed time and memory before choosing limits.
This closes an actual resource/recovery gap rather than adding another dashboard.

Follow-up implemented September 29: see the separate
[retry maintenance design](retry-maintenance-batching-design.md) and
[verification outcome](retry-maintenance-batching-outcome.md). The paragraph above
records the original recommendation, not outstanding implementation work.

Later, evaluate shared OMDb request pacing: its lookup timestamp/promise is still
process-local and recovery probes use a separate transport. Daily credit safety
already remains atomic; do not confuse it with cross-process request spacing or
an upstream account-wide rate guarantee.
