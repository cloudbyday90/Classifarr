# Episode gap diagnosis design

Decision date: 2026-10-11 (America/New_York). Scope: explain the two remaining
single-candidate membership gaps without manufacturing an identity repair.
See the [preceding outcome](source-combined-evidence-outcome.md).

## Evidence and contract

Read-only local investigation found one episode with no supported external IDs
in either the source list or item-detail response, and another with an ID absent
from the proposed TMDb scope. Neither had a catalog episode at its proposed
series/season/episode position. The latter's TVDB-to-TMDb lookup was empty.
This does not prove deletion, incorrect media files, or an alternative identity.
It is not evidence about current Unraid data.

Add an optional `gap` projection to the existing evidence comparison exclusions
for `missing_tmdb_episode_id` and `episode_absent_from_scope` only:

- `sourceIds`: `none`, `other_only`, or `tmdb` (supported declarations only).
- `catalogPosition`: `present` or `absent` in the validated proposed scope.
- `target`: the declared `tmdbSeriesId`, mapped `season`, and source `episode`.

Use a small pure ESM projector and a bounded position index over already validated
catalog membership. Never equate the presence of a numbered catalog episode with
an identity match. No new provider requests, credentials, raw episode IDs, URLs,
titles, caches, persisted state, endpoints or scheduler work are introduced.
Movies, successful comparisons and other exclusions remain unchanged. The UI
accepts old responses without the projection; malformed included projections
invalidate the preview. It verifies the target against the operator's proposal.

Display position-specific evidence and next steps beside each excluded episode,
outside the live status announcement. Guidance distinguishes source-ID gaps,
catalog-position gaps and differing IDs at an existing position. It asks the
operator to verify episode ordering/matching and catalog records before changing
anything, then rerun the existing evidence check. It never promises that a
metadata refresh can create a missing catalog record.

## Safety and lifecycle

Prerequisites remain active administrator, current source revision, configured
providers and an explicitly requested scope review. Fresh installations, disabled
providers and ordinary status polling create no new work. Admission remains one
installation-wide advisory lease, one attempt per click, a 90-second deadline,
10-second/1-MiB provider reads, at most 2,000 source and 10,000 catalog episodes,
four proposed works and 32 season edges. No cooldown or retry state is added.

Transient failures, rate limits, cancellation, lease loss, malformed data and
unknown failures retain the existing sanitized outcomes; they are not classified
as catalog absence. Repeated source/catalog/configuration/actor checks still
invalidate stale reads. Crash/restart discards the transient report. No external
side effect or completion write exists for diagnosis. Approval/backfill still
requires fresh, complete membership and separate explicit authority. Parent-ID
equivalence, ownership and memory safeguards are unchanged.

Completion means correct scoped diagnostics with no increase in matched count,
no approval for incomplete scope, unchanged unresolved counts, and regression
coverage for remapped seasons, wrong-work collisions, old/malformed responses,
safe rendering, cancellation and narrow-screen keyboard use.

## Options and recommendation

| Option | Benefit | Cost / risk | Decision |
| --- | --- | --- | --- |
| Explain gaps using existing validated reads | Precise next action; no provider load | Does not repair incomplete upstream metadata | Implement |
| Fetch every episode detail automatically | Could detect list/detail omissions | Extra latency/load; these observed detail reads agree | Defer |
| Fill IDs from matching episode numbers or titles | Reduces visible unresolved count | Can join different edits, orders or works incorrectly | Reject |
| Retry or rematch shared Plex automatically | Might refresh source metadata | External mutation and uncertain identity; no authority | Reject |

Recommended stack: scoped diagnosis, upstream episode/order verification, parent
equivalence evidence, then a separately specified idempotent backfill. An
unresolved count is preferable to a false match.

## Official research

Sources discovered through MCP search and opened on 2026-10-11:

- [TMDb finding data](https://developer.themoviedb.org/docs/finding-data) and
  [find by ID](https://developer.themoviedb.org/reference/find-by-id): external-ID
  lookup is distinct from text search; an empty result is not a replacement ID.
- [TMDb season details](https://developer.themoviedb.org/reference/tv-season-details):
  reads are scoped to series and season. Our complete-response validation remains.
- [Plex TV naming and ordering](https://support.plex.tv/articles/naming-and-organizing-your-tv-show-files/):
  Plex documents provider-dependent episode orders and season-zero specials.
  Review the selected order before changing source metadata; do not make a
  library-wide change to address one episode.
- [W3C error suggestion](https://www.w3.org/WAI/WCAG22/Understanding/error-suggestion.html):
  provide useful known corrections without compromising purpose or safety. These
  provider gaps are not necessarily user input errors; this informs guidance,
  not a claim of complete WCAG conformance.
- [W3C status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html):
  concise programmatic status without focus movement; detailed evidence stays
  navigable outside the live region.
- The official [Plex API index](https://developer.plex.tv/pms/) was discovered;
  opening exceeded the research tool's size limit. Do not claim it verified a
  missing-IDs behavior; that finding comes from bounded live read-only responses.

## Random PR trial

Fresh open enumeration returned #555 and #556; `Get-Random` selected
[#556](https://github.com/cloudbyday90/Classifarr/pull/556), head
`a62b4d210fda8579fa961a5da3d6a7b6e3d7b888`.
Review and locally trial the exact server Node declarations 26.6.4 / undici-types
8.9.0 change, keeping install policy intact. No PR merge or runtime migration.
Restore if Node 24 alignment or typechecks fail. New declarations can expose APIs
absent from the deployed runtime; [DefinitelyTyped's versioning guidance](https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/README.md)
supports matching declarations to the library version. Record actual checks in
the separate outcome document.
