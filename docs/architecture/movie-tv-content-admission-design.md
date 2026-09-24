# Movie and TV content admission: design

Status: Unreleased, 2026-09-24. See the separate [outcome](movie-tv-content-admission-outcome.md).

## Scope and root cause

Classifarr learns arbitrary movie and TV libraries from their contents. Music libraries, artists, albums, and audio tracks are outside the product scope. Library names, titles, genres, and descriptions are not admission rules: a movie about music is still a movie.

Provider library discovery already filters for movies and TV, but both item adapters previously mapped every non-series item to `movie`. If a provider returned an unexpected audio item, this fallback could admit it as a film. Webhook parsing also guessed types from subjects, while classification parsing defaulted missing types to movies. These implicit defaults bypassed the downstream movie/TV identity check.

## Decision

- Retain source library filters and add movie/TV validation to both library synchronization paths. Ignore unsupported libraries before insertion, automatic policy creation, or background item sync. A direct unsupported-library sync returns a successful skipped result before requesting source data.
- Accept only Plex `movie`/`show` and Emby/Jellyfin `Movie`/`Series` item types. Unsupported source entries become internal metadata-free page placeholders. Sync drops them before observation capture, identity recovery, analysis, or persistence. Keep the original page length and offset so a full page of ignored items does not terminate the scan before valid later items. One normal completion summary includes an ignored count; ignored items do not generate per-item warning reports.
- Reuse the canonical movie/TV type helper for incoming payloads. Accept existing snake-case and camel-case type fields only when all declarations agree after normalization. Missing, conflicting, and unsupported declarations are rejected; a subject never supplies a type.
- Authenticate webhooks first, then acknowledge unsupported content with HTTP 200 and `skipped: true`, `reason: unsupported_media_type`. Do not store its payload, enqueue classification, or update request status. Test notifications remain usable without a media type. Normalize accepted aliases before queuing.
- Complete already queued unsupported classification tasks with a skipped result and mark an associated webhook log skipped. Do not call classification, routing admission, enrichment, or retry. The classification service also rejects unsupported direct calls before enrichment or policy evaluation.

This does not inspect file bytes or repair incorrect source type labels. A source that explicitly mislabels audio as a movie requires separate source-metadata diagnosis. The safeguard protects the types actually supplied, without inventing a title/genre blacklist.

## Official-source research

Sources were checked September 24, 2026:

- [Plex library overview](https://support.plex.tv/articles/200288916-overview/) identifies media type as a library property. Use that property, not its configurable name.
- [Emby item types](https://dev.emby.media/doc/restapi/Item-Types.html) distinguishes audio, albums, and artists from movies and series. Its API supports querying particular types; the returned type must still be checked locally.
- [Jellyfin BaseItemKind](https://typescript-sdk.jellyfin.org/variables/generated-client.BaseItemKind.html) defines distinct Movie, Series, Audio, MusicAlbum, MusicArtist, and MusicVideo values.
- [OWASP input validation](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html) recommends allowlists and semantic validation. The application accepts its two supported types rather than trying to enumerate every unsupported format.

No new UI controls or acknowledgement step are required. The music-only interface is removed; existing accessible movie/TV views continue to represent the supported inventory.

## Alternatives and recommendation

| Approach | Benefit | Cost or limitation | Decision |
| --- | --- | --- | --- |
| Filter library names or music-related genres | Easy to implement | Rejects valid musical films and depends on naming | Reject |
| Trust source library filters alone | Minimal code | Unexpected item responses can bypass the filter | Insufficient |
| Explicit admission at discovery, sync, webhook, queue, and classification | Prevents unsupported metadata reaching learning and routing; quiet skips avoid retry storms | Older callers must supply an explicit supported type | Adopt |

Recommended stack: source type validation → pagination-preserving exclusion → canonical payload admission → quiet webhook/queue skips → existing movie/TV learning and routing.

Next: close the source-description evidence gap for movie and TV libraries, including valid items missing TMDB IDs. Reuse bounded backfill/recovery orchestration and evaluate retrieval and placement on held-out items across those libraries.
