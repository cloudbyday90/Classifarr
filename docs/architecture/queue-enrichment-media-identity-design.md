# Queue enrichment media identity design

Date: 4 September 2026. August 2026 practice baseline, verified against official
sources on 4 September. Living documentation is not an archived August snapshot.

## Problem and decision

Queue refill takes media type from the destination library and defaults missing
type to `movie`. OMDb and TMDb title lookup repeat that default. IMDb resolution
prefers any movie results before TV results, and ID backfill checks only item ID.
These paths can create a plausible but incorrectly typed identity before the
source-history validation boundary.

Use authoritative `media_server_items.media_type` during refill. Reject unknown
types rather than infer from a library. Share explicit nested/top-level type
validation with history persistence. Capture a canonical private payload before
asynchronous work. For item-backed tasks, verify the declared type against the
current source record before invoking enrichment, and recover missing IDs/library
metadata only from that matching record. Conflicting declarations or source
identity skip enrichment with a fixed diagnostic and an explicit non-enriched
task result. Operational database failures remain retryable task failures.

Provider methods also validate their inputs when called directly. TVDB lookup
is TV-only; IMDb lookup reads only the requested movie/TV result bucket. Title
search uses an explicit endpoint type and ignores malformed or conflicting
results. Retain the established title-ranking heuristic in this slice; typed
selection is not proof of a correct title match. Use normalized OMDb `imdbId`
as well as the legacy `imdbID` spelling and reject conflicting result types.

Guard ID backfill with the captured item ID and media type plus the existing
null-ID condition. Parameterize values and never overwrite a different existing
ID. Capture inputs before waits so caller mutation cannot retarget writes.
Apply the type condition to OMDb rating updates too. Metadata updates also check
library and resolved TMDb ID, and a zero-row update skips history creation.
Success logs require a row actually changed. These conditional statements do
not make the entire provider-to-history flow one atomic transaction.
No database migration, provider credential change, paid study run, automatic
routing, release, or historical correction is part of this change.

## Official guidance and application

[TMDb Find By ID](https://developer.themoviedb.org/reference/find-by-id) returns
multiple object categories together. Classifarr must select the bucket matching
its known type rather than use response order as identity evidence.
[OMDb's parameter reference](https://omdbapi.com/) distinguishes movie, series,
and episode. Keep Classifarr's existing `tv` to `series` adapter mapping.

[OWASP input validation guidance](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
recommends early syntactic and semantic validation of external inputs. Apply
allowlists both to task declarations and provider results.
[node-postgres query guidance](https://node-postgres.com/features/queries)
supports keeping data in bound parameters rather than SQL interpolation.

[W3C Data on the Web Best Practices](https://www.w3.org/TR/dwbp/) discusses
identifiers, provenance, and data quality. Preserving item type from its source
record and reporting skipped enrichment accurately applies those principles;
W3C does not prescribe this schema. No browser interface changes are needed.

## Alternatives and recommendation stack

| Approach | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Remove only literal movie defaults | Small patch | Leaves cross-type IMDb selection and stale writes | Insufficient |
| Infer type from library or provider response | More apparent completion | Invents identity and hides ambiguity | Reject |
| Shared contract, source check, typed providers, conditional writes | Preserves type throughout the queue path; independently testable | Extra source read; malformed/stale tasks stop enriching | Adopt |
| Hold a database lock during provider calls | Stronger serialization | Locks span network waits and outages | Reject |

Recommended stack: authoritative item type → captured explicit-type contract →
source-record admission → typed provider selection → conditional ID backfill →
existing typed history persistence. Keep modules focused and ESM-only.

## Validation and boundaries

Use unit regressions for missing/conflicting types, canonicalization, source
disagreement, movie/TV IMDb collisions, malformed result IDs, provider failures,
and mutation during waits. Exercise refill SQL and type-guarded backfill using
temporary PostgreSQL tables in integration tests and existing local Compose.
Use stubbed provider responses so these tests cannot spend provider credits.

Existing title matching can still select a weak first result; removing that
automatic ID backfill is the next priority. Concurrent history deduplication and
other enrichment retry/reprocess entry points require separate review. This
change does not certify all platform writers or the historical
inventory. Keep semantic counter-evidence gated by the existing independently
labelled, held-out study and review-only readiness/preflight contracts.
