# Inventory-driven profile refresh design

## Problem and decision

The existing refresh scheduler runs every minute, but native-policy discovery
only considers nonempty libraries with enabled policies and active intents. It
uses profile age rather than changes to observed inputs. Synchronization,
enrichment, and identity correction can therefore leave an apparently recent
profile behind the actual inventory, and an empty library can retain old traits.

Record a compact per-library inventory revision in the same database transaction
as each relevant change. Feed dirty active libraries into the existing refresh
outbox and worker, including libraries with no policy. Keep generation and its
coverage contract unchanged. No new scheduler, provider call, API endpoint,
operator control, classification authority, or dependency is needed.

## Alternatives and recommendation stack

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Hooks in each application writer | Familiar ESM call sites | Missed writers or failures between mutation and notification can lose refresh work | Reject as the sole signal |
| Periodic full inventory hashing | Detects changes without triggers | Repeated inventory scans and delayed detection | Avoid |
| Transactional per-library revision and existing outbox | Covers all writers, survives rollback/restart, coalesces work | Small trigger cost and an additive migration | Implement |
| Regenerate synchronously for every item | Immediate results | Repeats aggregation during sync and couples latency to ingestion | Reject |

Use database change capture → per-library revision → existing scheduled planning
and outbox → idempotent generation → claim-bound revision acknowledgement.

## Change detection and lifecycle

Use statement-level INSERT, UPDATE, and DELETE triggers with transition tables,
plus TRUNCATE handling. Updates compare only fields consumed by the observation:
membership, typed identity, ratings, genres, primary studio, and the projected
provider/language fields. Share the SQL metadata projection with the observation
reader to avoid a second field contract. Sync timestamps, plots, enrichment
bookkeeping, and unrelated provider payload changes do not dirty a profile.

Advance each affected library once per statement, with stable library lock order.
Moving an item dirties both libraries. A foreign key removes revision state when
the library is deleted. Inactive libraries retain dirty state until reactivated.
Seed existing nonempty libraries and libraries with stored profiles as dirty in
the migration so deployment needs no manual initialization.

## Outbox delivery and concurrency

Add an internal `inventory_change` request with a positive bigint
`inventory_revision`. Preserve the existing learning/native request constraints;
inventory work carries no classification, candidate, or learning identifiers.
Use bound SQL and fixed server-owned source/reason identifiers.

The planner locks a bounded set of dirty active-library states with SKIP LOCKED.
Select the oldest 25 candidates, then lock them in library-ID order to match
multi-library change capture and avoid reversing the state lock order.
The existing partial unique index permits one active refresh per library. An
existing learning/native request can delay inventory work, but cannot acknowledge
its revision. The next planning pass will queue it if still dirty.

The worker must generate inventory-change requests even when the previous
profile is young. Complete the outbox claim and acknowledge only its requested
revision in one SQL statement. The worker's later observation includes at least
that committed revision; updates after planning keep a larger revision pending.
Use the greatest acknowledged revision so late claims cannot move it backwards.
A lost claim cannot acknowledge anything. Empty generation uses the existing
guarded profile deletion and is acknowledged as successful completion.
New inventory claims pause while a library is inactive; already-running work
can finish. Inactive changes are still captured for later reactivation.

Keep the existing three-attempt lease/retry behavior. After a terminal inventory
failure, permit a new automatic probe after the existing two-hour circuit probe
interval, including when no additional inventory arrives. Keep one active job
per library and retain the last failed record to preserve cooldown across
restart. This is bounded background recovery, not a new operator task.

Compact older terminal inventory requests after 30 days in bounded batches,
preserving the latest record per library and all active work. Remove orphaned
inventory requests after library deletion. Configuration backups do not export
runtime revision state; replacing libraries clears it through foreign keys.

## Official research

Sources were discovered with web tools on 2026-09-05 for the requested August
2026 baseline. These are living documents, not archived August snapshots.

- [PostgreSQL trigger behavior](https://www.postgresql.org/docs/18/trigger-definition.html)
  documents statement triggers and transition relations for affected rows.
- [PostgreSQL CREATE TRIGGER](https://www.postgresql.org/docs/current/sql-createtrigger.html)
  describes the event and transition-table restrictions used by this migration.
- [PostgreSQL SELECT](https://www.postgresql.org/docs/18/sql-select.html)
  identifies SKIP LOCKED as suitable for concurrent queue consumers, rather than
  a consistent general-purpose observation. Profile reads retain normal snapshots.
- [AWS transactional outbox guidance](https://docs.aws.amazon.com/en_en/prescriptive-guidance/latest/cloud-design-patterns/transactional-outbox.html)
  explains atomic change/notification recording and idempotent delivery. This
  design uses the existing PostgreSQL outbox; no AWS service is introduced.
- [W3C Data Quality Vocabulary](https://www.w3.org/TR/vocab-dqv/)
  describes quality measurements and provenance. The revision records which
  committed input changes have been processed; it does not certify placement
  accuracy. This Working Group Note does not require an RDF implementation.

## Verification and limits

Use isolated PostgreSQL tests for real DML, rollback, unchanged syncs, relevant
metadata changes, moves, empty/deleted/inactive libraries, concurrent planners,
claim loss, mid-generation changes, terminal recovery, and retention. Exercise
the actual shared worker and profile generator, then run appropriate regression,
schema, ESM, lint, type, and coverage checks. Measure trigger/planner behavior
with local Compose inventory in an isolated scratch database, never by updating
the running installation's media rows.

Freshness is eventual, with bounded work per scheduler tick and possible retry
delay. A raw field change that normalizes to the same trait may cause one harmless
extra refresh. This revision covers profile observation fields, not all metadata
or semantic evidence. Keyword/language provenance remains a separate next task.
