# Cross-library inventory overlap design

Date: 2026-09-05. Status: implemented and locally verified; see the separate
[outcome](library-overlap-outcome.md).

## Problem and decision

Automatically maintained profiles now describe real inventory, with attributable
traits and source-safe enrichment. The next question is what libraries have in
common. Add a read-only comparison on the Libraries page, loaded automatically,
without provider requests, model calls, per-item setup, or classification writes.
Existing placements are observations, not independently verified labels.

## Contract and architecture

`GET /api/libraries/overlap` uses the existing authenticated library router and
named client API layer. A small query module obtains one PostgreSQL statement
snapshot; pure cohort and comparison modules calculate the response. This keeps
library profile row-based distributions unchanged while reusing their trait
normalization and typed TMDb provenance rules.

Select at most 12 active libraries in ascending library ID order. Report excluded
active libraries explicitly. Read at most 20,001 inventory IDs across the selected
libraries. If more than 20,000 exist, return `capacity_exceeded`, without sampled
counts or comparisons. Do not silently omit the tail of a library. Empty libraries
remain visible. Inactive libraries and unsupported media types are outside the
comparison; unsupported rows are counted separately.

Movie and TV identities are separate even when their TMDb numbers match. Collapse
duplicate placements within each library and media type. The intersection is the
number of shared distinct identities; report intersection / left identities and
intersection / right identities separately. Missing identities are coverage gaps.
No known identities on either side means insufficient coverage, not zero overlap.

Each distinct identity contributes at most once to each trait value. Matching
nonempty observations across duplicate placements count once; conflicting
nonempty sets make that identity unknown for that trait, with a conflict count.
Missing duplicate observations do not overwrite existing observations. Trait
coverage uses distinct identified items; identity coverage separately uses rows.
Common traits describe the two whole identified cohorts, not just shared titles.
Report both value counts and denominators, with five common values per trait,
ordered by the smaller of their two unrounded prevalences, then label. Expose
the full number of common values and whether the presentation is truncated.

The response carries its version, observation time, bounds, scope and coverage.
It contains aggregate library names/IDs and normalized trait labels, without
item IDs, titles, paths, descriptions, credentials or raw provider payloads.
Projected metadata exceeding 4,096 bytes and source genre arrays exceeding 2,048
bytes are withheld per row and counted; available bounded traits still contribute.
Unknown or withheld fields never become negative evidence.

## Security and accessibility

The endpoint is authenticated, read-only, parameterless, and sends `no-store`.
Reject query parameters instead of accepting arbitrary limits or SQL fragments.
Use fixed SQL and bound constants, the existing database statement timeout, and
an endpoint limit of 30 reads per IP per 15 minutes using the existing rate-limit
library and centralized configuration. No migration, dependency or new background
worker is needed. Database failures remain errors, rather than becoming empty observations.

Use native table captions and scoped headers, text counts/statuses, escaped Vue
interpolation, keyboard-operable native disclosures, and a polite loading/result
status. Errors have an explicit retry. Common-trait details remain optional reading;
the user does not need to operate a comparison workflow to obtain the summary.

## Research and alternatives

Official URLs were discovered through tool-backed web search and opened on
2026-09-05. This applies established guidance available by August 2026; living
PostgreSQL/OWASP pages are current reads, not an archived August snapshot.

| Source | Application |
| --- | --- |
| [W3C Data Quality Vocabulary](https://www.w3.org/TR/vocab-dqv/) (Working Group Note) | Describe measurement population, completeness and provenance so consumers can assess fitness; no RDF dependency required. |
| [W3C table captions](https://www.w3.org/WAI/tutorials/tables/caption-summary/) and [WCAG 2.2](https://www.w3.org/TR/WCAG22/) | Associate data with captions/headers and expose loading/results without focus changes; support keyboard use and non-color status. |
| [PostgreSQL LIMIT](https://www.postgresql.org/docs/18/queries-limit.html) and [transaction isolation](https://www.postgresql.org/docs/current/transaction-iso.html) | Stable unique ordering for bounded selection; one SELECT avoids mixed statement snapshots. |
| [OWASP REST security](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html) | Retain endpoint access controls, constrain inputs and output, and avoid sensitive error details. |

| Option | Pros | Cons | Recommendation |
| --- | --- | --- | --- |
| Bounded live inventory comparison | Current, deterministic, low operational input; one source snapshot | Explicit library/row limits; repeated reads cost database work | Implement first |
| Compare stored profile percentages only | Cheap and already available | Row duplicates and different refresh times distort identity overlap | Keep for existing profile displays |
| Persist an incremental cross-library index | Scales beyond bounded reads | Additional invalidation, migration and recovery paths | Revisit if measured capacity or latency warrants |
| Add semantic similarity now | Could explain related but nonidentical contents | Requires independent evaluation; circular placement labels can conceal errors | Defer behind existing readiness gates |

Recommended stack: synchronized inventory → attributable normalized traits →
automatic profiles → bounded typed overlap with coverage → measured future
classification assistance. Existing held-out readiness and frozen-study preflight
remain unchanged; ambiguous semantic evidence may support review only after the
required independently labelled evaluation succeeds.

## Verification plan

Exercise duplicates, crossed movie/TV IDs, asymmetric denominators, missing and
conflicting traits, empty/inactive libraries, capacity limits, projection bounds,
authentication and error handling. Verify the SQL in PostgreSQL under a read-only
transaction. Measure the local Compose inventory without writing live data, and
test the client API, rendered tables, loading/error states and browser interaction.
Record actual checks and the next recommendation in a separate outcome document.
