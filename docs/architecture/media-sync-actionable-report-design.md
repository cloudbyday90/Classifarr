# Actionable media-sync reports

Date: 2026-09-13

## Problem and selected design

A deduplicated count and a Plex forum link cannot tell an administrator which
movie or show needs attention. Enrich the existing administrator-only log detail
and copy-report reads with current, retained unresolved source observations.
Show title, year, media type, library, catalog problem and concrete repair steps.
Keep raw conflicting IDs and credentials out of the response.

The original warning remains an immutable counts-only event. Its repair section
is a current projection, not a claim that the original event has changed. Query
only the current owning Plex library, matching issue categories and observations
already present when the warning was recorded. Limit each projection to 50 items.
Expired or missing observations are not evidence that Plex has been repaired.

Resolve Plex's machine identifier through the configured server's read-only
identity request. Build item links only from validated machine and item IDs on
the fixed HTTPS app.plex.tv host, never from arbitrary metadata URLs or tokens.
Do not cache failed identity lookups. Reopening or copying the report retries;
an open detail section also revalidates through the existing Vue SWR composable
every 30 seconds while visible. Pause is available. No localStorage persistence,
new background job, warning duplication or database migration is needed.

## Options and tradeoffs

| Option | Benefit | Cost / risk | Decision |
| --- | --- | --- | --- |
| Write titles and links into every warning | Self-contained historic export | Private-data duplication; an offline lookup stays missing | Reject |
| Rewrite old logs with a scheduled backfill | Links appear without reading | Extra writes/jobs; alters event history; stale ownership risk | Reject |
| Enrich authenticated reads and revalidate | Existing warnings improve; offline lookup retries naturally | Requires retained observations and a reachable server for new links | Select |

## Research and implementation constraints

Sources discovered with web search and checked on 2026-09-13:

- [Plex Fix Match](https://support.plex.tv/articles/201018497-fix-match-match/):
  use the item's More menu; TV matching is performed at show level.
- [Plex item details](https://support.plex.tv/articles/202462186-viewing-item-details/):
  item-level metadata refresh and matching controls.
- [Plex API](https://developer.plex.tv/pms/): server identity and authenticated
  metadata access. Use the existing token-header client and five-second timeout.
- [Python-PlexAPI server implementation](https://python-plexapi.readthedocs.io/en/stable/_modules/plexapi/server.html)
  and [item implementation](https://python-plexapi.readthedocs.io/en/master/_modules/plexapi/base.html):
  maintained client implementation of the desktop server/details link. This is
  a compatibility reference, not a Plex guarantee that its Web UI route is stable.
- [W3C link purpose](https://www.w3.org/WAI/WCAG22/Understanding/link-purpose-in-context.html):
  descriptive item-specific link labels.
- [W3C auto-updating content](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide):
  pause control; updates must not move focus. This is not a whole-page WCAG audit.

## Security and recovery boundaries

Keep administrator authorization ahead of queries and network requests. Mark
enriched responses private/no-store. Escape titles in Vue and copied Markdown;
allow only the fixed Plex URL shape in the client. Do not expose the server's
local URL, API token or network error text. Share concurrent identity requests
within a router instance, with no durable negative cache.

Plex availability and identity correctness are separate. A restored link does
not authorize classification. Scheduled source recovery and normal backfill
continue unchanged; this read path does not refresh Plex, change a match, rewrite
provider IDs, route media or mark logs resolved. Correct matching/refreshing can
help, but cannot guarantee repair of an upstream catalog conflict.

## Recommendation stack

1. Actionable current diagnostics on the existing log, including offline fallback.
2. Nonpersistent SWR refresh and retryable verified Plex link resolution.
3. Preserve strict source identity recovery, deduplication and routing boundaries.
4. Resume the library-balanced movie/TV retrieval benchmark after these repairs.

Validation and delivery are recorded in a separate outcome document.
