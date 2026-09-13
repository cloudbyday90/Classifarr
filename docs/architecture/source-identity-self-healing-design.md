# Source identity self-healing design

## Reassessment — 13 September 2026

The warning investigation exposed a functional gap beyond alert duplication.
The existing scheduled external-evidence replay only records measurements. It
does not repair inventory or backfill metadata. A fresh read-only replay found
19 conflicts. The old replay accepted two, but its blanket secondary-ID rule
also rejected movies with disputed TVDB IDs. TMDb's documented Find API supports
TVDB for TV, not movies. A media-type-aware read-only reassessment found eight
candidate agreements (seven movies, one TV show) with matching title/year,
nine contradictory independent-ID cases and two incomplete cases. Those eight
were candidates for the guarded implementation, not yet successful repairs.

## Selected recovery boundary

Require a unique IMDb ID resolving to one declared TMDb candidate and an exact
catalog title/year match. For TV, any supplied TVDB ID must be unique and must
agree with IMDb. For movies, a disputed TVDB ID is left unset and recorded as an
unresolved secondary provider; never choose one or use TVDB-to-TV results to
identify a movie. The existing generic external-ID resolver and strict title
matcher supply these decisions. No AI, fuzzy title selection, library-name
heuristic, source-order preference, or upstream source mutation is permitted.

Adapters expose a transient, bounded candidate set and a digest binding it to
source key, library key, media type, title, and year. After catalog verification,
re-read current source evidence and require the same digest before applying it.
Do all provider requests and content analysis outside database transactions.

The sync capture transaction must still be current. Persist the recovered item,
stamp a server-owned recovery receipt, clear the matching unresolved observation,
and restore metadata-backfill eligibility together. The existing upsert resets
backfill timestamps on identity changes; unchanged identities retain completed
backfill instead of restarting it on every sync. A superseded capture or failed
write must not clear a conflict. Keep the existing backfill scheduler responsible
for filling missing metadata; do not create another queue or require a click.

Allow at most eight new catalog-verification attempts per library sync. A durable
24-hour retry timestamp prevents rebuilds from repeating failed external lookups;
changed source digests reset it immediately. Skip structurally ineligible sets
without catalog calls. Recent server-owned success receipts can be reused for
24 hours only with an identical digest, matching stored TMDb ID and a fresh source
re-check; they do not consume the new-attempt budget. Expired, future-dated or
changed receipts cannot authorize reuse. This lets later syncs progress to more
items instead of repeatedly spending the budget on already repaired ones.

The eleven contradictory/incomplete candidates cannot be repaired by guessing.
They remain captured and later changed evidence can make them eligible. Neither
an AI vote nor a library's name is allowed to resolve identity conflicts.

The companion [warning design](media-sync-warning-deduplication-design.md)
addresses repeated summaries across rebuilds, not identity correctness.

## Tradeoffs and stack

| Option | Advantage | Disadvantage |
| --- | --- | --- |
| Keep diagnostic replay only | No new writes | Proven repairs never reach inventory or backfill |
| Pick first ID or infer from library | More apparent recovery | Silent identity corruption; reject |
| Verified recovery during sync | Automatic, source/library agnostic, reuses backfill | Extra bounded catalog reads; ambiguity remains unresolved |

Select modular ESM normalization and receipt handling, existing TMDb evidence
adapters, revision-checked PostgreSQL persistence, durable retries, and existing
scheduled metadata backfill. The reported conflict path is wired through Plex's
GUID adapter; the recovery service itself uses an adapter contract and no library
names. Other adapters cannot opt into recovery without the same fresh digest
contract. This repairs Classifarr's inventory, not any upstream catalog.

## Research

The prior [atomic-resolution research](source-identity-atomic-resolution-design.md)
identified the correct candidate-bound proof and transaction boundary but deferred
implementation. The current user request explicitly asks to implement self-healing
and backfill. Official sources were discovered through search and checked on
13 September 2026:

- [TMDb Find by ID](https://developer.themoviedb.org/reference/find-by-id) lists
  IMDb support for movies and TV, but TVDB support only for TV/season/episode.
  This is the basis for the movie-specific secondary-ID rule, not a heuristic.
- [TMDb finding data](https://developer.themoviedb.org/docs/finding-data) separates
  external-ID lookup from text search; recovery uses typed external-ID evidence.
- [PostgreSQL transactions](https://www.postgresql.org/docs/16/tutorial-transactions.html)
  support the all-or-nothing repair, while
  [conditional UPSERT](https://www.postgresql.org/docs/18/sql-insert.html)
  preserves the existing concurrent-writer check.
- [Plex scanning versus refreshing](https://support.plex.tv/articles/200289306-scanning-vs-refreshing-a-library/)
  distinguishes file discovery from refreshing metadata. Rebuilding Classifarr
  does not correct Plex's metadata. A targeted upstream refresh can help after
  an upstream correction, but is not guaranteed and is not performed here.
- [Plex Fix Match](https://support.plex.tv/articles/201018497-fix-match-match/)
  is an upstream correction option for a genuinely wrong match, not permission
  for Classifarr to choose between contradictory candidates automatically.
- [Plex's duplicate GUID discussion](https://forums.plex.tv/t/double-plex-guids-validation-for-movies-series-and-episodes/882863)
  documents this class of metadata issue, including upstream duplicate records
  and cross-links. It is a relevant reference, not proof that every affected
  local record shares one currently open upstream defect.

No existing library placement is treated as a correct training label. Details
and identifiers remain in existing protected inventory paths, not error reports.

## Acceptance

Exercise unchanged-source recovery, changed-source rejection, unknown/provider
failure, conflicting independent IDs, malformed candidate arrays, wrong title or
year, bounded attempts, forged receipt stripping, and atomic rollback. Confirm
backfill eligibility with real PostgreSQL tests and report remaining live conflicts
honestly. No routing operation belongs to the recovery step.
