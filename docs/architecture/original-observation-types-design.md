# Original observation types in library UTC coverage

Date: 2026-09-07. Official sources checked in September 2026.

## Problem and semantics

The [library UTC outcome](library-utc-coverage-outcome.md) identified that captured
provenance combines imported membership, manual actions and classifier workflows.
A combined capture percentage cannot describe the composition of evidence that
may support future automation. Add automatic counts for these original observation
types within the existing UTC window, with an explicit unknown-origin category.

| Type | Validated original methods | Meaning and limit |
| --- | --- | --- |
| Imported membership | `source_library`, `authoritative_source_library`, `existing_media` | An existing placement observation, not independent classification truth |
| Manual action | `manual_classification`, `manual_correction` | A recorded manual action, not automatically a blinded reference label |
| Classifier workflow | Existing `CLASSIFIER_CAPTURE_METHODS` allowlist | Includes attempts, retries, fallbacks and no-candidate results; does not imply a successful route |
| Unknown origin | Missing/invalid/unsupported provenance or an unmapped original method | Never infer origin from the mutable recorded method |

Only validated capture envelopes supply original methods. A valid envelope that
records an invalid or absent candidate still identifies the original workflow.
Unknown origin and unknown recording time are distinct: unknown-time history is
excluded from every recent observation-type count. The four types partition UTC
window events. Known-type counts cannot exceed captured provenance. No per-type
capture percentage is reported: missing original methods cannot be assigned to a
known type, so that percentage would conceal the unknown population.

## Implementation and security

Extend the existing materialized UTC population with a fixed observation type,
then add four filtered counters to its existing per-library aggregation. Nest
them as `observation_types` in each projected row and global totals. Reuse the
same 200 library rows and explicit truncation; do not multiply groups by type.
Globals include all libraries. Complete row sums must match every global type;
capped sums must not exceed them. Validate nonnegative safe integers and both the
type partition and its relationship to captured provenance on server and client.

Keep taxonomy SQL and count projection in small ESM modules. SQL structure comes
only from internal constants, and the existing limit remains bound server-side.
No request-controlled SQL, raw metadata, new endpoint, schema migration, provider
call, write or routing change is needed. Preserve authentication, no-store
responses and the read-only statement timeout. Vue escapes catalog names.

Present a separate compact native table beside the existing library UTC table,
with a descriptive caption, row/column headers, keyboard scrolling and ordinary
wrapping prose. Show all-library type totals even when rows are capped, and
repeat the common UTC window/scope. No filters, annotations or other controls are
introduced. Unsupported older responses display unavailable rather than zeros.

## Research and recommendation stack

URLs were discovered through web search/MCP and read from official sources.

| Recommendation | Pros | Cons / alternative | Source |
| --- | --- | --- | --- |
| Filtered counters in the existing grouping | One population, no extra grouping cardinality | Four counters add aggregate work; measure before adding indexes | [PostgreSQL SELECT and FILTER](https://www.postgresql.org/docs/18/sql-select.html) |
| Keep unique ID ordering and existing cap | Stable bounded rows and complete global totals | Some libraries remain omitted in large catalogs | [PostgreSQL LIMIT](https://www.postgresql.org/docs/18/queries-limit.html) |
| Fixed taxonomy and bound values | Restricts SQL structure to trusted code | Taxonomy changes require reviewed code and tests | [OWASP parameterization](https://cheatsheetseries.owasp.org/cheatsheets/Query_Parameterization_Cheat_Sheet.html) |
| Separate simple table with native headers | Easier associations than a larger multi-level matrix | More vertical page space and horizontal scrolling | [W3C table headers](https://www.w3.org/WAI/tutorials/tables/two-headers/), [W3C multi-level alternatives](https://www.w3.org/WAI/tutorials/tables/multi-level/) |
| Caption and prose explaining unknowns | Makes scope and limitations available without interaction | Longer explanatory copy | [W3C caption and summary](https://www.w3.org/WAI/tutorials/tables/caption-summary/) |

Recommended stack: validated immutable original methods, fixed SQL taxonomy,
existing bounded UTC aggregation, strict ESM projections, and a small escaped
Vue table verified in PostgreSQL and browser tests. Defer per-type percentages,
inferred legacy origin, configurable taxonomies and a library-by-type-by-day
matrix. Independent labels, readiness and frozen-study preflight continue to
gate review-only semantic counter-evidence.

## Writer correction discovered during live validation

A new source-library history event appeared with a known recording time but no
original capture envelope. The queue membership writer and manual queue writer
insert history directly, bypassing the classifier persistence capture. Both now
use a small shared metadata builder that preserves unrelated fields and replaces
caller-supplied capture data with the fixed current non-classifier method and
`not_applicable` candidate status. It records no candidate library. Existing rows
are not backfilled, and later resolution does not rewrite original provenance.
