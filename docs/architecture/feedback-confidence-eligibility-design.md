# Feedback confidence eligibility design

## Problem and decision

`calculateNetConfidence` currently reads every feedback row in its 30-day window.
For matching genre, keyword or studio signals, a null `selected_library_id` differs
from the candidate ID in JavaScript and therefore increments the rejection count.
`queueCarsaCleanup.mjs` already clears these references during reset. Historical
records consequently become negative evidence even though their destination is
unknown. The retained-reference prototype makes this consumer defect more visible.

Exclude detached and unresolved destinations before scoring. A selected destination
must have a positive PostgreSQL integer ID and resolve to a currently active library.
The candidate must also be a positive integer ID resolving to an active library.
Inactive or unknown active-state libraries do not participate in automatic learning.
Retain all feedback records for historical inspection; this fix performs reads only.

## Implementation contract

Use a small ESM feedback-evidence service for ID eligibility and the parameterized
query. An inner join validates the selected library, and an existence check validates
the candidate within the same statement snapshot. Return only the three fields
needed for scoring: selected ID, correction flag and item metadata. Apply the numeric
ID check again to returned rows before they reach signal comparisons. Invalid
candidate inputs return zero confidence without a database request.

Reuse the existing genre/keyword/studio matching, 30-day lookback, thresholds,
correction interpretation and confidence result shape. Require at least one
confirmation before `shouldApply` can be true, including when a caller provides zero
thresholds. Query failures retain the existing zero-confidence fallback. There are
no new API contracts, migrations, dependencies, provider calls or operator steps.

Detached records stay excluded when an old ID is reused: the live FK remains null.
Names, metadata, policy references and retained snapshots are not fallback sources
for a destination ID. This does not identify a non-null reference incorrectly
reattached by an external writer; that needs immutable identity/provenance and writer
guards. Creation timestamps alone are not used to infer identity across restores.

The query establishes eligibility at read time. It does not make later preference
writes atomic with library lifecycle changes. Existing write authority, transaction
and conflict checks remain responsible for those writes.

## Official research and alternatives

Official URLs were discovered through web search and read on 6 September 2026.
They support established guidance for the August 2026 baseline; living documentation
is not an archived August snapshot.

- [PostgreSQL comparison predicates](https://www.postgresql.org/docs/18/functions-comparison.html)
  distinguish null/unknown values from ordinary values. A missing destination must
  not become a domain-level rejection merely because a language comparison differs.
- [PostgreSQL table expressions](https://www.postgresql.org/docs/18/queries-table-expressions.html)
  describe inner joins retaining matching rows. Joining to the current library
  validates resolution in the same database statement rather than relying on a stale
  application cache or a non-null ID alone.
- [W3C PROV-O](https://www.w3.org/TR/prov-o/) provides concepts for retained entities
  and the activities that generated or invalidated them. Historical provenance and
  current decision eligibility serve different purposes. This is an application
  policy informed by those concepts, not a W3C conformance claim or RDF requirement.

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Filter only null IDs in JavaScript | Small change | Cannot establish current resolution or active state | Insufficient |
| Filter only null IDs in SQL | Reduces rows transferred | Non-null stale or inactive destinations remain eligible | Insufficient |
| Join current libraries and validate numeric IDs | Excludes unresolved evidence without manual work | Adds indexed lookups; eligibility changes with active state | Implement |
| Delete detached feedback | Simplifies consumers | Destroys historical evidence | Reject |
| Recover IDs from archived names or snapshots | Reuses more records | Can attach historical evidence to a replacement identity | Reject |

Recommended stack: retained history → current destination resolution → strict
numeric IDs → unchanged signal scoring → positive-evidence threshold → existing
write authority and conflict checks.

## Validation and follow-up

Test null/missing/malformed IDs, confirmations and genuine rejections across all
signal types, all-ineligible cohorts, disabled candidates/destinations, stale IDs,
detachment with ID reuse, record preservation and query failure. Use real PostgreSQL
for join/active-state behavior and the production service for confidence arithmetic.

Next, apply explicit destination eligibility to feedback failure-pattern analysis.
`feedbackAnalysisPatternDetection.mjs` also compares selected and suggested IDs and
reads corrections for a policy without proving a live selected destination. Audit
its suggestion outcomes before allowing detached feedback to influence them.

The separate [outcome](feedback-confidence-eligibility-outcome.md) records results
and the limits of the local measurements.
