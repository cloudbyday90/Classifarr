# Original candidate and recorded library comparison

Date: 2026-09-07. Official guidance checked in September 2026.

## Problem and scope

The [original observation types outcome](original-observation-types-outcome.md)
recommended comparing original classifier proposals with recorded libraries.
This should reveal the evidence already retained, without new labels, controls,
provider requests or operator decisions. It must not imply that either placement
or agreement is independently verified truth.

Use the existing 14-day UTC window and recorded-library groups. Only events with
validated original classifier provenance enter this comparison. Imports, direct
manual actions and unknown origins remain in the adjacent observation-type table.
Unknown recording times, older events and future events stay outside the window.

| Exclusive outcome | Meaning |
| --- | --- |
| Same library | Valid original candidate ID equals the non-null recorded library ID |
| Different library | Both IDs are known and differ |
| No candidate | Valid capture explicitly records no proposal |
| Invalid candidate | Valid capture explicitly records an invalid proposal |
| Recorded library unknown | A valid candidate exists but the history library is null, including removed libraries |

Missing/invalid/unsupported capture envelopes do not establish a classifier
origin and never enter a comparison. Legacy rankings and the mutable recorded
method cannot substitute for validated original capture. Capture status is
validated before casting candidate IDs. Do not join the candidate ID to the
current catalog: removal or inactivity must not erase an originally valid ID.

Recorded library means the history row's library at query time, which later
resolution or deletion can change. The candidate remains its original captured
value. Same/different counts therefore describe the current retained record,
not an immutable routing outcome, successful delivery, correctness or feedback
eligibility. Retries and superseded attempts remain separate events.

## Contract and implementation

Add `candidate_comparison` to each existing `utc_library_coverage` group and its
global totals. Its five nonnegative safe-integer counters partition exactly
`observation_types.classifier_workflow_events`. Names end in `_events`:
`same_library`, `different_library`, `no_candidate`, `invalid_candidate`,
`unknown_library`. There is no percentage or inferred denominator.

Reuse the same materialized UTC population and filtered library aggregation,
200-group cap and stable ID ordering. Global totals include omitted groups.
Complete groups must reconcile exactly; truncated sums cannot exceed any global
counter. Small ESM modules own comparison SQL, projection and client validation.
The new client table validates its additive contract independently so older
responses can still display the pre-existing tables.

SQL structure is fixed application code and limits remain bound. Preserve the
authenticated, no-store overview, read-only transaction and five-second statement
timeout. Return counters only, without raw candidate IDs, media metadata or new
endpoints. No schema or dependency changes are needed. Vue escapes library names.

Use a native table with a distinct caption, row/column scope, visible unknowns,
all-library totals and a keyboard-scrollable region. Repeat the UTC scope and
explain the five-way partition. Missing or inconsistent comparison data display
unavailable, not zeros. No action or filter is introduced.

## Official research, alternatives and recommendation

Sources below were discovered through search and followed using web/MCP tools.

| Recommendation | Pros | Cons / alternative | Official source |
| --- | --- | --- | --- |
| Guard nulls before comparing IDs | Unknown placements cannot become false matches or mismatches | Requires a separate unknown bucket; null-safe equality alone would give the wrong product meaning | [PostgreSQL comparison](https://www.postgresql.org/docs/18/functions-comparison.html) |
| Filter counts in the existing grouping | Shared population and bounded response; no pairwise group expansion | Five more aggregate counters; retain performance checks | [PostgreSQL aggregate expressions](https://www.postgresql.org/docs/18/sql-expressions.html) |
| Keep SQL structure fixed and values bound | Maintains separation of code and data | Configurable comparison taxonomies require another reviewed design | [OWASP SQL injection prevention](https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html) |
| Separate native table with scoped headers | Clear header associations and independently understandable scope | Adds vertical space and horizontal scrolling | [W3C headers](https://www.w3.org/WAI/tutorials/tables/two-headers/), [simplifying complex tables](https://www.w3.org/WAI/tutorials/tables/multi-level/) |
| Caption plus explanatory prose | Identifies the data and its limitations without interaction | Needs concise but explicit terminology | [W3C caption and summary](https://www.w3.org/WAI/tutorials/tables/caption-summary/) |

Recommended stack: validated immutable capture, explicit comparison states,
bounded PostgreSQL aggregation, strict modular ESM projection, accessible Vue
table, and real PostgreSQL/browser validation. Defer pairwise library matrices,
agreement percentages and routing changes. Independent labels, readiness and
frozen-study preflight still gate any review-only semantic counter-evidence.

## Validation plan

Exercise every comparison state, all supported classifier methods, malformed
IDs/envelopes, legacy and forged rankings, resolution, inactive/removed libraries,
UTC boundaries and session zones. Verify 201-library truncation with nonzero
omitted comparisons, payload bounds and query timing. Check count reconciliation,
safe integers, unavailable/empty states, escaped names, keyboard scrolling,
contrast, narrow reflow and no writes. Record measured results separately in the
outcome document.
