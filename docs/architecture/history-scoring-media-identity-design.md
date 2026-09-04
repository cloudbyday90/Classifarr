# History scoring media identity design

Date: 4 September 2026. Research baseline: practices applicable in August
2026, checked using official sources on 4 September. Living documentation
does not establish the exact wording published on 31 August.

## Problem and decision

`scoreHistory` currently searches completed classifications by `tmdb_id` alone.
The database stores movie and TV records in the same table. Consequently, a
movie can inherit a TV record's confidence or occurrence count, or lose its
place in the five-library result limit to unrelated TV records.

Treat `(media_type, tmdb_id)` as the media identity. Validate the input before
querying, then bind both fields in the SQL `WHERE` clause before aggregation
and limiting. Preserve completed-status filtering, the five-library bound,
and the existing confidence formula/cap. Add `library_id` as a deterministic
tie-breaker. Missing or unsupported identity contributes zero history score;
do not infer the media type from the requested destination or fall back to an
ID-only query.

Extract history scoring from `policyEngineSourceScoring.mjs` into a small ESM
service and a pure query builder. Preserve the existing named export and
`policyEngine.scoreHistory` facade. Inject database access for focused tests;
do not add shared caches, schema changes, dependencies, or new API/UI contracts.
Accept positive integer IDs and decimal-string equivalents within PostgreSQL
`integer` range. Normalize surrounding whitespace and movie/TV casing, but
reject ambiguous aliases, non-decimal IDs, booleans, objects, and arrays.
Return zero for invalid aggregate values or database errors. Error logs must
not contain raw item data, IDs, SQL parameters, or database exception text.

## Official-source research

TMDb documents separate [movie details](https://developer.themoviedb.org/reference/movie-details)
and [TV series details](https://developer.themoviedb.org/reference/tv-series-details)
resources. Combined with Classifarr's existing paired-identity constraints,
this supports retaining the resource type with its numeric ID; treating a
bare ID as a global media identity is an application error.

[node-postgres query guidance](https://node-postgres.com/features/queries)
recommends passing values as parameters instead of concatenating SQL. Keep
the statement static and bind the validated TMDb ID and media type separately.
[OWASP input validation guidance](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
supports early syntactic and semantic validation using an allowlist. Input
validation supplements parameterization; it does not replace it.

[PostgreSQL SELECT semantics](https://www.postgresql.org/docs/18/sql-select.html)
put `WHERE` before grouping and limiting. Therefore filtering after the query
would be too late: incorrect records would already affect counts, confidence,
and the result limit. A stable library-ID tie-breaker follows PostgreSQL's
[ordering guidance](https://www.postgresql.org/docs/18/queries-order.html).

[W3C Data on the Web Best Practices](https://www.w3.org/TR/dwbp/) discusses
identifiers, provenance, and data quality. Applying those principles here
means retaining identity context and documenting the evidence used by the
scorer. This is an application of the guidance, not a W3C requirement for this
database schema. No browser interaction or accessibility change is needed.

## Alternatives and recommendation stack

| Option | Pros | Cons | Recommendation |
| --- | --- | --- | --- |
| Add one SQL predicate in the existing source-scoring file | Smallest patch | Leaves identity validation and isolated testing unresolved | Insufficient alone |
| Focused ESM query builder and scorer with paired identity | Clear contract, testable boundary, conservative fallback | Two small modules; malformed callers lose history evidence | Adopt |
| Normalize every identity consumer and rewrite stored history | Wider consistency | Broad scope and historical-data risk | Audit consumers separately |
| Infer missing media type from a library | Fewer zero scores | Destination becomes evidence for its own identity | Reject |

Recommended stack: validated media identity → parameterized PostgreSQL query
→ bounded numeric scoring → existing policy facade. Validate with collision
fixtures in PostgreSQL, existing policy-engine integration tests, and focused
input/error tests. Measure the existing index plan before adding an index.
Keep real inventory queries read-only and retain only aggregate local receipts.

The separate outcome document will record actual results, the open-PR check,
remaining limitations, and the next item. No release is part of this change.
