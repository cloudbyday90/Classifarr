# Bounded library page repair prototype design

## Decision

Implement the next [recovery benchmark recommendation](library-scan-recovery-benchmark-outcome.md)
as an isolated ESM prototype. Keep production sampling unchanged while proving
bounded change capture, repair and coherent publication. Reuse the disposable
PostgreSQL benchmark runtime; add no operator workflow or application endpoint.

## Page and journal contract

Partition positive integer item IDs into fixed ranges of 20,000. Each range
contains at most 20,000 source rows because item IDs are unique. Sparse ranges
are skipped with indexed next-ID lookups. A forward visit performs at most two
one-ID seeks: its first ID belongs to the metadata range; the second establishes
whether another range remains. Keep at most 128 cached range
summaries and 32 library cursors globally in the prototype.

Statement triggers record distinct affected library/range pairs, including both
sides of deletion, identity changes and library reassignment. A transactional
head row serializes journal publication; do not use sequence allocation as commit
ordering. A 256-slot global ring bounds retained events. Bulk invalidation above
256 ranges advances the generation and clears the ring. Missing sequence
continuity, overwritten events, tracked generation invalidation, age limits or capacity
exhaustion require a full restart with complete counts withheld.

Changed cached ranges become dirty. Changes in earlier uncached ranges create
dirty placeholders so inserts behind the build cursor cannot disappear. New
forward ranges remain discoverable by the indexed cursor. Build the remaining
ranges, then repair the oldest dirty range; retain its original dirty sequence
until repair so a repeatedly changing low-ID range cannot monopolize repairs.
One selected library reads at most one metadata range per visit.

These are logical row limits, not a hard bound on physical relation bytes. MVCC,
indexes, WAL and vacuum behavior require a separate sustained storage assessment.
The prototype refuses a 33rd cursor or a 129th page rather than evicting another
library. Idle-library eviction and restart lifecycle remain production design work.
Sparse or interleaved global IDs can consume the page cap with relatively few
items; real range occupancy must be assessed before choosing production storage.

## Coherent coverage and time

A visit uses a short read-committed transaction and locks the journal head before
reading journal events or source rows. Every tracked writer must update that same
head before commit. Source reads remain unlocked and see the committed version;
writers cannot publish another tracked version until the visit ends. Library
cursor updates and page summaries commit atomically with the visit.

The prototype's global lock is a correctness mechanism with a known contention
cost. It is not approved for production. Statement, lock and idle-transaction
timeouts bound database waits; no transaction remains open between scheduled turns.

Each page stores seven coverage counters, a private population digest and its
next time-dependent expiry. Re-evaluate a page when observation timestamps cease
to be future timestamps or a fetched observation reaches its freshness boundary.
Clock regression discards cached state. Unchanged rows can otherwise become stale
without any journal event, so a journal alone cannot establish current freshness.

Publish complete counts only if no source ranges remain unbuilt, no pages are
dirty and no cached page has expired at the returned evaluation time. The journal head
identifies the coherent committed source version; a separate evaluation timestamp
identifies freshness. This prototype does not claim compatibility with v3's
rolling population fingerprint or its scan-start freshness contract.

## Isolation and security

Permanent prototype objects can be created only in the disposable benchmark or
integration database, in a dedicated new schema. A temporary mode uses only
session-local objects for private Compose assessment. Scope names are allowlisted,
data is parameterized, and existing schemas are never overwritten by installation.
Only aggregate results leave the CLI; IDs, metadata, digests and credentials stay
private. The existing CLI's no-argument connection boundary and cleanup are reused.

Prototype tables/triggers are not application migrations. Production source
writers, sampler contracts, readiness gates and classification routing stay unchanged.
The prototype tracks insert, update, delete and truncate; privileged DDL or
disabled triggers are outside its contract. Production configuration invalidation
must be designed before integration.
Trigger work is proportional to affected transition rows even though journal writes
are capped; that ingestion cost needs measurement before production integration.

## Official research and August 2026 scope

URLs were discovered through search and read on 6 September 2026. These established
PostgreSQL 18 and W3C sources apply to the August baseline; living pages are not
represented as archived August snapshots.

- [PostgreSQL statement triggers](https://www.postgresql.org/docs/18/sql-createtrigger.html)
  describes transition relations for observing sets of changed rows.
- [PostgreSQL explicit locking](https://www.postgresql.org/docs/18/explicit-locking.html)
  describes row-lock lifetime and conflict behavior. Use a transactional head
  and test actual concurrent sessions, rollback and lock timeouts.
- [PostgreSQL transaction isolation](https://www.postgresql.org/docs/18/transaction-iso.html)
  notes that sequences do not roll back with their allocating transaction.
  Sequence numbers alone cannot prove committed journal continuity.
- [W3C Data Quality Vocabulary](https://www.w3.org/TR/vocab-dqv/) describes quality
  measurements and their provenance. It is a Working Group Note, not a mandate
  to adopt RDF. Expose measurement time/version and distinguish prototype evidence
  from production readiness.

## Alternatives and recommendation stack

| Approach | Pros | Cons |
| --- | --- | --- |
| Whole-library restart | Existing simple correctness boundary | Repeats unaffected work under churn |
| Bounded page repair | Reuses unaffected summaries within the existing row budget | More state, expiry rules and journal continuity |
| Global transactional head | Straightforward commit ordering and publication proof | Serializes writers and visits across libraries |
| Sequence-only journal watermark | Cheap allocation | Can miss late commits or confuse rollback gaps |

Recommended evaluation stack: synchronized inventory → transactional changes →
bounded page summaries → expiry-aware repair → coherent aggregate publication →
existing diagnostics → independently evaluated review-only semantic evidence.
