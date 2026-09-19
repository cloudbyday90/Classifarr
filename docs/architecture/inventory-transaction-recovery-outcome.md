# Inventory transaction recovery outcome

Date: 2026-09-19

## What changed

Implemented the recovery follow-up identified in the
[paired AI comparison](multi-scale-ai-comparison-outcome.md), following the
[transaction recovery design](inventory-transaction-recovery-design.md).

Shared-wrapper database clients now own their error events until released. Failed
connections are discarded, callbacks are never replayed, and failed rollback or
unlock cannot replace the original callback error. Diagnostic logs retain fixed
operation/error codes without sending them back to the failed database.

Inventory snapshots still capture source rows and vectors in one repeatable-read,
read-only transaction. Vector decoding, learned-profile aggregation, calibration
fitting and optional context retrieval now happen after that transaction closes.
Existing exclusion rules, source verification, model keys and routing authority
are unchanged. No schema migration, new dependency or timeout increase was needed.
The policy-evaluation reader uses the same capture/decode boundary and shared
transaction runner; configuration and policies stay in its single source snapshot,
while its final fingerprint is computed after commit.

Async-local session-lock scope prevents subsequent `query`/`withTransaction`
operations from proceeding after lock loss, including a child transaction's
commit. Inventory refresh and retrieval also combine lock cancellation with
their existing inference signal. This is not distributed fencing: already-issued
statements, raw pool clients and external side effects cannot be recalled.
Callbacks must still settle cooperatively; no callback is abandoned with a
reusable client. Healthy later work can acquire a fresh connection.

## Verification

The isolated real-PostgreSQL regression sets a 50 ms idle deadline on its own
transaction. It observes SQLSTATE `25P03`, proves the first insert was rolled
back, and then verifies a different backend connection, a successful new write
and a healthy database check. It never terminates live application connections.

Four targeted PostgreSQL integration suites / 23 tests passed. Unit regressions
cover error-event ownership, duplicate errors, rollback/unlock failures, uncertain
commit, no replay, lock-loss cancellation, later backfill recovery, and snapshot
completion before decoding/fitting/context work. The final database/policy-focused
run passed 72 tests; the expanded lock/inventory run passed 115 tests.

The full suite exposed the policy-evaluation adapter's dependency on the old
internal transaction return shape. That adapter was reconciled using explicit
capture/decode functions, not a second snapshot. A new regression requires its
vector decoding to happen after commit. Seven focused suites / 136 tests passed
after that correction. The final full backend rerun passed all 1,324 suites /
38,507 tests in 808.982 seconds. The coverage ratchet passed: backend 90.24% lines /
83.15% branches and frontend 87.67% lines / 77.54% branches. No test timeout,
coverage threshold or baseline was relaxed.

The frontend passed all 369 files / 5,128 tests. The full PostgreSQL integration
run passed 143 suites / 1,645 tests with one existing skipped suite/test; the four
targeted suites / 23 tests also passed again after extracting the shared
transaction runner. Lint, server/client types, copyright/dependency preflight and
static ESM import/mock-shape checks passed. The naming gate retains the pre-existing
43 production references against its zero baseline; no new reference or waiver
is included.

## Frozen Compose comparison

Repeated the same 300-description cohort (172 movie / 128 TV), five grouped
folds and 100 requested inference cases. The sample fingerprint remained
`ad63320ed17b1c413293a6b801a73dbcc5dd017ec65394da67ae67907bd2f12c`.
The command used default read-only PostgreSQL sessions and the existing local
models. Background recovery remained enabled.

| Fold | Local context | Total fit time |
| --- | --- | --- |
| 1 | Available | 32.038 s |
| 2 | Available | 73.119 s |
| 3 | Available | 78.392 s |
| 4 | Available | 104.079 s |
| 5 | Unavailable: discovery time budget | 167.233 s |

The fifth fold failed complete-context admission. Inference therefore made zero
calls; there are no new AI quality or accuracy results. Final source verification
also detected a changed metadata digest, making the report `invalidated`.
Descriptions, vectors and library digests did not change. No invalid result was
promoted and no routing was changed.

The application stayed healthy with zero container restarts. A check during
fitting found zero idle transactions. The post-run container counters recorded a
2,147,483,648-byte peak, 674,216 memory-limit hits and zero OOM kills. These counters
cover the whole container, not just the benchmark. The
[Linux memory-controller documentation](https://cdn.kernel.org/doc/html/latest/admin-guide/cgroup-v1/memory.html)
distinguishes limit hits/reclaim from an OOM kill. This is evidence of memory
pressure, not proof that memory alone caused the discovery deadline. Host
regression suites also ran concurrently; no isolated timing claim is made.

Next: profile and reduce peak live discovery allocations and repeated fitting,
then repeat this exact comparison without competing test workloads and with
unchanged source digests. Preserve held-out exclusions, content-only grouping,
work limits and incomplete-context admission. Do not raise limits or disable
automatic recovery merely to obtain a passing benchmark. Once complete, compare
smaller query-focused evidence against raw descriptions for stability and cost.

Follow-up: [discovery allocation design](discovery-allocation-design.md) and
[measured outcome](discovery-allocation-outcome.md).

Also audit source-fingerprint relevance: the shared CLI verifies candidate
metadata for every comparison, while these two arms consume descriptions,
membership and vectors, not `candidateMetadata`. Any narrower fingerprint needs
explicit per-mode input-dependency tests. This run remains invalid under its
unchanged rules, and its incomplete fifth fold independently prevents inference.

## PR and release boundaries

The GitHub connector returned an empty open-PR collection on 2026-09-19, so there
was no open PR to randomly select or apply. No PR was merged. All six workflows
for the preceding commit completed successfully. This component only updates
Unreleased; it creates no release, tag or version change.

## Recommendation stack

1. Keep scoped connection ownership and one coherent snapshot followed by
   computation. This protects unattended recovery without duplicating writes;
   the cost is explicit preparation/assessment boundaries and bounded temporary
   encoded-vector storage.
2. Keep the existing SWR/backfill scheduler and retry admission. A failed current
   attempt must not become a successful classification or a completed cache entry.
3. Reduce discovery's peak allocations and repeated work, then use the complete,
   source-verified paired comparison to choose the next content-learning change.
   Placement agreement is diagnostic, not accuracy.
4. For future cross-process, externally mutating jobs, assess durable fencing and
   idempotent outcome reconciliation. Cooperative cancellation cannot settle an
   already-issued request with an unknown outcome.

Do not raise confidence or database deadlines to conceal a failed operation, and
do not add user acknowledgement steps to recover ordinary transient failures.
