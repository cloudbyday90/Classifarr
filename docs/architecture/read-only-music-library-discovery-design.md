# Read-only music library discovery: design decision

Status: implemented in Unreleased, 2026-09-24. The [outcome](read-only-music-library-discovery-outcome.md) is recorded separately.

## Objective and boundary

The provider-neutral description diagnostic exposed a real gap: Classifarr's `libraries` schema, policy creation, item synchronizer, enrichment, RAG, and routing are movie/TV-oriented. Simply adding `music` to the `libraries.media_type` check would let automatic workers treat an artist as a film or series. The first content-agnostic step is therefore **section discovery**, not item admission. Plex's documented library sections include `type="artist"` for Music; Emby documents `music` as a collection type, and Jellyfin's API client lists `music` among virtual-folder types. [Plex URL commands](https://support.plex.tv/articles/201638786-plex-media-server-url-commands/), [Emby library browsing](https://github.com/MediaBrowser/Emby/wiki/Browsing-the-Library), [Jellyfin API client](https://github.com/jellyfin/jellyfin-apiclient-python/blob/master/jellyfin_apiclient_python/api.py).

## Decision

- Use an explicit ESM capability registry: movie and TV remain routing inventory; music is `source_discovery_only` with artist-level source semantics. No unknown type silently becomes routable. Existing provider adapters keep `getLibraries()` movie/TV-only and gain a separate `getDiscoveryLibraries()` read. This prevents music from entering either legacy or current movie/TV synchronization.
- Store only source music **section** ID, name, provenance server, current presence, and first/last observation timestamps in a separate table with a database `music` check constraint and no foreign key to routing libraries or policies. Do not store track, album, artist, media paths, artwork, provider IDs, credentials, or text descriptions here. The source ID is local provenance, not cross-provider identity. [W3C Data on the Web Best Practices](https://www.w3.org/TR/dwbp/).
- Cap each complete source snapshot at 64 sections and reject malformed, duplicate, or oversized snapshots before persistence. An absent Plex `Directory` is accepted as empty only when its container explicitly reports size zero; an ambiguous response preserves the previous snapshot. Upsert present sections and mark missing sections absent; prune missing observations only after 90 days. A request failure leaves the previous snapshot unchanged and cannot roll back movie/TV sync. Use parameterized SQL and one transaction for discovery writes. This is an application of [OWASP allowlist input validation](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html) and [PostgreSQL constraints](https://www.postgresql.org/docs/18/ddl-constraints.html).
- Expose a no-store, administrator-only, count-bounded read model that omits the source ID and credentials. The Libraries page shows the music section and a plain read-only status without action buttons; status and errors use semantic text, consistent with [W3C status-message guidance](https://www.w3.org/WAI/WCAG21/Understanding/status-messages).

## Alternatives and tradeoffs

| Option | Benefit | Cost/risk | Decision |
| --- | --- | --- | --- |
| Expand `libraries` and `media_server_items` directly | Immediate reuse of UI and sync | Policy/profile/worker paths can misinterpret music; unsafe routing authority | Reject until each consumer has an explicit capability gate |
| Live-only music section API | No migration | Evidence disappears across restart; cannot distinguish source outage from disappearance | Reject |
| Separate durable section registry | Safe, recoverable source provenance without a route | Adds a bounded source request per library sync; does not yet discover artists, albums, or tracks | Adopt |

## Recommendation stack and next gate

Source section adapters → capability allowlist → bounded validation → isolated discovery table → administrator read model → compact UI. The next gate is a separate, resumable, source-scoped **artist/album/track metadata observation** pipeline with explicit item-kind provenance, rate and retention budgets, and measured duplicate/metadata quality. It must remain shadow-only until its held-out comparisons demonstrate acceptable false-join and placement behavior. No user choice or media-server metadata should silently promote discovery evidence into training or routing authority.
