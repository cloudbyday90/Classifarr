# Source enumeration preflight — design

## Decision

Check actual media and collection responses before starting a source capture.
Run the check inside the existing owned ingestion attempt, not in a new timer,
setup polling loop, or AI service. A connection test is not a pagination test;
a passed pagination sample is not proof that the whole library is complete.

The prior importer could discover a missing total or a broken collection endpoint
only after writing media. Full enumeration already prevented destructive completion,
but a fresh installation could repeatedly do substantial work before discovering
that completion was impossible. This change moves bounded evidence checks earlier.

## Contract and lifecycle

1. Preserve existing eligibility checks: movie/TV only, enabled and configured
   source, one owner per library, two global slots, and durable retry eligibility.
   No demand means no provider requests. Music remains excluded.
2. Claim the existing ingestion ledger and create a sync attempt. Attach its ID
   before network work, with no capture generation yet. A crash remains recoverable
   without an unowned running status being mistaken for a foreign worker.
3. Request up to two pages from each endpoint, sequentially. Request at most two
   items per page (or the smaller configured batch). Actual returned counts control
   offsets. Explicit empty totals stop that endpoint after one page.
4. Use the actual adapters and the existing completeness validator. Require known
   totals immediately; reject malformed, repeated, inconsistent or non-progressing
   evidence. Optional missing totals are insufficient evidence under Classifarr's
   safety policy, not necessarily an upstream API violation.
5. Bound each preflight response to 1 MiB decoded and five seconds, compose owner
   cancellation, and recheck source configuration before and after requests. Up to
   four calls means a 20-second network deadline budget, excluding database and
   local processing. Providers may return more items than requested; the existing
   1,000-item page cap also applies. No nested network retries are added.
6. Only after both samples pass, create the capture. Consume buffered pages in
   order within this run and continue normal enumeration. Do not refetch or cache
   samples across runs. Full validation, source fencing and atomic completion/pruning
   remain mandatory. A later truncated page still fails the capture.
7. Failures preserve inventory and the previous capture. Store the safe failure in
   the existing sync attempt, finish the ledger in retry-wait, and leave normal
   readiness gating deferred. The next eligible attempt checks the current source
   again; no cached positive capability or manual reset can bypass it.

## Diagnostics and UI

`sourcePreflightDiagnostic.mjs` owns allowlisted causes and concrete next steps.
It never includes provider response text, credentials, URLs, titles or source IDs.
The warning includes library ID, endpoint phase, cause and action. Existing warning
throttling requests a 24-hour library/phase/cause window; it is process-local, not
durable deduplication. The ingestion ledger and failed sync attempt are durable.

The existing `media_server_sync_status.error_message` retains a version-one prefix:
`Source preflight unavailable (media:unknown_source_total). `, followed by fixed
application text. The decoder recognizes only allowlisted phase/cause pairs and
regenerates text; arbitrary historical messages and suffixes are never returned.
This avoids a separate persistence system or schema migration. Future prefix changes
must retain this decoder for historical records until their normal retention expiry.

Authenticated library detail adds nullable `ingestion_status.preflight` with
`phase`, `reason`, `message`, and `nextStep`, derived only from the current owned
failed attempt in retry-wait. It is last-attempt evidence, not a permanent provider
compatibility claim. Raw storage text is stripped before the response. Existing
non-persistent SWR displays a concise heading, cause/action and retry eligibility;
stale/offline data and non-retry states suppress the diagnostic. Reads do not probe
or initiate imports. No arbitrary diagnostic URL is rendered.

## Official research verified 2026-09-27

URLs were discovered or re-opened from previously verified official sources using
web tools. Recommendations below are our engineering application of those sources.

- [Plex pagination](https://developer.plex.tv/pms/) permits returned counts different
  from requested counts and optional pagination totals. Probe returned evidence,
  not assumed server behavior or a hardcoded product/version allowlist.
- [Jellyfin result fields](https://typescript-sdk.jellyfin.org/interfaces/generated-client.BaseItemDtoQueryResult.html)
  are optional; its [Items request](https://typescript-sdk.jellyfin.org/interfaces/generated-client.LibraryApiGetItemsRequest.html)
  supports explicitly requesting total counts. Require sufficient evidence without
  inventing absent totals.
- [Emby Items API](https://dev.emby.media/reference/RestAPI/ItemsService/getItems.html)
  describes item arrays and total record counts. Exercise both media and collection
  queries with the shared adapter, not just connection identity.
- [AWS retry guidance](https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/)
  supports backoff and jitter to reduce synchronized retries. Reuse the current
  durable owner cooldown instead of introducing another retry layer.
- [W3C data best practices](https://www.w3.org/TR/dwbp/) emphasizes quality,
  provenance and coverage. Distinguish a small compatibility sample from a full
  capture; do not present unknown evidence as completion or AI accuracy.
- [W3C status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)
  calls for programmatically identifiable updates without unnecessary focus changes
  or excessive announcements. Keep status text separate from continuously changing
  item counters and do not show an invented completion percentage.

## Alternatives and final recommendation stack

| Option | Pros | Cons | Recommendation |
| --- | --- | --- | --- |
| Connection test only | Fast, already available | Cannot establish pagination compatibility | Retain for connectivity, not import admission |
| Owned bounded preflight, then full enumeration | Early actionable failure; no new scheduler; samples reused | Small initial pages; missing totals defer; sample cannot prove later behavior | Implement |
| Cached server-wide capability registry | Cross-library history and version reporting | Invalidation complexity; one library cannot prove another; stale positives | Defer until there is a measured need |
| Trust short pages or fabricate totals | Completes more often | Can mistake omissions for absence and authorize deletion | Reject |

Recommended stack: existing owner and retry ledger → bounded actual-adapter canaries
→ safe retained diagnostic → capture and full enumeration → atomic finalization →
existing learning/backfill readiness. Use small ESM modules, existing PostgreSQL,
the bounded native HTTP client, and Vue/SWR; add no dependency or workflow engine.

## Limits and next boundary

The check observes configured behavior, not a certified provider-version matrix.
It does not fetch or retain provider version strings. Neither sample agreement nor
full count agreement creates an atomic upstream snapshot. Missing totals that never
return require a separately validated compatibility solution, not endless claims of
self-healing. Ordinary sync retention may expire the historical diagnostic.

Next: **library-catalog discovery completeness before library deletion**. Inspection
found `PlexService.getLibraries` defaults missing `Directory` to an empty list, while
`computeLibraryDiff` and `deleteRemovedLibraries` can remove libraries absent from
that list. Per-library content preflight cannot protect a deletion that precedes it.
Require validated catalog evidence, distinguish unavailable from genuinely empty,
and test preservation under malformed/partial discovery plus confirmed removal.
Do not claim that this patch resolves that separate boundary.

## Authorized local rollout

After tests pass, rebuild only the local Classifarr Compose service with
`--no-cache` and verified clean-commit provenance. Retain its current image and a
private full PostgreSQL archive before replacing the container. Preserve existing
mounts and settings; check health, migrations and configuration after startup.
The current local image predates four already-committed migrations, so replacing
the image is an upgrade even though this patch adds no migration.

[Docker build](https://docs.docker.com/reference/cli/docker/compose/build/) separates
`--no-cache` from pulling base images. Use the repository's pinned Dockerfile and
existing provenance wrapper. [Compose up](https://docs.docker.com/reference/cli/docker/compose/up/)
supports service-scoped recreation, `--no-build` and a health wait. Do not remove
volumes or restart unrelated services. Normal background jobs resume on startup.

No release, version bump, manual live metadata repair or new music support.
