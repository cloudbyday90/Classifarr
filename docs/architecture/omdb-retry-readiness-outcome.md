# OMDb retry readiness outcome

Implemented September 29, 2026. No release, version change, migration or live
deployment is part of this change.

## Delivered behavior

The Command Center's retry view now offers Web search or OMDb through a native
labeled selector. Only the selected observer is mounted and polling. Pause
carries across selection; late responses from the previous observer are ignored.
Neither selection nor observations are persisted in browser storage.

OMDb shows five labeled categories in the visual breakdown, local request usage
when known, and a relevant next action. There is no fictitious cache-ready
category. Zero counts remain in the text legend without drawing chart slivers.
Stale or unavailable observations hide the chart, budget and action; authorization
loss clears the observation and stops its polling. Display controls do not stop
or trigger background retries.

The new administrator-only fixed GET endpoint inspects at most 50 pending OMDb
rows, with one extra row detecting partial coverage. It reuses the worker's
structural, source-identity, library, attempt, credential and timing predicates.
It reads OMDb's own cooldown and quota policy in a read-only transaction, with
local timeouts, 30-second server caching and single-flight coalescing.
It does not claim work, reserve requests, contact OMDb, reset saved usage or
change settings. The existing web-search endpoint remains compatible.

OMDb is not equivalent to web search: it has no retry-result cache, and one retry
can require both IMDb and title lookups. Ready means eligible for another worker
check, not that requests have been reserved for every ready row. The local daily
budget is not OMDb's upstream account balance. Older dated usage resets logically
under the existing policy without a database write; undated exhausted usage has
no promised reset. Configuration failures suppress retry-time estimates, and an
exhausted budget prevents an estimate earlier than its known local reset.

## Validation evidence

- Focused backend checks: 59 tests across five suites passed.
- Full backend: 1,540 suites / 46,706 tests passed with coverage (90.20%
  statements, 84.95% branches, 92.01% functions and 90.20% lines).
- Frontend: 411 suites / 5,794 tests passed with coverage (86.10% statements,
  78.74% branches, 85.56% functions and 88.02% lines). The coverage run generated
  its HTML and JSON reports directly. Final component checks also passed after
  correcting test-stub prop declarations reported by lint.
- PostgreSQL: 36 tests across OMDb readiness, OMDb quota admission and cache-aware
  retry dispatch passed. The new OMDb tests preserve queue/configuration rows,
  exclude private fields, separate provider cooldowns, distinguish dated and
  undated usage, enforce partial coverage and item safeguards, and prove that
  observing two ready rows cannot reserve the last remaining request twice.
- Chromium: the synthetic browser scenario passed with no mutation requests or
  persistent readiness cache. Desktop and 390/320-pixel layouts, keyboard pause,
  provider selection and failure presentation were checked. Screenshots were
  inspected; this is not a complete WCAG conformance audit.
- The production client build, both typechecks, preflight dependency boundaries,
  static ESM import checks, ESM mock-shape checks, lint and documentation lint
  passed. Existing policy naming/language/delivery/maintenance gates also passed.
- The ownership gate passed after reviewing the changed quota-store fingerprint.
  Only a read-only projection was added; reservation code is unchanged. Its
  existing `analysis_debt` classification remains unresolved, not approved or
  waived.
- Existing root YAML/Markdown dependency regressions: 32 tests passed.

The coverage ratchet passed against both fresh full-suite reports without changing
the baseline or thresholds. All listed validation completed successfully.

## PR disposition

GitHub MCP open-PR searches returned no open pull requests for this repository,
including the final validation recheck. There was no eligible PR to select or
implement. No PR was merged, closed or reopened by this work.

## Recommendation and next item

Keep the existing stack: bounded PostgreSQL observation, small Node ESM services,
shared worker predicates, fixed authenticated Express GET routes, named client
API functions, memory-only Vue SWR and a dependency-free CSS chart. The benefit
is low-cost explanation without spending quota. The tradeoff is a partial,
transient preview rather than a whole-backlog count or an execution guarantee.
The [design document](omdb-retry-readiness-design.md) records official OMDb, W3C
and PostgreSQL sources and the alternatives' pros and cons.

Follow-up delivered: [OMDb admission before queue claim](omdb-preclaim-admission-design.md).
The bounded scheduling hint uses fresh quota observations, while per-request
atomic reservation and ownership checks remain authoritative. The cached
dashboard response never authorizes a write. See the
[implementation outcome](omdb-preclaim-admission-outcome.md) for verification
and the next component.
