# Retry candidate selection design

September 30, 2026. Follow-up to the
[retry query benchmark](retry-query-benchmark-outcome.md). Implementation results
and remaining work belong in the separate
[outcome](retry-candidate-selection-outcome.md).

## Problem and scope

Returning 50 rows did not bound database work. The mixed deep-page benchmark
repeatedly scanned source conflicts, while effective-deadline expressions hid
ordinary due work from the existing due index. Adding an ordered index alone did
not fix this. The page is only a scheduling hint; it must never authorize a claim
or an outbound provider request.

Scope: shared OMDb, web-search and legacy Tavily page selection. No library IDs,
media-server brands or titles are special-cased. Music remains excluded. No
schema migration, new worker, release, deployment or production-data repair.

## Official research

Sources discovered and opened through web tools on September 30, 2026:

- [PostgreSQL 18 WITH queries](https://www.postgresql.org/docs/18/queries-with.html):
  materialization can prevent repeated work but can also prevent useful predicate
  pushdown. Materialize only the small, secret-free provider views; let the queue
  selection remains one ordered query.
- [PostgreSQL 18 index ordering](https://www.postgresql.org/docs/18/indexes-ordering.html):
  ordered LIMIT benefits depend on index/plan compatibility. An index is not a
  substitute for measuring the actual guarded query.
- [PostgreSQL 18 row comparisons](https://www.postgresql.org/docs/18/functions-comparisons.html)
  and [sorting](https://www.postgresql.org/docs/18/queries-order.html): nullable
  tuple comparisons are not equivalent to ascending NULLS LAST ordering. Treat
  missing timestamps separately from actual infinity and retain timestamp text
  to avoid JavaScript millisecond truncation.
- [PostgreSQL 18 SELECT](https://www.postgresql.org/docs/18/sql-select.html):
  SKIP LOCKED is suitable for competing queue consumers, not a consistent global
  queue snapshot. Keep the existing atomic claim and source-fenced completion.
- [W3C status messages](https://www.w3.org/WAI/WCAG21/Understanding/status-messages):
  status changes must be available to assistive technology without unnecessary
  focus changes. This backend-only change adds no visual status, live region or
  polling loop; existing pausable readiness UI and API contracts are unchanged.

These documents guide the design; performance conclusions come from our own
disposable PostgreSQL measurements, not from generic tuning claims.

## Implementation boundaries

`enrichmentRetryCandidatePolicy.mjs` owns shared gates and bound parameters.
`enrichmentRetryCandidatePage.mjs` owns read-only page selection.
`enrichmentRetryCandidates.mjs` preserves the existing import surface.

One SQL statement retains the shared effective-deadline expression, including
exact-deadline credential-recovery provenance. The initial UNION ALL experiment
improved mixed tails but regressed recovery head pages from roughly 2 ms to
910 ms. It is not shipped. Bounding each branch separately did not resolve all
regressions either.

The same shared predicates still check pending status, attempts, library/content
eligibility, existing evidence, rejected credentials, cooldowns and monthly waits.
The source-conflict helper shares one predicate body between EXISTS write guards
and a scalar, LIMIT 1 page lookup. Its complete library/server/external key allows
point access using the existing primary key. No global conflict cache is built.
A lateral media-item lookup with OFFSET 0 prevents the planner from starting
with a full inventory scan. This is a join-order boundary on a unique primary-key
lookup (at most one row), not offset-based pagination. It lets the ordered queue
path stop early for easy pages without repeating large conflict scans on tails.

The cursor follows priority, created-at NULLS LAST, then unique queue ID. It is
memory-only and resets safely on restart. NULL no longer shares a cursor value
with PostgreSQL infinity. Parameter binding is retained; no caller-supplied SQL
identifier is accepted. Queries do not return credentials or recovery provenance.

Each claimed ID is checked again by the existing atomic claim. Provider admission
still checks quota/pacing before HTTP, and source/claim fencing still protects
result commits. A stale page can suppress or suggest work; it cannot grant new
write authority. Unknown legacy waits and ownership remain conservative.

## Options and recommendation stack

| Option | Benefit | Cost / risk | Decision |
|---|---|---|---|
| Split due/recovery branches | Exposes ordinary due access | Large measured recovery-head regression; greater complexity | Reject this iteration |
| Statement-local provider context | Avoids rebuilding provider views per item | Must not become a durable authorization cache | Implement |
| Exact conflict point lookup | Avoids repeated large conflict scans in measured case | Planner behavior remains distribution-dependent | Implement and measure |
| Queue-led lateral item lookup | Prevents full inventory-first plans; keeps easy pages cheap | Deliberate join-order boundary needs workload tests | Implement |
| Add broad ordered index | Helps some ordered scans | Prior experiment adds storage without fixing deep-page work | Do not ship |
| Disable JIT globally | May reduce compilation overhead | Changes unrelated workloads; hides excessive estimated work | Reject |
| Separate queue engine or persisted eligibility | Could move selection cost | New consistency, recovery and operational responsibilities | Defer |

Recommended stack: existing PostgreSQL and indexes; modular shared policy;
read-only page hints; atomic ID-targeted claims; existing provider admission and
source-fenced commits. Reuse the coalesced scheduler, not a new timer service.

## Acceptance and recovery

- Compare old/new page shapes with the independent fixture oracle at head,
  middle and tail for all three retry types and eight workload distributions.
- Real PostgreSQL tests must cover null/infinity/ties/microseconds, mutation
  between page and claim, concurrent workers, credential changes and restart.
- Keep complete integration coverage for quota/pacing and stale result rejection.
- Measure waiting and mixed tails, include regressions, and retain raw reports
  only in ignored `.tmp/`. No production connection or data is used.
- Keep rollback savepoints around measured claims. No migration rollback is
  needed: reverting the service refactor restores the previous query shape.
  In-memory cursors reset on process restart; pending work is not deleted.

LIMIT does not provide a scan-cost guarantee. No claim is made that this removes
all backlog-dependent work or proves performance under concurrent production
load. A scoped provenance index is a possible next measured experiment, not an
approved production schema change.
