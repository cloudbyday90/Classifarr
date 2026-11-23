# Suggestion dashboard pagination outcome

November 23, 2026 Eastern. See the [design](suggestion-dashboard-pagination-design.md)
and [API guide](../api/suggestions.md).

The dashboard displays one page of up to 20 suggestions at a time. All sends
`status=all`. Older follows the current continuation, Newer reads the preceding
position again, and the result announcement gives the count on the current
page. Filter changes and completed or conflicted reviews start again at the
newest page. A failed page request keeps the current results visible and offers
an explicit retry of the same position. An obsolete retry cannot block a retry
for the current filter.

Cards show summary metadata. Opening Details reads that proposal and its
independent evidence page. Members can inspect proposals. The dashboard checks
the current account role before showing policy and review controls, and the
server authorizes every evidence request and write. An available, pending
proposal can be applied. An unavailable, pending proposal can be rejected.
Historical proposals are read-only. If the account lookup fails, reviewers can
still inspect suggestions and retry the permissions check.

The navigation buttons retain keyboard focus during and after paging. The
proposal and rejection dialogs use the shared native modal. Dismissal returns
focus to the card, or to the dashboard heading when the card has been removed.

## Verification

All 97 focused client tests and 79 PostgreSQL and HTTP tests passed. They
covered explicit status and policy filters, stale page completion, invalid
continuations, exact retries, role lookup recovery, duplicate activation, and
recognized review conflicts. All 33 Chromium checks passed, including proposal
and evidence requests, administrator and member behavior, unavailable proposals,
late proposal responses and keyboard navigation at a 320-pixel viewport. All
three npm audits reported zero findings.
GitHub listed no open PRs or Dependabot branches to rebase.

The full client suite passed all 7,706 tests across 491 files with 89.58% line
coverage. Both coverage ratchets passed using that report and the preceding
89.32% server report, whose source tree and report hash were verified. The
production build, lint, type checks, preflight, ownership, ESM, and policy gates
passed.

## Next recommended item

Qualify Apply and Reject after an uncertain response. Both still inherit the
shared client's automatic retries. A retry after a committed review can receive
a pending-state conflict without telling the operator which request wrote the
change. Assess opting these writes out of automatic retries and using a fresh
read for reconciliation. A fresh status alone cannot attribute the write to
this operator. The independent administrator policy picker still reads the full
policy catalog and can be assessed separately.
[HTTP idempotency guidance, RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html#section-9.2.2).
