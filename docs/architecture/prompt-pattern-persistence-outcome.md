# Prompt pattern persistence: implementation outcome

## Delivered behavior

The [metadata-vote follow-up](feedback-metadata-votes-outcome.md) is complete.
Prompt responses now save explicit pattern choices, feedback, learning statistics
and classification completion in one transaction. Insert, update and commit-time
failures roll back the entire response. Concurrent or repeated responses cannot
record a second feedback event for the same pending prompt.

A small shared ESM writer supplies the required library name, uses current schema
columns, preserves higher existing confidence and returns the persisted ID. Both
prompt responses and reviewed tuning suggestions use it. The historical API field
`patternsCreated` now counts distinct successful upserts, including updates to
existing patterns. Feedback stores the same distinct actions. No schema migration,
dependency, release tag or package version change was needed.

The prompt list, batch and detail routes also used removed classification columns.
They now read the existing method, confidence and candidate metadata. Classification
completion preserves original confidence and metadata, records the current library
name and clears pending reason/identity. Named client API functions expose the
existing endpoints through the shared transport; no view/store used these endpoints,
so no UI workflow was changed.

## Request contract and boundaries

Library and optional policy IDs must be positive PostgreSQL integers. All requested
destinations must exist, be active and match the classification's media type; a
selected policy must belong to the selected library. Explicit pattern choices
respect the existing native-intent legacy-tuning guard. Selecting a destination
without adding a legacy pattern remains possible for a native-intent policy.

The request allows up to 50 actions, 50 UTF-8 bytes per pattern type, 1,024 per value,
20 reasons of at most 200 bytes each, and a custom reason of at most 4,000 bytes.
Text must be nonempty and contain no NUL. Trimming and exact identity deduplication
preserve case and Unicode distinctions. Target library defaults only when omitted.
Any invalid action returns 400 before writes; missing classifications return 404.
Only `pending` classifications may be completed here; other states return
`409 PROMPT_NOT_PENDING`. Existing awaiting-decision workflows retain their separate
lifecycle. There is no automatic retry or automatic pattern adoption.

Policy, destination and classification locks remain held until commit; pattern
writes use a stable identity order even when no policy exists. The feedback facade
and learning-statistics service accept the caller's transaction client while
preserving existing standalone callers. This does not retrofit transactions into
every other feedback entry point.

## Validation

| Check | Outcome |
| --- | --- |
| Related backend unit tests | 243 passed across 21 suites |
| Real PostgreSQL integration | 106 passed across 4 suites |
| Full frontend suite with coverage | 4,528 passed across 329 files |
| Frontend coverage | 85.79% statements, 77.39% branches, 84.65% functions, 87.74% lines |
| Integration coverage of response service, shared writer and projection | 100% statements/functions/lines, 92.30% branches |
| Server/client type checks, affected-file lint, ESM gates | Passed |
| Local Docker image | Built from staged tracked files, including production frontend build |
| Disposable application startup and schema comparison | Healthy startup; schema unchanged |

Database tests cover current-schema reads, new and existing patterns, duplicate
actions, invalid targets, policy ownership, native authority, missing/nonpending
classifications, rollback at every write stage, deferred commit failure, concurrent
responses and separate simultaneous prompts with and without policies. The broader
feedback suite exposed five stale fixture failures; fixtures now capture and attach
real frozen evidence instead of bypassing the current contract.

Full repository backend coverage and the combined coverage ratchet were not rerun.
The current backend evidence is the focused unit/integration run and scoped coverage
above, not the older full-suite report. No new server endpoint was added.

## Real data and PR check

Read-only inspection of local Compose at 2026-09-07 00:18:22 UTC found PostgreSQL
18.6 with zero feedback, zero suggestions and no eligible cohort. The aggregate
query took 78.226 ms and performed zero production writes, provider requests or
individual-record exports. Regression fixtures are not an independently labeled
production cohort or a measured classification error profile.

GitHub MCP returned an empty open-PR list on both checks. No PR was available for
random selection or local implementation, and no external PR was merged.

## Recommendations and tradeoffs

| Recommendation | Pros | Cons |
| --- | --- | --- |
| Keep response writes atomic | Prevents false success and partial learning evidence | One invalid action rejects the whole response |
| Retain the existing pattern table with a shared writer | Repairs two paths without a migration | Other legacy writers still exist |
| Lock pending responses and use current destination data | Prevents duplicate votes and stale names | Briefly serializes affected responses |
| Preserve the historical result field with documented upsert semantics | Avoids a response-envelope migration | `patternsCreated` includes updates, so clients must not present it as new-row count |
| Keep cohort/readiness gates | Avoids treating regression fixtures as accuracy evidence | Real error rates remain unknown until eligible evidence exists |

Recommended stack: bounded input → current destination and policy checks → pending
classification lock → shared upsert → transaction-bound feedback/statistics →
commit → truthful response. This adds no operational labeling requirement. The
separate [design document](prompt-pattern-persistence-design.md) records alternatives
and the verified PostgreSQL, IETF and W3C sources for the August 2026 baseline.

## Next item

**Separate observed feedback from evaluable correction evidence.** The existing
feedback writer defaults a missing correction flag to false, and learning statistics
count every non-correction as correct. When original candidate metadata is absent,
this can count an unevaluated decision as an accuracy success. Define a shared
eligibility rule, preserve the original observation, and report evaluated coverage
separately from accuracy. Apply it consistently across feedback producers and
statistics before making further automation decisions. This can use existing
metadata without asking operators to label every item. Repeated observations of
the same media identity still need a separate policy for corrections over time.
