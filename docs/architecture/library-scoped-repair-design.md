# Per-library page boundaries and transaction ordering design

## Decision

Implement the next [lifecycle recommendation](library-repair-lifecycle-outcome.md)
as a separate ESM prototype. Preserve production sampling and the earlier
benchmark. Use row-count-based pages so a sparse library with at most 20,000
items completes in one visit. Replace the prototype's global publication head
with ordered per-library transaction locks and synchronous cache invalidation.

## Page and capacity contract

Each visit reads at most 20,001 ordered IDs and 20,000 bounded observation records.
A new page covers `(previous boundary, twentieth-thousandth ID]`; the final page
extends to the maximum integer ID. Small libraries therefore need one page even
when their IDs are sparse. A growing cached range is split after 20,000 rows;
its remaining range becomes dirty and is repaired on a later visit.

Preallocate 32 registry slots and 128 summary slots globally. Allocate only free
slots using `FOR UPDATE SKIP LOCKED`; never skip source rows or dirty summaries
to manufacture complete coverage. Busy or exhausted capacity withholds counts
and retries later. Slot counts bound live logical state, not physical disk bytes.

Reclaim other libraries after seven idle days only when their library lock can
be acquired without waiting. Keep selected-library age and clock restart reasons.
Empty summaries can be released; an insert into a previously covered gap forces
a conservative rebuild. Preserve freshness expiry, oldest-dirty selection and
rollback behavior. No transaction spans scheduled visits.

## Source writes and coherent publication

Use this order for every supported write transaction: compatible source-table
lock → distinct old/new library locks in ascending numeric order → source rows
in ascending item-ID order. The bounded mutation service accepts full replacement,
insert and delete operations with expected membership. A membership mismatch
rolls back the entire batch; callers must refresh evidence before retrying.

A statement trigger rejects writes unless this backend already holds locks for
all actual old/new libraries. It never acquires a missing library lock after
source-row writes. Truncate's exclusive table lock is a barrier against all
compliant readers/writers and invalidates all watched libraries atomically.

Within the same source transaction, increment each affected watched library's
revision and mark intersecting cached ranges dirty. A separate applied-invalidation
revision confirms that the cache received the source revision. Missing application,
changes in reclaimed gaps, oversized transition sets and truncate require a
restart. An earlier mismatch stays sticky through subsequent writes.

This design coalesces invalidation directly into at most 128 summaries rather
than retaining a change journal. There is no journal to overflow; a bounded
transition-set overflow invalidates the affected library's whole cache. The
contract and epoch are separate from v3 and the previous journal prototype.

A reader holds its library lock throughout source measurement and publication.
Other libraries' writers can commit concurrently. Moves lock both sides before
any row changes. Revision, dirty markers, page splits and source writes commit
or roll back together. A fresh cache epoch distinguishes registry reuse/rebuilds.

## Isolation and security

Create objects only in a new allowlisted disposable schema or session-local
temporary tables. Reuse the existing no-argument disposable PostgreSQL runtime.
The mutation gateway validates identifiers, operation count, timestamps and
payload size before starting work; SQL values are parameterized. No application
route, migration, provider, classification or readiness integration is added.

The trigger is a correctness guard, not a security boundary against a privileged
database owner who disables triggers or alters cache state. Production promotion
requires auditing every writer and enforcing the gateway through deployment
privileges. Advisory-lock use is a new contract and cannot silently replace the
existing production writes.

## Official research and August 2026 scope

Search discovered these official sources, read on 6 September 2026. Established
PostgreSQL 18 and W3C guidance informs the August baseline; living pages are not
represented as archived August snapshots.

- [PostgreSQL explicit locking](https://www.postgresql.org/docs/current/explicit-locking.html):
  consistent lock order and transaction-scoped advisory locks support the declared
  write protocol. They do not make arbitrary external writes deadlock-free.
- [PostgreSQL SELECT](https://www.postgresql.org/docs/current/sql-select.html):
  deterministic ordering is required for bounded pages; skipped locked rows give
  an incomplete view. Restrict skipping to free capacity slots.
- [PostgreSQL statement triggers](https://www.postgresql.org/docs/18/sql-createtrigger.html):
  transition relations expose old/new rows for transactional invalidation.
- [PostgreSQL lock inspection](https://www.postgresql.org/docs/current/view-pg-locks.html):
  the guard checks this backend's granted exclusive two-integer advisory keys;
  concurrency probes observe dependencies with `pg_blocking_pids()`.
- [W3C Data Quality Vocabulary](https://www.w3.org/TR/vocab-dqv/):
  report measurement scope, provenance and completeness. This Working Group Note
  informs the evidence contract without requiring RDF or claiming UI conformance.

## Alternatives and recommendation stack

| Option | Pros | Cons |
| --- | --- | --- |
| Fixed global-ID ranges | Simple change-to-range mapping | Sparse populations waste visits and slots |
| Per-library row-count boundaries | Preserves small-library completion and dense page budgets | Growth needs splitting; reclaimed gaps require conservative rebuilds |
| Global head and retained journal | Simple global ordering and gap detection | Unrelated writers block each other |
| Ordered library locks and synchronous invalidation | Localizes contention; bounded coalesced cache state | Requires every writer to follow the predeclared-lock contract |

Recommended evaluation stack: synchronized inventory → bounded per-library pages
→ declared transactional writes → automatic invalidation and reclamation → coherent
coverage and diagnostics → independently evaluated review-only semantic evidence.

See the separate [measured outcome](library-scoped-repair-outcome.md) for the real
occupancy replay, concurrency evidence, limitations and next implementation gate.
