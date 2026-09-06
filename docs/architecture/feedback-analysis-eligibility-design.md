# Feedback analysis eligibility design

## Problem and decision

The [confidence fix](feedback-confidence-eligibility-outcome.md) excluded detached
destinations from automatic confidence. Policy suggestion analysis still reads those
rows. Its failure-pattern helper also performs an independent 30-day corrections
query, bypassing the caller's cohort and requested lookback.

Read one eligible cohort before the minimum-feedback check and use it throughout
failure patterns, signal effectiveness, new patterns and threshold analysis. The
selected destination must be a positive PostgreSQL integer ID, resolve to a currently
active library and match the current selected policy's library. A policy reference
alone cannot stand in for a missing or contradictory selected destination. Explicitly
analyzing a disabled policy remains supported; the scheduler still selects enabled
policies as before.

## Architecture and security

Add a small ESM evidence reader with an injected database client. Reuse the confidence
reader's strict numeric ID predicate. A parameterized inner join resolves policy and
library in the same statement snapshot. Select only fields used by analysis, respect
the existing 1–365-day lookback contract and order ties by feedback ID. Invalid IDs
or lookbacks yield no evidence; database failures propagate without storing suggestions.

`analyzePolicy` is the production eligibility boundary. Its internal analysis helpers
consume the already eligible cohort; they do not establish live eligibility for
arbitrary caller-provided arrays. The failure-pattern helper derives corrections
from that cohort instead of fetching more records. All suggestion support and score
denominators consequently share one eligibility decision and lookback. An empty
cohort always stops before suggestion generation, including a zero minimum supplied
by an internal caller. The response shape remains unchanged; `feedbackCount` now
means eligible feedback count.

Historical feedback, reporting and learning statistics remain intact. There is no
snapshot/name fallback, schema change, provider request, additional operator input
or automatic routing. No thresholds, weights or correction interpretation are
recalibrated. The cleanup prototype remains isolated.

Read-time eligibility is not a lock across later writes. Previously stored pending
suggestions are not retroactively invalidated. Non-null references incorrectly
reattached by another writer need immutable identity and writer guards. Existing
suggestion approval and policy write authority remain in place.

## Official research and alternatives

Official URLs were discovered through web search and read on 6 September 2026.
These established semantics support the August 2026 baseline; the living pages are
not archived August snapshots.

- [PostgreSQL table expressions](https://www.postgresql.org/docs/18/queries-table-expressions.html)
  explain how inner joins retain matching rows. Explicit policy/destination joins
  establish current resolution without application caches or per-row queries.
- [W3C PROV-O](https://www.w3.org/TR/prov-o/) separates entities and activities,
  including generation and invalidation. Retaining historical provenance while
  separately evaluating current eligibility is an application policy informed by
  this model, not a W3C conformance claim or requirement to introduce RDF.

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Filter null IDs only | Small patch | Stale, inactive and contradictory references remain | Insufficient |
| Query eligibility independently in every helper | Locally defensive | Repeated reads, divergent windows and eligibility snapshots | Reject |
| Read one eligible cohort | Consistent support, denominators and window; no manual work | Fewer eligible samples; current state affects results | Implement |
| Delete or reconstruct historical references | More apparent usable evidence | Loses history or assigns evidence to an unproven identity | Reject |

Recommended stack: retained history → current policy/destination agreement → active
library resolution → one bounded lookback → eligible sample minimum → existing
suggestion generation and approval → policy write authority.

## Validation and next item

Use real PostgreSQL and the production analysis service to verify generated/stored
suggestions, null and stale references, inactive/unknown-active libraries, policy
mismatch, detachment with ID reuse, all-ineligible cohorts, custom windows and record
preservation. Unit checks cover invalid inputs and database failures. Run the reader
against local Compose in a read-only transaction and build the local production image.

The integration assessment also exposed duplicate pending pattern suggestions: the
store compares PostgreSQL JSONB rendered as text with application JSON text. Equivalent
objects need structural equality. Fix semantic deduplication next with repeated-run
and concurrent-storage tests to reduce redundant operator review.

Then validate pending suggestion evidence at application time. Suggestions generated
before detachment can outlive the evidence that justified them. Threshold and weight
suggestions currently have empty supporting-feedback arrays, so the follow-up must
define a complete cohort provenance contract before adding an eligibility guard.

The separate [outcome](feedback-analysis-eligibility-outcome.md) records validation
results and practical limitations.
