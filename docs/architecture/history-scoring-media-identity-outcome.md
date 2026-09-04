# History scoring media identity outcome

Date: 4 September 2026. The separate
[design document](history-scoring-media-identity-design.md) records official
source research, alternatives, and the recommendation stack.

## Delivered behavior

History scoring now uses a validated `(media_type, tmdb_id)` identity.
`policyHistoryScoringQuery.mjs` validates IDs and canonicalizes movie/TV input,
then returns a static parameterized SQL statement. `policyHistoryScoring.mjs`
executes that query and produces a bounded score. The original source-scoring
named export and `policyEngine.scoreHistory` facade are preserved.

Movie and TV histories are separated before `MAX(confidence)`, `COUNT(*)`,
group ordering, and the five-library limit. Completed-status and assigned-library
requirements remain. A library-ID tie-breaker makes equal groups deterministic.
For valid data the formula remains `min(min(confidence, 60) + min(count * 10,
40), 95)`.

Missing/unsupported media types, malformed IDs, nonpositive/out-of-range IDs,
and non-finite or invalid aggregates produce zero history evidence. Valid
decimal-string IDs remain usable; whitespace and movie/TV casing normalize
without inventing a type or accepting an alias. Database failures also return
zero and log only a fixed diagnostic reason. No credentials, item metadata,
identities, parameters, or exception text are added to logs.

This changes future scoring, not stored classification records. A caller that
previously omitted media type now receives zero history evidence until it
supplies a valid identity. The existing confidence-cap integration fixture
was corrected to include its known movie type. No schema migration, new
dependency, API/UI change, or release/version bump is included.

## Executed validation

- Targeted unit checks: 12 suites and 214 tests passed, including input
  rejection before database access, safe error handling, numeric bounds,
  formula preservation, and the existing public export.
- PostgreSQL integration: 3 suites and 46 tests passed, covering the policy
  engine, the collision regression, and the held-out study query regression.
- The same collision fixture passed in the existing local Compose container.
  A movie retained score 70 while TV history with the same ID scored 95;
  the movie received zero for a TV-only destination. Six unrelated TV library
  groups no longer displaced the movie from the five-library limit.
- Fixtures also cover incomplete statuses, null library/identity/confidence
  values, absent matches, and deterministic ties. All fixture writes used
  connection-local temporary tables and were rolled back.
- Backend lint, server/client type checks, and the ESM static-import and
  mock-shape gates passed.
- The full backend unit suite passed: 1,041 suites and 28,810 tests. Markdown
  lint and `git diff --check` also passed.

A read-only query of the local Compose history found 6,614 distinct numeric
IDs among completed records with a destination. Forty-six numeric IDs occurred
in both media types. None occurred in both types within the same destination
library. These counts demonstrate ID reuse; they are not counts of scoring
errors or misrouted items.

An `EXPLAIN (ANALYZE, BUFFERS)` check for a frequently occurring identity used
the existing `idx_classification_history_tmdb` index. The observed execution
time was 0.096 ms, with 0.343 ms planning time. This single local sample is not
a latency guarantee or a representative benchmark. It provides no reason to
add another index for this fix. Real history was queried under PostgreSQL
read-only mode; titles, IDs, and raw plans were not exported.

## Repository and PR handling

At the user's request, the completed held-out-study commit `05540b0d` was
first fast-forwarded into `main` and pushed to `origin/main`. The history fix
was then developed on `fix/history-scoring-media-identity` from that commit.

The GitHub MCP pull-request endpoint returned an empty array for
`cloudbyday90/Classifarr` with `state=open&per_page=100` on 4 September 2026.
There was no eligible open PR to choose randomly or implement locally. No
closed PR was substituted and no PR was merged for this part of the task.

## Recommendation and remaining work

Retain the focused ESM query builder/scorer, paired identity parameters,
conservative zero-score behavior, real PostgreSQL regressions, and existing
policy facade. The advantages are identity isolation, testability, and no
data migration. The cost is reduced history evidence for malformed legacy
callers; they must provide a type rather than rely on a guess. Broader identity
normalization would improve consistency but should be handled per consumer
with explicit compatibility tests.

The next production item is source-library history persistence in
`queueClassificationHistoryService.mjs`. Its duplicate check still uses TMDb
ID plus library without media type, and its insert path defaults missing
media type to `movie`. Apply a consistent typed-identity contract across
duplicate checking and insertion, including the no-TMDb title fallback, and
test missing-type handling. This is a code finding, not a claim that the local
inventory contains that corruption. Do not rewrite historical rows without
independent evidence of their correct type.

The separate semantic-study task still needs a prospectively selected eligible
cohort and independent human labels. This history fix does not change the
readiness thresholds or authorize semantic counter-evidence routing.
