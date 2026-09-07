# Retained history lifecycle design

Date: 2026-09-07. Status: implementation selected.

## Problem and decision

The available-evidence breakdown counts all retained history. A retry or an
unanswered decision can therefore look like a completed classification when only
the event count is visible. Use the existing history status automatically; no
operator labels, additional requests, background jobs or schema changes are needed.

Extend the existing `evidence.coverage.v1` history totals and library/method groups
with four additive, mutually exclusive integer fields:

| Field | Display | Exact recorded statuses |
| --- | --- | --- |
| `completed_events` | Completed | `completed`, `corrected`, `verified`, `routed` |
| `pending_events` | Pending decision | `pending`, `awaiting_decision` |
| `retry_events` | Retry pending | `pending_retry` |
| `other_events` | Other | Everything else, including null, failed and reclassified |

The completion and pending sets follow `classificationRouteHistory.mjs`'s existing
history ordering. `classificationPersistenceService.mjs` writes awaiting-decision,
retry-pending or completed states. `classificationRetryService.mjs` marks an old
row reclassified when a retry is queued, before its replacement succeeds. Thus
reclassified must not count as completed or as a currently pending history row.
This is a description of retained rows' current states, not a queue-depth metric,
unique-media count, transition log, routing success rate or accuracy measure.
Imported membership remains visible separately even when its status is completed.

## Architecture and security

Keep one bounded read-only SQL statement in `evidenceCoverageQuery.mjs`. A fixed
CASE expression partitions every history row before the existing library/method
aggregation. Counts use FILTER; global totals cover every group even when only
200 groups are returned. The five-second timeout, original-candidate checks,
independent feedback attribution, authenticated route and no-store response stay
in place. No titles, media identifiers, reasons or arbitrary status values are
added to the response.

The projection service requires nonnegative safe integers and reconciles the
four lifecycle counts to events for totals and every group. Complete groups must
sum to global counts; capped groups may omit counts but cannot exceed them in
either population. Invalid or missing
server data makes coverage unavailable. Existing clients can ignore the additive
fields. The new client displays a lifecycle-unavailable message for older payloads
instead of converting missing fields into zero.

A small ESM Vue component presents labelled counts with native description-list
semantics, both globally and inside the existing history-event table cells. This
avoids four more horizontal columns. Captions, row/column headers, keyboard
scrolling, visible focus and text labels remain available without extra controls.

## Research and alternatives

Official sources were discovered through web search and read on September 7.
The selected guidance below was available by August 2026; living documentation is
not an archived August snapshot.

| Recommendation | Benefit | Cost or limitation | Source |
| --- | --- | --- | --- |
| Document scope and evidence quality separately | Prevents completion from implying verified correctness | Requires explicit explanatory copy | [W3C Data on the Web Best Practices](https://www.w3.org/TR/dwbp/) |
| Aggregate fixed status categories with FILTER | One consistent snapshot, no per-row API work | Still scans retained history; measure aggregate cost | [PostgreSQL 18 aggregate expressions](https://www.postgresql.org/docs/18/sql-expressions.html) |
| Keep native table captions and scoped headers | Preserves row/column relationships for assistive technology | Dense tables still need horizontal scrolling on small screens | [W3C tables with two headers](https://www.w3.org/WAI/tutorials/tables/two-headers/) |
| Display passive counts with a conservative Other bucket | No manual input; unknown states remain visible | Does not diagnose every failed or superseded record | Existing status writers and history ordering |

Discarding unfinished rows would hide useful observations. Grouping by arbitrary
raw status would multiply the bounded groups and expose unstable vocabulary.
Manual status annotation would add operational work and duplicate persisted data.

The recommended stack is PostgreSQL conditional aggregation, strict ESM service
projection, the existing named client API and a small native Vue presentation.
Keep correctness evaluation and frozen-study readiness as separate gates for
future AI changes. These counts do not authorize semantic routing.

## Validation plan

Exercise each known status, null and unknown states in real PostgreSQL; assert
partition reconciliation, unchanged attribution, truncation and empty datasets.
Test malformed service data and old client payloads. Check desktop and narrow
viewports, keyboard scrolling, contrast and absence of mutation requests in the
existing browser regression. Measure aggregate-only local Compose data read-only.
Record actual results and the next follow-up in the separate outcome document.
