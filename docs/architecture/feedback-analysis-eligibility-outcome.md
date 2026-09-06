# Feedback analysis eligibility outcome

## Implemented behavior

The [confidence eligibility follow-up](feedback-confidence-eligibility-outcome.md)
now protects policy suggestion analysis. A small ESM reader selects feedback whose
positive integer destination resolves to the selected policy's current active library.
Detached, unresolved, inactive, unknown-active-state and contradictory references
cannot contribute to pattern, weight or threshold suggestions or the sample minimum.

All analysis branches use that one cohort. Failure-pattern analysis no longer issues
an independent 30-day query, so short and extended requested windows also govern
missed-positive patterns. An empty cohort stops before generation/storage, even with
a zero minimum from an internal caller. Database read failures propagate without
creating suggestions. The API shape is preserved; `feedbackCount` now counts eligible
rows. Historical records and reporting remain unchanged.

No migration, dependency, provider call, new operator step or automatic routing was
introduced. Existing classification thresholds, correction semantics and suggestion
approval/write authority remain in place. The isolated inventory cleanup prototype
was not promoted or deployed.

## Tests and local measurements

The targeted unit and code-health run passed **20,640 checks across five suites** in
13.821 seconds. The new evidence reader has 100% statement, branch, function and line
coverage. The scoped report covering it and the pattern-detection module has 90.9%
statements/lines, 86.44% branches and 100% functions. These are scoped measurements,
not repository coverage; the separate report remains under ignored `.tmp/`.

The Docker-backed PostgreSQL integration run passed **41 tests across three suites**
in 4.742 seconds, including ten new eligibility cases, existing feedback analysis
and confidence eligibility regressions. The new cases exercise production readers,
analysis, generation and suggestion storage against real schema tables:

- Five eligible confirmations plus ten detached corrections and five contradictory
  destinations produce five eligible rows, 100% preset accuracy and no suggestions.
  Historical rows are byte-for-byte equivalent at the database value level afterward.
- Three confirmations and three genuine corrections retain 50% preset accuracy,
  supported Action patterns and a pending threshold adjustment from 85 to 90.
  Six detached corrections cannot add their metadata or IDs to those suggestions.
- Eligible signal failures still produce pending weight adjustments. Inactive and
  unknown-active destinations, insufficient eligible samples and all-detached cohorts
  cannot generate suggestions.
- Seven-day analysis excludes ten-day corrections; 60-day analysis includes ten- and
  forty-day corrections in missed-positive patterns. A missing policy and deliberately
  corrupted stale destination fixture produce no eligible evidence.
- Detachment stays excluded after numeric ID reuse. Explicit analysis of a disabled
  policy remains possible when its destination is active. The reader runs inside a
  database-enforced read-only transaction.

The first integration run exposed an existing deduplication defect: the genuine
correction fixture stored two equivalent pattern suggestions and one threshold
suggestion. Its initial expectation of two total suggestions failed. The regression
now checks every pattern's exact eligible support and the threshold/weight outcomes
without asserting that unrelated deduplication already works. That defect is the next
recommended fix below.

The production evidence reader ran against local Compose at **2026-09-06 19:47:01 UTC**
in a repeatable-read, read-only transaction with statement/lock timeouts. An active
policy destination existed, but the 30-day feedback window contained zero records.
The query returned zero eligible rows in 7.505 ms, with zero writes, provider requests
or individual records exposed. Plain JSON `EXPLAIN` used policy/library primary keys
and the existing feedback-library index. This verifies local compatibility, not a
populated performance benchmark or a real 24–32-case accuracy study.

Repository lint, configured backend/frontend type checks, ESM static-import and
strict mock-shape checks, both server Knip checks and Markdown lint passed. The local
production image `classifarr:feedback-analysis-local` was built from the staged tree,
excluding ignored private captures, and was not deployed or published. Full backend
and frontend suites and repository coverage were not regenerated; no baseline changed.

## Recommendations and tradeoffs

| Recommendation | Pros | Cons |
| --- | --- | --- |
| Use one eligible cohort for every suggestion branch | Consistent support, denominators and lookback; fewer queries | Internal helpers must receive that eligible cohort |
| Require current policy/destination agreement and active state | Excludes contradictory or unresolved evidence automatically | Fewer usable samples; current lifecycle state changes eligibility |
| Preserve historical feedback | Retains reasons and context for future classification research | Other consumers still need explicit eligibility contracts |
| Stop empty cohorts before generation | No suggestions from an absent sample | Does not retrospectively invalidate stored suggestions |

Recommended stack: retained history → current policy/destination agreement → active
library resolution → one bounded lookback → eligible sample minimum → existing
suggestion generation and approval → policy write authority. PostgreSQL join semantics
and W3C provenance guidance, alternatives and the August-baseline research limitation
are recorded in the separate [design](feedback-analysis-eligibility-design.md).

## Next fix and remaining limits

**Make pending suggestion deduplication structural and safe under concurrent writes.**
`feedbackAnalysisSuggestionStore.mjs` compares `suggestion_config::text` with supplied
JSON text. JSONB rendering changes whitespace and key ordering, so equivalent objects
can miss the comparison. The real integration fixture reproduced duplicate patterns
from the missed-positive and new-pattern branches. Use JSONB equality for semantic
matching, then define a transaction/database uniqueness strategy for concurrent
analysis. Test equivalent key ordering, repeated runs, concurrent writers and distinct
configurations. Preserve existing history when addressing already stored duplicates.

After that, record full cohort provenance and revalidate pending suggestion evidence
when applying it. Weight and threshold suggestions currently store empty supporting
feedback arrays. Read-time eligibility cannot protect old suggestions from later
detachment or library lifecycle changes. Immutable identity and writer guards remain
necessary for incorrectly reattached non-null references. These are separate from
the implemented cohort eligibility fix.

GitHub MCP returned no open PRs on 6 September 2026, so none was available for random
selection or local implementation. No external PR was merged and no release was created.
