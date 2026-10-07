# Provider-study midnight accounting outcome

Date: 2026-10-06 local / October 7 UTC.
[Design and official reference](provider-study-midnight-design.md).

## Implementation

The real-HTTP provider integration test now checks eleven committed reservations
through a test-only transactional audit, then verifies sequential per-day usage
and the final persisted daily counter. All HTTP-count, retry-wait, completion,
drain, budget and provider-enabled assertions remain. The audit refuses non-test
database names and records no credentials or provider payloads. Existing suite
teardown drops the entire owned test database.

No production quota logic, migration, runtime setting or application-image input
changed. Tests/helpers are excluded from the Docker build. The comparison catalog
study was allowed to finish on its original immutable candidate before running
these PostgreSQL tests; its workload and image are not replaced mid-run.

## Validation

The original CI job failed with eleven lifetime HTTP attempts but nine requests
in the stored daily counter during a run crossing UTC midnight. Its other receipt
assertions passed. A new real-PostgreSQL regression covers same-day eleven requests,
two-plus-nine across midnight, rollback, extra reservations, corrupt daily sequence
and non-test-database refusal. Only this boundary regression injects database time;
the HTTP study retains real cooldowns. After the memory study finished, all three
targeted PostgreSQL suites passed: 22 tests in 160.891 seconds, including the
unchanged real-HTTP workload and existing quota-reservation coverage. The boundary
regression reproduced the daily counters of eleven and nine while proving eleven
committed reservations in both cases. Rolled-back writes were absent; extra writes
and corrupt per-day sequences were rejected. Server lint, typecheck, copyright,
static-import and ESM mock-shape checks also passed.

This reproduces the timing explanation, not the original job's individual request
timestamps, which were not recorded. CI must rerun on this test-only correction;
the earlier failed receipt is not retroactively described as passing.

## Recommendation

Keep exact total and per-day accounting. Do not weaken the assertion to a range,
skip tests near midnight or modify production quotas to fit a lifetime assertion.
Keep the real-clock HTTP test and explicit boundary regression together. Track
the [follow-up CI receipt](https://github.com/cloudbyday90/Classifarr/actions/runs/37551094913)
for commit `e559f873` separately; local verification does not substitute for that run.
