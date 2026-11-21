# Retry lineage refusal details

November 21, 2026 Eastern. Approved design. Baseline `21f0f78dd`.
The previous batch made transfers atomic and preserved the existing Queue
error code. It did not save which check failed. [Transfer outcome](retry-lineage-consumption-outcome.md)

## Recommendation

Save the first proven refusal category with the failed task. Show its fixed
explanation under a collapsed native disclosure in Command Center's existing
Errors card. Use the current authenticated Queue read and its existing
bounded list. Make the Errors section itself a keyboard-operable disclosure
without enclosing Retry All in the toggle.

The first batch covers unavailable producer proof, an unverifiable source
classification relationship, unverifiable item identity, and unverified
media request or webhook links. Keep other failures and historical refusals
without saved evidence at a general explanation. Each category describes
the check at refusal time. An absent expected row may have been reassigned,
detached, or deleted. A mismatch in one set does not establish that checks
for the other set were completed.

Some existing refusal checks run after local transfer while evaluating
routing admission. Use general copy that makes no claim about whether
transfer or routing occurred. Existing terminal failure, retry eligibility,
claim, reporting, and routing behavior continue to govern processing.

## Storage and disclosure

Add a nullable checked category to the existing queue row. Derive the value
only from a trusted refusal observed by the worker. Store it in the same
lease-checked terminal acknowledgement that records the existing failure
code, after the transfer transaction settles. A stale claim, SQL failure, or
duplicate completion cannot record a refusal detail. The detail follows the
queue row's existing retention and dismissal. No historical inference,
separate write, index, or repair job is required.

Project only the allowlisted category on failed classification tasks with
the existing lineage failure code. Omit the detail when unavailable.
Readers include current Queue-authenticated sessions, API keys and the
existing scoped diagnostic token. The added field contains no individual
link identifiers, names, payload content, private proof, lease information,
or raw exception text. Preserve the existing response contract for unrelated
fields. Neither expanding the disclosure nor loading the list reads the
reference owners or contacts a provider. No new page or request is needed.

| Option | Benefit | Cost or limit |
| --- | --- | --- |
| Capture a fixed refusal category | Explains the original attempt and adds one scalar to the existing read | Older refusals retain general wording and the category cannot identify a particular row |
| Look up current link ownership | Can show where surviving links are attached today | Needs its own access and resource bounds and cannot explain a prior failure from a current snapshot |
| Save exact link identifiers | Allows item-by-item investigation | Exposes identifiers, expands retention and requires a separate trusted reader |

## Sources and verification

Reviewed official guidance through MCP on November 21, 2026 Eastern.

- Use an ordinary disclosure for supplementary content and retain keyboard
  operation and visible focus. The explanation is existing page content.
  Refreshing a card does not require a modal, focus movement, or an alert.
  [WHATWG interactive elements](https://html.spec.whatwg.org/multipage/interactive-elements.html)
  · [W3C disclosure pattern](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/)
  · [W3C status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)
- Reuse the existing request authorization and cap the additional response
  to a checked category. Reuse the guarded update to commit the status
  and category together. [OWASP authorization](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)
  · [PostgreSQL UPDATE](https://www.postgresql.org/docs/18/sql-update.html)

Exercise the real PostgreSQL worker and HTTP Queue reader for each category,
stale claim, rollback, mixed-version rows and forged payload fields. Keep the
existing routing and replay tests. Check the disclosure and outer toggle with
keyboard navigation, narrow layout, refresh and ordinary retry controls.
Run affected coverage and quality gates on main. A current-owner review, if
needed later, should have its own authorization and bounded read contract.
