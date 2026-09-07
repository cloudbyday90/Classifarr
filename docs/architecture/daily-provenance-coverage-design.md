# Daily provenance coverage design

Date: 2026-09-07. Official research checked in September 2026.

## Purpose and temporal contract

The previous [attribution outcome](evidence-method-attribution-outcome.md) found
6,772 older history events with unrecorded original methods. All-retained totals
alone obscure whether new history is capturing provenance. Add a passive daily
view to the existing statistics overview, without configuration or annotations.

Use a fixed 14-calendar-day window including today so far. Return all 14 dates,
including zero-event dates, and explicitly mark the last day partial. Each day and
the window total partition events into captured, unrecorded, invalid and unsupported
provenance using the existing validated capture rules. Capture coverage is
captured/events; an empty denominator is null, displayed as N/A. This is descriptive
coverage, not accuracy, a health threshold or a routing signal.

`classification_history.created_at` is a nullable `timestamp without time zone`,
defaulting to `now()`. Compose permits non-UTC time zones. Preserve those stored
calendar dates instead of silently inventing historical offsets. The current
database session calendar determines today's date and the partial-day cutoff;
return its time-zone name and label that basis in the UI. Changing the historical
time-zone setting cannot be repaired by this report. No schema conversion or
historical backfill is included.

Use the half-open interval from midnight 13 dates before today through the SQL
statement time expressed in the database calendar. Separately count older,
future/at-cutoff and undated/non-finite timestamps. Those exclusions plus the
window total must equal retained history. A zero-event date means no retained
events dated that day; retention and deletions can change historical counts.

## Implementation and safety

Extend the existing `evidence.coverage.v2` payload with `provenance_trend`. Small ESM
SQL and projection modules reuse the existing materialized scalar history and
provenance validation. Keep one read-only statement, its five-second timeout and
the existing overview endpoint. Generate exactly 14 calendar dates with integer
date arithmetic, avoiding implicit daylight-saving interval behavior. Validate
date order/continuity, counts, partitions, coverage denominators and reconciliation
to all-retained attribution totals. Older client payloads show unavailable trend.

Return only dates, aggregate counts, scope and time-zone metadata. The native Vue
table has a caption, scoped headers and a labelled keyboard-scrollable region.
The partial date is labelled with text. No chart-only or color-only information,
provider requests, automatic decisions, additional polling or new operator input.

## Official research and alternatives

| Recommendation | Pros | Cons / limit | Official source |
| --- | --- | --- | --- |
| Preserve stored dates and disclose the database calendar | Honest about offset-free history; stable grouping across client zones | Cannot recover historical zone changes | [PostgreSQL date/time functions](https://www.postgresql.org/docs/18/functions-datetime.html) |
| Generate a fixed date series; mark today's partial interval | Zero dates remain visible; latest traffic is included | Partial-day volume must not be compared as a full day | [PostgreSQL set-returning functions](https://www.postgresql.org/docs/18/functions-srf.html) |
| Share the existing command snapshot and fixed SQL | Coherent counts; bounded output; no request-built SQL | Scans retained history, so measure before adding indexes | [PostgreSQL isolation](https://www.postgresql.org/docs/18/transaction-iso.html), [OWASP SQL injection prevention](https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html) |
| Use native tabular semantics and separate explanatory text | Works with keyboard and assistive technology; exact counts | Requires horizontal scrolling on narrow screens | [W3C captions](https://www.w3.org/WAI/tutorials/tables/caption-summary/), [W3C headers](https://www.w3.org/WAI/tutorials/tables/two-headers/) |

A complete-days-only window omits the newest traffic. An automatic alert requires
a validated threshold and population definition. A time-zone migration requires
a separate writer audit and a policy for ambiguous legacy timestamps. None is
needed for this bounded descriptive view.

Final recommendation stack: existing captured provenance, explicit database-calendar
window, one bounded read-only SQL snapshot, strict ESM projection, and native Vue
presentation. Keep independent review and study preflight gates intact.

## Validation plan

Use real PostgreSQL for date boundaries, zero dates, partial today, null/infinite
timestamps, daylight-saving calendar arithmetic and status partitions. Preserve
existing history/feedback totals. Check projection rejection of malformed results,
browser keyboard/mobile access and GET-only activity. Measure read-only Compose,
then build and start a disposable container and compare the authoritative schema.
The selected [client tooling PR 528](https://github.com/cloudbyday90/Classifarr/pull/528)
requires full client tests and coverage under Vitest 5 in addition to scoped feature
checks. Its separate [outcome](client-tooling-528-outcome.md) records compatibility
work. See the [trend outcome](daily-provenance-coverage-outcome.md) for results.
