# Command Center visual status: implementation outcome

Date: 2026-09-26. Unreleased; no release, container replacement, or live-data change.

## Delivered

The overview now presents three signals: a library-summary freshness ring,
metadata issue count, and pending-decision count. One suggested next step follows
them. Coverage and measurement caveats remain available in a disclosure.
Freshness is not presented as AI quality or classification accuracy.

The metadata button opens an inline, paginated list from the population behind
the count. Each entry includes its title, year, library, issue, recorded retry
state, and next source action. A segmented bar and textual legend summarize
recovery states. The prior link to the unrelated inventory-review population is
removed from this overview; that existing review workflow is not retired.

Library and pending-item links navigate to the existing sections with keyboard
focus. Opening metadata details performs only a read. Unknown pending status is
shown as unavailable, not zero, in both the overview and header.

## API and boundaries

`GET /api/libraries/source-identity-issues?offset=0` returns
`library.source_identity_issues.v1`:

- `asOf`, `total`, `offset`, fixed `pageSize: 50`;
- `coveredLibraryCount` and `activeLibraryCount`;
- `recovery`: `retry_wait`, `retry_due`, `source_review`, `not_recorded` counts;
- `items`: opaque membership key, library ID/name, title/year/type, issue,
  recovery state, retry-eligibility timestamp, and last-observed timestamp.

The existing library-router authentication and request limiter apply. Unknown
parameters, non-scalar offsets, negative offsets, and oversized offsets fail
before SQL. Count, category totals, and page entries come from one statement.
The query shares capture eligibility and generation predicates with upgrade
readiness. No schema change is required.

The new detail request uses the existing Vue SWR implementation without disk
persistence or background polling. Transient failures have bounded retries.
Access loss, malformed responses, mismatched pages, contradictory recovery
states, and impossible category counts withhold the detail display. Source
strings remain escaped text. No source credentials, raw source keys or provider
payloads are exposed.

## Validation

- Targeted server contract tests: 19 passing across three suites.
- PostgreSQL integration: 34 passing across four suites, including shared-scope
  parity, 53-item pagination, retry boundaries, and exclusion of stale,
  incomplete, incremental, omitted, inactive, and superseded evidence.
- Chromium end-to-end: passing with intercepted synthetic API responses only.
  Checks exact count navigation, keyboard focus, lazy detail loading, changed
  totals, pagination, permission loss, no writes, and 390px/320px layouts.
- Desktop and mobile screenshots visually inspected. Fixed a collision between
  the original generic ring class and Tailwind's ring utility.
- Type checks, production build, documentation lint, copyright, static ESM import
  checks, and production dependency checks passed.
- Lint passed with the existing unrelated non-literal filesystem warning in
  `captureOperatorCorrectionFrozenPolicy.mjs:32`.

- Full frontend suite: 5,393 tests across 385 files passed on the final code.
  Coverage: 85.82% statements, 78.04% branches, 85.32% functions, 87.84% lines.
  An earlier run overlapped the final validator edit and was discarded; the
  clean rerun includes all contradictory-state regression assertions.

- Full backend coverage run: all 1,455 current suites recorded as passing in
  Jest's completed-run results cache; no failed current suites remain.
  Coverage: 90.37% statements/lines, 84.42% branches, 92.24% functions.
- Coverage ratchet passed for both applications without changing baselines.

## PR selection

Two GitHub MCP searches for open pull requests in
`cloudbyday90/Classifarr` returned an empty list. There was no open PR to randomly
select. No closed or unrelated PR was substituted, and nothing was merged.

## Limits and next work

Each detail page is a fresh snapshot, not a frozen export. A concurrent sync can
change membership between pages; the UI shows its current total and explains a
change from the overview. It does not append pages into a purported immutable
dataset. Library-profile details retain their existing 200-library window and
truncation notice.

A retry timestamp records eligibility, not an execution appointment or result.
The overview deliberately does not claim that unknown recovery is running, that
the user must fix every conflict, or that a displayed percentage measures
accuracy. It adds no provider requests, repairs, classification, or training.

Next: extend the existing recovery service and successful-repair receipts with
structured failure reasons and attempt/resolution timestamps. Its unsuccessful
paths currently return `null`, so a timer cannot distinguish provider downtime
from insufficient evidence. Use those outcomes to show verified automatic
progress and only the cases genuinely requiring human attention. Do not create
a parallel worker or rebuild the dashboard again.

Research and alternatives are in the [design document](command-center-visual-status-design.md).
