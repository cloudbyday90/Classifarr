# Library catalog preservation

Status: implemented; verification recorded in the companion outcome document.
Research reviewed 2026-09-27.

## Problem and invariant

The manual media-server discovery path treated any absent library as deleted and
cascaded local deletion. Plex also converted a missing catalog envelope to an empty
list. A provider outage, malformed response, permission change, or rebuilt source
identifier must not erase inventory, policies, mappings, or classification history.

Discovery is additive: validate the entire response, update observed movie/TV
libraries, and preserve unobserved libraries. Music and other unsupported types
remain excluded from ingestion. Presence or absence is evidence about this request,
not proof that the administrator intended deletion. Never match libraries by name.

## Recommended stack and tradeoffs

| Option | Benefit | Cost / decision |
| --- | --- | --- |
| Delete after one or repeated missing observations | Automatic space reclamation | Reject: permissions and outages can persist; repetition is not authority. |
| Preserve on discovery | No destructive inference; returning IDs retain local identity | Recommended; genuinely obsolete libraries need intentional cleanup. |
| Review cleanup separately | Administrator sees scope before acting | Recommended; requires a fresh review and concurrency checks. |
| Provider-specific bounded parsers | Reject malformed/ambiguous catalogs before any writes | Recommended; incompatible provider responses fail visibly rather than partially importing. |

Use existing PostgreSQL transactions, owner locks, Express authorization, Vue
components and ESM modules; no new workflow engine or chart dependency is needed.
Fetch remote catalogs outside write transactions. Recheck the source configuration
before applying results so a changed token, URL, or provider cannot reuse stale data.

## Reviewed reversible archive

The administrator explicitly chose reversible archive, not permanent local deletion.
`libraries.archived_at` is nullable; a database constraint requires every archived
library to remain disabled, including attempts through older/direct update paths.
Discovery never clears this marker, enables a library, matches a replacement by
name, or modifies an archived library's metadata. Archived libraries remain visible
with an Archived label and a restore control; this is preservation, not disk cleanup.

Archive review requires a normal active administrator access session, a disabled
source-linked library, a freshly validated catalog without that identity, no current
ingestion owner and no unfinished import/capture. The operator must attest that
older/external writers are stopped. An advisory lock cannot prove their absence.
Confirmation checks an actor-bound strong revision, re-fetches the source before
opening the short transaction, rechecks configuration, takes the same library owner
lock as ingestion, locks the local records, and commits the archive and audit together.

Restore works without contacting an offline provider, but still rechecks local
state and authority. It clears only the archive marker and leaves the library
disabled. Enabling and ingestion recovery remain separate existing workflows.
Neither operation deletes media, policies, mappings, inventory or history. Existing
retention/manual log cleanup remains unchanged.

The API provides POST confirmation with exact `If-Match`, a UUID request ID and an
audit receipt lookup. A unique receipt index prevents cross-library request-ID
reuse. Unknown network outcomes retain the same confirmation ID; the client never
automatically repeats writes. Non-persistent SWR is used for on-demand review only;
it performs no provider query until the user opens the review.

### API contract

- `GET /api/media-server/libraries/:id/archive`: read the current review, effect,
  eligibility reason and strong revision (also returned as `ETag`).
- `POST /api/media-server/libraries/:id/archive`: send that exact revision in
  `If-Match` and `{ requestId, operation, workersStopped: true }`. Operations are
  only `archive` and `restore`. Reuse the request ID when an outcome is uncertain.
- `GET /api/media-server/libraries/:id/archive/receipts/:requestId`: read the
  actor/library-bound committed outcome; a missing receipt is not proof of failure.

All three endpoints require an administrator access session, reject API keys and
query parameters, use `Cache-Control: no-store`, and share a 12-request/15-minute
per-client rate limit. Database authority is rechecked rather than trusting a stale
token role. Discovery's existing response retains `libraries` and adds
`preservedLibraries`; clients should reload local libraries to include preserved
and archived records, not replace their list with the observed catalog.

Limits: 1,000 catalog entries and 4 MiB per response, 10-second network timeout,
3-second preview statements, 5-second write statements and 500 ms lock waits.
These are application safety bounds, not provider limits or proofs of completeness.
An unsupported identity still counts as visible, preventing music filtering from
turning a type change into evidence for removal. No music is imported.

Compatibility: the existing Emby/Jellyfin array endpoint is retained. Current
Emby QueryResult/pagination migration requires a separately tested provider-specific
adapter; an unexpected shape now fails closed rather than partially importing it.

An interrupted `running` ingestion checkpoint blocks archive even before it has
attached a sync/capture marker. An inactive `retry_wait` checkpoint without live
markers may be archived without discarding its recovery state. This avoids making
successful replay of a genuinely removed source a prerequisite for preservation.

## Deployment and rollback

Apply the additive migration through the normal migration runner before using the
new code. No populated records are rewritten or deleted by the migration. Take the
usual database backup before deployment. Rolling back to a build that still deletes
libraries during discovery is unsafe for preserved/archived libraries: keep the
non-deleting discovery patch on any rollback build, or disable discovery while
restoring a tested backup. Do not drop the disabled-state constraint as a workaround.

## Research and application

- [Plex Media Server API](https://developer.plex.tv/pms/): library sections are a
  distinct discovery endpoint. Documentation discovery succeeded; the web reader
  could not render the full page. Parser decisions are also checked against repo
  adapter fixtures, not represented as newly verified provider guarantees.
- [Jellyfin LibraryStructureApi](https://typescript-sdk.jellyfin.org/classes/generated-client.LibraryStructureApi.html):
  virtual folders return an array. Do not reinterpret malformed objects as empty.
- [Emby LibraryStructureService](https://dev.emby.media/reference/RestAPI/LibraryStructureService.html):
  current documentation lists `/Library/VirtualFolders/Query`, unlike the existing
  shared legacy endpoint. Do not silently assume identical Emby/Jellyfin contracts.
- [PostgreSQL explicit locking](https://www.postgresql.org/docs/17/explicit-locking.html):
  short transactions and shared owner-lock identifiers can coordinate local writers;
  advisory locks do not prove an external/legacy writer has stopped.
- [HTTP conditional requests](https://www.rfc-editor.org/rfc/rfc9110.html):
  exact preconditions prevent applying a stale review to changed local state.
- [W3C error prevention](https://www.w3.org/WAI/WCAG22/Understanding/error-prevention-legal-financial-data.html):
  consequential changes need review/confirmation or reversibility. Show plain-language
  effects, accessible labels and text status; do not rely on color alone.

## Verification plan

Test empty/reduced catalogs, malformed envelopes, duplicate IDs, music exclusion,
provider/configuration changes, transactional rollback, disabled libraries, and
returning identities. Use disposable database fixtures. No live-library cleanup,
release, deployment, or provider mutation is implied by implementation/testing.
