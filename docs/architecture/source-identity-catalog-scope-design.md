# Source identity: catalog scope and provider diagnostics

## Decision — 2026-10-10

Do not automatically discard a TVDB ID merely because TMDb has no series mapping
for it. A bounded, read-only recheck of eleven local unresolved items found stable
Plex evidence with artwork and descriptions, but incomplete cross-references.
Official public TVDB pages identify eight of the nine extra TVDB IDs as actual
series records, including specials, follow-on and regional records. The ninth
has not been authoritatively established. Two additional records represent a
trilogy and an anthology. None of this proves a safe one-to-one replacement.

These are differing catalog boundaries, missing cross-links, or unresolved
record histories—not proof of absent Plex metadata. Public pages are research
evidence, not an authenticated merge history or a new runtime identity source.
Private titles, identifiers and per-item notes stay outside the repository.

## Implementation contract

Extend only the explicit `--cross-references` diagnostic. Version its report as
`source_identity_cross_reference_diagnosis.v2` and retain the existing totals.
Add fixed IMDb/TVDB counters, including missing movie/series mappings that also
returned another object type. These counters describe **TMDb lookup responses**;
they do not assert that an ID is invalid, deleted, merged, or an episode ID.

Reuse the existing 12-item/four-per-library window, four-lookups-per-item cap,
single-request concurrency, two-minute run deadline, ten-second HTTP timeout,
1 MiB response limit, short read-only database transaction and final source
digest recheck. Add no HTTP calls, scraper, API key, cache, scheduler or writes.
Fresh setups with no current conflicts perform no provider work. Invalid or
unavailable responses remain separate from absent mappings; source drift,
cancellation and partial runs must not count unverified findings.

Completion means the selected bounded sample was inspected, not repaired.
Restart repeats safe reads, with no claims, persisted cooldown or retry-budget
changes. Existing recovery, ownership, configuration checks and memory
safeguards remain unchanged. Neither local observations nor public research
authorize changing Unraid, shared Plex/Ollama, or upstream catalog records.

## Options and recommendation stack

| Option | Benefit | Cost / risk | Recommendation |
| --- | --- | --- | --- |
| Provider-specific read-only counts | Shows which cross-reference needs investigation without private IDs | Does not repair catalog structure | Implement now |
| Ignore unmatched IDs | Clears some warnings | Can collapse a follow-on, special or different series into the wrong identity | Reject |
| Scrape TVDB pages during recovery | More apparent evidence | Unstable HTML, no verified merge history, new external dependency | Reject |
| Licensed TVDB API integration | Typed records and some explicit merge history | Authentication/licensing and a separate bounded provider design | Evaluate separately |
| Explicit scoped identity mapping | Can model verified one-to-many catalog relationships | Needs operator intent, provenance, invalidation and downstream tests | Design next |

Before any repair, establish the intended series/season scope and whether all
downstream consumers can represent it. A merge needs explicit typed evidence,
not a title similarity or a missing TMDb result. Keep unknown cases reviewable.

## Official research

Retrieved through MCP on 2026-10-10:

- [TVDB API guidance](https://github.com/thetvdb/v4-api/blob/main/README.md)
  describes licensed/subscriber access and explicit `mergeToType`/`mergeToId`
  fields for some duplicate-deletion updates. Series, seasons and alternative
  orders are distinct concepts; missing results alone do not establish a merge.
- [TVDB authentication](https://support.thetvdb.com/kb/faq.php?id=78)
  requires a project key and, for subscriber-supported access, a PIN. No new
  credentials, subscription or service integration was introduced here.
- [TMDb Find By ID](https://developer.themoviedb.org/reference/find-by-id)
  returns separate media-type buckets. A season/episode result cannot stand in
  for the requested series.
- [Definitely Typed versioning](https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/README.md)
  aligns declaration major/minor versions with the represented library.

Specific public catalog pages were independently opened for the private sample;
their per-title references are kept in the private investigation notes. Plex
support search results were discovered, but full-page retrieval returned 403;
they are not claimed as successfully retrieved documentation this round.

## Independent PR trial

Random selection from the two currently open PRs chose
[#555](https://github.com/cloudbyday90/Classifarr/pull/555), head
`4cbffcb7dd726af152382a1f92edb9dc326fe349`: client Node declarations
24.19.2 → 26.6.4 and undici-types 7.24.6 → 8.9.0. Registry metadata agrees with
the immutable patch and declares no new lifecycle scripts for these packages.
Apply and test locally with the reviewed install policy. Retain Node 24 and
revert the trial if the current runtime contract rejects it; do not weaken a
gate, upgrade the runtime, or merge the PR just to retain the change.
