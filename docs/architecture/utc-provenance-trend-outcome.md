# UTC provenance trend outcome

Date: 2026-09-07.

## Design and implementation

Implemented the [UTC design](utc-provenance-trend-design.md) on top of main
`a62228281b83f92ba4cd0d4847c1d3add1880a0b`. The existing evidence overview now
returns `utc_provenance_trend`, a fixed 14-date view of known recording instants.
UTC conversion is explicit for the window date, start instant and daily grouping.
Today is partial and the capture cutoff is excluded. Older/future known instants
and unknown instants are separately counted. No legacy times are inferred.

The new UTC SQL module reuses the materialized scalar history and validated
original-method statuses. Both temporal views use shared ESM date/count projection
with separate basis checks. The UTC wrapper verifies its end date against the
snapshot capture date and reconciles exclusions with retained history and
recording-time coverage. Missing or inconsistent data makes coverage unavailable.
The fixed query retains its read-only transaction, five-second timeout and
existing authenticated, no-store endpoint. No migration or extra API call is needed.

The two Vue views share `ProvenanceTrendTable.vue`, including native captions,
scoped headers, date-only labels, contrast and keyboard scrolling. Shared display
validation rejects malformed dates, missing rows, count/fraction mismatches and
invalid exclusions before formatting. The UTC view never substitutes the legacy
calendar payload. The recording-time summary explains how the views differ.
This adds no configuration, annotations, provider requests or routing authority.

## Local observation

At `2026-09-07T12:53:13.488Z`, the read-only local Compose observation found
PostgreSQL 18.6 and 6,772 retained events. Its older schema lacks `recorded_at`.
An ignored measurement adapter explicitly supplied null instants and verified
empty feedback before using the existing missing-view adapter. The production
query has no schema fallback, and the running service was not redeployed.

The new projection returned available coverage with 14 UTC dates from August 25
through September 7, zero dated events, N/A capture coverage and 6,772 unknown-time
exclusions. Older/future exclusions were zero. The measured query took 305.389 ms;
the 5,000-event PostgreSQL fixture took 71.247 ms. These are individual observations,
not latency guarantees. No production writes, provider calls or individual media
records were returned. Unknown dates are not evidence of poor classification.

## Validation and limits

- 84 server unit tests passed across shared/basis-specific trend projection,
  evidence coverage, recording-time coverage and attribution.
- 119 real PostgreSQL integration tests passed across seven suites. Cases include
  UTC midnight and microsecond boundaries, both offsets of a repeated DST hour,
  leap-day midnight, entirely unknown/empty history, immutable times through
  resolution, existing writers, feedback evaluation/receipts and calendar-view
  compatibility. UTC results were identical in UTC, America/New_York,
  Pacific/Auckland and Asia/Kathmandu sessions.
- 74 focused client tests passed across the new view, shared table/display logic,
  existing statistics components and API leaf. Malformed input is unavailable
  rather than a rendering exception or a fabricated percentage.
- The browser flow passed in a Pacific/Honolulu browser zone with unchanged UTC
  date labels, five distinguishable native tables, keyboard scrolling, contrast,
  320/390-pixel reflow and zero writes. Desktop and narrow-screen captures were
  visually inspected. The narrow visual artifact uses a taller viewport to capture
  the entire section inside the app's scrollable main; interaction checks use
  the normal 320x844 viewport.
- Both temporal payloads retain separate 6,000-byte limits; the existing bounded
  attribution/history payload retains its 150,000-byte limit.
- Server/client typechecks, scoped ESLint, ESM static-import/mock-shape checks and
  production dependency checks passed.

- `classifarr:utc-provenance-local` built from the staged Git tree. A fresh
  disposable container bootstrapped successfully and its schema matched the
  authoritative snapshot without drift. Migration integrity, Markdown lint and
  whitespace checks passed. The running user Compose service was not redeployed.

The full test suites and combined coverage ratchet were not run; this task adds
no endpoint or dependency. These checks do not supply independent classifier
labels or certify every security/accessibility property.

## Open PR availability

GitHub MCP returned zero open PRs at task start and final readback. The previously adopted PR 528
was already closed without merge. No random selection or new PR implementation
was possible from an empty population. No PR was fabricated, reopened or merged.

## Recommendations and next item

Recommended stack: immutable recording instants, explicit UTC SQL boundaries,
strict shared ESM projection, separate temporal contracts and one native Vue table
component. Benefits are stable dates, honest missingness, shared maintenance and
no operator input. Costs are another retained-history aggregation, extra page
space and initially empty UTC windows on older installations. Official PostgreSQL,
W3C and OWASP sources and alternatives are in the design document.

**Next: add bounded per-library UTC capture coverage to the existing evidence
breakdown.** The current UTC trend groups only by date; all-retained library
totals cannot show where recent original-method capture is missing. Reuse the
known-time window and explicit unknown-time counts, label the recorded history
library carefully, and reconcile capped groups to global totals. This should
identify gaps passively without treating history placement as independently
verified classification truth.

Independent labels, readiness and frozen-study preflight continue to gate
review-only semantic counter-evidence. README, Unreleased and the preceding next
item were updated. No release, version bump, tag or production deployment is part
of this work.
