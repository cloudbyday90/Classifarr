# Daily provenance coverage outcome

Date: 2026-09-07.

## Delivered behavior

Implemented the [design](daily-provenance-coverage-design.md) as `provenance_trend`
in the existing `evidence.coverage.v2` overview. It always returns 14 stored history
dates, including today so far, with explicit zero dates and a partial-day flag.
Captured, unrecorded, invalid and unsupported counts partition each date and the
window total. Capture coverage uses events as its denominator and remains null
for an empty date. It neither measures accuracy nor establishes a health threshold.

Small ESM services separate SQL construction, shared provenance-count validation
and daily projection. The daily query reuses the existing materialized history
and validated capture statuses in one read-only statement. Older, future/at-cutoff
and undated/non-finite exclusions reconcile the window to retained history. Dates
are ordered and complete, each partition is checked, and daily totals reconcile
to window counts. The window's status counts cannot exceed all-retained attribution.

History uses `timestamp without time zone`; Compose supports non-UTC zones. The
report therefore discloses the current database calendar and preserves stored
dates. Date-only browser labels are formatted without shifting them into the
browser's zone. No historical offset was inferred, no timestamp was rewritten and
no schema migration was required. Current recorded method changes do not move a
row to its resolution date or replace its captured provenance.

The native Vue table displays exact counts, dates, partial today, N/A, scope and
exclusions automatically. Captions, scoped headers, text labels and a keyboard
scroll region support desktop and narrow screens. The existing named API request
is reused with no extra polling, controls, annotations or operational input.

## Real read-only Compose observation

At `2026-09-07T12:13:58.315Z`, the aggregate query and status cross-check completed
in 131.937 ms against local PostgreSQL 18.6. The session calendar was
`America/New_York`, and the window ran from 2026-08-25 through partial 2026-09-07.

| Population | Events |
| --- | ---: |
| Retained history | 6,772 |
| Inside the 14-date window | 18 |
| Captured original method in window | 0 |
| Unrecorded original method in window | 18 |
| Invalid / unsupported provenance in window | 0 / 0 |
| Older history | 6,754 |
| Future/at-cutoff / unusable date | 0 / 0 |

The daily view separates recent observations from the large older population.
The running image predates original capture; these results do not indicate a
capture failure in the new build. Today had zero retained events and N/A coverage.
Feedback remained empty. The read returned aggregates, with no individual media
records, database writes or provider requests.

The older Compose image lacks feedback source/evaluation relations. The ignored
helper verified feedback was empty before supplying empty relations for this
measurement only. Production has no such fallback. The existing application was
not redeployed, and its data was not changed.

## Validation and limits

- 58 server unit tests passed across the coverage service, attribution and daily
  projection suites. They cover integer validation, date continuity, partial-day
  flags, partitions, exclusions, redaction and reconciliation.
- 75 PostgreSQL integration tests passed across daily coverage, retained evidence
  and feedback evaluation. Tests include an exact midnight start, an exclusive
  microsecond cutoff, repeated DST wall-clock times, leap day, null/infinite dates,
  empty history and unchanged provenance after manual resolution. The 5,000-event
  coverage fixture took 19.597 ms locally; this is not a production guarantee.
- All 4,652 existing client tests passed under the selected Vitest 5 update before
  feature UI changes. The 54 focused integrated client tests also passed. The final
  full run passed 4,668 tests in 337 files, with 85.43% statements, 77.20% branches,
  84.23% functions and 87.42% lines covered. Vitest/coverage required no compatibility
  overrides or test-runner refactor.
- Browser checks passed four native tables, the 14-date series, one partial label,
  empty-date N/A values, keyboard overflow, contrast and desktop/390/320-pixel
  layouts. Desktop and mobile trend screenshots were inspected. Statistics still
  makes the same four initial GET requests and zero writes in the regression.
- Typechecks, scoped ESLint, ESM static-import and mock-shape gates, and production
  Knip dependency analysis passed.
- `classifarr:daily-provenance-local` built from the staged Git tree. Fresh disposable
  startup, migrations and authoritative schema comparison passed. The checked-in
  schema remained unchanged and the helper removed its disposable container.
  Ignored data and secrets were excluded from the build context.

Validation found fixture issues, not a reason to relax production constraints.
Completed-history fixtures now supply their required library. The existing
aggregate fixture keeps its 150,000-byte bound and the new fixed 14-date payload
has a separate 6,000-byte bound. Exact boundary tests use a bound test clock and
transaction-local database zone in disposable PostgreSQL.

The full server suite and combined coverage ratchet were not run; no new endpoint
was added. The separate [tooling outcome](client-tooling-528-outcome.md) records PR
528's dependency scope and official migration research. Tests do not certify every
security/accessibility property or supply independently labelled classifier data.

## Recommendations and next item

The final stack is existing immutable capture, shared validation, an explicit
database-calendar window, bounded read-only SQL, strict ESM projection and native
Vue tables. Benefits are passive visibility into recent capture, exact missingness
and honest time scope. Costs are another descriptive view, the need to treat today
as partial, retained-history variability and inability to recover old time zones.
The design compares alternatives and cites official PostgreSQL, W3C and OWASP
guidance researched in September 2026.

**Follow-up completed: audit history writers and retain an offset-aware creation
instant for new history.** See the [recording-time outcome](history-recording-instant-outcome.md).
Preserve the existing calendar field for compatibility and keep legacy
instants explicitly unknown. This would support unambiguous future date windows
without asking operators to annotate or reinterpret old timestamps. A migration
must not assign its execution time to old rows and present that as their creation
instant.

Independent labels, readiness and frozen-study preflight continue to gate any
review-only semantic counter-evidence. This work does not change classification,
learning eligibility or routing authority. README, Unreleased and the previous
next item were updated. No release, tag, application version bump or deployment
is part of this change.
