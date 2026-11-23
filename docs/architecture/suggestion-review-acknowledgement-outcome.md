# Suggestion review acknowledgement outcome

November 23, 2026 Eastern. See the
[design](suggestion-review-acknowledgement-design.md) and
[suggestion API guide](../api/suggestions.md).

Classifarr sends one Apply or Reject POST per dashboard confirmation. The
request uses the existing CSRF and authorization handling and waits up to 60
seconds for the response. A recognized refusal keeps its existing handling,
and a session refusal explains that a new review requires signing in again.
Success requires the canonical acknowledgement for the selected suggestion and
action.

When the response is uncertain, the dashboard closes the submitted form and
uses the existing proposal route for a 10-second, single-attempt status check.
An explicit Check status action repeats only that GET. The message describes
the saved status and leaves the original request unconfirmed. Pending is a
snapshot that may precede a late commit. Missing or invalid reads leave the
outcome unconfirmed. A new attempt requires opening the proposal and making a
fresh decision. Closing the form discards its local rejection draft, so a new
rejection uses a newly entered reason.

A terminal observation closes any reopened form for the same suggestion and
refreshes the list. Keyboard focus stays with the status action or returns to
the dashboard heading when a focused card disappears. The status notice is
local to the dashboard, and navigating away discards it.

## Verification

All 111 focused client tests and 82 isolated PostgreSQL and HTTP tests passed.
The server tests dropped actual HTTP responses after both kinds of review
committed and read the resulting saved status. A separate test observed pending
while a review waited for a database lock and rejected after it completed.
The client tests covered unexpected acknowledgements, including a mismatched
policy and an explicitly contradictory status, and invalidated a reopened form
after a late terminal observation. All three npm audits reported zero findings.
GitHub showed no open PRs or Dependabot branches to rebase.

The production build and all 36 Chromium checks passed. Browser checks used
the real client transport and verified one Apply after a dropped response,
one Reject after a gateway error, exact GET-only follow-up checks, keyboard
focus, and no authentication refresh or replay after `401`.

The full client suite passed all 7,721 tests across 491 files with 89.58%
line coverage. Both coverage ratchets passed with the verified 89.32% server
report. The new server integration tests run separately from that report.
Lint, type checks, preflight, ownership, ESM and policy checks passed.

## Next recommended item

Design an exact command receipt for suggestion reviews if operators need to
recover attribution after a disconnect or navigation. Bind the receipt to the
authorized reviewer, suggestion, action, and committed outcome, using the
repository's established receipt patterns. Keep the current read-only status
check for callers that lack a receipt.
