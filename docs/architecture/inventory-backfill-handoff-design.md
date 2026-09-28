# Durable inventory-to-backfill handoff

Date: 2026-09-28. Scope: the gap between a completed library scan and metadata
queue creation. This change does not enable routing, invoke models, or release
or deploy the application.

## Root cause and contract

Ingestion completion is durable, but queue refill starts later. Background
readiness previously treated an empty queue as sufficient after ingestion. A
restart in that interval could therefore admit evaluation before backfill was
even considered. An in-memory refresh hint cannot close that gap.

Use the existing ingestion run UUID as a generation fence. Completion of an
owned scan already commits atomically with pruning and capture completion.
An unacknowledged completed run now represents durable backfill demand. New
nullable checkpoint columns also make legacy completed runs require a pass.

The relay processes up to twenty 250-item library pages per refill invocation,
retaining the existing 5,000-item scan budget and five-minute cadence. It locks
the ingestion row, reuses existing candidate eligibility and payload shaping,
and commits queue inserts and page progress in one database transaction. A
failed transaction publishes neither. A new run invalidates the old checkpoint;
no elapsed-time guess or owner takeover is involved. Libraries rotate by their
last page timestamp so a large library does not starve smaller ones.
The existing `(library_id, id)` index supports library-scoped keyset paging;
this does not add a redundant inventory index.

Readiness remains `backfilling` until the current run has a completed enqueue
pass, then retains the existing pending/due and processing queue checks. This
is readiness to attempt evaluation, not proof of metadata completeness or
placement accuracy. Optional-provider cooldowns, missing configuration,
quarantined identity conflicts and unsupported music retain existing eligibility
rules; unavailable optional enrichment must not become an infinite barrier.

## Safety and recovery

- No network calls, AI, routing, or new broker inside the relay transaction.
- Only active movie/TV libraries on active sources are admitted. Unfinished or
  owned ingestion is deferred. Disabled libraries retain their checkpoint.
- Row locks serialize relays for a library and fence concurrent scan claims.
  Statement and lock timeouts bound database waits; failures leave demand pending.
- The ordinary refill pass excludes unacknowledged owned libraries, preventing
  it from bypassing the durable relay. Manual and scheduled queue-facade calls
  share a session lock distinct from the outer scheduler lock. This also protects
  against an already-started ordinary pass racing a newer generation on another
  application instance. Existing pending/processing metadata jobs are reused
  rather than replaced. Arbitrary direct task producers are not certified.
- Persist identifiers, cursor and timestamps, not credentials or raw provider
  responses. Queue payloads retain the existing metadata contract.
- No permanent success assertion: completed handoff means the current inventory
  was checked and eligible jobs were durably queued, not that every job succeeded.

## Options and recommendation stack

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Poll the whole inventory in every readiness check | Simple definition | Repeated expensive scans; no durable progress | Reject |
| Add a broker/workflow engine | Broader orchestration features | New operational system and dual-write boundary | Defer |
| Generation-fenced PostgreSQL handoff | Atomic local writes; bounded restart recovery | Adds schema and relay tests | Implement |

Recommended stack: owned ingestion → durable run-scoped handoff → existing
metadata queue and retry policies → revisioned profiles → readiness-gated
evaluation. Next, extend the existing runtime-installation acceptance harness to
exercise the full startup scheduler in a packaged-image fresh-install/upgrade
drill, then present each stage's backlog age and blocker
so operators can distinguish normal waiting from stalled progress.

## Official research

Sources discovered using connected GitHub and web tools, checked September 2026:

- [AWS transactional outbox guidance](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/transactional-outbox.html)
  motivates committing work intent with business state and accounting for replay.
  Here the database is both the intent store and queue, avoiding a broker dual write.
- [PostgreSQL 18 SELECT](https://www.postgresql.org/docs/18/sql-select.html)
  documents `FOR UPDATE` and `SKIP LOCKED` for queue-like consumers. Skipping a
  locked row must not be interpreted as completed work.
- [PostgreSQL 18 INSERT](https://www.postgresql.org/docs/18/sql-insert.html)
  documents parameterized insertion and conflict behavior. The relay holds the
  generation row throughout queue creation and checkpoint advancement.
- [W3C status messages](https://www.w3.org/WAI/WCAG21/Understanding/status-messages)
  motivates programmatically exposed, non-focus-stealing status updates. This
  backend increment reuses the existing `backfilling` state; a future visual
  progress component should provide text equivalents and polite announcements.
- [Docker Compose startup order](https://docs.docker.com/compose/how-tos/startup-order/)
  distinguishes running containers from readiness and supports health-conditioned
  dependencies. Design inference: the next packaged-image drill must additionally
  assert application-level handoff progress; a passing health check is insufficient.

Implementation and validation results are recorded in a separate outcome document.
