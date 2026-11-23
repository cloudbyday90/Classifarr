# Paged evidence in the tuning dashboard

November 23, 2026 Eastern. This builds on the
[saved suggestion evidence endpoint](saved-suggestion-evidence-read-design.md).

Open Suggestion Details from the selected list row. That row already supplies
the proposed configuration, confidence, and expected impact. Fetch the first
bounded evidence page alongside the dialog. Use the server's administrator
response to determine access. Regular members can inspect the proposal and
see that supporting evidence requires an administrator. This approach needs
one denied read per member open and avoids an extra session lookup or role
cache. Keep the legacy detail endpoint available for existing clients.

| Approach | Benefit | Cost |
| --- | --- | --- |
| Read the first bounded page on open | Shows evidence promptly and uses the endpoint's current access decision | A regular member receives a denied evidence request |
| Look up the session role first | Can omit the denied request for regular members | Adds another read for administrators and still needs to handle server refusal |
| Fetch all pages on open | Allows scrolling through all evidence at once | Loses the per-interaction limit and increases memory in the dialog |

Use one page of up to 20 saved positions at a time. Request another only on
activation of Next page. Retain the current page during an ordinary request
failure and retry the same position on demand. Clear the page when the server
refuses access or the suggestion is gone. Ignore completions from closed
dialogs so a previous suggestion's results cannot replace the current ones.
The pager describes saved references, including unavailable positions.
Render labels as text and distinguish unknown correction status from a saved
false value. [OWASP response limits](https://api-security.owasp.org/editions/2023/en/0xa4-unrestricted-resource-consumption/)

Reuse the shared modal for initial focus, Escape, and focus return. Keep the
activated paging button in place while loading and after the last page.
Announce loading, range, unavailable references, and failures through a
status region without changing focus. Verify the route in Chromium and
exercise late completion and retry in component tests.
[W3C modal dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)
· [W3C status messages](https://www.w3.org/WAI/WCAG21/Understanding/status-messages.html)
