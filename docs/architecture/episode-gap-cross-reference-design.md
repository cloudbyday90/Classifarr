# Episode gap cross-reference design

## Scope and prerequisites

The previous read-only sample found 39 episode-ID gaps among 834 episodes in
11 retained source groups. This is not the same measure as the 12 unresolved
items displayed on Unraid. Metadata visibility does not establish an unambiguous
external identity. Preserve source grouping across every library and adapter.

Add an explicit `--episode-cross-references` diagnostic mode. It first performs
the existing complete source capture and candidate-season comparison, then checks
only episodes missing a TMDb ID or carrying one absent from those candidates.
Use declared IMDb/TVDB episode IDs with TMDb Find; never search by title or infer
an episode ID from season/episode coordinates. Movies and fresh/empty setups do
no episode work. Disabled libraries and incomplete captures remain excluded.

## Contract and bounds

- No writes, retry scheduling, cooldown changes, cache persistence or mapping
  activation. A crash discards the run; rerunning bounded reads is safe. Existing
  ownership, memory and retry guards remain unchanged.
- Keep the existing 12-observation, four-per-library, 30-day sample and two-minute
  deadline; one provider request at a time. Retain source pagination, candidate,
  season and episode bounds. Add at most 64 external lookups per group and 128
  per run, charged before each request, including failures. Refuse a group that
  cannot fit rather than treating a truncated lookup set as agreement.
- Reuse the configured TMDb identity transport: ten-second requests, one-MiB
  decoded response limit, rate limiter and cancellation. Its existing Find
  transport redirect policy is unchanged; do not claim redirect refusal.
- Validate typed `tv_episode_results` and all returned result buckets. Multiple
  results, malformed tuples, duplicate/reused source declarations, other media
  results and missing mappings cannot establish agreement. Different ID, series
  or coordinate declarations remain explicit review outcomes.
- Provider failures are sanitized unavailable outcomes, malformed data is invalid,
  and exhausted budgets are limits, not negative matches. Cancel/deadline/unknown
  orchestration failure discards the run summary. No automatic retries.
- Full source digest recheck and database selection/configuration recheck still
  surround provider work. Database transactions end before HTTP. Source drift
  discards group findings; selection drift discards the entire summary.
- Output a reference UUID and aggregate counts only, never titles, identifiers,
  provider bodies, credentials or raw errors. `canApply`, `orderVerified` and
  `crossProviderVerified` remain false: TMDb's index is not a direct independent
  IMDb/TVDB verification, and episode evidence does not resolve the parent show.

Completion means a bounded diagnostic run finished, not that the unresolved
items were repaired. No schema migration or UI/API change is required.

From the installed application directory run:

```sh
node src/scripts/runSourceIdentityExternalEvidenceReplay.mjs --episode-cross-references
```

For the local test container, prefix that command with `docker exec classifarr`.
It accepts no URL, credential or apply argument. Run deliberately, not in a
polling loop; unavailable groups and budget refusals remain visible outcomes.

## Research and choices

Official sources retrieved through MCP on 2026-10-10:

- [TMDb Find](https://developer.themoviedb.org/reference/find-by-id) supports
  IMDb and TVDB episode lookups and returns multiple object types. Match only
  the requested episode type, not a show/movie bucket with the same numeric ID.
- [Plex metadata schema](https://github.com/plexinc/tmdb-example-provider/blob/main/docs/Metadata.md)
  separates external GUIDs, parent relationships and episode coordinates from
  descriptive metadata. External mappings are optional. This is provider-schema
  guidance, not a guarantee about every Plex Media Server response.
- [OWASP API resource consumption](https://api-security.owasp.org/editions/2023/en/0xa4-unrestricted-resource-consumption/)
  recommends bounded payloads, operation counts and resource consumption. Our
  sequential lookup budget and decoded-body cap apply that guidance to this
  diagnostic; these exact numeric limits are project choices, not OWASP defaults.
- [Definitely Typed versioning](https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/README.md)
  connects declaration versions to the represented library. The separate PR
  trial must preserve the deployed Node 24 contract, not merely install cleanly.

| Option | Benefit | Cost/risk | Decision |
| --- | --- | --- | --- |
| Bounded exact-ID diagnosis | Explains remaining gaps without source mutation | Additional read latency; catalog mappings may be absent | Implement |
| Guess from title/numbering | Could reduce visible counts quickly | Wrong series/episode associations, especially grouped shows | Reject |
| Activate whole-series mappings from episode agreement | Less operator work | Episode coverage cannot settle conflicting parent identities | Reject |
| Reviewed explicit scoped mappings | Preserves grouping with auditable intent | Needs a separate preview, approval and backfill contract | Next, after evidence review |

Recommended stack: immutable source capture → typed catalog membership → bounded
external-ID gap checks → separately reviewed scoped mappings → guarded backfill.
Do not change the source library or release/deploy production in this round.

## Verification plan

Cover missing/ambiguous/reused IDs, typed versus wrong-media results, tuple and
catalog disagreements, malformed/oversized responses, budgets, cancellation,
source/configuration drift and privacy. Exercise real HTTP transport and isolated
PostgreSQL, then the repository quality gates. Rebuild the local image without
cache from a clean source commit, run the aggregate diagnostic, and regenerate
the schema only in a disposable database from that exact image.
