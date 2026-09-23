# Post-upgrade work orchestration: design

Date: 2026-09-23. This is the first safety slice toward an installation-aware
upgrade orchestrator, not a claim that every background worker is coordinated.

## Problem and boundary

The [latest published beta](https://github.com/cloudbyday90/Classifarr/releases/tag/v0.48.4-beta)
is `v0.48.4-beta`; the working tree contains many
subsequent migrations and services. Migrations run before services, but the
post-upgrade runner treated an absent task ledger entry as permission to replay
historical `clear_logs` operations. It also rebuilt all library profiles during
post-upgrade and again during ordinary startup. Other startup/scheduled workers
can still begin independently. A generic all-at-boot backfill would amplify
load and could publish partial evidence.

This slice limits itself to registered post-upgrade tasks. It does not change
classification authority, routing thresholds, policy learning, or the behavior
of unrelated schedulers. Existing admission, revision, and per-task locks
remain in force.

## Selected contract

- A read-only task manifest combines registered task IDs/actions with the
  migrated completion ledger. It exposes only fixed internal task metadata,
  never media, library contents, credentials, or source payloads. A missing
  ledger is an error, not an empty history.
- One PostgreSQL session advisory lock covers the entire task check and run.
  A second instance defers without reading or replaying tasks. The existing
  database lock wrapper fails if its held connection becomes unhealthy. The
  process needs at least two pooled connections; a one-connection pool fails
  explicitly instead of hanging behind its own held lock.
- Historical automatic `clear_logs` replay is skipped. Its IDs may be recorded
  as skipped, but current logs and error reports are never deleted merely
  because an old ledger entry is absent. The existing scheduled retention and
  manual Logs cleanup remain available; this does not retire log cleanup.
  The current scheduled error-log job deletes rows older than
  `error_log_retention_days` regardless of resolution state; the operator chose
  to keep that stale-item rule. It runs independently of upgrade replay.
- A zero-user database is fresh only if it also has no libraries, inventory,
  or classification history. Failure to establish that state aborts the task
  check rather than assuming an empty installation.
- Run registered tasks in order. If one fails, leave it and later tasks
  pending for another startup. A partial library-profile refresh is a failure.
  If one successful refresh already satisfies both registered profile tasks,
  mark the second as satisfied without rebuilding again.
- Pass a profile-refresh-attempted result from preflight to service startup so
  the ordinary startup pass does not immediately repeat an attempted upgrade
  refresh. When there is no upgrade refresh, ordinary startup keeps its
  previous behavior.
- Preserve service availability after a post-upgrade failure, but expose that
  failure explicitly in logs and keep work pending. No partial new evidence
  becomes a route grant through this change.

## Alternatives and trade-offs

| Approach | Advantage | Cost/risk | Decision |
| --- | --- | --- | --- |
| Session lock plus existing ledger | Small, cross-process safety step; restart resumes pending tasks | Holds one DB connection during work; ledger is task-level, not per-library | Implement |
| Run all backfills on each boot | Simple code path | Duplicated load, old destructive replays, weak dependency ordering | Reject |
| New external workflow engine now | Rich durable jobs and visual state | Another production service, migration, and operational failure mode | Defer |
| Disable all startup workers until all backfills finish | Strong-looking global gate | Could block normal service for hours or indefinitely on offline providers | Reject |

Recommended stack now: PostgreSQL task ledger and session advisory lock,
ES Module task-plan projection, existing local worker safeguards, and an
internal read-only manifest CLI. The later full coordinator should add a
per-library durable cursor, explicit source/config revision checks, bounded
resource classes, retry budget, pause/resume, and verified publication gates.
That later step requires disposable upgrade and failure-injection evidence
before changing scheduler order or automatic-routing behavior.

## Official guidance checked September 2026

- [PostgreSQL 18 advisory-lock functions](https://www.postgresql.org/docs/18/functions-admin.html)
  document immediate, session-scoped try-locks and unlocks. The lock is
  coordination, while the ledger remains the durable completion record.
- [Amazon Builders' Library: safe retries](https://aws.amazon.com/builders-library/making-retries-safe-with-idempotent-APIs/)
  explains why retries need a durable idempotency identity and why recording
  completion separately from effects requires care. The existing task IDs
  provide only coarse idempotency; per-library effects still need future work.
- [Google SRE: handling overload](https://sre.google/sre-book/handling-overload/)
  motivates retaining a serving lane and bounding recovery load instead of
  forcing every historical job to complete before traffic can proceed.
- [W3C status-message guidance](https://www.w3.org/WAI/WCAG21/Understanding/status-messages)
  informs a later Command Center status view. No UI is added here; a future
  progress message must be programmatically announced without stealing focus.

## External PR boundary

GitHub's repository open-PR collection and PR search both returned empty on
2026-09-23. There is no random open PR to implement locally; no closed PR is
substituted and no PR is merged.
