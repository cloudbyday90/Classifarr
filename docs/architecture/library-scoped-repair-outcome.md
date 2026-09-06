# Per-library repair prototype outcome

## Decision and scope

The [per-library design](library-scoped-repair-design.md) preserves one-visit
completion for the observed small libraries and removes the old prototype's
global-head wait for unrelated writers. Keep it isolated until the production
writer contract and operational recovery have been assessed.

Recent work progressed from revision-checked scans (`0593d7aa`) and automatic
diagnostics (`5f93bc82`) to recovery benchmarks (`61afb834`), journal-based page
repair (`7d0fc46f`) and lifecycle fixes (`5590acb2`). This implements the last
[lifecycle recommendation](library-repair-lifecycle-outcome.md): adaptive page
boundaries and ordered library locks, with the small-library path preserved.

All new code is ESM. Separate modules own limits, locking, mutation validation,
schema/trigger installation, registry lifecycle, page measurement, visits,
fixtures, concurrency probes and the benchmark. The earlier projection now
exports its bounded source columns so both prototypes share the production
observation predicate. Production routes, migrations and sampling are unchanged.

## Real Compose inventory distribution

On 6 September 2026 at 13:24:35 UTC, a rollback-only temporary replay on the local
PostgreSQL 18.6 Compose instance captured 6,692 real item IDs, library memberships,
media types and TMDB identities across 10 active libraries. Its inventory oracle
counted the captured source independently of page aggregation.

| Library ordinal | Items | Previous fixed-ID ranges | New summaries | New visits to complete |
| --- | --- | --- | --- | --- |
| 1 | 30 | 4 | 1 | 1 |
| 2 | 535 | 3 | 1 | 1 |
| 3 | 399 | 1 | 1 | 1 |
| 4 | 1,253 | 4 | 1 | 1 |
| 5 | 2,813 | 18 | 1 | 1 |
| 6 | 46 | 2 | 1 | 1 |
| 7 | 68 | 1 | 1 | 1 |
| 8 | 274 | 2 | 1 | 1 |
| 9 | 309 | 2 | 1 | 1 |
| 10 | 965 | 5 | 1 | 1 |
| Total | 6,692 | 42 | 10 | 10 |

The new prototype used 76.2% fewer summaries for this distribution. Every library
completed in one visit, reading its item count in both the ID lookahead and the
bounded metadata projection. No source row was skipped to obtain completion.

The running application's schema predates the observation-clock columns. The
initial capture therefore failed safely and rolled back. The successful replay
used explicitly empty observation fixtures; it measures real occupancy and page
efficiency, **not live observation health or semantic classification accuracy**.
No application upgrade was performed to manufacture those fields.

Application relations were only read. All prototype writes were session-local
and rolled back; temporary source removal was verified. Provider requests,
production writes and classification writes were zero. Raw IDs and reports remain
in ignored local intermediates; this document contains aggregate evidence only.

## Scheduling and work bounds

Reproduce the generated-data assessment with:

```bash
npm run benchmark:library-scoped-repair
```

The no-argument CLI creates its own `postgres:18.6-alpine` container with generated
credentials. It cannot accept an application connection string. Nine scenarios
each run 90 simulated five-minute scheduling slots across 15 libraries, for 810
visits. Each selected library returns every 75 simulated minutes. These are
scheduling results, not elapsed benchmark wall time or a production SLA.

| Target items | Stable first completion | One page changing | Every page changing |
| --- | --- | --- | --- |
| 20,001 | 75 minutes | 150 minutes | No complete result |
| 40,001 | 150 minutes | 225 minutes | No complete result |
| 80,001 | 300 minutes | 375 minutes | No complete result |

All complete reports matched the independent generated-fixture count oracle.
Dense scheduling matches the previous prototype; this change improves sparse
occupancy and lock scope. Continuous changes across all pages still prevent a
coherent complete report, and totals remain null rather than stale or partial.

Every visit stayed within 20,000 metadata rows and 20,001 lookahead IDs. The
largest measured visit took 240.62 ms and the largest mutation took 21.55 ms on
this machine. Allocation peaked at 15 active registry slots and 19 summaries,
within the preallocated global caps of 32 and 128. Every scenario had zero
restarts; other libraries received all 84 scheduled visits per scenario. The
disposable schema was removed and cleanup verified.

## Transaction, failure and recovery evidence

On the standalone PostgreSQL 18.6 runtime, an unrelated-library mutation committed
in 8.46 ms while a reader still held its selected-library lock. A same-library
writer visibly waited, using `pg_blocking_pids()` to establish the dependency.
Opposite-direction moves committed with both source memberships correct.

The PostgreSQL integration suite additionally starts opposite moves between the
first and second library-lock acquisitions. It verifies that the second writer
waits for library 1 before holding library 2, then both moves commit. This tests
the ordering rule at the point where an inconsistent order would form a cycle.

Further checks establish that:

- Inserts into a full range split it and withhold totals until its tail is measured.
- All 32 existing observation-validity cases retain their expected six reusable
  and 26 unusable outcomes. Oversized observations are withheld.
- Clock-only changes, identity corrections, source-ID moves, library moves through
  null, deletes and reinsertion invalidate affected ranges or require a rebuild.
- Missing old/new library locks reject source writes with SQLSTATE `55000`.
  Stale membership rolls back the entire mutation batch and its invalidations.
- Invalidation revision mismatches remain sticky through later writes, including
  bigint values beyond JavaScript's safe integer range; rebuilds change epoch.
- Oversized transition sets and truncate require a restart with null totals.
- Freshness expiry, expiry during a visit, backward clocks and seven-day state
  age cannot publish misleading complete counts. Older dirty pages make progress.
- Global capacity exhaustion and temporarily locked free slots refuse publication.
  Split failure leaves another library's capacity intact. Concurrent first visits
  claim distinct registry/summary slots.
- Idle reclamation skips busy libraries and reclaims them after their locks release.
  A reader waiting behind truncate has no library advisory lock to form a cycle.
- Rollback and termination of an owned backend preserve committed cursor state;
  reconnect resumes the remaining one-row page. Temporary installation rolls back.

The integration harness runs its existing isolated PostgreSQL 18 image (18.4).
Standalone scheduling/concurrency and the Compose replay separately ran on 18.6.
Backend termination is a connection-loss check, not a database-crash/restart test.
Logical slot bounds do not establish a physical disk-size ceiling.

## Verification

The complete backend coverage run passed 30,215 tests across 1,066 suites in
527.39 seconds. Coverage was 89.87% lines/statements, 80.60% branches and 92.33%
functions; the repository ratchet passed. The unchanged client retained its
existing coverage evidence (87.86% lines, 77.65% branches); client tests were not
rerun for this backend-only prototype.

All 51 PostgreSQL checks passed across the new scoped tests and earlier repair
and lifecycle suites. The final focused unit run passed 53 projection and input
validation checks, including corrected table-driven invalid-batch cases. The
standalone assessment completed all 810 replay visits with oracle agreement.
Lint, server/client types, static ESM imports, strict test mock shapes, both
server unused-code checks, migration/schema integrity, 1,014 Markdown documents
and the local Docker build passed. No running application was redeployed.

## Recommendations, tradeoffs and next item

| Choice | Pros | Cons | Recommendation |
| --- | --- | --- | --- |
| Current production sampler | Fits the observed inventory; already automatic | Large changing libraries can restart | Retain during evaluation |
| Row-count page boundaries | Sparse libraries complete promptly; measured row budget | Growth splits and empty gaps need conservative repair | Keep this tested prototype |
| Per-library ordered locks | Unrelated writers progress concurrently | Every writer must declare actual old/new libraries before row locks | Audit production compatibility before adoption |
| Synchronous invalidation | Coalesced bounded state; no retained journal overflow | Requires transactional trigger/gateway integrity | Keep a separate contract and fail-closed epochs |
| Production rollout now | Would expose adaptive repair sooner | Existing writers do not yet implement the new lock contract | Defer |

Next: **build an automated production-writer compatibility inventory and adapt the
sync upsert contract in isolation**. The source review already identifies distinct
paths that need preservation, rather than a drop-in replacement with the prototype:

- `mediaSyncItemQueries.mjs` upserts can move libraries and already compare `xmin`.
- `mediaSyncQueries.mjs` prunes a whole library and can exceed the mutation cap.
- `queueEnrichmentPersistence.mjs` writes observations and clocks after provider I/O.
- `mediaIdentityReviewRepository.mjs` can acquire source-row locks before applying
  a reviewed identity; lock ordering must be coordinated with its actor/audit work.
- `mediaResolvedIdentityPersistence.mjs` preserves source-evidence comparisons.
- `queueCarsaCleanup.mjs` performs broad deletion; migrations and foreign-key
  cascades require inclusion in the complete writer inventory too.

Acceptance should prove old/new membership discovery, bounded bulk handling,
preservation of existing optimistic comparisons, and no provider I/O while library
locks are held. Audit every source writer and deployment privileges before adding
production triggers. An owner able to disable triggers remains outside the guard's
security boundary. Sustained storage churn and database-crash recovery remain
separate promotion gates; add no operator collection workflow.

Recommended stack: synchronized inventory → bounded per-library pages → declared
transactional writes → automatic invalidation and reclamation → coherent coverage
and existing diagnostics → independently evaluated review-only semantic evidence.
This storage study does not supply independent human labels or satisfy the frozen
semantic-study preflight. Semantic counter-evidence remains gated on a measured
error profile and must send ambiguity to review, never automatic routing.

Official PostgreSQL and W3C sources, August-baseline scope and design alternatives
are linked in the [design document](library-scoped-repair-design.md). W3C DQV informs
measurement provenance and completeness; no UI or RDF conformance is claimed.

GitHub MCP returned no open PRs on 6 September 2026, including the final recheck.
There was no PR available for random local implementation. No external PR was
merged and no release was created.
