# Emby catalog compatibility design

Research date: 2026-09-27. Scope: library discovery, not media-item pagination or routing.

## Finding

Classifarr used the same array-returning endpoint for Emby and Jellyfin. Current
Emby documents `GET /Library/VirtualFolders/Query` with `StartIndex`, `Limit`,
`Items` and `TotalRecordCount`. Jellyfin documents an array from its existing
virtual-folder endpoint. Emby's archived official JavaScript client confirms the
legacy array contract. No precise server-version cutoff is assumed.

## Options and recommendation

| Option | Pros | Cons / decision |
| --- | --- | --- |
| Keep only the legacy array endpoint | Few requests; no adapter change | Misses the documented current Emby contract. Reject. |
| Select by reported server version | Avoids probing an old server | Needs a verified version boundary and another dependency. Reject for now. |
| Current Emby query, narrowly bounded legacy fallback | Supports both observed contracts without guessing versions | One extra request on legacy servers. Recommended. |
| Accept any response shape or fall back after any failure | Appears tolerant | Hides permission, transport and incomplete-page failures. Reject. |

Use a provider-specific ESM reader injected into the existing Emby-like service
factory. Keep Jellyfin's array reader independent. Share only transport and the
normalized library contract. No new package, schema, background job, UI framework,
or persistent capability cache is required.

## Safety contract

1. Prefer Emby's documented query endpoint. Only a **first-request HTTP 404 or
   405** permits one attempt at the existing legacy endpoint. This is compatibility
   negotiation, not proof of a server version or permission to delete data.
2. Never fall back after a valid first page, malformed success, authentication
   failure, rate limit, server error, cancellation, timeout, or byte-limit failure.
3. Validate the complete catalog before returning it. Require integer bounded
   totals, stable totals, unique identities, forward progress and no count overflow.
   A short page may be followed by more pages; an empty page before the total is
   reached is incomplete, not successful discovery.
4. Query pages accept Emby's documented `ItemId` or `Id` alias. If both are supplied
   they must agree. Preserve exact source identities, not names or numeric coercions.
   Jellyfin's contract is not broadened by Emby's alias support.
5. Count unsupported libraries while paginating. Music stays excluded from ingestion
   but remains visible to archive review; filtering cannot invent absence.
6. Request 100 records per query page; cap the operation at 20 pages, 1,000 records,
   4 MiB per response, 10 seconds per request and a shared 30-second deadline.
   Use native cancellation composition; no automatic retries or parallel page reads.
   These are application budgets, not provider guarantees.
7. Construct requests only from the configured source and fixed endpoint paths.
   Ignore response-provided continuation URLs. Keep tokens in headers and discard
   provider-specific options, locations and raw bodies from normalized results/errors.
8. Return no partial result and open no discovery write transaction if any page
   fails. Existing non-deleting reconciliation and reviewed archive safeguards remain.

Offset pagination and a stable total do not establish a transactional remote
snapshot: same-count changes between pages can evade detection. Consequently this
reader never authorizes deletion, automatic archive, or automatic identity remapping.
Do not persist a fallback decision: an upgraded/reconfigured server must be probed
again on the next independently requested discovery.

## Verification plan

Use synthetic fixtures shaped from the official contracts: legacy Emby, current
Emby query, Jellyfin array, and the existing Plex parser. Include empty catalogs,
short/full pages, duplicate/conflicting IDs, unsupported-only pages, changed totals,
non-progress, failures on later pages, fallback restrictions, cancellation, bounds
and sensitive-field exclusion. Exercise the actual adapter and database reconciler
together on disposable PostgreSQL; assert failed enumeration never updates or
deletes existing libraries and never partially inserts an earlier page.

Fixtures demonstrate contract compatibility, not certification of every released
server version. No live media server, media files or production library data is
required for this change.

## Official sources

- [Emby query endpoint](https://dev.emby.media/reference/RestAPI/LibraryStructureService/getLibraryVirtualfoldersQuery.html)
  specifies offset/limit pagination, the count envelope and identity aliases.
- [Archived official Emby JavaScript client](https://github.com/MediaBrowser/Emby.ApiClient.Javascript/blob/master/apiclient.js)
  implements the legacy array endpoint in `getVirtualFolders`; it is historical
  evidence, not current-version guidance. Read through GitHub MCP after web rendering
  did not expose the method body.
- [Jellyfin LibraryStructureApi](https://typescript-sdk.jellyfin.org/classes/generated-client.LibraryStructureApi.html)
  documents the independent array-returning contract.
- [Node.js AbortSignal](https://nodejs.org/docs/latest/api/globals.html)
  documents native timeout and signal composition used by the existing HTTP client.
- [W3C status messages](https://www.w3.org/WAI/WCAG21/Understanding/status-messages)
  informs the existing textual status/error presentation. This backend-only change
  keeps those semantics; it does not claim a new WCAG conformance assessment.

## Recommended stack

Retain ESM services, the bounded native HTTP client, explicit provider parsers,
PostgreSQL transactional reconciliation and the existing Vue/SWR UI. Add focused
contract fixtures rather than an SDK or workflow engine. Tradeoff: small adapter
maintenance overhead in exchange for controlled compatibility and no partial imports.
