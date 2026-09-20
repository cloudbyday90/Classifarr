# Small-library familiarity cross-fitting: outcome

## Outcome on 20 September 2026

Implemented the [cross-fit design](library-familiarity-cross-fit-design.md) as
an explicit evaluation mode. It removes the observed small-library calibration
gap without lowering the minimum reference count. It does **not** materially
increase automated routing: live routing is unchanged, and most nominations still
lack calibrated distinction from competing libraries.

The existing split baseline remains the factory default. New code is ESM and
modular: a pure numeric kernel, a bounded mode on the existing snapshot factory,
and a third paired arm in the existing leader-challenge runner. No frontend, API,
database schema, dependencies, AI provider or application configuration changed.

## What was verified

- Cross-fit familiarity can assess 21–39 training description groups. Every
  calibration item is absent from its own references, and the outer held-out fold
  remains absent from all training and calibration queries.
- Calibration queries and the evaluated query use equal reference counts, capped
  at 256. At most 257 description groups and 128 calibration queries are retained.
- Retained decisions, shared descriptions and conflicting metadata remain excluded.
  Identity copies cannot bypass whole-description exclusion.
- Separate version admission prevents cross-fit results from silently satisfying
  the default split-baseline validator or existing live familiarity checks.
- Work limits, 20-fold caching, a 20-million-component cross-fit model memory bound,
  cancellation, failed-fit eviction and source-drift invalidation remain enforced.
- Collapsed or undersized distributions abstain. No confidence probability,
  conformal coverage guarantee or routing receipt is produced.

## Local Compose results

Two 300-item samples each included 150 movies and 150 TV shows across all ten
library strata, using five whole-description held-out folds. Sample A replays the
preceding balanced cohort; sample B uses a second seed. These samples **overlap**,
especially in small libraries, and must not be presented as 600 independent labels.
Existing placement is a weak evaluation label, not verified correctness.

Both runs completed with `sourceVerified: true` and no within-run source changes.
Metadata and observed-trait digests differed between runs, so this is a practical
second-sample stability check, not a seed-only controlled experiment. Each run's
three arms use exactly the same frozen source. No generation calls were made.

### Acceptance and coverage

| Result | A: split | A: cross-fit | B: split | B: cross-fit |
| --- | ---: | ---: | ---: | ---: |
| Raw nominations, including vetoed | 33 | 33 | 43 | 43 |
| Sparse-incumbent blocks | 15 | 0 | 15 | 0 |
| Accepted nominations, including vetoed | 3 | 4 | 7 | 7 |
| Challenger unfamiliar | 0 | 2 | 2 | 2 |
| Not distinguished from alternatives | 15 | 27 | 19 | 34 |
| Accepted unvetoed gains | 1 | 1 | 2 | 2 |
| Accepted unvetoed losses | 0 | 0 | 0 | 0 |
| Accepted hypothetical gains under veto | 2 | 3 | 5 | 5 |
| Accepted hypothetical losses under veto | 0 | 0 | 0 | 0 |

Sample A has 284 reviewable comparisons and 249 unchanged policy vetoes. The
policy baseline agrees with 228 observed placements; both acceptance arms agree
with 229. Its raw nomination arm had three unvetoed gains, one loss and one
neither-destination agreement. The additional cross-fit hypothetical gain is in
anonymous TV stratum 8; the other accepted hypothetical gains are in movie
stratum 5, and the unvetoed gain is in movie stratum 2.

Sample B has 288 reviewable comparisons and 251 unchanged policy vetoes. The
policy baseline agrees with 227 observed placements; both acceptance arms agree
with 229. Its raw arm had three unvetoed gains and one loss. Cross-fit accepts two
unvetoed gains in movie stratum 2 and hypothetical gains in movie stratum 5 (two)
and TV stratum 9 (three). No accepted loss appears in any library stratum in either
sample. This limited observation does not establish future safety or accuracy.

Small-library nominations are now assessable rather than automatically blocked
by sample size. That does not make them acceptable: the separate distinction check
still rejects unsupported proposals. All policy vetoes remain active and no
benchmark proposal is actually applied.

### Reproduction

Protocol `inventory_leader_challenge_v3` retains `comparison` (raw) and
`acceptanceComparison` (split), and adds `crossFitAcceptanceComparison`.

```text
docker exec -e LOG_LEVEL=fatal -e FILE_LOGGING_ENABLED=false -e 'PGOPTIONS=-c default_transaction_read_only=on' classifarr node src/scripts/runInventoryDescriptionBenchmark.mjs --seed classifarr-leader-20260920 --size 300 --folds 5 --leader-challenge --max-minutes 30
```

For sample B, replace the seed with `classifarr-crossfit-20260920`. Private aggregate
logs are `.tmp/crossfit-all-libraries.log` and `.tmp/crossfit-stability.log`; neither
is committed. No private descriptions, titles or destination IDs enter the reports.

| Integrity field | Sample A | Sample B |
| --- | --- | --- |
| Sample fingerprint | `87f58693d97f5e4e251b93bdb0ab7d6a1e1bcf909b99e32c404520e65bbe231a` | `8198e2b875429f8304e49a28375b1048736f62e3e61a9dce8ab2edb24a085c67` |
| Fold fingerprint | `de91fbe9cbb1b6270c33ebc44f0d7961a021446a9cb63d60110174020d2776fa` | `10dd01a5b0dc12889cb0b625d7cbb292b8c128323af16d9d910ae4adb85662a1` |
| Metadata digest | `0012566f72f69718497ed65c07a91d9edf77b71da620d72905fdba0b8c1dcc3e` | `c7ab5c24764699b75339f9558bea11acbf779290e2598ef0d1a998edc40feb5e` |

Both runs used the cached 1024-dimensional `mxbai-embed-large:latest` representation
with digest `468836162de7f81e041c43663fedbbba921dcea9b9fefea135685a39b2d83dd8`.
Vector digest: `49fe5be63dac7f7a49cc94a46fe046f7f4294f5d4eb62072f8274586778eb5b9`.
Provenance digest: `0a06355a860e2da958b20df5144a986666fbb062c698df9811a4d4ae37e1afeb`.

## Verification and engineering notes

- Focused verification: 11 suites, 197 tests passed, including independent numeric
  oracle agreement, leakage contrast, minimum boundaries, source isolation,
  cancellation/retry, memory reservation recovery and explicit version admission.
- PostgreSQL integration: three suites, 24 tests passed.
- Full backend coverage run: 1,341 suites and 39,065 tests passed. Coverage ratchet
  passed; backend statement/line coverage is 90.27%, branches 83.36% and functions
  92.38%. The new numeric kernel has 100% coverage in all four measures. The client
  was unchanged; the ratchet reused its existing coverage report, not a new run.
- Lint, client/server type checks, copyright/dependency preflight and ESM checks passed.
- Markdown lint passed for 1,386 documents. Compose remained healthy after both
  runs, with zero restarts, memory-limit failures or OOM kills; observed cgroup peak
  memory was 1,354,014,720 bytes. This peak includes the running application, not
  only the benchmark.
- A first memory-bound test exercised hundreds of millions of numeric operations
  and timed out. It was replaced with an isolated, scaled reservation-limit fixture
  exercising the real numeric kernel. Production limits were not relaxed.
- Existing production-naming gate debt remains 43 references against baseline zero;
  no waiver or baseline change was added.
- GitHub's open-PR collection was empty: no random open PR was available to implement.
  No PR was merged and no release or version change is included.

## Final recommendation stack and next item

Follow-up: [neighbor-reference coverage outcome](neighbor-reference-coverage-outcome.md)
records the measured coverage gap and the representative-selection comparison.

1. Retain the provenance-clean, library-agnostic evidence path and grouped outer
   evaluation. Do not treat current placement or Classifarr's own decisions as truth.
2. Keep cross-fit familiarity as an evaluation option. It fixes sparse assessment
   here, but overlapping calibration samples and low accepted counts still require
   broader validation, including genuinely unknown-content controls.
3. **Next: improve and test calibrated neighbor-reference coverage.** The nomination
   uses nearest examples from the full admitted corpus, while neighbor calibration
   uses a fixed bounded reference sample (at most 64 per library). Compare a bounded
   diversity-aware or query-relevant reference selection against that control, with
   the same outer exclusions and per-query self-exclusion during calibration.
   Determine whether the reference sample misses relevant examples before changing
   thresholds. The mismatch is visible in code; its causal contribution to the
   27–34 distinction abstentions is not yet established.
   Reuse the [existing multi-scale retrieval](multi-scale-retrieval-outcome.md)
   and [cross-fitted neighbor calibration](cross-fitted-neighbor-calibration-outcome.md)
   modules. The new question is reference coverage in the numeric distinction
   check, not another retrieval service or another expansion of AI prompt examples.
4. Only after representative loss and unknown-content checks should a separately
   tested live advisory change separate comparison order from fallback identity.
   Never remove policy vetoes globally to inflate automation counts.

The practical tradeoff is better small-library coverage for additional bounded
CPU, not a demonstrated reduction in operator workload yet. No new user-facing
settings or acknowledgements are justified by these results.
