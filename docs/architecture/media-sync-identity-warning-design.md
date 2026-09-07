# Media sync identity warning design

Date: 2026-09-07. Investigates warning
867ae1d3-abb0-4e05-ae84-72d9e6725eed from mediaSync.

## Problem and decision

The warning contained only invalid_source_identity. That category covers invalid
server IDs, source keys, media types, malformed provider IDs and conflicting Plex
GUIDs. It cannot identify an affected item or explain which condition failed.

Keep identity rejection intact. Plex GUID parsing now retains a fixed conflict
category and provider field while still discarding all candidate IDs from a
conflicting response. A separate ESM diagnostic service adds an allowlisted issue,
provider field names, numeric library/server IDs and a SHA-256 source fingerprint
to this warning. Titles, source keys, provider values, URLs, credentials and raw
metadata are excluded. Fingerprints are pseudonymous correlation identifiers,
not anonymization or authentication tokens; existing log access controls apply.

Diagnostics do not write rejected items, select an arbitrary provider ID, invoke
AI, relax provenance checks or require operator input. Existing valid identity
normalization and conflict protection remain authoritative.

## Research and tradeoffs

The [W3C data-quality guidance](https://www.w3.org/TR/dwbp/) supports distinguishing
available observations from evidence fit for a particular use. The
[OWASP API10 guidance](https://owasp.org/API-Security/editions/2023/en/0xaa-unsafe-consumption-of-apis/)
supports retaining validation at third-party boundaries. Applying those principles
here favors explicit conflict status over arbitrary identity selection.

Search discovered the official
[Plex API documentation](https://developer.plex.tv/pms/) and
[merge/split support page](https://support.plex.tv/articles/201018248-merge-or-split-items/).
Full retrieval failed (size limit and HTTP 403 respectively). These pages are
research leads, not evidence that merged items caused the observed conflicts.
The root-cause evidence below comes from local code and a read-only source scan.

| Option | Advantages | Costs or limitations |
| --- | --- | --- |
| Fixed diagnostics, retain rejection — selected | Safe, actionable, no routine operator work | Conflicted source records still do not refresh through this write path |
| Take the first or last provider ID | Suppresses warning, permits sync | Arbitrary identity can corrupt observations and future automation; rejected |
| Log complete source payload | Easy manual debugging | Exposes private titles/URLs/metadata and encourages manual handling; rejected |
| Separate unresolved observation storage — next | Retains inventory/library visibility and conflict provenance | Needs a separate persistence/projection design and retention policy |

Recommended stack: strict identity parser → fixed conflict category → unchanged
write guard → privacy-limited diagnostics → separate unresolved observations as
the next change. No classification or review routing is authorized by a warning.

See the separate [measured outcome](media-sync-identity-warning-outcome.md).
