# UTC provenance trend design

Date: 2026-09-07. Official guidance checked in September 2026.

## Purpose and temporal contract

The [recording-time outcome](history-recording-instant-outcome.md) established
immutable, offset-aware instants for new history. Use those known instants to
show recent original-method capture consistently across database and browser
time zones, without operator configuration or annotations.

Add `utc_provenance_trend` to the existing evidence overview. Its fixed 14 UTC
dates include today so far, with a half-open interval from UTC midnight 13 dates
before today through the database statement instant. Explicitly convert the
cutoff to UTC to determine the date window, the start date to a UTC instant for
comparison, and each known recording instant to its UTC date for grouping.
Integer date generation fills empty dates and avoids DST interval arithmetic.

Partition retained history into window events, older known instants, known instants
at/after the cutoff, and unknown instants. Never infer a legacy offset from
`created_at`. Each date and the window partition captured, unrecorded, invalid and
unsupported original-method provenance using the same validated source as the
existing attribution report. Unknown recording time is separate from unrecorded
original-method provenance. Capture coverage is captured/window events; zero
events yields null, displayed as N/A. A zero window may mean all history has
unknown times, not that the system has never classified anything.

Preserve the stored-calendar trend as a separately named view. These are alternative
views of retained history, not additive populations or accuracy measurements.
Retention can change earlier counts, today is partial, and the recording instant
is the INSERT statement start rather than media creation or commit time.

## Implementation and security

Use a small fixed SQL module alongside the existing materialized scalar history.
Reuse the current endpoint, authentication, no-store response, read-only transaction
and five-second timeout. No request controls SQL, dates or time zones. Return 14
date/count rows and aggregate exclusions only. No schema change, provider calls,
extra polling, notifications or routing changes are needed.

Extract shared ESM date/count projection from the existing daily projector.
Keep basis-specific wrappers: UTC requires the UTC label, the capture date, exact
retained-history reconciliation, and unknown counts matching recording-time
coverage. Dates must be canonical, contiguous, ordered and correctly marked
partial; daily totals and provenance partitions must reconcile. Bad data makes
coverage unavailable. The database finite constraint and aggregate cross-checks
prevent non-finite instants being silently counted as valid evidence.

Reuse one native Vue table component for both views, with distinct captions,
scoped row/column headers, date-only labels and keyboard-scrollable regions.
Keep narrative text outside the scroll region so it reflows at 320 CSS pixels.
Older payloads show the UTC view unavailable; they do not borrow the calendar
trend. Validate display dates and counts before formatting to avoid malformed
payloads producing NaN, misleading percentages or a rendering exception.

## Research, tradeoffs and recommendation stack

| Recommendation | Pros | Cons / limit | Official guidance |
| --- | --- | --- | --- |
| Explicit UTC conversion of known instants | Stable boundaries across session/browser zones and DST | UTC dates differ from some local dates; label them clearly | [PostgreSQL date/time functions](https://www.postgresql.org/docs/18/functions-datetime.html) |
| Keep unknowns excluded and visible | No fabricated history or denominator inflation | Older installations may initially show no known events | [PostgreSQL date/time types](https://www.postgresql.org/docs/current/datatype-datetime.html) |
| Fixed SQL and bounded output | No new input surface; coherent counts in one statement | Retained history still needs scanning; measure before indexing | [OWASP parameterization](https://cheatsheetseries.owasp.org/cheatsheets/Query_Parameterization_Cheat_Sheet.html) |
| Shared native table with distinct captions and headers | Accessible structure and consistent formatting | Two temporal views take more page space | [W3C captions](https://www.w3.org/WAI/tutorials/tables/caption-summary/), [W3C headers](https://www.w3.org/WAI/tutorials/tables/two-headers/) |
| Scroll tables while prose reflows | Keeps all columns reachable on narrow screens | Wide tables still need horizontal scrolling | [W3C reflow](https://www.w3.org/WAI/WCAG21/Understanding/reflow.html) |

Reject converting legacy dates or silently replacing the existing calendar trend.
Defer a chart, configurable time zones, materialized summaries and indexes until
usage or measured query plans justify their added complexity.

Recommended stack: immutable known instants, explicit UTC SQL boundaries, strict
shared ESM projection with separate temporal contracts, native reusable Vue table,
and real PostgreSQL boundary/zone tests. Independent labels, readiness and frozen
study preflight remain prerequisites for review-only semantic counter-evidence.
