# Feedback confidence eligibility outcome

## Implemented behavior

The [retained-reference follow-up](inventory-retained-references-outcome.md) is
implemented in the production confidence service. A new ESM evidence reader selects
only feedback with a positive integer destination that resolves to an active library.
The candidate must resolve to an active library in the same query snapshot.
Malformed candidate IDs return zero confidence without querying. Returned destination
IDs are checked before metadata matching, and zero confirmations cannot enable
learning even when thresholds are zero.

Historical feedback is retained unchanged. No name, metadata field, policy ID or
snapshot is used to reconstruct a detached destination. Existing signal matching,
30-day lookback, correction scoring, result shape and error fallback are preserved.
There are no API changes, migrations, dependencies, new operational steps or provider
calls. The library cleanup prototype remains isolated; this change does not deploy it.

For the integration fixture containing three confirmations, one valid rejection,
two detached records and one inactive destination, the result is three confirmations,
one rejection and **75% confidence** for each signal type. The previous implementation
would count all four non-confirming rows as rejections, yielding approximately
42.86%; that comparison follows directly from its earlier arithmetic. The new result
meets the fixture's existing threshold without manufacturing additional confirmations.

## Validation and local evidence

The final targeted unit/code-health run passed **20,644 checks across four suites**
in 15.001 seconds. Coverage restricted to the changed confidence/evidence modules
was 99.49% statements/lines, 91.37% branches and 100% functions. The new evidence
reader had 100% coverage in every category. These are scoped figures, not repository
coverage, and the report is kept separately under ignored `.tmp/`.

The Docker-backed PostgreSQL integration run passed **19 tests across three suites**
in 7.723 seconds, including ten new eligibility cases and existing auto-learning and
reset regressions. The new cases execute the production reader and confidence
service against actual schema tables. They verify:

- Genre, keyword and studio scoring retain genuine confirmations and rejections.
- Null, missing, inactive and unknown-active-state destinations/candidates are
  excluded. A deliberately corrupted stale FK fixture is also excluded.
- Reset-style detachment stays excluded after deleting and recreating a library
  with the same numeric ID; embedded snapshot metadata does not reactivate it.
- All feedback fields remain unchanged, the existing lookback/correction behavior
  remains intact, and the reader works in a database-enforced read-only transaction.

Unit cases additionally cover malformed numeric IDs and returned rows, zero-threshold
behavior and query failure. An initial test-table shape passed an empty argument
array to Jest and timed out; named case objects corrected the test without changing
the implementation. The final run passed.

The production evidence reader was also executed in read-only transactions against
local Compose at **2026-09-06 19:24:40 UTC**. An active candidate existed, but the
30-day feedback window contained zero rows: zero detached, unresolved or inactive
references and zero eligible rows. The call took 13.778 ms locally. It performed
zero writes and provider requests and returned no individual records in the report.
This confirms query compatibility, not real-cohort accuracy or populated-table
performance. Plain JSON `EXPLAIN` used the candidate primary key and a join; no
index migration or application redeployment was performed.

Repository lint, configured server/client type checks, ESM static-import and strict
mock-shape checks and both server Knip checks passed. Markdown lint passed across
1,024 documents. The local image `classifarr:feedback-confidence-local` built from
the staged repository tree, excluding ignored private captures; it was not deployed
or published. Full backend/frontend suites and repository coverage were not
regenerated; no coverage baseline changed.

## Recommendations and tradeoffs

| Recommendation | Pros | Cons |
| --- | --- | --- |
| Resolve current destinations in SQL | Excludes detached/stale records without operator work | Adds library lookups |
| Require active candidates and destinations | Keeps inactive libraries out of automatic learning | Changing active state changes the eligible evidence set |
| Validate numeric IDs before scoring | Prevents coercion and malformed-ID rejections | Numeric strings are rejected by this internal service |
| Preserve feedback for historical inspection | Retains reasons and decision context | Other consumers must define their own eligibility explicitly |
| Require positive evidence | Empty or negative-only cohorts cannot enable learning | Eligibility filtering can reduce usable sample size |

Recommended stack: retained history → current destination resolution → strict IDs
→ existing signal scoring → positive-evidence threshold → existing write authority
and conflict checks. No manual collection queue or new automatic routing mechanism
was introduced.

## Next fix and remaining limits

**Apply destination eligibility to feedback failure-pattern analysis**, starting
with `feedbackAnalysisPatternDetection.mjs`. Its false-positive filter compares
selected and suggested IDs directly, and its corrections-toward-policy query does
not prove a live selected destination. Detached feedback can therefore still affect
suggestion analysis even though it no longer affects automatic confidence. Reuse
the eligibility contract with tests for the resulting suggestions; keep historical
reporting distinct from evidence eligible for automation.

This fix cannot detect a non-null FK deliberately reattached to the wrong library
incarnation. Immutable identity and retention-writer guards remain necessary for
that case. Read-time eligibility is not a transaction lock covering later preference
writes. Existing correction semantics and cross-library signal interpretation were
not recalibrated by this bug fix.

Official PostgreSQL and W3C research, August-baseline limitations and alternatives
are recorded in the separate [design](feedback-confidence-eligibility-design.md).
GitHub MCP returned no open PRs on 6 September 2026, so none could be randomly selected
for local implementation. No external PR was merged and no release was created.
