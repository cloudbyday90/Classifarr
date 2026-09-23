# Installation-specific library upgrade assessment — design

## Decision

Add a read-only, administrator-only aggregate for **all** libraries, separate
from the existing 200-library detail window. It counts movie, TV, and other
library types; current, queued, processing, retry, cooldown, waiting, paused,
unverified, and no-inventory profile states; inventory-bearing libraries
without profiles; and unresolved source-identity issues by category in recent, complete, full source
captures. It also reports whether the profile-upgrade enrollment task has been
recorded. The Command Center shows a short status and leaves per-library
details behind the existing disclosure.

This is an **assessment**, not a release gate or an assertion that all media
metadata has been checked. Source-conflict counts apply only to active
libraries with a complete full capture started within 30 days, no omitted or
uncapturable items, and matching current generation. The response states both
covered and active library counts. A zero conflict count with incomplete
coverage must never be read as an all-clear.

## Options and tradeoffs

| Option | Benefit | Cost |
| --- | --- | --- |
| Reuse the existing 200-library report | No new query | Wrong installation-wide totals when the window truncates; exposes names unnecessarily. |
| Full aggregate query (selected) | Complete counts, no titles or provider payloads, one database snapshot | Work scales with the library count and current source observations; poll conservatively. |
| Persist a readiness cache | Cheap reads | More state, invalidation and privacy complexity; stale results could mislead operators. |

Recommended stack: the existing per-library refresh view for bounded detail;
this aggregate for all-library operational counts; a separate release-review
process for schema, startup, backup, provider and data-distribution evidence.
The aggregate is refreshed no more than once per five minutes while the page
is visible. It does not enqueue work, alter policy, export records, or call a
media provider.

## Technical and accessibility rationale

- PostgreSQL's per-aggregate `FILTER` computes multiple counts in one grouped
  read: [PostgreSQL 18 aggregate documentation](https://www.postgresql.org/docs/18/tutorial-agg.html).
  Indexed `EXISTS` and latest-outbox lookups avoid shipping individual media
  rows to the server process. Counts and profile/media-type totals are checked
  for consistency before presentation.
- The admin route rejects query controls, uses the existing observation-health
  rate limit, and returns `Cache-Control: no-store`, consistent with
  [MDN's cache-control guidance](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cache-Control).
- The Command Center uses one polite `role="status"` region for dynamic
  assessment text and a native `details` disclosure for optional per-library
  information, following [W3C guidance for status messages](https://www.w3.org/WAI/WCAG21/Understanding/status-messages)
  and [ARIA22](https://www.w3.org/WAI/WCAG21/Techniques/aria/ARIA22).

## Security and limitations

No response field contains a library name, title, external ID, provider ID,
URL, payload, or credential. The separate detail endpoint retains its existing
administrator controls. The browser stores neither response and polls only
while visible. A failed aggregate read falls back to the bounded profile
summary instead of reporting installation-wide success.

The assessment cannot prove a future container upgrade or source-system
availability. A profile marked current means its stored revision matches the
current inventory revision, not that every metadata field is complete or a
classification can safely route automatically.
