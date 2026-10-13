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

- Focused backend checks: 81 unit tests passed, including actual HTTP responses,
  redirect/body limits, cancellation, administrator/CSRF checks, stale-result
  rejection, finite recovery and scheduler cancellation/overlap handling.
- 39 isolated PostgreSQL/scheduler-lifecycle tests passed, covering enrollment, concurrency, one-time recovery,
  unchanged attempt budgets, receipt alignment, stale leases/rows, configuration
  changes, rollback, Retry-After extension, cascading cleanup, typed TV recovery
  and migration idempotence without budget resets.
- Type checks, migration naming/snapshot integrity, ownership review, dependency
  usage checks, copyright and static ESM/mock-shape checks passed.
- Full coverage suites and the final no-cache Compose rebuild are pending at
  this checkpoint; this document will be updated with their actual outcomes.

The local database has zero failed tasks, so it cannot demonstrate a real failed
item recovering. Before replacement, a 76,265,850-byte PostgreSQL custom archive
was saved under local ignored backup storage and its table-of-contents header
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
