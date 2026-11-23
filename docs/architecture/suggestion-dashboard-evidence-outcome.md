# Tuning dashboard evidence outcome

November 23, 2026 Eastern. See the
[design](suggestion-dashboard-evidence-design.md) for the access and paging
decisions.

Suggestion Details opens directly from the selected list row. The dialog
uses the bounded administrator evidence read and shows one page at a time.
Regular members retain the proposed change and see an administrator-access
message when the server refuses evidence. Existing API callers can still
use the legacy detail endpoint.

The dialog uses the shared modal for keyboard focus and dismissal. Its status
region announces loading, page ranges, unavailable references, and errors.
The paging control retains focus through loading and the last page. An
ordinary failure can be retried at the same position. Closing the dialog
discards late responses. Existing review actions still use their original
server checks.

The Chromium cases use the real dashboard route with controlled HTTP
responses. They verify the exact requests, administrator paging, member
proposal access, escaped feedback text, the 320-pixel layout, and focus
return. The cases run in the existing Chromium CI step.

## Verification

The final client coverage run passed 7,687 tests across 491 files with
89.71% line coverage. An initial run found a test-file formatting issue.
After correcting it, a rerun encountered timeouts in two existing Vue
tooling suites. Both passed independently and then passed in the complete
two-worker run with the existing deadlines. Backend coverage was reused
after verifying the server source, installed dependency tree, and report
hash. The coverage ratchet passed for both workspaces.

The production build and 30 Chromium checks passed. Lint, type checks,
preflight, ESM checks, and the policy gates passed. GitHub listed no open
pull requests for adoption or rebasing.

## Next recommended item

Review the contract for the legacy detail endpoint with external callers in
mind. The dashboard no longer uses it. Decide whether members need separate
bounded detail and how to retire the full feedback response without breaking
supported callers.
