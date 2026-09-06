# Library repair occupancy, contention and lifecycle design

## Decision and scope

Continue the [page-repair evaluation](library-page-repair-outcome.md) with measured
range occupancy, actual concurrent sessions and bounded cache lifecycle fixes.
Keep this work in the isolated ESM prototype. Production observation collection,
classification, readiness and operator workflows remain unchanged.

## Concrete fixes

The existing reader locks the journal head before acquiring a source-table lock.
A concurrent truncate can hold the source table exclusively while waiting for
that head, forming a cycle. Acquire an access-share source-table lock before the
head, consistent with source writers' table-before-head order. Ordinary row
updates remain compatible with the reader's table lock. Verify real blocking and
transaction recovery rather than relying on timing alone.

The existing global cache never reclaims a library that stops receiving visits.
Before admitting a cursor, remove other cursors whose last visit is more than
seven days old, including their cached summaries. Hold the existing publication
lock throughout reclamation and admission, so concurrent visits cannot evict a
cursor being used. Preserve the selected library's explicit age/clock restart
reason and do not evict a recently visited library merely to make room.

After measuring an empty range, remove its summary. The build cursor still proves
that the range was visited; any later insert behind it creates a dirty placeholder
from the journal. Test reinsertion and missing continuity so reclaimed storage
cannot hide new inventory. These changes add no collection or cleanup step for
operators.

## Occupancy measurement

Read only item IDs and active-library IDs in one read-only repeatable-read
transaction. Evaluate at most 32 libraries and 200,000 item IDs, with one sentinel
library and one sentinel item to distinguish complete evidence from truncation.
Use indexed, parameterized library/ID reads; never read metadata or provider
credentials. Summarize occupied ranges, utilization and capacity fit. If a limit
prevents a complete assessment, report unknown fit unless the observed lower
bound already exceeds capacity. Reports omit source IDs and library names.

The live Compose assessment uses this read-only path. All source mutation,
connection-termination, contention and vacuum experiments use the existing
disposable PostgreSQL container and a newly created allowlisted prototype schema.

## Concurrency and storage evidence

Measure writer waits with the head held by a reader, including writes to another
library. Record actual blocking through PostgreSQL lock inspection. Compare
single and bulk transition sets, preserve statement/lock timeouts and verify
rollback and reconnect after an interrupted visit.

Replay committed changes over multiple bounded journal wraps, recording live row
counts and physical relation/index bytes before and after ordinary vacuum. This
is a finite local lifecycle experiment, not proof of a long-term disk ceiling.
Do not use vacuum full or apply maintenance to the running application.

Per-library ordering remains a candidate design: sort all old/new library locks
before publication, account for source-row lock order and membership races, and
preserve global-capacity serialization. Do not substitute sequence allocation
for commit ordering or promote a partially implemented lock partitioning scheme.

## Official research and August 2026 baseline

Search discovered these official URLs; their contents were read on 6 September
2026. Established PostgreSQL 18 and W3C guidance informs the August baseline.
Living documents are not represented as archived August snapshots.

- [PostgreSQL explicit locking](https://www.postgresql.org/docs/18/explicit-locking.html):
  consistent acquisition order helps avoid deadlocks; conflicting locks can wait
  until transaction end. Test real sessions and bound waits.
- [PostgreSQL routine vacuuming](https://www.postgresql.org/docs/18/routine-vacuuming.html):
  updated/deleted versions need reclamation; ordinary vacuum makes space reusable
  and generally does not shrink files. Physical bytes and live rows are distinct.
- [W3C Data Quality Vocabulary](https://www.w3.org/TR/vocab-dqv/): state measurement
  scope, units and provenance so fitness can be judged. This Working Group Note
  informs explicit completeness and timestamps; it does not require adopting RDF.

## Alternatives and recommendation stack

| Option | Pros | Cons |
| --- | --- | --- |
| Automatic expiry and empty-range reclamation | Recovers unused capacity without operator work | Requires reinsertion and continuity proof |
| Evict recently used libraries on pressure | Admits more new work | Can repeatedly discard active progress |
| Consistent source-table/head order | Removes the reader/truncate lock cycle | Global head still blocks unrelated writers |
| Per-library publication ordering | Could reduce unrelated contention | Membership changes, row locks and global bounds complicate correctness |

Recommended evaluation stack: read-only inventory occupancy → bounded summaries
with automatic reclamation → consistent transaction ordering → measured contention
and reconnect behavior → coherent automatic coverage → retained diagnostics →
independently evaluated review-only semantic evidence.
