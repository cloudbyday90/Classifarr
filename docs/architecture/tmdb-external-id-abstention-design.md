# TMDb external-ID abstention design

Date: 5 September 2026. August 2026 practice baseline, checked against official
sources in September. Living provider and OWASP pages are not archived August
snapshots. The W3C recommendation below predates that baseline.

## Problem and decision

The previous title-matching fix leaves two external-ID risks: TVDB/IMDb lookup
filters malformed results and takes the first remaining ID, and the cascade
accepts TVDB before checking a supplied IMDb ID. OMDb IMDb metadata also wins
over a conflicting payload IMDb ID. Finally, the general TMDb helper converts
provider failure into an empty result, allowing the title fallback to hide it.

Use a pure ESM external-ID contract, a small queue orchestration module, and a
strict provider lookup alongside the existing general helper. Keep the existing
queue ID-or-null facade and conditional database writes. Represent intermediate
decisions explicitly as resolved, not-found, or review-required; do not use null
alone to decide whether fallback is safe.

Capture all applicable external declarations before any asynchronous lookup.
TVDB remains TV-only; movie tasks ignore TVDB declarations. Require valid
positive database-range TVDB IDs and exact `tt` plus 1–12 digits for IMDb IDs.
Null/absent declarations are unavailable. Supplied invalid declarations fail
closed. Matching-type OMDb IMDb aliases and the payload IMDb ID must agree;
contradictory aliases cannot silently disappear behind a preferred value.
OMDb data declaring another media type is ineligible as identity evidence.

For each lookup, require a selected movie/TV result bucket that is an array of
at most 20 entries. Validate every entry's ID and any explicit type before
checking uniqueness. Never filter corrupt entries into apparent uniqueness.
Repeated IDs, distinct multiple IDs, missing/malformed buckets and oversized
buckets require review. Other object buckets do not contribute identities to
the requested type. This cap is an application limit, not a provider guarantee
or HTTP body-byte limit. TMDb's find response has no search-page contract.

Make at most two sequential requests through the fixed TMDb base URL, existing
credentials, rate limiter and ten-second timeout. The strict adapter preserves
errors; it does not return a synthetic empty bucket. Use only fixed reasons in
the queue receipt/log, without provider content, error text, external IDs or
credentials. The general find helper retains its compatibility behavior.

## Acceptance and fallback rules

| Evidence | Decision |
| --- | --- |
| Existing valid source TMDb ID | Preserve it; no new external lookup |
| No applicable external IDs | Continue to existing conservative title matching |
| Every lookup valid but empty | Continue to existing conservative title matching |
| One external ID, one valid result | Accept the typed identity |
| Both external IDs resolve to the same typed ID | Accept corroborated identity |
| One ID resolves and the other returns no match | Review: incomplete external evidence |
| Distinct resolved IDs | Review: conflicting external IDs |
| Invalid declarations, ambiguity, duplicate IDs, malformed response or provider failure | Review; no title fallback or ID backfill |

Keep `tmdb_resolution` version 1 with fixed status/method/reason fields. The
new `external_ids` method describes combined evidence; single lookups use
`tvdb` or `imdb`. A terminal review receipt survives the enrichment metadata
write with a null ID. It has no routing or authorization authority. No review
screen, new API contract, database migration, historical repair or release is
part of this fix. Source-library history continues recording inventory facts.

## Official research and application

[TMDb Find By ID](https://developer.themoviedb.org/reference/find-by-id) searches
multiple object types in one response. Its contract does not promise that a
selected bucket contains exactly one identity. [TMDb Finding Data](https://developer.themoviedb.org/docs/finding-data)
distinguishes external-ID lookup from text search. Retaining type boundaries and
not replacing ambiguous external evidence with a title guess are application
decisions based on these contracts.

[OWASP Input Validation](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
recommends early syntactic and semantic validation of external feeds. Validate
the whole relevant bucket and the agreement of individually valid declarations.
Parameterized SQL and existing guarded writes remain necessary; validation
does not replace those controls.

[W3C Data on the Web Best Practices](https://www.w3.org/TR/dwbp/) recommends
quality and provenance information that consumers can use to assess suitability.
The versioned minimal receipt applies that principle without retaining raw
provider evidence. W3C does not prescribe our schema, threshold, or acceptance
rules. Identifier comparison remains exact; no Unicode or fuzzy title changes
are needed for this fix.

For the proposed review UI, W3C's WCAG 2.2 guidance covers
[keyboard operation](https://www.w3.org/WAI/WCAG22/Understanding/keyboard.html),
[visible labels and instructions](https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions.html),
and [text descriptions of detected input errors](https://www.w3.org/WAI/WCAG22/Understanding/error-identification).
These are requirements to carry into that separate UI task; this backend change
does not claim to implement or certify a new accessible review interface.

## Alternatives and recommendation stack

| Approach | Pros | Cons | Recommendation |
| --- | --- | --- | --- |
| First valid result and provider priority | Fewer requests, high apparent coverage | Hides ambiguity and conflicting evidence | Remove for queue identity |
| Deduplicate or discard malformed rows | Tolerates provider anomalies | Can manufacture apparent uniqueness | Reject |
| Unique typed result with agreement of all supplied IDs | Deterministic, explainable, conservative | Up to two requests; more review | Adopt |
| Title fallback after ambiguity or outage | More automatic matches | Erases uncertainty and weakens the external-ID check | Reject |

Recommended stack: captured declarations → strict provider adapter → whole-bucket
validation → cross-ID agreement → explicit decision → minimal receipt → guarded
writes. Tests must verify that terminal uncertainty cannot be overwritten by
later title matching, including actual PostgreSQL and local Compose execution
with stubbed providers and rolled-back temporary tables.
