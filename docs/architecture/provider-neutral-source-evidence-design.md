# Provider-neutral source evidence: design decision

Status: implemented in Unreleased, 2026-09-24. See the separate [outcome document](provider-neutral-source-evidence-outcome.md).

## Problem

The first per-library coverage contract only assessed descriptions after a movie/TV item had a valid TMDB ID. That undercounted metadata already present on source items and would leave a future content type wholly invisible. It also risked implying that one metadata-provider ID is the definition of content identity. The current production `libraries` schema and sync admission still restrict media to movie/TV. This increment must discover available evidence without changing classification, RAG indexing, sync admission, or routing boundaries.

## Decision and authority boundary

- Treat `(library ID, media-server ID, media type, exact source item ID)` as a **local source anchor**. It identifies one current observed library member, may change after a source rebuild, and is not proof that two servers or providers describe the same creative work. Do not coalesce anchors by title, TMDB, IMDb, or TVDB. Plex identifies metadata items using a server-side `ratingKey`; Jellyfin exposes item `Id` and `ProviderIds`; Emby documents provider IDs as a dictionary. Their separate shapes support preserving source provenance rather than assuming one universal identifier. [Plex metadata commands](https://support.plex.tv/articles/201638786-plex-media-server-url-commands/), [Jellyfin item DTO](https://github.com/jellyfin/jellyfin/blob/master/MediaBrowser.Model/Dto/BaseItemDto.cs/), [Emby item information](https://dev.emby.media/doc/restapi/Item-Information.html).
- In the existing short, repeatable-read library snapshot, inspect at most 10,000 source rows. Count type-matched rows, valid source anchors, current source-conflict blocks, locally described eligible items, missing descriptions, described items without TMDB, and eligible items with a valid observed IMDb/TVDB ID. Do not return IDs, title, description, hashes, vectors, or provider endpoints. A larger library gets an explicit truncated state; no partial percentage. [PostgreSQL transaction isolation](https://www.postgresql.org/docs/17/transaction-iso.html), [OWASP excessive data exposure](https://wstg.owasp.org/latest/4-Web_Application_Security_Testing/12-API_Testing/03-Excessive_Data_Exposure/).
- Keep the existing TMDB-keyed description-vector and retry counts as a **separate**, narrower layer. Source-level description presence does not imply that an item is indexed, deduplicated, retrievable, learned from, or routable. The contract can represent other media types, but the production schema and synchronizers cannot yet admit them; description retrieval remains explicitly movie/TV-only. The versioned response advances to `library.evidence_coverage.v2`, with strict client/server reconciliation.
- Preserve source provenance and explain coverage limitations. W3C's data-on-the-web guidance distinguishes identifiers, provenance, data quality, and coverage; this implementation does not manufacture a globally persistent work ID from a local key. [W3C Data on the Web Best Practices](https://www.w3.org/TR/dwbp/). The UI uses a concise status statement and optional detail, consistent with [W3C status-message guidance](https://www.w3.org/WAI/WCAG21/Understanding/status-messages).

## Alternatives and tradeoffs

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Require TMDB everywhere | Simple and already used by retrieval | Hides available local evidence and excludes other content | Reject for discovery; retain for current retrieval |
| Merge items across servers by title or whichever provider ID exists | Could produce larger apparent cohorts | False equivalence can contaminate learning and routing; provenance is lost | Reject |
| Keep scoped source anchors with provider IDs as observations | Safe denominator, source-agnostic first step, no live behavior change | No cross-source deduplication or new retrieval yet | Adopt |

## Final recommendation stack

Media-server source item → typed local anchor and validated provider-ID observations → bounded private description projection → read-only coverage counts → administrator-only API → compact library view. Only a later, independently verified equivalence layer may join anchors across sources; only an evaluated and controlled worker may index new content. The high-value next item is a staged media-type capability registry and migration that admits one non-movie/TV library type for **read-only discovery only**, followed by a shadow source-anchored backfill and held-out duplicate/false-join tests before any routing authority changes.
