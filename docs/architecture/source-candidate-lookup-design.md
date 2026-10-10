# Source candidate lookup

## Design — 2026-10-10

Add an explicit administrator lookup beside the source mapping draft. The local
read-only check at 23:09 UTC still found eleven conflicts across ten current
library captures. All eleven have Plex descriptions/artwork; nine declare two
TVDB IDs and two grouped shows declare multiple TMDb series IDs. Metadata presence
does not resolve that disagreement. Do not approve or mutate these real items.

## Contract

- Bind requests to the current issue key, page and source version. Accept no
  browser-supplied provider IDs, URLs, credentials, actor or approval fields.
- Use the existing Plex/Emby/Jellyfin identity adapters, not episode enumeration.
  Add the existing source fingerprint to the Emby-like identity projection so
  all adapters can reject stale captured identity. Recheck source, database
  configuration and administrator status after the catalog reads.
- Freeze configured catalog credentials; use existing bounded, cancellable HTTP
  reads without redirects. Read at most eight declared IDs and eight distinct
  candidate details, sequentially, with 1 MiB responses and a 60-second provider
  cancellation deadline. Database reads retain the existing pool query bounds;
  cancellation is checked again before accepting their results.
  Preserve the shared catalog rate limiter; reject oversized or malformed results.
- Use the existing database-wide scope-review advisory lock. Allow five explicit
  lookup requests per IP per fifteen minutes. No polling, automatic retry, new
  scheduled work, cache, durable attempts or migrations. Restart loses transient
  read results/rate-limit memory, not approval or backfill state.
- Show exact-ID provenance, typed title/date and unmatched/other-scope results.
  Never reinterpret an episode/season/person ID as a whole work. TVDB movie lookup
  is unsupported, not evidence of no match. A 404 is per-ID absence; other errors
  fail the entire read with fixed diagnostics and no partial success claim.
- No title search, ranking, automatic choice or draft mutation. Operators can
  copy the displayed ID into the existing typed draft. Every source season must
  still pass the existing evidence and explicit approval flow before recovery.
- Results are memory-only, text-rendered, `no-store`, and admin-session/CSRF
  protected. Closing/changing an item or cancelling drops late responses. Use
  polite status announcements and explicit empty/error explanations.

## Options and recommendation stack

| Approach | Benefit | Cost / risk | Decision |
| --- | --- | --- | --- |
| First title-search match | Fast | Can conflate unrelated works/grouped series | Reject |
| Declared-ID lookup with provenance | Explains current conflicts without guessing | Missing IDs still need manual research | Implement |
| Automatic mapping approval | Less operator effort | Lookup agreement is not complete scope verification | Reject |
| Optional bounded title search | Helps absent/unrecognized IDs | Needs distinct provenance and ambiguity review | Defer until exact-ID results are evaluated |

Validate malformed/wrong-type/oversized catalog data, other-scope results, empty
matches, 404/429, cancellation, source/configuration drift and administrator
revocation. Exercise real HTTP bounds, PostgreSQL read-only behavior and browser
status/cancellation. Preserve ownership, memory and complete-season safeguards.

## Official research

Discovered and opened through MCP on 2026-10-10:

- [TMDb finding data](https://developer.themoviedb.org/docs/finding-data) separates
  text search from external-ID lookup. This design uses the latter; a match is a
  suggestion, not independent identity approval.
- [TMDb find by ID](https://developer.themoviedb.org/reference/find-by-id) can return
  several object types. TVDB supports shows, seasons and episodes, not movies.
- [TMDb rate limits](https://developer.themoviedb.org/docs/rate-limiting) requires
  respecting 429 responses; published limits can change. Keep requests bounded.
- [W3C status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html?trk=article-ssr-frontend-pulse_little-text-block)
  distinguishes result lists from the announced search status. Announce counts
  and errors without moving focus or making the entire result list a live region.
- [DefinitelyTyped guidance](https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/README.md)
  ties declarations to the represented implementation. Retain Node-major alignment.

## Separate PR trial

Random selection from open PRs #555 and #556 chose
[server PR #556](https://github.com/cloudbyday90/Classifarr/pull/556), head
`a62b4d210fda8579fa961a5da3d6a7b6e3d7b888`. Trial its exact Node declarations
24.19.2 → 26.6.4 and undici-types 7.24.6 → 8.9.0 diff locally; retain only if
compatible with deployed Node 24. Registry integrity values match the PR; neither
candidate declares lifecycle scripts. No PR merge, release or runtime major bump.
