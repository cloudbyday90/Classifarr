# Bounded suggestion list outcome

November 23, 2026 Eastern. See the [design](bounded-suggestion-list-design.md)
and [API guide](../api/suggestions.md).

Signed-in members and administrators can opt into `GET /api/suggestions/page`.
The endpoint returns up to 20 compact summaries and a `nextBeforeId` when
another matching row exists. The existing global and per-policy lists and
dashboard continue to use their current contracts. The proposal and
administrator evidence reads provide inspection data on demand.

The new page validates optional status, policy ID and continuation before
reading suggestions. It selects explicit columns, excludes saved configuration
and raw feedback fields, and asks HTTP caches to avoid storage. Descending
IDs give an exact continuation even if the boundary row is deleted. The
count and JSON size limits bound the response. PostgreSQL can examine more
rows for a sparse filter, and each page sees the current database state.

## Verification

All 79 focused HTTP and PostgreSQL tests passed. They checked member and
administrator access, anonymous and scoped-token refusal, validation before
the suggestion query, live insertion and deletion, exact 20-row termination,
filtering, and compatibility with both legacy lists. The largest escaping
fixture returned 20 rows and exceeded 55 KiB while staying within 64 KiB.
The client adapter tests exercised explicit all-status and maximum-ID
continuation requests. The API specification tests checked the served
parameter contract. All three npm audits reported zero findings. GitHub
listed no open PRs or Dependabot branches to rebase.

The full backend run passed 64,543 tests across 1,958 suites, with one skip
and 89.32% line coverage. All 7,699 client tests passed across 491 files with
89.72% line coverage. Both coverage ratchets passed. The client production
build and all 30 Chromium checks passed. Lint, type checks, preflight,
ownership, ESM and policy gates passed.

## Next recommended item

Plan the dashboard migration to the bounded page. Decide which status counts
the dashboard needs and how it should display unavailable proposals before
switching its data source. Fix the All filter in that migration and verify
member access, administrator review, keyboard navigation, focus and loading
announcements in the browser.
