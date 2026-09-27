# Inventory recovery view: design

Date: 2026-09-27. Scope: read-only administrator diagnostics for movie/TV provider recovery.

## Decision

Expose existing durable inventory recovery cases through a small authenticated
read service and a dedicated Libraries page. Do not add another recovery worker,
retry endpoint, identity editor or persistence table. Keep source conflicts and
missing-ID review distinct, with navigation to their existing workflows.

Use one database statement for counts and a bounded keyset page. Count recorded
open cases, not all missing metadata or classification accuracy. Restrict the
population to current movie/TV identities in active libraries/servers. Include
source-conflict blocking explicitly; a retry deadline is eligibility, not a
promise that work will start at that exact time. Do not expose credentials,
server URLs, arbitrary JSON, private provider errors or stored payloads.

Require an administrator access session and a current active administrator row.
Reject API keys and scoped/refresh tokens. Return `Cache-Control: no-store` and
use non-persistent SWR reads. Pagination and item/case identifiers are validated;
all user values are bound SQL parameters. No GET writes identity, scheduling or
logs. The list makes no provider requests.

On expanding one case, resolve a Plex item link through the existing bounded,
request-coalesced resolver. Recheck actor and current source/configuration after
network I/O; never return a link for a replaced case or changed server. Missing
links can be retried on the next details read, without caching failure. Verify
link syntax again in the client. A server identity check does not prove the item
still exists or that its metadata is correct. Non-Plex sources retain title and
library instructions without invented deep links.

Use compact movie/TV/open-case counts, accessible item details, plain-language
diagnosis, next retry and one source/settings/wait action. Candidates are review
hints only. Keep polling pausable, preserve focus and hide data after read failure.

## Official research and trade-offs

URLs were discovered with web search and inspected on 2026-09-27.

- [W3C data tables](https://www.w3.org/WAI/tutorials/tables/) recommends semantic
  headers/captions for relational data; native details and lists suit this small
  item-oriented view without a custom grid.
- [W3C pause guidance](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide)
  supports stopping automatic visual updates without stopping background jobs.
- [W3C status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)
  supports announcing concise status changes without moving focus. Native details
  retain their own expanded/collapsed semantics; the case list is not a live region.
- [OWASP REST security](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html)
  supports endpoint authorization, input validation and no-store sensitive reads.
- [Plex Fix Match](https://support.plex.tv/articles/201018497-fix-match-match/)
  identifies the details-page More menu and show-level repair for TV. Display
  those steps in the app; do not send users to a forum to interpret an error.
  Its search-indexed official content was readable; a direct open returned an
  internal retrieval error. Existing application deep-link construction is
  reused, not represented as a newly guaranteed public Plex API.

| Approach | Pros | Cons / decision |
| --- | --- | --- |
| Read existing cases | Restart-safe evidence; no new authority or duplicate state | Cases appear only after an eligible observation; recommended |
| Separate lazy link read | Offline Plex cannot block the list; bounded network work | Link appears after opening details; recommended |
| Fetch all links on every poll | Immediate links in the list | Unnecessary network load and outage latency; reject |
| One global health percentage | Compact | No defensible denominator or accuracy measure; reject |
| Automatic candidate replacement | Fewer clicks | Lookup evidence alone cannot authorize identity repair; reject |

## Acceptance and recommendation stack

Administrator session → validated bounded query → allowlisted projection →
non-persistent SWR → accessible recovery details → verified source link.
Test permission revocation, hostile query values, pagination, stale sources,
inactive/music exclusion, malformed records, offline link recovery, no writes,
unsafe link rejection, pause/in-flight refresh, keyboard operation and narrow
layout. No release or PR merge. Document actual validation separately.
