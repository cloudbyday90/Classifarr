# Library-agnostic source-to-catalog mapping plans

## Decision — 2026-10-10

Preserve the operator's source grouping. Do not split Plex shows, select a
preferred ID by library name, or treat descriptions as proof of catalog identity.
The domain is a source item on a configured media server, not a Plex-specific
library. The same rules apply to movie and TV libraries and to supported source
adapters. A target remains explicitly TMDb because current consumers use TMDb;
the source-neutral contract is not a claim of arbitrary target-provider support.

Implement an offline, bounded mapping-plan validator first. It accepts whole-work
movie/TV proposals or explicit source-season to TMDb-series/season edges. It
never activates a mapping, selects a real target, changes inventory, or marks an
issue resolved. Structural validity is not catalog verification or authorization.
This is a foundation for review, not the completed mapping feature.

## Why a scalar override is insufficient

The current code has several distinct responsibilities:

| Consumer | Current assumption | Required mapping behavior before activation |
| --- | --- | --- |
| `mediaSyncItemQueries.mjs` | One source row and scalar TMDb ID | Keep source membership singular; store scoped edges separately |
| `mediaSyncIdentityRecovery.mjs` | Independent evidence establishes one work | Never turn a partial season match into a whole-work receipt |
| `queueInventoryTmdbRefill.mjs` | One enrichment target per item | Enrich catalog works separately; do not overwrite source descriptions |
| `inventoryDescriptionCorpus.mjs` | Group by typed work ID or private source key | Keep whole-source descriptions source-scoped; avoid duplicate evidence |
| `mediaSyncLibraryStateService.mjs` | Exact scalar ID means existing media | Distinguish whole, partial and unknown coverage before suppressing acquisition |
| Policy/comparison/routing consumers | Whole-work evidence and destination intent | Require compatible scope; mapping does not grant routing authority |

Mapping identity must not encode a library name, destination, policy, genre or
provider URL. Source identity uses configured media-server ID, opaque external
item ID and media type. Library membership remains necessary for authorization,
enabled-state checks and freshness. A move or configuration revision requires
revalidation; it must not copy permission or infer identity from matching titles.
The existing identity digest also binds the current source library key. It is an
invalidation condition, not the permanent identity of the mapping.

## Contract and bounds

`source_catalog_scope_plan.v1` contains `intent: preserve_source_grouping`,
`source` and `scope`. The source has `mediaServerId`, `externalId`, `mediaType`
and `identityDigest` from the existing source-evidence algorithm. Submitted
digests are untrusted claims until independently re-read during future review.

- `whole_work`: one typed `tmdbId`; valid for movie or TV proposals.
- `seasons`: TV only; explicit `sourceSeasonNumbers`, `coverage` (partial or
  complete), and `mappings` with `sourceSeason`, `tmdbSeriesId`, `tmdbSeason`.
- Season zero is valid. No duplicate source season, duplicate target tuple,
  unknown source season, empty edge list, or mixed whole/season scope is allowed.
- Complete means all **declared** source seasons are mapped, not that a live
  source was inspected. Partial requires at least one declared unmapped season.
- Maximum 256 declared seasons/edges, 64 target works, season number 0–10,000,
  positive PostgreSQL integer IDs and 500-character opaque source IDs.
- CLI input is one UTF-8 JSON document on stdin, at most 32 KiB, within ten
  seconds. Unknown keys/versions and unsupported episode-range/alternate-order
  proposals are rejected, not approximated as season mappings.

The report contains fixed status/reason fields, aggregate counts and a canonical
SHA-256 plan fingerprint. It never repeats source IDs, catalog IDs, titles,
credentials or submitted text. The fingerprint changes with source identity,
evidence, coverage or mappings but not array/property order. It is not a signature,
approval token or persisted receipt. Every report has `canApply: false`.

This command imports no database/provider runtime. There is no admission queue,
lease, retry budget, cooldown, network request, cache or background work. Fresh
installs do nothing. Invalid input fails; interrupted input has no effects;
restarting repeats a pure review. Successful completion means structural checks
passed, not that a mapping is safe to use. Existing imports, ownership fences,
optional vectors and memory safeguards remain unchanged.

### Try the synthetic example

From the repository root, using the pinned Node toolchain:

```sh
node server/src/scripts/runSourceIdentityExternalEvidenceReplay.mjs --scope-plan < scripts/fixtures/source-catalog-scope-plan.synthetic.json
```

PowerShell:

```powershell
Get-Content -Raw scripts/fixtures/source-catalog-scope-plan.synthetic.json | node server/src/scripts/runSourceIdentityExternalEvidenceReplay.mjs --scope-plan
```

The file is deliberately synthetic; do not substitute its IDs or digest into a
real recovery action. This mode has no apply flag and requires no credentials.
For a whole-work draft, replace `scope` with
`{ "kind": "whole_work", "tmdbId": 30 }`; the source media type distinguishes movie
and TV namespaces. Keep real proposals in private storage, not version control.

## Activation design — deliberately deferred

1. Collect fresh, bounded source identity **and episode/season membership** through
   the configured adapter. Series-level GUIDs alone cannot establish season scope.
2. Verify typed target details and numbering/order compatibility outside database
   transactions. A matching season number alone is insufficient. Split episodes,
   regional cuts and alternate orders require episode-level evidence or refusal.
3. Have an authenticated administrator review each mapping in a preview bound to
   source/configuration revisions, current membership, proposed edges and expiry.
   Record actor/intent server-side; never accept an actor or approval from JSON.
4. Store normalized source bindings and edges with foreign keys, uniqueness and
   row checks. Do not change `tmdb_id` into an array or accept client claims as
   verified evidence. Scope activation and revocation need optimistic concurrency
   plus the existing ingestion fence, audit history and idempotent commands.
5. Enable consumers deliberately: enrich per target, deduplicate source evidence,
   represent partial possession, and preserve routing consent. Invalidate on
   source/layout/configuration changes; retain inventory and re-review, not reset.

No schema or active mapping is introduced before these contracts are implemented
and exercised together. A library rename must not change mapping semantics; a
disabled, moved, deleted or inaccessible source must not retain usable authority.

## Options and recommendation stack

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Pick one ID or drop unmatched IDs | Small implementation | Misrepresents combined works and may suppress valid requests | Reject |
| Force source shows into separate entries | Fits scalar consumers | Changes user organization and shared Plex behavior | Reject as default |
| Treat every linked work as fully owned | Easy many-to-many relation | Partial seasons become false whole-series ownership | Reject |
| Typed, explicit scoped mappings | Preserves grouping and catalog boundaries | Needs evidence, review, storage and consumer changes | Recommended architecture |
| Bounded offline draft validation | Testable contract with no production effects | Does not yet repair unresolved items | Implement this round |

Next implement source-layout capture and typed catalog-scope preview, then durable
admin review and scope-aware consumers. Do not activate mappings piecemeal.

## Official research

Retrieved through MCP on 2026-10-10:

- [TMDb season details](https://developer.themoviedb.org/reference/tv-season-details)
  identifies seasons by series ID and season number, supporting a typed tuple
  rather than a globally unique season number.
- [TMDb episode groups](https://developer.themoviedb.org/reference/tv-episode-group-details)
  distinguishes aired, absolute, DVD, digital, story-arc, production and TV
  groupings. Therefore equal season numbers are not sufficient identity evidence.
- [PostgreSQL 18 constraints](https://www.postgresql.org/docs/18/ddl-constraints.html)
  recommends foreign-key/unique/exclusion constraints for cross-row relationships,
  not a CHECK expression that queries other rows. Apply this when storage lands.
- Official [Plex organization](https://support.plex.tv/articles/naming-and-organizing-your-tv-show-files/)
  and [merge/split](https://support.plex.tv/articles/201018248-merge-or-split-items/)
  pages were found through search; direct retrieval returned 403. Search snippets
  mention ordering differences, but full-page contents were not verified here.

## Independent PR trial

Fresh enumeration found open PRs #555 and #556. Random selection chose
[#556](https://github.com/cloudbyday90/Classifarr/pull/556), head
`a62b4d210fda8579fa961a5da3d6a7b6e3d7b888`: server `@types/node`
24.19.2 → 26.6.4, `undici-types` 7.24.6 → 8.9.0. Registry integrity matches
the immutable patch; neither added package declares install scripts. Apply the
exact trial, test locally and revert if the Node 24 gate fails. Do not widen the
runtime or weaken checks. [Definitely Typed versioning](https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/README.md)
ties declaration major/minor to the represented library; latest is not necessarily
appropriate for the installed runtime. No PR merge is authorized.
