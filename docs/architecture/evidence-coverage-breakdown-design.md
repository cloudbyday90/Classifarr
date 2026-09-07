# Evidence coverage by library and method: design

## Decision and population

The [source-receipt outcome](feedback-source-idempotency-outcome.md) found 6,699
terminal `source_library` history events and no ranked candidates or feedback in
the local installation. These are useful library-membership observations, not
evidence of classifier correctness. Make the distinction visible automatically in
the existing Policy Statistics overview and reuse library profiles for common traits.

Add `evidence_coverage` to `GET /api/stats/overview`, preserving its existing fields
and authentication. A separate ESM SQL module aggregates retained history and
feedback in one statement; a small service returns a versioned projection. No new
endpoint, migration, operator setting, provider request or labeling workflow is needed.

Keep two populations explicit rather than joining their counts into one denominator:

| Population | Grouping and counts |
| --- | --- |
| Retained classification history, all states | Recorded library and method; events, imported `source_library` observations, original-candidate availability, events with retained source-bound feedback. |
| Retained policy feedback | Selected library and source history method; observations, source-bound observations, evaluated and unevaluated outcomes. |

A correction may refer to an original history library and a different selected
feedback library. The two tables therefore cannot be added together. Feedback
without receipts is explicitly unlinked; a receipt whose history was removed uses
a separate removed-history method group. Missing library references are unassigned,
and inactive libraries remain visible. Deleted feedback receipts are counted as
tombstones, not retained feedback. Repeated media items in different events remain
separate observations; this is not a unique-title inventory count.

Original-candidate availability means the first stored ranked candidate is an object
with a positive PostgreSQL integer library ID. A malformed array, empty array,
invalid identifier or candidate later in the array cannot fill a missing original.
Availability does not establish that the candidate is current, correct or reviewed.
Evaluated outcomes reuse `policy_feedback_evaluation`; no parallel correctness rule
or inference from current library membership is introduced.

## Bounds and failure behavior

Use one read-only transaction with a five-second statement timeout. Aggregate all
retained rows, return global totals, and cap each table at 200 library/method groups
in stable library-ID/method order. Disclose total groups and truncation separately;
never present capped rows as the whole population. Totals and groups share a single
statement snapshot. Reject unsafe numeric counts in the response projection.

The overview is `Cache-Control: no-store`. The coverage service reports unavailable
on read failure, without manufacturing zero counts or exposing database errors.
Existing policy metrics can still load when this additional read is unavailable.
No raw title, media ID, source ID, reason, metadata, score or receipt fingerprint is
returned. Library names are ordinary escaped text in the authenticated UI.

## Presentation

Add a dedicated Vue component to Policy Statistics. Show all-retained scope,
capture time, totals, the two separately captioned tables, denominator explanations,
empty states and explicit unavailability/truncation. Use native table column and row
headers, text labels and keyboard-focusable horizontal overflow regions. Existing
dashboard refresh loads the data without a separate request or action. The dashboard
time buttons do not change this explicitly all-retained summary.
Remove the dashboard's exact visibility listener on unmount, so navigating away
cannot restart background statistics reads.

Link to existing Libraries profiles for common genres, studios and other observed
traits. Do not add another inventory sampler or ask operators to fill missing evidence.
The component adds no classification or routing control. This is targeted use of
W3C guidance, not a claim of complete WCAG conformance.

## Official research: August 2026 baseline

URLs were discovered and read through web tools on 2026-09-07 UTC. These sources
support guidance available by August 2026; live pages are not archived snapshots.

| Official source | Application |
| --- | --- |
| [W3C Data on the Web Best Practices](https://www.w3.org/TR/dwbp/) | Disclose provenance, population, coverage and quality so data can be assessed for its intended use. |
| [W3C tables with two headers](https://www.w3.org/WAI/tutorials/tables/two-headers/) | Separate captions and scoped native headers preserve table relationships. |
| [PostgreSQL aggregate expressions](https://www.postgresql.org/docs/18/sql-expressions.html) | Filtered counts and nullable evaluation distinguish observations from known outcomes. |

## Alternatives and recommendation stack

| Option | Pros | Cons |
| --- | --- | --- |
| Extend the existing overview (selected) | Automatic loading; existing API and auth; no extra operator step | Adds a bounded database read to overview refresh. |
| New reporting endpoint/page | Independent request cadence and navigation | More API/UI surface for a small passive readout. |
| Add all counts into one library table | Compact | Misleading attribution and denominators when corrections change destinations. |
| Materialized reporting cache | Lower repeated query cost | Staleness, invalidation and another maintenance process. |

Recommended stack: preserved history and receipts → canonical evaluation → one
bounded aggregate snapshot → separate accessible population tables → existing
inventory profiles. Validate aggregate reconciliation, malformed metadata, retention,
destination changes, row caps, read failure, escaping and local query cost. Record
the measured outcome in a [separate document](evidence-coverage-breakdown-outcome.md).
