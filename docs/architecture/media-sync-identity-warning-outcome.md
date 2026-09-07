# Media sync identity warning outcome

Date: 2026-09-07. See the separate
[design and alternatives](media-sync-identity-warning-design.md).

## Finding

The supplied error ID exists in the local database. A read-only scan fetched
**6,692 current source items** and reproduced invalid_source_identity for **19**.
Every reproduced rejection involved multiple differing Plex GUID values for the
same supported provider. All observed values had valid ID syntax; the conflict,
not numeric parsing, caused rejection. Source data and stored inventory were not
edited by the diagnostic scan.

The old event has insufficient item context to tie it conclusively to one of
these 19 records. The scan establishes a current reproducer for the warning, not
proof of which item generated that historical event. It does not establish why
Plex supplied conflicting GUIDs or justify choosing one of them.

## Change and limits

The existing warning now identifies conflicting_provider_ids, the affected
provider field, library/server IDs and a stable source fingerprint. Fixed
categories also distinguish invalid server, media type and source key cases.
Forged arbitrary diagnostic fields cannot be forwarded into the log. Tests cover
all three supported provider conflicts, fingerprint stability/separation and
rejection before analysis or database access.

Identity conflict protection remains enabled. This is a diagnostic repair, not
resolution of the 19 source conflicts; conflicted items continue to be skipped.
Existing rows are retained by the existing sync behavior when their source keys
are observed. An absent row does not become inventory merely because a warning
was emitted. No automated routing, ID reassignment or manual cleanup requirement
was added. Raw observations and logs remain outside committed artifacts.

## Next item

Add bounded unresolved source-observation capture keyed by media server and source
item, retaining library membership and conflict provenance independently of a
resolved TMDb identity. Expose aggregate coverage/conflict counts in inventory
observations, exclude unresolved IDs from enrichment/classification authority,
and test repeat sync, movement, removal and later conflict resolution. This best
supports understanding what already exists with minimal operational input.
