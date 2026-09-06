# Incremental library coverage design

## Decision and scope

Keep the existing fair five-minute library rotation. Each visit reads up to
20,001 ordered IDs and measures at most 20,000 rows. Persist a small accumulator
per library and resume at the next item ID on that library's next turn. Publish
coverage counts only after the final page; partial work exposes a scanned-row
count and an unknown total, never a percentage of the whole library.

No request starts a scan, invokes a provider or changes classification. Existing
health/overlap reads keep their contracts. All implementation modules use ESM.

## Consistency and time

Reuse the transactional inventory revision, which tracks membership, typed
identities and observed metadata. Add a separate observation-clock revision for
attempt/fetch timestamp updates, because those clocks affect freshness. Clock-only
updates must not mark profiles dirty. Both revisions are private decimal strings
in the sampler; JavaScript must not round PostgreSQL bigint values.

Selection, revisions, prior progress and a bounded page share a database statement
snapshot. Resume only when revisions, acquisition-configuration presence and the
sampling continuity key match. Expire scans after seven days. Otherwise restart
from the first page and explain the reason. Recheck the revisions in the atomic
write statement: revisions that differ in that statement's snapshot discard the
page and publish an invalidation status. Concurrent workers share the existing
conditional cursor claim, so only one can advance progress and history in a slot.

All pages evaluate freshness at the scan's start time. A complete record exposes
both that time and its final visit time. It describes coverage at that baseline,
not freshness at response time. A completed historical record is not invalidated
by later inventory changes, including changes committed after the write's
validation snapshot. Counts are historical measurements, not a claim about the
inventory at response time. Statement snapshots and revision checks avoid holding
a transaction or row lock open across background visits.

## Storage and comparison

Progress retains counters, times, revisions, a private item cursor and a rolling
population digest; it stores no item metadata or library names. One row per
library is bounded by the catalog and cascades on library deletion. Expired or
inactive progress is not advertised as current coverage; the next visit restarts
expired work. History retains the existing 2,016 fixed slots and seven-day window.

The v3 digest chains deterministic, ordered page digests with a versioned seed.
It covers item IDs, types and identities; metadata gains do not change the
population digest. Fixed page size is part of this measurement contract. A v2
record cannot be compared to a v3 record as if their digest formats matched.
Compare complete records across intervening partial visits. Sampling gaps still
withhold deltas. Raw digests, revisions and cursors never leave the server.

## Interface and accessibility

The existing history endpoint adds v3 sampling metadata and point fields. The
client accepts retained v2 points alongside v3 points and distinguishes complete,
in-progress and invalidated work. Native disclosures, local pagination, captions
and scoped table headers remain. A partial row says that complete counts are
unavailable; it does not render zeros or imply a failed acquisition.

## Official research and August 2026 scope

Official URLs were discovered through search and read on 5 September 2026 local
time. These established PostgreSQL 18 and W3C mechanisms predate the requested
August baseline; living pages are not asserted to be archived August snapshots.

- [PostgreSQL transaction isolation](https://www.postgresql.org/docs/18/transaction-iso.html)
  explains statement snapshots at Read Committed and transaction-wide snapshots
  at Repeatable Read. Use a coherent page snapshot with revision validation;
  separate page reads alone do not create one consistent long-running snapshot.
- [W3C Data on the Web Best Practices](https://www.w3.org/TR/dwbp/) supports
  explicit quality, provenance and version metadata. Expose partial status and
  measurement times, and keep incompatible measurement versions distinct.
- [W3C table captions and summaries](https://www.w3.org/WAI/tutorials/tables/caption-summary/)
  describes how captions identify tables and summaries explain their structure.
  Keep native table semantics and distinguish visit time from measurement time.

## Alternatives and recommended stack

| Option | Pros | Cons | Recommendation |
| --- | --- | --- | --- |
| Bounded revision-checked pages | Automatic; fair; small memory and storage | Continuous changes can prevent completion | Implement |
| One transaction spanning all visits | Stable database snapshot | Long-lived connections and retained row versions | Reject |
| Increase the full-library cap | Simple | Larger peak work; another eventual limit | Reject |
| Publish summed pages without revisions | Quick apparent coverage | Mixed populations and misleading freshness | Reject |

Recommended stack: synchronized inventory → transactional observation revisions
→ automatic profiles → fair incremental measurement → comparable complete
coverage → independently evaluated review-only semantic evidence. Readiness and
frozen-study gates remain unchanged; fixtures are not independent human labels.
