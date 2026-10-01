# Criteria-based image-index reconciliation

## Decision and scope

Add a small admission service to the existing bounded image-index worker. We do
not need another daemon, deployment variable, Compose service or privileged API.
Saved standard, Unraid and forced-user templates keep their existing behavior.
This is an unreleased source change; it does not update a running installation.

I inspected the catalogue validator, executor, queue claims and inventory readiness
at `216930542367cedff44a6cad4f9aefd8df28ec3b`. The executor existed, but no production
producer scheduled its repair jobs. RAG health also considered an index name
sufficient evidence of availability. We can address both locally, retaining the
existing security boundary rather than introducing another authority owner.

## Admission and lifecycle

- An initial check is scheduled ten minutes after startup; periodic checks run
  at minutes 12, 27, 42 and 57 (and may run before the initial check).
  Initial and periodic calls coalesce in-process; database locking coordinates
  different application processes and the executor.
- One short transaction acquires shared runtime/restore admission, checks the
  restore gate, then tries the existing exclusive index-maintenance key. It has
  a three-second statement timeout, one-second lock timeout, eight-second
  transaction timeout and ten-second checked-out-session deadline.
- RAG must be enabled, image weight positive and finite, and the image provider
  mode enabled and configured. Only configuration-presence booleans are read;
  credentials and endpoint strings do not leave that SQL query. No provider
  connection, model call or paid token request is made.
- The existing exact catalogue validator checks all three code-owned indexes.
  Unexpected same-name objects or definitions require review; they are never
  silently replaced. Healthy installations do not run readiness scans or DDL.
- Any pending/processing index job prevents another enqueue. A missing or invalid
  expected index requires the shared movie/TV ingestion/backfill readiness check.
  Empty, inactive and busy installations wait. Music remains unsupported.
- A fixed low-priority queue job and its singleton episode record commit together.
  The record deliberately has no queue foreign key. Queue retention, failure,
  deletion, restart or changed missing-index combinations cannot reopen a budget.
- Before an automatic attempt, the executor reads current configuration and
  readiness again, excluding only its own queue ID. It reserves a started attempt
  durably before DDL: at most three per unresolved episode, one hour apart.
  Busy/disabled/cooling-down work returns to the queue for a fifteen-minute wait
  without consuming an attempt. A lost episode or exhausted budget fails the job
  for review. Queue failure limits remain an additional, independent bound.
- Only a later successful catalogue observation, with no active index job, clears
  the episode. Its cooldown remains. A pruned job with unhealthy indexes stays
  review-required; there is no timer-based budget reset.

The producer never executes DDL. The worker still checks its claim before each
fixed concurrent statement and final acknowledgement, validates the catalogue
after building, and retains the 120-second total budget, 64 MB maintenance memory
setting and zero parallel maintenance workers. These are not total RSS/CPU limits.
Concurrent ingestion starting after admission remains possible; readiness is not
a global ingestion lock. Concurrent DDL and timeouts limit interference, but we
do not promise a fully idle system throughout a build.

## Components and compatibility

`imageIndexReadiness.mjs` owns demand checks; `imageIndexReconciliation.mjs` owns
transactional enqueue; `imageIndexAutomaticAdmission.mjs` owns worker admission;
`imageIndexReconciliationScheduler.mjs` owns cadence and transition logs.
All are ES modules. The shared readiness SQL adds a fixed, parameterized variant
for excluding one claimed task; existing callers keep their unchanged contract.

Migration `20261001_160000_image_index_reconciliation.sql` adds the bounded singleton
ledger. The fresh-install snapshot contains its structure, not operational state.
The producer initializes it only when work is admitted. No library, inventory,
routing or provider settings are changed. Existing manual jobs retain their
operator-driven admission and original queue limits.

RAG health preserves its public response shape but now checks the expected table
and PostgreSQL valid/ready/live flags. This health check is read-only and does not
claim exact definition validation; the repair path performs that stronger check.

## Options, pros and cons

| Approach | Benefit | Cost or limitation |
| --- | --- | --- |
| Manual-only repair | No automatic DDL; explicit operator approval | Recoverable damage remains until intervention |
| Existing worker plus durable admission — selected | Self-healing, bounded retries, unchanged templates | One small ledger, periodic checks, explicit review after exhaustion |
| New privileged service | Could isolate authority with a redesigned deployment | More operations and migration work; does not itself solve retry correctness |

The security review favored completing the existing boundary. We retain shared
application/database authority: the ledger is restart-safe, not tamper-proof
against a compromised database administrator. Full privilege separation remains
separate work and is not claimed here.

## Research baseline and accessibility

Official sources were discovered through web search and followed links on
1 October 2026 for the September 2026 PostgreSQL 18 baseline. These are live
documents, not archived September snapshots.

- PostgreSQL explains that concurrent builds can leave invalid indexes and that
  name existence does not establish a matching definition. We reuse exact
  validation and concurrent recovery rather than `IF NOT EXISTS` as a health
  check. [CREATE INDEX](https://www.postgresql.org/docs/18/sql-createindex.html)
- PostgreSQL distinguishes validity, insert readiness and live state. We use all
  three in health reporting. [pg_index](https://www.postgresql.org/docs/18/catalog-pg-index.html)
- Transaction locks release at transaction end and coordinate with session
  advisory locks; the producer uses the executor's existing lock order.
  [Explicit locking](https://www.postgresql.org/docs/18/explicit-locking.html)
- W3C describes polite, programmatically identifiable status messages. This change
  adds no UI or live region: logs carry text outcomes and next steps, with repeated
  scheduler states suppressed within a process. A future progress UI should use
  text alongside visuals and appropriate status semantics, not color alone.
  [W3C ARIA22](https://www.w3.org/WAI/WCAG21/Techniques/aria/ARIA22)

## Rollout and rollback

Run migration, fresh-schema, queue, catalogue and real concurrent-build tests
before a later image release. No tag, version bump, release or live-container
restart accompanies this commit. Rolling back the scheduler stops new production
admission; keep the ledger and existing queue rows intact. Older worker images
do not enforce the new automatic episode budget, so drain or explicitly review
pending automatic jobs before rolling back worker code.

## Recommendation stack and next component

Keep fixed SQL/claims/restore guards first, add durable criteria-based admission
second, and make evidence visible third. The next component should be a read-only
index-repair progress view: show waiting, running, verified or review-required
with the real reason, attempt count and next eligible time. Pair that work with a
representative large-table timing study before considering a larger build budget.
Do not infer a completion percentage from elapsed time or automatically reset
exhausted attempts.
