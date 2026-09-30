# Retry query benchmark outcome

Implemented September 29, 2026 under Unreleased. No release, version bump,
application schema change or production restart. See the separate
[design](retry-query-benchmark-design.md) for official research and tradeoffs.

## Result

The high-value next target is **candidate-page selection**, not the ID-targeted
claim and not another worker. Returning at most 50 items does not constrain the
database work required to find them.

Delivered `npm run benchmark:retry-queries`: modular ESM tooling that uses a
disposable PostgreSQL 18.6 container and synthetic data. It captures actual
production SQL, verifies expected IDs independently, measures both current and
experimental indexes, and rolls back every claim and scenario.

## Measured evidence

100,000 rows per populated scenario; 2-CPU / 1 GiB container; three warmed
repetitions; 240 scenario/type/query/strategy comparisons and 720 EXPLAIN runs.
Both strategies returned exactly the expected IDs. No provider calls or
production-data changes occurred. All claims and benchmark schemas rolled back.

Selected OMDb median execution times in milliseconds (not production SLAs):

| Workload / query | Current indexes | Proposed index | What it shows |
|---|---:|---:|---|
| All waiting / first page | 47.76 | 40.27 | Still scans 33,333 provider rows with the index |
| Last 1% due / first page | 63.59 | 40.42 | Searching for due work is still backlog-dependent |
| Mixed guards / first page | 1.16 | 1.19 | An easy first page hides later-page cost |
| Mixed guards / deep page | 790.22 | 776.30 | Ordered index does not address the expensive plan |
| Mixed guards / readiness | 8.03 | 7.31 | Bounded preview has a different cost profile |
| Mixed guards / ID-targeted claim | 0.61 | 0.76 | Authoritative point claim is not the main bottleneck |

The all-waiting baseline first page examines 100,000 queue rows; the experimental
index narrows that to approximately one provider's third. It adds 4,988,928 bytes
for the fully pending fixture. It helps some fallback claims but does not solve
the expensive deep-page query, so no index migration was shipped.

The mixed deep-page plan examines 33,333 queue rows and repeatedly scans the
7,692-row conflict fixture: 568 scan loops, approximately 4.35 million emitted
scan rows in the recorded repetition. Root shared-buffer hits were 66,004 for
both strategies. EXPLAIN row averages are rounded; these are plan-work
diagnostics, not counts of distinct media or disk reads.

The deep-page estimated cost also crosses the configured 100,000 JIT threshold;
PostgreSQL reports 149 generated functions. Even a cooldown-blocked deep page
reports 143 functions despite zero queue scan loops. This implicates compilation
overhead as an additional hypothesis, but this run does not isolate its duration:
per-node timing was disabled. It does not justify disabling JIT globally.

Source schema SHA-256:
`069a4bac90daef7eaa70870f3f3bd26a977d723319f1b16a2193429f3d2c51f3`.
The report records per-query hashes, planner settings and all repetitions. Local
generated reports belong in `.tmp/`, not version control.

## Validation

- Full backend coverage: 1,550 suites / 47,044 tests passed; 90.23% statements
  and lines, 85.03% branches and 92.05% functions.
- Full frontend coverage: 411 suites / 5,795 tests passed. The combined coverage
  ratchet passed with unchanged thresholds and baselines.
- Disposable PostgreSQL: 3 suites / 35 tests passed, covering the benchmark,
  credential-scoped waits and retry ownership. These verify exact IDs,
  actual claim rollback, schema removal, refusal boundaries and readiness flags.
- The new tooling has 43 targeted unit tests. Existing lifecycle tests also
  verify container cleanup on connection, measurement and close failures.
- Copyright, ownership review, dependency reachability, lint, type checks,
  documentation lint, ESM checks, migration/snapshot checks and four policy gates
  passed. No reported validation issue remains.
- The frontend and production services are unchanged. No provider credentials,
  library data, routing settings or running application containers are modified.

## Limits

The data deliberately stresses ordered tails; it is not a capture of the user's
backlog. Priorities are tied and timestamps monotonic. No concurrent writers,
cold-cache behavior, foreign-key/trigger overhead or provider latency is measured.
The benchmark does not measure dispatch, maintenance or the whole scheduler.
An empty setup returns no work; the tool does not start background services.

The private index is only a comparison. Its faster cases do not establish a
general production benefit. No cache of eligibility or extra daemon was added.

## PR disposition

Initial and repeat GitHub MCP searches returned no open PRs in
`cloudbyday90/Classifarr`. There was
no eligible random PR to implement. No closed PR was substituted or PR merged.

## Next component

September 30 follow-up: [candidate selection outcome](retry-candidate-selection-outcome.md)
records the implementation and remaining waiting-backlog work. The original
acceptance targets below motivated that work; the split-deadline experiment was
rejected after broader measurements exposed a recovery-head regression.

Refactor **retry candidate selection**, keeping ID-targeted claims authoritative:

1. Make the cursor predicate and ordering index-compatible, including nullable
   timestamps and ties. Measure early, middle and tail pages.
2. Separate ordinary due work from credential-repair eligibility where this
   allows selective index access, without waiving unknown legacy waits.
3. Eliminate repeated full conflict scans while preserving positive conflict
   exclusion and rechecking source/claim authority before every write.
4. Re-run this harness against both query versions. Require identical IDs/order
   and lower scan work in the waiting and mixed deep-page cases, then test
   concurrent workers, changes between page and claim, and restart behavior.

Start with the measured mixed deep-page case. Add an index only if the revised
plans demonstrate a consistent benefit. Do not weaken quotas, pacing, music
exclusion, library activation or ownership checks to obtain a faster result.
