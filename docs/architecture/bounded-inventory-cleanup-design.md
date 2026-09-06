# Bounded inventory cleanup design

## Decision

Prototype the [writer compatibility follow-up](inventory-writer-compatibility-outcome.md)
inside the disposable sync schema. Production full-sync pruning currently deletes
all unseen items in one statement. Library removal relies on parent cascades and
also handles queues, classification history, policies and other dependents. This
prototype establishes inventory completion semantics before adapting that wider graph.

Use durable cleanup jobs, an incrementally collected seen-ID manifest, bounded
source mutations and database admission checks. Keep production routes, sync SQL,
schema migrations and automatic classification behavior unchanged. All new runtime
modules use ESM and existing PostgreSQL/test-container dependencies.

## Lifecycle and completion

Pruning starts in `collecting`. Append at most 128 validated external IDs per call;
duplicate IDs are idempotent. Only a complete traversal can seal the manifest, with
an explicit expected unique count. Partial or failed traversal cannot start deletion.
An empty, explicitly complete manifest means an empty library, as in existing sync.

Sealing closes admission to the target library and records a source high-water ID.
Parent removal closes admission immediately. Each step visits and deletes at most
128 source rows, comparing the discovered ID, membership and `xmin` after ordered
library locks. Moves and already-absent rows are counted separately from deletions.
A changed revision is retained for another pass. No skipped or partial batch is
reported as completed. Final absence checks run while admission remains closed.

Library deletion happens only after its inventory is empty. Server deletion drains
inventory, then removes empty libraries one per step, then removes the empty server.
No final parent delete may cascade through remaining inventory. Row mutations and
job counters/cursor commit together. A new connection can resume the persisted job;
replaying a completed step returns its recorded result without deleting again.

Jobs on the same server are serialized, including collecting jobs, to avoid nested
library/server cleanup ownership. Other servers can clean independently. Unaffected
libraries can still accept sync writes. Collecting jobs may be cancelled; once
deletion starts, recovery resumes forward instead of claiming whole-job rollback.
Every individual failed transaction remains atomic.

## Admission and locking

The source-table lock precedes the cleanup coordinator lock, job row lock and
ordered library locks. Parent guards verify the coordinator/library locks as well
as empty descendants, so even an empty parent requires the cleanup protocol. Source
insert/update triggers lock the destination server and library admission rows with
`FOR SHARE NOWAIT`, then reject missing, mismatched or draining parents. The shared
row locks last until commit, so fencing cannot overtake an admitted write. Fencing
uses `FOR UPDATE NOWAIT`; contention rolls back for a later retry. Nonblocking gate
locks avoid waiting in reverse order behind a sync transaction's library locks.

Moves out of a draining library into an active library remain possible and must not
be counted as deletes. Moves into a draining scope and updates remaining there fail.
Source IDs and external/server identity are immutable in this lab. Server admission
also fences new libraries; parent ownership cannot change during cleanup.

These triggers are correctness guards for the tested writer family. A database
owner can change definitions or bypass the job protocol. Least-privilege runtime
roles and complete writer coverage remain production requirements. The installer
accepts only the existing allowlisted disposable database names. SQL identifiers
come from fixed internal variants, values are parameterized, and payloads, row
budgets and transaction timeouts are bounded. No provider calls or operator queue
are introduced.

## Research and alternatives

Official sources were discovered through web search and read on 6 September 2026.
They document established guidance applicable to the August 2026 baseline; living
pages are not presented as archived August snapshots.

- [PostgreSQL DELETE](https://www.postgresql.org/docs/18/sql-delete.html) describes
  bounded selection followed by deletion. This design uses stable IDs plus `xmin`
  rather than persisting physical tuple locations between transactions.
- [PostgreSQL SELECT](https://www.postgresql.org/docs/18/sql-select.html) warns that
  `SKIP LOCKED` provides an inconsistent view. Empty skipped batches therefore
  cannot prove cleanup completion; this prototype uses no skipped-row shortcut.
- [Explicit locking](https://www.postgresql.org/docs/18/explicit-locking.html)
  supports consistent acquisition order, transaction-scoped locks and short
  transactions. Shared admission-row locks and nonblocking exclusive transitions
  make the before/after boundary observable in real PostgreSQL tests.
- [Foreign-key constraints](https://www.postgresql.org/docs/18/ddl-constraints.html)
  explain deletion actions and the need to consider indexes on referencing columns.
  The lab indexes source and library membership for bounded candidate selection.
  [Trigger behavior](https://www.postgresql.org/docs/18/sql-createtrigger.html)
  confirms that referential actions also fire triggers; source-row counts alone
  cannot bound the downstream work of production cascades.
- [W3C DQV](https://www.w3.org/TR/vocab-dqv/) motivates attributable measurements
  with explicit scope and completeness limitations. It is a Working Group Note;
  no UI, RDF requirement or accessibility-conformance claim follows from this work.

| Choice | Pros | Cons | Recommendation |
| --- | --- | --- | --- |
| One large transaction | Atomic whole operation | Unbounded row work and lock duration | Preserve production until replacement is proven |
| Chunk deletes without admission | Simple and smaller statements | Late inserts invalidate completion | Reject |
| Durable fenced cleanup | Bounded mutations, resumable progress, exact completion boundary | Target writes pause; partial progress is durable | Test in isolation |
| Generation-aware concurrent ingestion | Allows more target writes during pruning | Requires every producer to carry generation provenance | Consider after writer coverage |
| One cleanup per server | Prevents overlapping scope ownership | Collecting jobs delay other cleanup on that server | Accept for this prototype |

Recommended stack: complete traversal evidence → durable manifest/job → database
admission boundary → bounded revision-checked work → exact completion → broader
dependent-table and privilege validation → production adoption assessment.

The row budget limits visited candidates and deleted source/parent rows per step,
not index entries examined, invalidation-cache writes, total manifest storage or
wall-clock execution. Existing transaction timeouts bound waits/statements; sustained
large-scale latency, manifest/history retention and abandoned-collection recovery
need separate evidence before adoption. The complete-traversal signal is an internal
caller contract, not independent proof that a remote server supplied every item.

The separate [outcome](bounded-inventory-cleanup-outcome.md) records measurements,
limitations and the next implementation item.
