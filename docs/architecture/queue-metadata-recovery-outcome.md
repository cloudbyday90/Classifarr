# Failed-task metadata recovery outcome

Date: 13 October 2026. No release or production deployment is part of this work.

## Finding

The Unraid task for Avengers: Endgame Encore still references TMDb movie 1778435.
At 17:24:56 UTC, its details endpoint returned 404 while configuration returned
200 with the same credentials. Task 3685557 was failed at metadata fetch, had
one of five attempts used, and had no active claim or routing link. It originated
before the current release. This is evidence of a missing catalog resource,
not proof that the record was deleted, merged or replaced by another title.

Official sources establish a real Encore re-release with different editions,
but do not establish a replacement TMDb identity. No Unraid/Plex record was
changed, no production retry was run and no replacement mapping was approved.
See the [research and tradeoffs](failed-task-identity-check-design.md).

## Implemented

Command Center now offers an administrator-only check of the exact saved movie
or TV ID, separate from classification. It returns a bounded current observation
and task reference, rejects changed settings/tasks/authority, cancels on disconnect
and never remaps or retries the task. Status reads do not call providers.

The [same-ID recovery worker](queue-metadata-self-healing-design.md) also backfills
eligible confirmed missing-record failures. Its PostgreSQL ledger saves admission,
cooldowns and six-check budget before HTTP. If the original record returns, it can
resume the original unrouted task once with its remaining attempts. It excludes
unknown historical failures, exhausted budgets, linked decisions, claimed tasks
and superseded requests. Title guessing, retry-budget resets and changes to
ownership, memory safeguards or source libraries are not part of recovery.

Separate ESM provider, repository, service and scheduler modules use the existing
HTTP transport, limiter and queue. The additive migration and isolated fresh-schema
snapshot were reviewed explicitly in the ownership manifest; existing review debt
was not waived. No dependencies or release versions changed.

## Verification

- Focused backend checks: 99 unit tests passed, including actual HTTP responses,
  redirect/body limits, cancellation, administrator/CSRF checks, stale-result
  rejection, finite recovery and scheduler cancellation/overlap handling.
- 39 isolated PostgreSQL/scheduler-lifecycle tests passed, covering enrollment, concurrency, one-time recovery,
  unchanged attempt budgets, receipt alignment, stale leases/rows, configuration
  changes, rollback, Retry-After extension, cascading cleanup, typed TV recovery
  and migration idempotence without budget resets.
- Type checks, migration naming/snapshot integrity, ownership review, dependency
  usage checks, copyright and static ESM/mock-shape checks passed.
- Final backend unit run: 1,824 suites passed; 57,548 tests passed and one existing
  test skipped. The earlier coverage run found one stale SQL-text assertion in
  the read-model test. It was updated to verify the recovery join and failed-task
  filter, then the entire unit suite was rerun successfully.
- Final frontend coverage run: 470 suites and 7,219 tests passed. The initial run
  found an old copy assertion; the updated panel test also verifies that unrelated
  routing failures do not offer a metadata check.
- Coverage ratchet passed: server lines/statements 89.75%, branches 86.26%,
  functions 91.16%; client lines 89.35%, statements 87.64%, branches 81.57%,
  functions 87.30%. Final lint, type checks and Markdown checks passed.
- The default full database run had 17 connection-reset/connection-timeout
  failures across five existing files, 3,274 passing tests and one existing skip.
  The PostgreSQL container had no restart or OOM kill. A small default-host rerun
  also had connection resets. All five affected files plus both new recovery
  integration files then passed with test-only `TESTCONTAINERS_HOST_OVERRIDE=127.0.0.1`
  (97 tests). This suggests a local connection-path issue; it does not establish
  IPv6 as the cause or explain the separate GitHub cleanup failure. The full IPv4
  rerun then passed: 266 suites and 3,291 tests, with one existing skipped
  suite/test. No application networking, TLS, memory limits or timeout settings
  were changed. This is a test-run workaround, not a confirmed networking fix.

## Local image evaluation

The no-cache Compose build succeeded from clean implementation commit
`ac326cbcd8750ad17664a3ce417c10753436dc04`. Docker resolved the resulting image to
`sha256:7cca7f4f9f4d58b27b0be9b129bcd953251cafb9cca6239c66851ecbaff03da7`
(exported platform configuration `sha256:67b894472459052aa3c78402f6e0e94e724b65e417c5bb617eeef03f9c75fc30`).
Its fresh-schema check passed in an isolated container, which was cleaned up.
The previous local image `sha256:ee519a81497550072ea47931930b952739a53079313d580900b087e9ab0ce397`
was retained under the verified container-specific rollback tag before building.
Local Compose replacement succeeded with that exact image. Container
`d51b678ea50d8335c2c87a982f26a132545954b92787cd1302b40dc7e1336ff4`
is healthy, with no OOM kill or restart. At 18:51 UTC the migration was recorded
once, the recovery ledger and failed-task counts were zero, `/health` returned
200 and an unauthenticated metadata-check POST returned 401. Startup logs confirm
`queue-metadata-recovery` registered on its five-minute schedule. This confirms
registration, not an observed recovery of a real failed item.

The container still runs as `1000:1000`, with a read-only root filesystem,
`no-new-privileges` and a 2 GiB limit. Initial container memory was about 799 MiB;
this is a startup observation, not a long-duration memory assessment. No memory
safeguard was disabled. Unraid, Plex and the shared Ollama service were unchanged.
The follow-up commit changes documentation and a SQL-text test assertion only;
it does not change the built application runtime.

The local database has zero failed tasks, so it cannot demonstrate a real failed
item recovering. Before replacement, a 76,265,850-byte PostgreSQL custom archive
was saved in ignored `data/backups/metadata-recovery-before-20261013.dump` and
`.tmp/metadata-recovery-before-20261013.dump`; its table-of-contents header was
validated. SHA-256: `321d5a9a0e8a5e550105e7a1f38c5eff9079573fc3e30d23d13c46917024133d`.
This confirms the archive was generated and readable, not a full restore rehearsal.

Tests that exercise future cooldowns explicitly advance isolated fixture deadlines;
they do not claim hours or weeks elapsed. Reconstructing a repository/service
proves persisted-budget reuse, not a published-image upgrade. Live recovery of the
Encore item remains unproven because its original record is still unavailable.

GitHub reported **zero open PRs** on two checks during this work. There was no
open PR to choose or implement; none was merged or closed.

## Recommendation stack

1. Keep exact-ID diagnostics plus bounded same-ID recovery. This removes manual
   work for temporary catalog disappearance without changing identity authority.
2. Repair CI shutdown-drill diagnostics before a release: the latest failure hid
   its underlying cleanup errors. See the [CI finding](queue-recovery-drill-failure-20261013.md).
3. Add evidence-driven identity repair for records that never return. Reconcile
   authoritative external IDs and request lineage, distinguish work from edition,
   and require a version-bound reviewed mapping with an audit receipt. Preserve
   ambiguity instead of automatically substituting the closest title.
