# Suggestion dashboard pagination design

Reviewed with Astra and agreed November 23, 2026 Eastern.

The dashboard uses the authenticated suggestion page for up to 20 summaries in
descending ID order. The existing All selection was sent without a status and
resolved to Pending. The new selection sends `status=all`. The count describes
the current page, including any historical or unknown status it contains.

## Options

| Option | Benefit | Cost |
| --- | --- | --- |
| Replace the current page on Older or Newer | Bounds the rendered list and gives keyboard users explicit controls | Moving back re-reads a live page whose membership can change |
| Append every page | Keeps previously viewed rows on screen | Accumulates rows and makes focus and counts harder to interpret |
| Request collection-wide status totals | Gives operators aggregate context | Adds a separate aggregate and authorization contract with more database work |
| Inspect one proposal on demand | Supports member inspection and makes the administrator see the proposed change before applying | Adds one request when opening Details and removes raw preview and rejection notes from cards |

## Recommended stack

1. Keep a single page in a dashboard composable. Retain only the continuation
   values for previously visited pages in memory. Reset to the newest page on
   filter changes, successful reviews and recognized review conflicts. Ignore
   out-of-date replies and retry the exact failed request. Keep the current page
   visible during ordinary pagination and its retry. An old retry stops owning
   the current Retry control when the filter or review results reset.
   [Vue watchers](https://vuejs.org/guide/essentials/watchers.html).
2. Use metadata-only cards and the existing bounded proposal and administrator
   evidence reads inside Details. Check that the proposal belongs to the
   selected suggestion, policy and type. Users can inspect historical rows. Require
   a pending, available proposal for the dashboard Apply control. A pending
   proposal that was read successfully and marked unavailable can still be
   rejected. The server remains the authority for both writes. Preserve the
   administrator policy picker, whose independent read still returns all policies.
   A failed account-role lookup leaves inspection available and exposes a retry
   for the permissions check.
   [OWASP property-level authorization](https://api-security.owasp.org/editions/2023/en/0xa3-broken-object-property-level-authorization/)
   and [OWASP resource limits](https://api-security.owasp.org/editions/2023/en/0xa4-unrestricted-resource-consumption/).
3. Keep focus on the native navigation button during a page request and
   announce loading, results, empty pages and errors through a persistent
   status region. Reuse the shared dialog for proposal and rejection, returning
   focus to the card or the dashboard heading if that card has gone.
   [WCAG status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html),
   [WCAG focus order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html)
   and [W3C modal dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/).

Verify exact request sequences, stale list and proposal completion, permission
refusal, unavailable proposals, review conflicts, and keyboard navigation at
mobile width in the existing Chromium suite. Keep the legacy HTTP contracts
available to external consumers.
