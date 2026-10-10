# Catalog consumer boundary audit and first repair

## Decision — 2026-10-10

The next mapping step requires auditing real consumers before activation. The
current draft/evidence APIs deliberately do not persist or approve mappings.
This round repairs the first concrete consumer defect found by that audit:
classification embedding queries multiply history rows through a many-to-one
inventory join, and their poster eligibility differs from the poster resolver.
The local read-only check found four history rows with multiple inventory matches.
This does not explain or repair the twelve unresolved Unraid identities.

Keep source grouping, scalar identity safeguards and memory limits unchanged.
Do not introduce an untrusted metadata flag that can approve season mappings.
Full season-aware metadata, classification and backfill are not enabled here.

## Consumer inventory

| Consumer | Current assumption | Required mapping behavior / this round |
| --- | --- | --- |
| `inventoryDescriptionCorpus.mjs` | Identity and history synopsis fallback use media type + TMDb work ID | Season evidence needs its own projected text and key; never borrow a whole-series synopsis for a partial scope |
| `liveInventoryDescriptionRepository.mjs` and training/calibration helpers | Optional models reconstruct the same scalar identity | Carry scope through documents, holdouts, model/cache fingerprints and evaluation; preserve ordinary source retrieval |
| `embeddingServiceQueries.mjs` | Joining every matching inventory row counts one history record more than once | Repair cardinality and share eligible poster selection with the resolver |
| `embeddingServiceImage.mjs` | Newest scalar match can supply a poster despite an unresolved source conflict | Exclude current conflicting/inactive memberships and use the same typed, deterministic candidate rule |
| `mediaSyncItemPersistence.mjs` | Source analysis receives one parent TMDb ID before persistence | Add a separately verified server-owned projection before any mapped metadata is consumed; never choose the first mapped series |
| Classification/routing and recovery writers | Whole-item decisions and scalar identity provenance | Explicit activation, revocation and source/configuration revalidation remain prerequisites; no draft is write authority |

This is an entry-point audit, not a claim that all downstream consumers now
support season mappings. The first repair is deliberately useful to existing
installations without inventing a persisted mapping format prematurely.

## Implementation contract

Create a small ESM poster-selection module used by statistics, pending selection
and actual poster resolution. Use one `LEFT JOIN LATERAL` candidate at most per
history record. Retain the existing typed `(media_type, tmdb_id)` whole-work
relationship, require positive IDs and active, same-type library/server membership,
and exclude recent retained source conflicts through the existing shared guard.
Choose newest eligible inventory artwork, breaking timestamp ties by item ID.
Library names and policy names never define identity.

Prefer valid history artwork over inventory fallback. Normalize both supported
poster field spellings consistently; blank, non-string, oversized or unsupported
formats do not mask an eligible alternate value. Support absolute HTTP(S) URLs
and TMDb root-relative paths, preserving existing downstream transport controls.
Use explicit shared control/whitespace ranges: PostgreSQL's locale-dependent
`\s` does not agree with JavaScript for non-breaking spaces. This is a format
check, not a replacement for downstream URL/transport security validation.
Do not fetch artwork, call AI, write data or start jobs from statistics/status.
Text-only queries do not need inventory joins. Pending lists have stable ordering
and one entry per classification. Existing embedding uniqueness is retained.

No migration, new endpoint, credential, cache, timer, cooldown, retry budget or
new concurrency exists. These are repeatable database reads; process death loses
only the read result. Existing scheduler admission and transport cancellation
remain outside this repair. Unknown database errors retain the existing safe
empty/null service fallback. No new raw URLs, IDs or provider errors are logged.
Neither the absence of a conflict nor artwork proves a scoped mapping approved.

## Verification and tradeoffs

Use isolated PostgreSQL fixtures for duplicate membership, same-number movie/TV
IDs, inactive memberships, retained conflicts, multiple poster spellings, direct
history precedence, null IDs, deterministic selection and count/list/resolver
agreement. Test the URL projection without network calls. Compare aggregate local
counts read-only; do not activate image backfill merely to exercise this code.

| Option | Benefit | Cost / risk | Decision |
| --- | --- | --- | --- |
| One shared eligible poster candidate | Correct counts and consistent work admission | Correlated lookup; needs real SQL tests | Implement |
| `COUNT(DISTINCT ...)` alone | Hides duplicated totals | Leaves duplicate work and unsafe poster selection | Reject |
| Ignore conflicting provider IDs | Clears warnings | Can combine different catalog works | Reject |
| Activate season mappings now | Immediate apparent recovery | Remaining scalar consumers can apply wrong metadata | Defer |

Recommended sequence: repair this boundary; introduce typed scope projections
through description/learning consumers; then implement durable explicit approval,
revocation and bounded release backfill. No release in this round.

## Official research

Discovered and opened through MCP on 2026-10-10:

- [TMDb season details](https://developer.themoviedb.org/reference/tv-season-details)
  addresses a season by series ID and season number. Our inference: a season
  mapping cannot safely be reduced to its parent series ID for every consumer.
- [PostgreSQL row comparisons](https://www.postgresql.org/docs/current/functions-comparisons.html)
  documents typed row equality and null behavior; missing IDs are not matching
  identities. Keep movie/TV distinctions and explicit eligibility conditions.
- [PostgreSQL 18 table expressions](https://www.postgresql.org/docs/18/queries-table-expressions.html)
  explains correlated lateral joins and preserving outer rows without a candidate.
  Our implementation combines that behavior with a deterministic one-row limit.
- [OWASP authorization guidance](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)
  supports server-side checks and safe denial. A successful browser preview is
  not authority for a later database write.
- [DefinitelyTyped versioning](https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/README.md)
  ties declaration versions to represented library versions, relevant to the
  separate Node-types PR trial below.

## Independent PR trial

Fresh MCP enumeration found two open PRs (#555 and #556); random selection again
chose [#555](https://github.com/cloudbyday90/Classifarr/pull/555), head
`4cbffcb7dd726af152382a1f92edb9dc326fe349`. Trial its exact client manifest/lockfile
change to Node types 26.6.4 / undici-types 8.9.0 using pinned Node 24.21.0 and
npm 12.2.0. Review registry integrity/lifecycle metadata, normal installation,
type checks, audit and tooling gates. Restore the original dependency set if the
runtime alignment guard rejects it; do not merge or change the Node baseline.
