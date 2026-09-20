# Neighbor-reference coverage: outcome

## Outcome on 20 September 2026

Implemented the [reference-coverage design](neighbor-reference-coverage-design.md).
The audit now measures missed nearest examples instead of assuming sample
truncation explains a rejected proposal. A representative-selected alternative
reuses the existing content-group fitter, preserves calibration items and sample
size, and has its own evaluation version. Live routing remains unchanged.

The two neighbor arms share one privately copied immutable corpus. This avoids an
additional full embedding copy while keeping separate bounded model caches and
work budgets. New modules separate selection, coverage arithmetic and redacted
reporting. No database migration, dependency, API, frontend setting or provider
configuration changed. All new JavaScript uses ES modules.

## Snapshot-verified local result

The balanced 300-item sample covered 150 movies and 150 TV shows across ten
libraries, with five whole-description held-out folds. All four benchmark arms
used one frozen source. The run completed with `sourceVerified: true`, no changed
source components, zero generation calls and no writes under PostgreSQL's default
read-only transaction setting.

Coverage diagnostics cover the 33 nominated challenges (including vetoed ones),
not every sampled item: 165 candidate comparisons and 495 expected top-three
neighbor occurrences. Shared descriptions, retained decisions, conflicting
metadata and complete outer folds were excluded from both sides of the comparison.

| Measure | Ordered control | Representative alternative |
| --- | ---: | ---: |
| Exact nearest examples retained | 169 / 495 | 173 / 495 |
| Top-three recall | 34.14% | 34.95% |
| Comparisons retaining all three nearest examples | 45 | 45 |
| Mean top-three cosine-score gap from full retrieval | 0.052340 | 0.050268 |
| Accepted nominations including vetoed cases | 4 | 4 |
| Accepted unvetoed placement gains | 1 | 1 |
| Accepted unvetoed placement losses | 0 | 0 |
| Accepted hypothetical gains under veto | 3 | 3 |
| Accepted hypothetical losses under veto | 0 | 0 |
| Not distinguished from alternatives | 27 | 27 |

Representative selection improved the mean score in 31 candidate comparisons,
worsened it in 16 and left it unchanged in 118. Movie nearest-example recall rose
from 25.40% to 26.67%; TV recall stayed at 49.44%. Small-library strata 1, 6 and 7
already had complete coverage. Large-library coverage remained poor; for example,
movie stratum 5 recovered one of 63 nearest-example occurrences in the control
and two in the alternative. These are anonymous strata, not hard-coded categories.

The alternative used converged representative selection in 64 comparisons,
retained the small-library control in 45 and reported ordered fallback for 56
comparisons with unconverged geometry. These count query/candidate observations,
not distinct fit attempts. No iteration, evidence or memory limit was relaxed.

There were 284 reviewable cases and 249 unchanged policy vetoes. Both acceptance
arms retained 229 observed-placement agreements against the policy baseline's 228.
Existing placement is a weak label, **not verified semantic accuracy**. Neither
unknown-content rejection nor reduced user workload was established.

## Recovery and limits of the second sample

The second seed, `classifarr-crossfit-20260920`, was attempted under the same
constraints. Initial attempts deferred for busy/background work and insufficient
memory headroom. A normal Compose recreation, without deleting volumes, allowed
the experiment to run; the ending source check detected changed metadata and
observed traits and marked that result `invalidated` with `sourceVerified: false`.
Its figures are not counted as a second validated result. Further admission
deferrals were not treated as successful runs or bypassed.

The verified first sample reuses an existing evaluation cohort; this change adds
no independent correctness labels. A second seed would also overlap it, especially
in small libraries. No claim of 600 new or independent samples is warranted.

## Reproduction and integrity

```text
docker exec -e LOG_LEVEL=fatal -e FILE_LOGGING_ENABLED=false -e 'PGOPTIONS=-c default_transaction_read_only=on' classifarr node src/scripts/runInventoryDescriptionBenchmark.mjs --seed classifarr-leader-20260920 --size 300 --folds 5 --leader-challenge --max-minutes 30
```

Protocol `inventory_leader_challenge_v4` preserves raw, split-baseline and
cross-fit acceptance arms. It adds `representativeAcceptanceComparison` and
`referenceCoverage`, including movie/TV and anonymous per-library summaries.
Item descriptions, titles, hashes, vectors and destination IDs are not serialized.

- Sample fingerprint: `87f58693d97f5e4e251b93bdb0ab7d6a1e1bcf909b99e32c404520e65bbe231a`.
- Fold fingerprint: `de91fbe9cbb1b6270c33ebc44f0d7961a021446a9cb63d60110174020d2776fa`.
- Vector digest: `49fe5be63dac7f7a49cc94a46fe046f7f4294f5d4eb62072f8274586778eb5b9`.
- Metadata digest: `0012566f72f69718497ed65c07a91d9edf77b71da620d72905fdba0b8c1dcc3e`.
- Provenance digest: `0a06355a860e2da958b20df5144a986666fbb062c698df9811a4d4ae37e1afeb`.
- Embedding: cached 1024-dimensional `mxbai-embed-large:latest`, digest
  `468836162de7f81e041c43663fedbbba921dcea9b9fefea135685a39b2d83dd8`.

Private logs remain in `.tmp/reference-coverage-sample-a.log` and
`.tmp/reference-coverage-sample-b.log`; they are not committed. The latter is the
invalidated run, not an accepted result.

## Verification

- Focused: 20 suites and 253 tests passed, including unchanged small libraries,
  calibration-isolated selection, independent score arithmetic, private snapshot
  sharing, cancellation/retry, convergence fallback and explicit version admission.
- PostgreSQL integration: three suites and 24 tests passed.
- Full backend run: 1,346 suites and 39,156 tests passed. The coverage ratchet
  passed: backend statements/lines 90.28%, branches 83.38% and functions 92.39%.
  All three new runtime modules have 100% statement, line and function coverage;
  coverage arithmetic and aggregate reporting also have 100% branch coverage.
  The unchanged client's existing coverage report was reused by the ratchet,
  not represented as a new frontend test run.
- Lint, client/server type checks, copyright/dependency preflight and ESM checks passed.
- Markdown lint passed for 1,388 documents. Compose was healthy with a read-only
  root filesystem, no OOM kills and zero memory-limit failures. Observed cgroup
  peak after the second attempt was 1,521,233,920 bytes, including background
  application work; it is not a measurement of the experiment alone.
- The existing production-naming gate remains blocked at 43 references against a
  zero-reference baseline; no waiver or baseline adjustment was introduced.
- GitHub's open-PR collection was empty. No random open PR was available, and none
  was substituted or merged. No release, version bump or tag is included.

## Final recommendation stack and next item

Keep validated inventory → provenance-clean description grouping → exact retrieval
diagnostics → calibrated comparison → existing policy and routing safeguards.
Retain the ordered baseline and keep the representative alternative evaluation-only.

| Choice | Benefit | Limitation / decision |
| --- | --- | --- |
| Retain coverage diagnostics | Locates lost evidence by media and library without new UI | Recall is not correctness; keep |
| Promote representative selection | Slightly closer examples in this cohort | No added acceptance, some worse scores and many unconverged fits; do not promote |
| Raise iteration or confidence thresholds | Might change acceptance counts | Does not demonstrate better decisions; do not tune against this sample |
| Evaluate query-local references against an exact control | Directly tests whether restoring nearest evidence changes distinction | Requires bounded computation and matching calibration-time selection; next |

**Next: evaluate query-local neighbor calibration with an exact full-corpus
control.** Reuse the existing nearest-description scorer and fold infrastructure.
Cache bounded per-fold neighbor results, exclude each scored training description
before retrieval, and use the same selection rule for calibration and evaluated
queries. Preflight CPU/memory cost and defer safely if the current budget cannot
support a run; do not just enlarge the sample or raise thresholds.

Measure distinction and accepted gains/losses separately from retrieval recall.
This experiment establishes a coverage gap, but does not yet establish that it
causes the 27 withheld distinctions. The purpose of the next comparison is to
resolve that causal question, not add another operator acknowledgement or panel.
