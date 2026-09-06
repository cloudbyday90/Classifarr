# Bounded library page repair prototype outcome

## Decision

The [design](library-page-repair-design.md) is implemented as an isolated ESM
prototype. Reusing unaffected page summaries allows completion when continuous
changes affect one range, including libraries larger than the earlier 40,000-row
recovery cap. Complete counts remain withheld when every range changes faster
than the one-range-per-visit repair budget can resolve them.

Keep the existing production sampler and diagnostics. This experiment establishes
conditional progress and coherent publication, not production readiness. No
operator collection workflow, provider request, classification action, application
endpoint, migration or release was added.

## Delivered implementation

Run from the repository root with Docker and server development dependencies:

```sh
npm run benchmark:library-page-repair
```

The CLI reuses the existing disposable PostgreSQL 18.6 runtime, accepts no
arguments and loads no application database configuration. It creates a new
allowlisted prototype schema, executes nine real database scenarios and removes
its schema/container. Only aggregate JSON leaves the command.

Small modules separate the contract, isolated schema and statement triggers,
bounded projection, cache invalidation, transactional visits, fixtures and
measurement runner. Production observation validation supplies the seven coverage
counters. Each range retains compact counts, a private digest and a freshness
expiry; it does not retain item metadata.

The transactional head orders committed changes. The 256-slot journal records
both old and new library/range membership. A visit locks that head before reading
source data and atomically commits its summary and cursor. Exact bigint strings
avoid precision loss, and global continuity includes changes to other libraries.

Missing events, overwritten history, bulk overflow, truncate, age limits, clock
regression and global capacity exhaustion return `restart_required` with null
counts. The isolated prototype drops the affected cursor and rebuilds on a later
visit; wiring that signal into the existing production restart path is deferred.
Database errors roll back the visit. Expiry during a visit withholds publication.

## PostgreSQL 18.6 evidence

Nine scenarios each execute 90 committed visits across 15 libraries at modeled
five-minute slots. One library has the listed population; the other 14 contain
one identified item each. Continuous churn changes either one range or every
range before every global slot. These are scheduled offsets, not execution times.

| Large-library rows | Stable: first complete | One changing range: first complete | Every range changing | Max metadata rows per visit |
| --- | --- | --- | --- | --- |
| 20,001 | 75 minutes | 150 minutes | No completion | 20,000 |
| 40,001 | 150 minutes | 225 minutes | No completion | 20,000 |
| 80,001 | 300 minutes | 375 minutes | No completion | 20,000 |

All 810 visits executed. Each scenario preserved 84 visits for the other libraries
and their 75-minute scheduled revisit gap. All published counts matched explicit
fixture expectations. Oracle queries ran outside measured visits; they may scan
the controlled fixture and are verification work, not part of the bounded sampler.

At most two one-ID seeks accompany a metadata range: the first ID belongs to that
range and the second checks for another range. At most 19 cached summaries and
256 journal entries were retained in this replay, below the configured global
limits of 128 pages, 32 library cursors and 256 journal entries. Separate fault
tests exercise the exact global capacity boundaries and conservative refusals.

| Churn | Largest observed visit ms | Largest observed mutation ms |
| --- | --- | --- |
| Stable | 228.12 | 0 |
| One range | 259.81 | 2.20 |
| Every range | 221.67 | 14.84 |

These are descriptive maxima from one fixed-order local run using
`postgres:18.6-alpine`, with actual `server_version` 18.6. Visits include
transaction setup, database round trips, projection, hashing and commit. Mutation
timing includes source updates and triggers. Fixture creation, oracle checks and
storage inspection are excluded. Concurrent repository tests shared the host;
these numbers are not production latency estimates or a causal speed comparison.

The large replay populations use contiguous IDs. Real globally allocated IDs can
be sparse or interleaved across libraries, increasing cached ranges for the same
item count. A sparse 129-range population is correctly refused in fault tests;
this prototype does not claim that every 80,001-item library fits the cache.

The largest measured prototype relation/index footprint was 212,992 bytes,
excluding the source fixture. Row caps bound live logical state. They do not
establish a hard physical byte limit under sustained MVCC, index or WAL growth.

## Compose assessment

The running Compose PostgreSQL 18.6 service supplied 32 real typed identities:
16 movies and 16 TV items across eight libraries. Six valid and 26 malformed
metadata cases supplied explicit expectations. The identities were combined into
one controlled library with synthetic padding, so these are not measurements of
the original libraries' complete populations.

| Controlled population | Visits to completion under one-range churn | Captured observations at completion | Missing-event injection |
| --- | --- | --- | --- |
| 20,001 | 3 | 19,974 | Restart; counts withheld |
| 40,001 | 4 | 39,975 | Restart; counts withheld |
| 80,001 | 6 | 79,975 | Restart; counts withheld |

Inventory, supported, identified, captured, fresh, keyword and language counts
matched the explicit expectations. The changing synthetic item explains the
one-item difference between alternate final turns. Every visit read at most
20,000 metadata rows. All writes used temporary prototype objects; rollback and
removal were verified. Provider requests, live application writes and classification
writes were zero. The running application was not redeployed.

This temporary assessment uses one outer rollback transaction and does not prove
cross-session ordering. Separate disposable-database tests use actual concurrent
sessions and committed visits for that proof. Controlled validity cases are not
independent human classification labels. Existing readiness and frozen-study
requirements remain in force; semantic counter-evidence was not enabled.

## Validation

Focused checks cover 32 explicit observation-validity cases, exact expiry and
future-clock boundaries, bigint continuity, unsafe input rejection, database
isolation and transaction cleanup. Real PostgreSQL tests cover source mutations,
sparse/max IDs, overflow and missing events, capacity, fairness among dirty pages,
expiry, query bounds, rollback, a blocked concurrent writer and lock timeout.

All 37 focused checks and the final 18 PostgreSQL tests passed. A combined
PostgreSQL run also passed 38 checks across page repair, the preceding recovery
benchmark and production diagnostics before two additional rollback/capacity
tests were added and verified in the final page-repair run.

The full backend coverage run exercised 30,175 tests across 1,064 suites in
512.8 seconds. Its only failure was the new test's undocumented cleanup rejection
handler. The handler now explains why cleanup preserves the primary failure;
the code-health and projection recheck passed all 20,550 checks. All other suites
passed the full run. No application behavior changed in that correction.

Fresh backend line/branch coverage is 90.01% / 80.58%. The coverage ratchet passed
using that report and the retained current coverage for unchanged client code.
Repository lint, server/client types, static ESM imports, strict mock shapes,
both server unused-code checks, migration/schema integrity, Markdown validation
(1,010 documents) and the local Docker build passed. No browser behavior changed.

## Recommendations and next item

| Option | Pros | Cons | Recommendation |
| --- | --- | --- | --- |
| Current production sampler and diagnostics | Existing bounded work and visible incomplete coverage | Whole-library restart can starve under churn | Retain while evaluating recovery |
| Bounded page repair | Completes under localized churn; preserves the metadata budget | More state, expiry and continuity rules; cannot keep up with every-range churn | Retain as tested prototype |
| Global publication head | Simple commit-order and coherent-read proof | Serializes all tracked writers and visits; truncate can conflict with source locks | Do not promote without contention work |
| Sequence allocation alone | Cheap identifiers | Allocation and commit order differ; rollback gaps are ambiguous | Reject as a continuity proof |

Follow-up delivered in the [lifecycle assessment](library-repair-lifecycle-outcome.md).
The original next-step specification was to measure real range occupancy, concurrent ingestion and publication-lock contention, including
large transition sets, lock timeout and truncate conflicts. Evaluate per-library
ordering with deterministic old/new-library lock order, and define idle-cursor
eviction, reconnect/crash recovery and sustained vacuum/storage behavior. Require
the same coherence and conservative fallback tests before considering integration
with production source writers and automatic sampling.

Recommended stack: synchronized inventory → transactional observation changes →
bounded, expiry-aware summaries → coherent automatic coverage → retained
diagnostics → independently evaluated review-only semantic evidence. This stack
supports understanding existing library contents with minimal operational input.

The [design](library-page-repair-design.md) records official PostgreSQL and W3C
research, tradeoffs and the August 2026 baseline limitation. W3C quality provenance
informs the separate source revision and evaluation timestamp; this offline work
introduces no new user interface or accessibility claim.

GitHub MCP returned no open pull requests on 6 September 2026, including the
pre-integration recheck. No PR was available for random selection or local
implementation. No external PR was merged and no release was created.
