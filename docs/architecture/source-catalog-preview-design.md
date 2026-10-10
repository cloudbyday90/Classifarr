# Source layout and typed catalog preview

## Decision — 2026-10-10

Implement the next prerequisite for explicit mappings: a live, read-only,
adapter-neutral layout preview in the existing source-identity diagnostic CLI.
Plex metadata is present on the inspected unresolved items. The unanswered
question is how that source grouping relates to typed catalog works, not whether
the source has a description. Preserve grouping and every unresolved identifier.

The diagnostic selects the existing fair current-conflict window, reads source
identity and episode membership, fetches typed TMDb candidate details, repeats
the source capture, and rechecks the database-selected configuration/membership.
No result grants identity, possession, routing or recovery authority. A numbering
match is only structural compatibility: alternate order, cuts and combined works
still need independent episode evidence and administrator review.

## Contract and limits

- Explicit `--scope-preview` command only; no scheduler, UI polling, writes,
  schema migration, claim, lease, persisted cooldown or new cache. Fresh setups
  with no current conflicts make no provider requests. Restart repeats safe reads.
- Existing read-only database transactions end before HTTP begins. Select at most
  12 observations, four per library, from the bounded current full-capture window.
- Plex and the shared Jellyfin/Emby adapter expose one normalized layout contract.
  Validate source/library/series membership and typed movie/TV identity, not names
  of libraries, genres, policy destinations or title similarity.
  Plex grandchildren do not normally repeat `librarySectionID`: verify the
  parent series belongs to the selected library, then require each episode's
  `grandparentRatingKey` to equal that exact series. If a child does include a
  library ID, it must agree. Repeat the parent/layout read after catalog work.
- Single request concurrency; two-minute run deadline; ten-second HTTP timeout;
  1 MiB decompressed response limit. Each TV capture is at most 20 pages of 100
  items / 2,000 episodes. Refuse missing/changing totals, skipped/repeated pages,
  duplicate IDs or numbering, unsupported combined episode ranges, and bad types.
  Source seasons are those with retained episodes; empty folders are not catalog
  possession evidence. Episode record IDs and numbering enter the transient
  digest, not episode-title identity or a verified playback order.
- Up to four current TMDb candidates per observation. Typed series details supply
  at most 256 season entries and bounded episode counts. This round compares
  season counts/numbering, not individual catalog episode identities or order.
- Repeat the full source identity/layout after catalog reads. Discard a changed
  item. Re-read the selected configuration/window before returning; discard the
  entire summary if it changed. This detects observed drift, not an atomic
  cross-provider snapshot or an authorization receipt. Later activation must
  independently check source/configuration revisions, expiry and operator intent.
- Output only fixed outcomes, aggregate counts and a random reference. No raw
  provider bodies, titles, identifiers, credentials, paths or untrusted errors.
  Always `canApply: false`, `verification: layout_only`, `orderVerified: false`.
- Transient provider failures remain unavailable, malformed/ambiguous layouts
  remain reviewable, cancellation/timeouts stop new reads, unknown failures fail
  closed. A completed sample is not repaired data. No retry budget, memory guard,
  inventory record or optional-vector prerequisite changes.

## Run the diagnostic

From the installed application directory, with its existing configured database:

```sh
node src/scripts/runSourceIdentityExternalEvidenceReplay.mjs --scope-preview
```

For the local test container:

```sh
docker exec classifarr node src/scripts/runSourceIdentityExternalEvidenceReplay.mjs --scope-preview
```

This explicitly performs bounded read-only source and TMDb requests. It does not
accept arbitrary target URLs, an apply flag or credentials on the command line.
An unavailable or invalid item stays in the aggregate outcomes; it is not silently
skipped or repaired. `selection_changed`, cancellation, timeout and run failure
return a nonzero CLI exit and no summary. Do not run repeated tight-loop retries.

## Options and recommendation stack

| Option | Benefit | Cost / risk | Decision |
| --- | --- | --- | --- |
| Assume Plex metadata proves one TMDb work | Fast | Confuses descriptions with scope | Reject |
| Use season numbers as identity | Simple | Alternate orders can silently mis-map works | Reject |
| Bounded live layout preview | Establishes current structure without writes | Repeated reads; not identity approval | Implement |
| Explicit reviewed mappings and scoped consumers | Preserves grouping accurately | Needs durable revisions, review and consumer changes | Next |

Stack: live layout evidence → independent episode/order evidence → authenticated
mapping review → durable scoped edges and consumer support → guarded backfill.
Do not activate a subset through scalar whole-series consumers or fabricate old
failed-task/history links. This CLI is not the final operator-facing workflow.

## Official research

Discovered through MCP search on 2026-10-10:

- [Plex API](https://developer.plex.tv/pms/) documents children/grandchildren and
  pagination headers. Search extracts were available; the full page exceeded
  the retrieval tool's size limit. Runtime fixture tests must validate the exact
  adapter behavior, including servers that omit required pagination evidence.
- [Jellyfin item DTO](https://typescript-sdk.jellyfin.org/interfaces/generated-client.BaseItemDto.html)
  includes series membership, season/episode indices and combined-episode ends.
- [Jellyfin library API](https://github.com/jellyfin/jellyfin-sdk-typescript/blob/master/src/generated-client/api/library-api.ts)
  exposes parent, recursive, type, pagination and total-count parameters.
- [Emby browsing](https://dev.emby.media/doc/restapi/Browsing-the-Library.html)
  documents parent-scoped recursive episode queries.
- [TMDb season details](https://developer.themoviedb.org/reference/tv-season-details)
  identifies a season by series ID plus season number; [finding data](https://developer.themoviedb.org/docs/finding-data)
  distinguishes external-ID lookup from text search. Neither proves source order.
- [OWASP authorization](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)
  requires server-side access checks. Diagnostic evidence must not become a
  client-supplied permission to change ownership or identity.

## Independent PR trial

Fresh open enumeration found #555 and #556; cryptographic random selection chose
[#556](https://github.com/cloudbyday90/Classifarr/pull/556), immutable head
`a62b4d210fda8579fa961a5da3d6a7b6e3d7b888`. Trial server Node declarations
24.19.2 → 26.6.4 and undici-types 7.24.6 → 8.9.0 separately. Retain only if the
Node 24 baseline and typechecks pass; never weaken those gates or merge the PR.
[Definitely Typed versioning](https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/README.md)
ties declaration major/minor to the represented library. Record actual outcomes
separately, including a reverted trial if the incompatibility remains.
