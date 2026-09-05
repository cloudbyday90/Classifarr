# TMDb title-match abstention design

Date: 4 September 2026. August 2026 practice baseline, checked against official
sources on 4 September. Living provider documentation is not an archived August
snapshot; the W3C string-matching reference below is a dated July working draft.

## Problem and decision

Queue title resolution accepts the first search result when title/year matching
fails. It also accepts the first exact match when several distinct items match.
The shared search helper truncates results to ten and drops pagination, so it
cannot prove that the considered response is complete.

Create a separate queue identity-search adapter and a pure ESM match contract.
Keep general interactive TMDb search unchanged. Require an explicit movie/TV
type, a nonblank bounded title, and a valid four-digit year before title lookup.
Send the title and provider-specific year filter separately: movie primary
release year or TV first-air-date year. Use the existing fixed TMDb base URL,
rate limiter, credential lookup, adult-content policy, and request timeout.

Accept only a complete, bounded single-page response with consistent pagination
and result counts. Do not scan extra pages or silently truncate candidates.
The application cap is 20 candidates and 500 UTF-16 code units per title; it is
not a transport byte limit. The existing HTTP client decodes the body before
this validation. Provider response completeness is not catalogue completeness.
Validate IDs, types, titles, and dates; malformed or conflicting rows cause
abstention. Require exactly one distinct matching identity with an exact year
and either localized or original title. Duplicate IDs in a response are treated
as a provider integrity problem, not extra confidence.

For comparison only, use NFC normalization, Unicode lowercase conversion,
NFC again, and trimmed/collapsed whitespace. Preserve punctuation, accents,
script distinctions, and word order. This is not full Unicode case folding,
transliteration, fuzzy matching, or a claim that titles uniquely identify media.
Same-title/year collisions, missing years, incomplete responses, and weak
matches remain unresolved. External-ID resolution remains a separate path.

Persist a small versioned resolution receipt in existing enrichment metadata:
resolved or review-required status, method, and a fixed reason. It contains no
candidate IDs/titles, response content, credentials, or exception text. Retain
the existing ID-or-null resolver facade and conditional writes. No-match items
keep a null TMDb ID and the existing source-library history semantics. A later
successful ID resolution replaces an old review receipt.

## Official research

[TMDb movie search](https://developer.themoviedb.org/reference/search-movie)
supports original/translated/alternative titles and a primary-release-year
filter. [TV search](https://developer.themoviedb.org/reference/search-tv) separates
first-air-date-year filtering from matching any episode's airing year. These
are search facilities, not guarantees that the top result is the same item.
The linked [official OpenAPI schema](https://developer.themoviedb.org/openapi/tmdb-api.json)
also exposes pagination and raw movie/TV title/date fields. Retaining those
fields avoids relying on the application's display-only mapping.

The [W3C Character Model draft of 16 July 2026](https://www.w3.org/TR/2026/WD-charmod-norm-20260716/)
explains Unicode equivalence and the distinction between case conversion and
case folding. It is a working draft, not a completed W3C Recommendation. Our
documented comparison policy deliberately avoids compatibility folding and
accent removal; unsupported equivalences cause review instead of guessed IDs.

[W3C Data on the Web Best Practices](https://www.w3.org/TR/dwbp/) motivates
accurate quality/provenance records. The receipt applies those principles;
W3C does not prescribe this application schema or matching threshold.
[OWASP validation guidance](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
supports validating external responses semantically as well as syntactically.

## Alternatives and recommendation stack

| Approach | Pros | Cons | Decision |
| --- | --- | --- | --- |
| First result or first exact result | High apparent coverage | Wrong matches and hidden ambiguity | Remove |
| Fuzzy title score or provider popularity | Handles spelling differences | Uncalibrated identity decisions | Reject for backfill |
| Exact normalized title/year plus complete bounded response | Deterministic, testable, conservative | More unresolved items; same-title/year identities still need care | Adopt |
| Fetch every search page | Broader search coverage | Unbounded calls, latency, changing result sets | Do not add |

Recommended stack: captured typed request → bounded provider search → complete
response validation → unique exact title/year decision → fixed resolution
receipt → existing conditional ID and metadata writes.

## Review and validation boundary

There is no dedicated media-ID matching review screen or mutation endpoint in
the inspected queue/media-sync flow. This fix retains unknown IDs and records
review reasons in existing item metadata for operator inspection; it does not
route media or create a classification-review decision. A dedicated authenticated
ID-review workflow is a separate product task. Existing read APIs keep their
current shapes, with additive metadata only.

Test Unicode composition, original/localized titles, remakes, missing/bad years,
multiple exact matches, duplicate/malformed IDs, the eleventh candidate,
pagination/count mismatch, provider failures, and caller mutation. Exercise the
actual resolver-to-backfill/history path in PostgreSQL temporary tables and
local Compose with stubbed providers. No historical correction, release,
semantic counter-evidence rollout, or paid study run is included.
