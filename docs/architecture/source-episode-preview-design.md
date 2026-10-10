# Episode catalog membership preview

## Decision — 2026-10-10

Extend the existing read-only CLI with `--episode-preview`. Compare source
episode TMDb IDs with independently fetched, typed catalog episodes across all
declared seasons of the source's candidate series. Report ID membership and
numbering separately. Never infer identity from titles, artwork, counts or a
library name. Preserve Plex grouping and remain compatible with Jellyfin/Emby.

The initial read-only Plex probe found TMDb, IMDb and TVDB episode IDs on all
96 episodes in one selected source group. A catalog-season probe confirmed typed
episode IDs, series IDs and season/episode coordinates are available. This is
shape evidence for one group, not proof that every unresolved item is correct.

## Contract

- Explicit CLI only; no scheduler, UI polling, database migration, persisted
  mappings, retry reset, automatic repair, classification or provider write.
  Fresh/empty selections make no provider requests. Restart repeats safe reads.
- Reuse the current conflict selection: at most twelve items, four per library,
  short read-only transactions ending before HTTP. Recheck the selected database
  configuration/window before returning and discard observed drift.
- Reuse bounded source enumeration: twenty pages of one hundred episodes, at most
  2,000 per group. Request episode provider IDs in those pages, not one request
  per source episode. Include all normalized IDs in the transient source digest.
  Missing IDs remain missing; malformed declarations invalidate the capture.
- Re-read the entire source layout after catalog inspection. Observed ID,
  membership or numbering changes discard the item's comparisons. No raw IDs,
  titles, credentials, paths, response bodies or untrusted error messages escape
  the aggregate-only report. No new retained cache or background memory cost.
- At most four candidate series, 64 catalog seasons and 10,000 catalog episodes
  per item; at most 128 season requests per run. Single concurrency, two-minute
  deadline, ten-second request timeout and 1 MiB decoded responses. Reuse the
  existing TMDb rate limiter; reject redirects on source and new season requests
  and reject invalid request identifiers. Existing series-detail transport is
  reused unchanged; it has not received a new redirect policy in this change.
- Validate series, season and episode identity and coordinates; reject duplicate
  episode IDs/positions, changed counts, conflicting series membership and
  malformed payloads. Fetch all candidate seasons before reporting absence.
  An exhausted budget or failed season cannot become a negative identity match.
- Outcomes distinguish missing/ambiguous/reused source episode IDs, IDs absent
  from the inspected candidates, matching numbering and different numbering.
  Count groups whose matched episodes span more than one catalog series. These
  are source-record relationships, not proof that files are playable or owned.
- Movie observations are explicitly not applicable to episode analysis. No
  assumption about movie libraries or destinations enters the comparison.
- Reports always say `canApply: false`, `orderVerified: false` and
  `crossProviderVerified: false`. Exact TMDb membership is not an independent
  IMDb/TVDB cross-check, proof of correct metadata, or proof of viewing order.
  Separate provider reads are not an atomic snapshot or an activation receipt.
- Per-item malformed/unavailable/budget outcomes contribute no partial episode
  findings. Cancellation, deadline, unknown failure or changed database selection
  discards the run summary. No memory, ownership or retry safeguard changes.

## Options and recommendation stack

| Option | Advantage | Cost / risk | Decision |
| --- | --- | --- | --- |
| Guess from titles or episode numbers | Few requests | Misidentifies alternate orders and grouped works | Reject |
| Fetch every episode independently | Rich cross-provider detail | Thousands of requests and substantial provider load | Defer |
| Enumerate candidate seasons and join exact episode IDs | Bounded requests; reveals numbering/group differences | Missing IDs and conflicting cross-links remain unresolved | Implement |
| Reviewed scoped mappings with consumer support | Preserves source grouping without claiming whole works | Requires authenticated review, revisions and revocation | Next |

Stack: episode membership evidence → authenticated mapping review (with separate
handling for missing or contradictory IDs) → durable scoped edges and scope-aware
consumers → guarded backfill. Never activate through whole-series scalar consumers.

## Official sources

Discovered/opened through MCP search on 2026-10-10:

- [Plex metadata schema](https://github.com/plexinc/tmdb-example-provider/blob/main/docs/Metadata.md)
  separates episode parent/index fields, external GUIDs and alternate season types.
- [Plex includeGuids discussion](https://forums.plex.tv/t/implemented-add-includeguids-url-parameter-to-return-external-guids/735620/)
  describes bulk external-ID retrieval to avoid per-item request amplification.
  Actual grandchildren behavior was checked against the configured Plex server.
- [TMDb season details](https://developer.themoviedb.org/reference/tv-season-details)
  addresses seasons by series ID and season number.
- [TMDb find-by-ID](https://developer.themoviedb.org/reference/find-by-id)
  supports typed episode results from IMDb/TVDB IDs; it is a separate cross-check,
  not a reason to reuse a series ID as an episode ID.
- [Jellyfin TV organization](https://jellyfin.org/docs/general/server/media/shows/)
  distinguishes special episodes, ordering and multiple versions.
- [Emby item information](https://dev.emby.media/doc/restapi/Item-Information.html)
  defines episode/season indices, combined episode ranges and provider IDs.
- [Definitely Typed version policy](https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/README.md)
  ties declaration versions to their target library versions. The search service
  retrieved the relevant section; direct page retrieval timed out. Node 26 types
  are not a substitute for testing the deployed Node 24 API surface.

## Independent PR trial

Fresh enumeration found open #555 and #556. Node crypto random selection chose
[#555](https://github.com/cloudbyday90/Classifarr/pull/555), head
`4cbffcb7dd726af152382a1f92edb9dc326fe349`: client Node declarations
24.19.2 → 26.6.4 and undici-types 7.24.6 → 8.9.0. Review/install/test this exact
patch separately. Retain only if compatible with the Node 24 runtime policy;
never weaken a gate or merge the PR. Record the actual outcome separately.

## Verification plan

Unit tests cover complete membership, alternate numbering, grouped series,
unknown/ambiguous/reused IDs, specials, empty/movie scopes and budget boundaries.
Real HTTP tests cover encoded typed requests, cancellation, redirect refusal and
decoded byte limits. Real PostgreSQL tests retain short read-only transactions,
unchanged observations and rejection after configuration/enablement drift.
Then run scoped coverage, lint/typechecks/preflight and full backend tests.
Rebuild local Compose without cache, evaluate the actual image, dump schema from
an isolated fresh database and verify cleanup. Production remains read-only.
