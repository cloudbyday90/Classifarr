# Description failure isolation outcome

Date: 2026-09-13. Scope: local inventory-description backfill, not live routing.

## Design and implemented outcome

The previous commit (`9c6158ab`) added precise provider-response diagnostics and
whole-worker recovery. Its remaining failure mode was head-of-line blocking: one
rejected batch repeatedly occupied the start of the missing-description list.

The new ESM planner, backfill service and PostgreSQL journal separate healthy work
from deferred suspects. A failed batch is not evidence that every member is bad.
Its members are retried individually on later scheduled passes. Successful
descriptions keep their existing cache checkpoints and are not regenerated after
a restart. Changed descriptions or embedding representations use different keys.

Eight embedding requests remain the per-pass maximum. When both work categories
are backlogged, six fresh batches and two individual retries share that budget.
Two consecutive isolatable failures pause the worker through existing global
backoff. Transport, access, malformed JSON, model drift and database failures do
not create per-description diagnoses. Individual retry delays grow from 60–75
seconds to one hour; busy foreground work can delay execution further.

The journal stores only representation keys, description hashes, fixed reason
codes, attempts and timestamps. It has a 20,000-row admission cap and bounded
30-day expiry cleanup, serialized by the existing shared advisory lock. Zero
attempts denotes an unattributed batch failure. Only singleton failures increase
an item's count. No titles, descriptions, vectors, endpoints, credentials or
library membership are stored in this retry table or added to warning payloads.

Warnings explain that individual retries are scheduled and other work may
continue. Repeated codes remain deduplicated. A completion event is emitted only
when all currently eligible descriptions are cached. No acknowledgement, new
settings, UI panel, API contract, dependency or routing threshold was added.

## Verification

- Focused regression: eight suites / 25,152 tests, including code-health checks.
- Real PostgreSQL integration: seven tests covering fresh/idempotent migration,
  all-or-none capacity admission, due-time/retention behavior, model namespaces,
  validated cache checkpoints and worker recreation.
- Unit fault cases include mixed synthetic movie/TV content, one bad batch member,
  sustained all-bad responses, cancellation/admission changes, model drift behind
  malformed data, cache-write failure and cleanup failure after a checkpoint.
- Full frontend regression: 368 suites / 5,114 tests; no frontend/API changes.
- Repository preflight, server/client type checks and lint, ESM static-import/mock
  checks, documentation lint, migration naming and snapshot integrity passed.
- Fresh-container schema parity passed. The running Compose database confirms
  that the additive migration and journal are present.

The first full backend run exposed the not-yet-regenerated schema snapshot: two
assertions failed in the migration suite, while the other 1,291 suites passed.
The canonical snapshot was then generated from an isolated fresh database; all
20 migration-suite tests passed. The final full backend rerun passed all 1,292
suites / 37,477 tests. Backend coverage was 90.15% statements/lines, 82.58%
branches and 92.23% functions. Frontend coverage was 85.61% statements, 77.54%
branches, 85.08% functions and 87.66% lines. The combined coverage ratchet passed
without changing thresholds.

An isolated HTTP mock inside rebuilt local Compose exercised the shipped adapter,
validator, writer and worker with 24 synthetic movie/TV descriptions:

- One wrong-dimension response deferred its eight-member batch while 16 later
  healthy descriptions committed in the same pass.
- Individual retries recovered seven healthy companions, leaving one deferred
  description. Repeated singleton failures used 60- then 120-second delays with
  deterministic jitter for the test; a busy pass did not reset that state.
- Once the mock recovered, the remaining description backfilled automatically.
  A recreated worker reused all 24 cache checkpoints without another embed call.
- There was one deduplicated warning and one completion event. Neither contained
  synthetic descriptions or the provider endpoint. Compose remained healthy with
  a read-only root filesystem.

The Compose fault probe uses in-memory checkpoint/journal fixtures; the separate
PostgreSQL integration tests verify durable storage and restart behavior. This
distinction avoids claiming synthetic process recreation is a database restart.

No real inventory mutations or paid-provider calls are needed for the synthetic
fault checks. They establish recovery behavior, not semantic accuracy or the
cause of a particular historical provider defect.

## Recommendations, tradeoffs and next component

Adopt the stack in the [design and official-source research](description-isolation-design.md):
strict provider validation, existing durable vector checkpoints, a private retry
journal, fair bounded scheduling, and quiet actionable diagnostics.

Benefits: healthy backfill progresses without user intervention; deferred work
survives restarts; invalid output is never accepted as a repair. Costs: an additive
migration, more requests to isolate suspect batches, and slower progress during
provider-wide failures. Existing SWR/disclosure behavior remains unchanged; this
backend slice makes no new accessibility-conformance claim.

**Next: coverage-aware partial representative-profile publication.** Inspection
of `inventoryRepresentativeProfileRefresh.mjs` found that it still waits for every
eligible description vector. This change lets healthy descriptions finish
backfilling but does not let that publisher proceed with partial coverage. The
next component should publish only sufficiently supported profiles, report actual
coverage, distinguish missing evidence from negative evidence, and retain safe
fallback for under-covered libraries. Validate on held-out movie and TV inventory
before considering changes to live routing; never learn genre rules from library
names or treat the system's own unconfirmed placements as ground truth.

## Delivery boundaries

GitHub MCP returned no open Classifarr PRs during selection and recheck. No PR was
applied or merged. All six workflows for predecessor `9c6158ab` completed
successfully. This change includes no release, tag or version bump.

The migration is additive. Older code can run with the unused journal present;
rollback does not require deleting inventory, cache entries or the new table.
