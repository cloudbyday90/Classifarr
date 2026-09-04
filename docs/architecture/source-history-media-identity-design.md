# Source-library history media identity design

Date: 4 September 2026. Research baseline: August 2026 practices, verified
against official sources on 4 September. Living documentation is not a
historical snapshot of its exact wording on 31 August.

## Problem and decision

Source-library history checks duplicates by TMDb ID and destination without
media type. Its no-TMDb fallback also omits type. Insertion separately reads
the payload's nested type and defaults an absent value to `movie`. Thus the
lookup and write can describe different identities, and unknown media can
be recorded as a confident movie classification.

Use shared ESM identity primitives with history scoring, a dedicated source
history contract, and parameterized query builders. Resolve explicit nested
`media.media_type` and top-level `media_type` declarations, normalize movie/TV
casing and whitespace, and reject disagreements or invalid declarations.
Missing type is not inferred from a destination library.

Require a valid positive database library ID, a nonblank title of at most 500
characters, and either a valid TMDb ID or an explicitly absent ID. Only null
or undefined means absent; malformed supplied IDs do not enter title fallback.
Preserve exact title bytes and case for fallback rather than introduce fuzzy
matching. Unknown-ID identities remain scoped to type, title, and library;
same-title remakes remain a known limitation of this existing fallback.

Prepare the payload snapshot and insert parameters synchronously before
database checks. Reuse the captured identity for lookup and insertion so
caller mutation across an `await` cannot change the record. Both direct
insertion and the normal persistence entry point must validate identity.
Invalid input skips history creation with a fixed diagnostic reason containing
no raw title, ID, payload, or exception text. Preserve the established queue
call signature, stored graph metadata, and existing completed/source-library
semantics for valid inputs. Do not rewrite old history or add a release.

## Official guidance

TMDb identifies [movies](https://developer.themoviedb.org/reference/movie-details)
and [TV series](https://developer.themoviedb.org/reference/tv-series-details)
through separate typed resources. Retaining that type alongside the numeric
ID is consistent with Classifarr's existing identity model.
[OWASP input validation](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
supports early syntactic and semantic allowlist checks.
[node-postgres query guidance](https://node-postgres.com/features/queries)
supports binding values separately from static SQL. Validation and parameter
binding serve different purposes and are both required here.

[W3C Data on the Web Best Practices](https://www.w3.org/TR/dwbp/) addresses
identification, data quality, and provenance. Apply those principles to explicit
identity and accurate history metadata; this is an application-level design
choice, not a claim that W3C specifies this database schema. No UI or browser
accessibility behavior changes in this slice.

## Upstream boundary discovered during validation

This contract validates the payload presented to persistence; it cannot prove
how a producer obtained that identity. `queueRefillService.mjs` currently
selects `l.media_type` and defaults missing type to `movie` when building
enrichment payloads. `queueTmdbResolutionService.mjs` and
`queueOmdbEnrichmentService.mjs` also retain nested-type defaults for provider
lookups. These can present a guessed value as an explicit declaration before
this boundary. They require a separate producer-to-enrichment contract,
including tests of ID resolution and backfill, and are the next priority.

Do not treat this persistence fix as an end-to-end removal of identity
inference. Existing already-queued payloads and historical records also lack
enough provenance to distinguish a guessed type from an authoritative one.

## Alternatives and recommendation stack

| Approach | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Add type only to duplicate SQL | Small patch | Leaves defaulted inserts and mutable input disagreement | Insufficient |
| Shared identity validation plus captured parameterized writes | Consistent lookup/write identity, focused tests, no migration | Invalid legacy inputs stop creating history | Adopt |
| Infer missing type from library or title | More records appear complete | Invents identity and can preserve incorrect evidence | Reject |
| Add uniqueness or locking now | Can address concurrent duplicate writers | Requires a separate concurrency contract and existing-data analysis | Follow-up |

The recommended stack is shared identity primitives → source-history contract
→ immutable input snapshot and parameterized queries → existing queue service.
Test movie/TV collisions, null-ID title collisions, invalid/conflicting types,
malformed supplied IDs, direct insertion, and mutation during database waits.
Exercise actual SQL using temporary tables in PostgreSQL and local Compose.

## Concurrency boundary

The current existence check and insert are separate operations. This fix
corrects their identity contract but does not make concurrent workers atomic.
[PostgreSQL INSERT guidance](https://www.postgresql.org/docs/18/sql-insert.html)
explains the role of unique indexes in concurrent insertion. A follow-up should
compare a suitable uniqueness constraint with coordinated transaction-level
locking, account for historical duplicates, and prove behavior with two
connections. Preserve historical records during that analysis.
