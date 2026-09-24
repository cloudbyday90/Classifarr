# Read-only music library discovery: implementation outcome

Status: Unreleased implementation, 2026-09-24. See the separate [design decision](read-only-music-library-discovery-design.md) for alternatives, official sources, and recommendation stack.

## Delivered

- Added a small ESM media-library capability registry, source-specific music-section adapters for Plex/Jellyfin/Emby, and a read-only discovery service. Existing movie/TV `getLibraries()` results and routing policy creation remain unchanged; `computeLibraryDiff()` now rejects non-routing types defensively.
- Added `media_source_discovery_libraries` through a forward migration and schema snapshot. A complete valid sync records only library-section provenance and presence. Missing sections are marked absent, retained for 90 days, then pruned; failed/malformed discovery retains the prior snapshot. Discovery is automatically attempted during both normal and legacy scheduled library sync, but cannot fail the movie/TV synchronization.
- Added an administrator-only `GET /api/media-server/discovery` endpoint with `Cache-Control: no-store`, a strict client API/parser, and a compact read-only Libraries-page summary. The response omits source IDs, credentials, and item metadata. It does not trigger scanning or route configuration.
- No music items, policies, ARR mappings, embeddings, training examples, classification destinations, or automatic routing were created. The existing `libraries.media_type` constraint remains movie/TV-only; this separation is intentional.

## Verification and limitations

Focused provider, capability, synchronization, API, client-contract, component, and PostgreSQL integration tests cover music admission, malformed snapshots, disappearance/reappearance, privacy, and preservation on source failure. The schema migration and regenerated snapshot were checked in an isolated container without modifying the running local Classifarr service or its persistent library data. The GitHub MCP repository search found no open PR; no closed PR was substituted or merged. No release was created.

This is **section discovery only**. It proves that a music library exists or was previously observed, not what artists, albums, or tracks it contains. It does not establish cross-provider work identity or classification quality.

## Next item

Build a resumable, capped, read-only artist/album/track observation pipeline in a separate source-scoped store. Record item-kind and provenance, validate completeness and false-join risk on held-out cases, and keep the data out of RAG and policy learning until measured gates explicitly admit it.
