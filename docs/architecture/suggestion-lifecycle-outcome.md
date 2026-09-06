# Suggestion lifecycle outcome

## Implemented behavior

The [deduplication follow-up](pending-suggestion-deduplication-outcome.md) now protects
review transitions. Apply and reject use a shared ESM lifecycle module within a
Read Committed transaction. Both lock the policy first, then re-read and lock the
suggestion. Only pending suggestions proceed. A policy-reference change while waiting
returns a conflict instead of using stale authority or acquiring a different policy.

Apply retains the native-intent write guard. Rejection can dismiss pending suggestions
on native-intent policies because it does not change policy behavior. Successful apply
commits the policy/pattern effects, audit entry, status, review actor/time, applied
actor/time and accuracy baseline together. Rejection commits its status, reviewer,
timestamp and reason together. Both require a conditional pending-state update to
return a row. Failures roll back their effects; completed history is not rewritten.

The route's earlier accuracy write was removed. Both API families now use the service
transaction for bookkeeping. Existing success payloads remain unchanged; repeated or
conflicting reviews return 409 with a lifecycle code, while missing targets return
404. The client API preserves those errors. The dashboard closes stale review dialogs
and reloads the list on lifecycle conflicts, without retrying or reporting success.
Other policy-authority/network errors retain their existing handling.

No schema migration, dependency, provider call, automatic routing or new confirmation
step was introduced. The guarantee applies to updated service writers; arbitrary SQL
or older writers are not constrained by a database lifecycle trigger. Historical rows
were not backfilled or consolidated.

## Validation and local evidence

The targeted unit/code-health run passed **20,727 checks across nine suites** in
13.055 seconds. Targeted client API/dashboard tests passed **18 tests across two
files**. They cover conflict propagation without retries, stale-list refresh and
dialog closure, unchanged policy-authority error handling, successful reviews and
canceled apply requests.

Docker-backed PostgreSQL integration passed **70 tests across five suites** in
12.436 seconds, including sixteen new lifecycle cases and the existing suggestion API,
feedback analysis, eligibility and deduplication suites. The new cases verify:

- Apply/apply, apply/reject, reject/apply and reject/reject sequences preserve the
  first completed review, including actor, timestamps, baseline and audit data.
- Unknown/null statuses cannot be reviewed. Simultaneous apply/apply, reject/reject
  and apply/reject calls are observed waiting on real PostgreSQL locks; each pair
  produces one success and one lifecycle conflict with one terminal state.
- A policy-reference change during a lock wait leaves both policies untouched by
  the attempted application. An audit insertion failure rolls back policy changes,
  terminal state and baseline, and a subsequent application succeeds.
- Native-intent authority blocks apply before bookkeeping while allowing dismissal.
  Both API families return 409 for completed suggestions and 404 for missing targets;
  a newer learning-stat value cannot overwrite the first application's baseline.

The first integration run exposed ambiguous PostgreSQL inference for a parameter used
as both a varchar assignment and in text comparisons; an explicit parameter type fixed
the query. A later fixture needed a purpose rule in the same transaction as its active
native intent. The fixture was corrected to satisfy the real schema without disabling
constraints. The final targeted integration run passed.

Local Compose PostgreSQL **18.6** was inspected read-only at
**2026-09-06 20:31:24 UTC**. All seven lifecycle/bookkeeping columns were present, but
the instance contained zero suggestions. The aggregate inspection took 415.402 ms
with zero production writes, provider requests or individual records returned. This
confirms local schema compatibility; it is not a populated workload or cohort-accuracy
measurement.

The full frontend coverage run passed **4,504 tests across 327 files** in 364.32
seconds: statements 85.64%, branches 77.30%, functions 84.43% and lines 87.59%.

The full backend coverage run passed **30,434 tests across 1,074 suites** in
2,710.459 seconds: statements/lines 89.66%, branches 80.72% and functions 91.87%.
This report excludes the separately run PostgreSQL integration tests. The combined
coverage ratchet passed with fresh backend and frontend reports; no baseline changed.

The initial serial coverage attempt was interrupted after more than an hour without
a final report and is not counted as a pass. The final run used the repository's
existing CI configuration: `--ci --coverage --maxWorkers=2`.

Repository lint, backend/frontend type checks, static ESM imports, strict ESM mock
shapes and both backend Knip checks passed. Markdown lint passed across 1,030 files.
The production Docker image built successfully as
`classifarr:suggestion-lifecycle-local` from the staged source tree. It was not
deployed or published. Private captures, credentials and generated coverage reports
remain ignored and are not included in the commit or image build context.

## Recommendations and tradeoffs

| Recommendation | Pros | Cons |
| --- | --- | --- |
| Lock policy before the suggestion re-read | Coordinates storage and review; protects current authority/configuration | Same-policy operations wait |
| Require pending state and a guarded terminal update | Prevents repeats and conflicting reviews | Retries receive explicit 409 instead of another success |
| Keep effects, baseline and audit in one transaction | Failed reviews leave no partial bookkeeping | Requires every writer to follow the protocol |
| Refresh stale dashboard state without resubmission | Reduces manual recovery and misleading success messages | Refresh still depends on API availability |
| Preserve historical records | Retains original review provenance | Existing incomplete metadata is not backfilled |

Recommended stack: authenticated request → policy lock → locked suggestion re-read
→ pending-state check → existing apply authority check → transactional effects and
terminal update → committed response → refresh stale client state on conflict. The
separate [design](suggestion-lifecycle-design.md) records official PostgreSQL, HTTP and
W3C sources, alternatives and the August-baseline research limitation.

## Next item

**Persist complete cohort provenance and revalidate pending suggestion evidence when
applying it.** Lifecycle validity does not establish evidence freshness. A pending
suggestion can outlive a library detachment or policy change, and threshold/weight
suggestions currently store empty supporting-feedback arrays. Define the full cohort,
policy/configuration version and eligibility rules before implementing an application
guard; test changed and detached destinations without treating historical snapshots
as current routing authority.

GitHub MCP returned no open PRs on 6 September 2026, so none was available for random
selection or local implementation. No external PR was merged and no release was created.
