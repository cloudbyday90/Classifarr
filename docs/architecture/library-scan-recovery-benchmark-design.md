# Library scan recovery benchmark design

## Decision and scope

The next step after [scan diagnostics](library-scan-diagnostics-outcome.md) is a
reproducible recovery comparison. Implement an offline ESM benchmark with a pure
scheduling model and isolated PostgreSQL measurements. Production promotion is
conditional on consistent measurements, bounded work and fair library turns.
No candidate may silently relax the existing 20,000-row visit contract.

Compare the current single-page scan, a capped two-page visit and a frozen
projection capped at 40,000 rows. Use stable, periodic and continuous enrichment
timelines; include populations exactly at and above both caps. Report incomplete
scans and refused projections as unknown, never as successful zero coverage.

## Measurement separation

The deterministic model reports scheduled completion time, restarts, maximum
inventory rows read per turn, retained projection rows and other-library visit
gaps. It models changes before visits, not an actual provider workload. It does
not manufacture wall-clock timings, memory bytes or production churn rates.

PostgreSQL probes measure actual bounded capture/reduction elapsed time, serialized
transfer bytes and temporary-relation storage. The same compact projection is
used for both candidates. Extra pages reduce immediately; frozen rows survive
controlled source updates and are reduced in later pages. A 40,001st ID is a
lookahead sentinel; an oversized snapshot publishes no complete result.

The probes reuse the production row-validity predicate. Their compact query is
a prototype, not the complete production query: queue joins, population hashes,
cursor claims, persistence and durable recovery are excluded. Serialized transfer
bytes are not process memory. Timed totals exclude fixture creation and controlled
source-mutation time; those mutations test consistency, not recovery cost.

Use multiple repetitions and expose individual timings plus min/median/max.
Latency is descriptive on the local machine, not a portable performance promise.
Separately test actual concurrent sessions: a short repeatable-read transaction
must remain consistent across pages, while read committed can observe intervening
changes. Do not hold a database transaction between scheduled five-minute visits.

## Isolation and security

The CLI creates a disposable PostgreSQL container using existing test tooling.
It uses the official `postgres:18.6-alpine` image and records the runtime version.
It accepts no database URL, source credentials, user SQL, image or filesystem
output path. Fixed fixtures and bounded parameters prevent accidental production
benchmarking. It emits aggregate JSON only; random disposable credentials are not
printed. Connections and the container are closed even on failure.

The database probes use fixed temporary table names and parameterized row counts.
They assert required temporary relations exist before mutation, explicitly qualify
temporary-table writes and roll back each probe. The CLI adds statement and idle
transaction timeouts. No provider, classification, readiness or routing behavior
changes. A separate Compose assessment can reuse real identities privately inside
temporary tables, with aggregate-only results and verified rollback.

## Official sources and August 2026 scope

URLs were discovered with search and read on 6 September 2026. The established
PostgreSQL 18 and W3C guidance applies to the requested August baseline; these
living pages are not claimed to be archived August snapshots.

- [PostgreSQL transaction modes](https://www.postgresql.org/docs/18/sql-set-transaction.html)
  distinguishes statement snapshots from transaction snapshots. Short repeatable
  reads can preserve page consistency; they do not create durable cross-session state.
- [PostgreSQL cursors](https://www.postgresql.org/docs/18/sql-declare.html) explains
  that held cursors materialize rows in memory or temporary storage and remain
  session-bound. A held cursor is not free durable recovery storage.
- [PostgreSQL connection defaults](https://www.postgresql.org/docs/18/runtime-config-client.html)
  documents statement/transaction timeouts and the vacuum cost of idle transactions.
  Use local bounds without changing server-wide settings.
- [W3C Data on the Web Best Practices](https://www.w3.org/TR/dwbp/) supports quality,
  provenance and version information. Separate measured database costs, modeled
  scheduling behavior and operational evidence in a versioned aggregate report.
- [Official PostgreSQL image tags](https://hub.docker.com/_/postgres/tags?page=3)
  identifies the published `18.6-alpine` tag. Image tags can be rebuilt; the report
  records its reference and actual database version, not a claim of immutable binaries.

No UI or accessibility contract changes are needed for this offline benchmark.
Existing diagnostic status messages and native disclosures remain in place.

## Alternatives and recommendation stack

| Candidate | Benefit | Cost or limitation to measure |
| --- | --- | --- |
| Existing one-page visits | Existing work bound and no new storage | Repeated changes may prevent completion |
| Capped two-page visits | Can finish medium libraries within one snapshot | More work per turn; larger libraries still span changes |
| Bounded frozen projection | Later source changes do not invalidate captured evidence | Up-front capture, storage, retention and capacity limits |
| Long-lived transaction or held cursor | Convenient consistent database view | Connection affinity, temporary storage and vacuum/lifecycle costs |

Keep synchronized inventory → profiles → fair measurements → diagnostics as the
production stack. Select recovery from measured acceptance gates, then retain
independent evaluation before introducing review-only semantic evidence.
