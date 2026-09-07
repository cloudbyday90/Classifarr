# Per-library UTC coverage design

Date: 2026-09-07. Official guidance checked in September 2026.

## Purpose and contract

The [UTC trend outcome](utc-provenance-trend-outcome.md) identified a visibility
gap: global daily totals cannot show which recorded libraries lack recent
original-method capture. Add a passive library breakdown of that same UTC window.

`utc_library_coverage` describes retained history grouped by its recorded
`library_id`, with current catalog names and active flags. Include the null group
as unassigned or removed. Inactive libraries remain visible; catalog libraries
without retained history are omitted, not advertised as measured zero coverage.
Manual resolution or library removal can change a group without changing the
original method capture or global retained counts. Do not label these rows as
original candidate libraries, live inventory membership or independent truth.

Reuse the existing fixed 14-day UTC population, including partial today, and the
same half-open statement cutoff. For every library return retained events,
UTC-window events, four provenance statuses within that window, and older,
future/at-cutoff and unknown-time exclusions. Window plus exclusions equals
retained events. Unknown recording time and an unrecorded original method are
separate dimensions. Capture coverage uses only window events; empty windows
have null coverage, displayed as N/A. No legacy offsets are inferred.

## Bounded architecture and integrity

A small fixed SQL module groups the existing materialized UTC population. Return
up to 200 library groups in ascending ID order, null last, using the existing bound
limit parameter. The library cap is independent of method/feedback group caps.
Global totals include all groups; report group count and truncation explicitly.
Do not let retained history disappear just because its library falls beyond the
cap. Keep one read-only statement, the five-second timeout, existing authentication,
no-store response and overview API. No schema change or provider call is needed.

A separate ESM projector checks nonnegative safe integers, per-row temporal and
provenance partitions, exact global reconciliation to the validated UTC trend,
positive retained populations, unique ordered library identities, and the expected
number of rows. Complete groups must sum exactly to totals; capped groups cannot
exceed any global count. Omitted groups must have at least one omitted retained
event each. Only catalog display fields and counts are returned.

A small Vue view uses native table semantics, scoped headers, a distinct caption,
keyboard horizontal scrolling and prose outside the scroll region. A separate
display validator rejects missing, inconsistent or oversized payloads before
rendering. Library names use Vue text escaping. Add no controls, manual labels,
configuration, additional requests or automatic routing decisions.

## Research, alternatives and recommendation stack

| Recommendation | Pros | Cons / limits | Official guidance |
| --- | --- | --- | --- |
| Unique ID ordering with a fixed group cap | Stable, bounded results independent of names and locale | Large catalogs hide some rows; global totals and truncation remain visible | [PostgreSQL LIMIT](https://www.postgresql.org/docs/18/queries-limit.html) |
| Reuse known UTC instants and exclusions | Consistent with the existing trend; no guessed offsets | Legacy-only libraries have N/A recent coverage | [PostgreSQL date/time functions](https://www.postgresql.org/docs/18/functions-datetime.html) |
| Fixed SQL with bound values | No request-controlled SQL structure or time-zone input | Another aggregate over retained history; measure its cost | [OWASP parameterization](https://cheatsheetseries.owasp.org/cheatsheets/Query_Parameterization_Cheat_Sheet.html) |
| Native caption and row/column headers | Clear associations for assistive technology | Detailed counts require a wide table | [W3C table headers](https://www.w3.org/WAI/tutorials/tables/two-headers/) |
| Scroll the table while prose reflows | Keyboard access to every column at narrow widths | Horizontal scrolling is still needed | [W3C reflow](https://www.w3.org/WAI/WCAG21/Understanding/reflow.html) |

Reject a library-by-day matrix, unbounded catalog response, estimated legacy dates
and a configurable dashboard filter for this task. They add complexity or operator
input without resolving the measured gap. Defer indexing or materialized summaries
until measured query plans justify their write/storage cost.

Recommended stack: existing immutable instants and UTC population, bounded library
SQL, strict modular projection, escaped native Vue table and real PostgreSQL
partition/cap tests. This is descriptive evidence coverage. Independent labels,
readiness and frozen-study preflight still gate review-only semantic evidence.
