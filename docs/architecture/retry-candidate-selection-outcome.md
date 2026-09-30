# Retry candidate selection outcome

Implemented September 30, 2026 under Unreleased. See the separate
[design and official research](retry-candidate-selection-design.md).
No release, version bump, schema migration, production restart or data change.

## Delivered

- Modular shared eligibility policy and read-only candidate-page query; existing
  imports and public APIs remain compatible.
- Statement-local, secret-free provider context and queue-led item lookups.
- Exact source-conflict point lookup using the existing primary key, with the
  same predicate body as authoritative write guards.
- Correct pagination across priorities, ties, microseconds, NULL, and actual
  positive/negative infinity. NULL is no longer encoded as infinity in the cursor.
- Expanded offline benchmark: old/new head, middle and tail page shapes, plus
  readiness and both claim paths. No new production dependency or timer.

The initial split-deadline implementation passed correctness checks but regressed
credential-recovery head pages from approximately 2 ms to 910 ms. It was rejected.
The shipped query keeps the shared deadline expression and uses bounded
primary-key lateral lookups. We did not keep a fast tail at the expense of a slow
ordinary recovery path.

## Measured outcome

PostgreSQL 18.6; 100,000 synthetic rows per populated scenario; 2-CPU / 1 GiB
container; three warmed repetitions. Version 2 verifies 432 combinations and
1,296 EXPLAIN runs. Every combination matched its independent expected IDs/order;
all claims and schemas rolled back. Zero provider requests or production writes.

Selected OMDb median execution times, milliseconds, using existing indexes:

| Workload / position | Previous page shape | Shipped page shape |
|---|---:|---:|
| Mixed guards / head | 1.27 | 1.22 |
| Mixed guards / middle | 3,536.69 | 10.23 |
| Mixed guards / tail | 802.12 | 11.26 |
| Credential recovery / head | 1.68 | 1.42 |
| Credential recovery / tail | 253.69 | 69.91 |
| All waiting / head | 53.33 | 50.00 |
| All waiting / tail | 86.39 | 7.34 |
| Last 1% due / head | 54.16 | 55.29 |

Web-search and Tavily mixed tails improved from 797.05 / 805.99 ms to 10.33 /
10.29 ms respectively. The small head-page differences are not material wins or
SLA evidence; sparse-ready head scans remain a limitation.

Not every case improved: the largest increase was the Tavily terminal-history
tail, 15.14 to 21.76 ms; rejected-credential Tavily head rose 35.81 to 38.29 ms.
These are reported rather than hidden by an aggregate speedup. They warrant
repeat measurement on an idle host and realistic distributions, not removal of
eligibility checks. The rejected split-query regression was far larger.

For the OMDb mixed tail, queue rows examined fall from 33,333 to 3,334. Instead of
568 full conflict scans, the shipped plan performs 568 primary-key probes. Root
shared-buffer hits fall from 66,004 to 3,654 in the recorded repetition. Root
buffer totals include children; they are not summed twice. No temporary writes
were observed. No global JIT setting was changed; these shipped page plans stayed
below the compilation threshold in this run.

The optional broad ordered index remains an offline experiment only. No index
DDL is deployed. The schema SHA-256 remains
`069a4bac90daef7eaa70870f3f3bd26a977d723319f1b16a2193429f3d2c51f3`.
Generated reports are ignored local `.tmp/` artifacts. Reproduce with
`npm run benchmark:retry-queries`.

## Validation

- Disposable PostgreSQL: 8 suites / 118 tests passed, including full benchmark,
  cursor boundaries, stale page-to-claim hints, competing workers, restart,
  credential-scoped waits, cache-aware dispatch, OMDb admission/pacing and web
  quota admission. PostgreSQL also enforces a read-only transaction around the
  candidate query in a regression test; this is not only a SQL-text assertion.
- No routing, music exclusion, attempts, cooldown, monthly wait, quota, claim or
  result-source fence was weakened. New reads do not mutate retry state.
- Final backend coverage run: 1,551 suites / 47,085 tests passed; 90.23%
  statements/lines, 85.03% branches and 92.05% functions.
- Frontend coverage: 411 suites / 5,795 tests passed. Coverage ratchet passed with
  unchanged baselines and thresholds.
- Copyright, ownership review, dependency reachability, lint, type checks,
  Markdown lint, ESM checks, migration/snapshot checks and all four policy gates
  passed. SQL-shape mocks and read-only assertions were updated for the new CTE;
  the complete backend coverage suite was rerun successfully after those fixes.

## Limits and tradeoffs

The benchmark baseline preserves the previous SQL shape while sharing current
authority predicates. The independent fixture oracle checks both; finite fixture
timestamps do not reproduce the old NULL/infinity cursor bug. Separate PostgreSQL
pagination tests cover that intentional correctness change.

Synthetic tied priorities and warmed samples are not production latency or
capacity evidence. Other local validation work overlapped part of the run; the
host was not isolated. The benchmark excludes concurrent writers, foreign-key /
trigger overhead and provider latency; integration tests cover separate
concurrency and admission properties. No cold-cache or whole-scheduler claim is
made. The lateral planning boundary should be remeasured on PostgreSQL upgrades.

An all-waiting head page still examines 100,000 queue rows in this fixture.
Returning at most 50 items is not a database-work bound. Existing preview/claim
guards remain authoritative and no durable eligibility cache was introduced.
The ownership inventory gate records reviewed drift, not proof that all other
writers are safe; its existing unresolved debt remains explicit.

## PR disposition

Initial and repeat GitHub MCP searches returned no open PRs in
`cloudbyday90/Classifarr`. No random open PR could be selected; no closed PR was
substituted and no PR was merged.

## Recommendation and next component

Keep PostgreSQL, the current indexes, shared ESM policy, read-only page hints and
existing claim/admission/commit boundaries. The benefit is much lower repeated
lookup work without a new service or schema; the cost is a deliberate query-plan
boundary plus remaining backlog scans.

Next: **selective waiting-backlog discovery**, not another broad ordered index.
Measure a narrow index for pending rows with recorded wait provenance together
with ordinary due selection. Require independent-ID equivalence and bounded
head-page work for all-waiting, sparse-ready and mass credential-recovery cases.
Include realistic timestamp/priority skew, write/storage overhead and concurrent
updates. Ship only if it avoids the recovery-head regression caught this round.
Unknown legacy deadlines must remain protected, and provider admission stays
separate from selection. Do not enable automatic takeover or infer ownership.

September 30 follow-through: [selective waiting-backlog discovery](retry-wait-discovery-design.md)
adds a conservative statement-local check and narrow provenance index for idle
pages and scheduler probes. See its separate outcome for measurements and limits.
