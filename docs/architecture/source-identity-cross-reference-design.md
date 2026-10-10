# Source identity cross-reference diagnosis

## Decision — 2026-10-10

Add an explicit, read-only `--cross-references` mode to the existing source
identity evidence replay command. Keep automatic recovery and the ordinary
replay unchanged. A populated Plex description or poster is not proof that its
catalog identifiers agree.

Local inspection found nine conflicting TVDB candidate sets in which one ID
mapped to the declared TMDb series and another had no series match. Some find
responses also contained season or episode results. Those are separate result
types, not permission to treat an episode or season as a series. Two other
sampled items had multiple TMDb candidates and inconclusive external evidence.
These are observations from local data, not a fresh diagnosis of Unraid.

## Contract and bounds

- Reuse the existing current, complete full-capture query and rotating library
  window inside a short read-only transaction; finish it before HTTP calls.
- Inspect at most 12 observations, four per library, in a 12-library window.
  Fresh installations with no conflicts perform no provider work.
- Require valid, bounded candidate arrays and a source snapshot digest. Query
  each declared IMDb/TVDB candidate separately, with at most four lookups per
  item. Exceeding the bound rejects the entire item, without truncating evidence.
- Concurrency is one per invocation. Use existing rate limiting, 10-second
  request timeouts and 1 MiB response limits; a two-minute invocation deadline
  cancels in-flight HTTP. Database statements are limited to 10 seconds, locks
  to one second. No retry, scheduler, persisted cooldown or new cache is added.
- Re-read the source after catalog reads. Discard catalog findings if the type,
  digest or candidates changed. Configuration is a read-only snapshot, not a
  continuing authorization to repair anything.
- Output only fixed aggregate categories and counts, with a run reference.
  Never emit titles, IDs, addresses, credentials, provider bodies or raw errors.
- Distinguish missing mappings, contradictory matches, matches outside declared
  candidates, invalid evidence, provider failure, source drift and cancellation.
  Partial/cancelled runs must report inspected versus selected observations.
- Even unanimous external matches are diagnostic only: this command does not
  verify title/year, acquire ownership, consume recovery attempts, write
  receipts, route media or change source metadata. Restart repeats safe reads;
  it cannot leave a partially applied repair. Memory safeguards are unchanged.

Completion means the bounded sample was inspected, not that the library is
fully covered or any unresolved item was repaired. Unknown failures remain
explicit and sanitized. Unraid, Plex configuration and shared Ollama stay
unchanged.

## Options and recommendation stack

| Option | Benefit | Cost / risk | Decision |
| --- | --- | --- | --- |
| Read-only per-ID diagnosis | Separates missing catalog mappings from contradictions | Additional bounded provider reads; no automatic repair | Implement first |
| Ignore an ID that finds no series | Could unblock some items | Absence is not proof an ID is wrong | Reject |
| Rematch every item in Plex | May refresh genuinely wrong metadata | Can disturb correct matches and ordering | Only after item-specific verification |
| Verified catalog/source correction | Addresses upstream inconsistency | Requires checking the authoritative record and human intent | Next investigation |

## Official research

Retrieved 2026-10-10 through the connected web research service:

- [TMDb Find By ID](https://developer.themoviedb.org/reference/find-by-id)
  searches across object types. TVDB is supported for shows, seasons and
  episodes; only the requested movie/series bucket is identity evidence here.
- [TMDb OpenAPI](https://developer.themoviedb.org/openapi/tmdb-api.json)
  documents distinct find-response buckets. Other buckets are counted only as
  diagnostic context, never used as substitute series matches.
- [Definitely Typed versioning](https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/README.md)
  ties declaration major/minor versions to the represented library version.
- [Node AbortSignal](https://nodejs.org/api/globals.html)
  documents timeout and combined signals used to cancel the diagnostic's
  remaining work without retaining an orphaned provider request.

## Independent open-PR trial

Random selection from the two currently open PRs chose
[server Node declarations #556](https://github.com/cloudbyday90/Classifarr/pull/556),
head `a62b4d210fda8579fa961a5da3d6a7b6e3d7b888`. Apply its exact
24.19.2 → 26.6.4 declaration update and undici-types 7.24.6 → 8.9.0 lock changes
locally, inspect/install with scripts initially disabled, and test the existing
toolchain policy and typecheck. The application targets Node 24: reject the trial
if it violates that contract, even if TypeScript accepts it. Do not merge the
PR, change runtime versions or weaken policy to keep the update.
