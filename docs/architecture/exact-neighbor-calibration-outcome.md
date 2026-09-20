# Exact-neighbor calibration outcome

## Implementation on 20 September 2026

Implemented the [exact-neighbor design](exact-neighbor-calibration-design.md) in two
small ESM services: bounded scalar score reuse and full eligible-pool calibration.
They share the existing privately copied corpus with the sampled comparison arms.
No library names or content categories are hard-coded. Movie/TV scope and explicit
library membership determine which examples can participate, not their labels.

The benchmark now reports `inventory_leader_challenge_v5`, a separately versioned
`library_neighbor_exact_cross_fit_v1` arm, and aggregate cache resource use. The
existing CLI runs the comparison automatically; no new operator configuration,
confirmation, UI panel, HTTP endpoint, migration, dependency, or provider call was
added. Live routing, policy vetoes, familiarity calibration and tail thresholds
remain unchanged. This commit does not release or version the application.

## Snapshot-verified local comparison

A read-only Compose run completed on 300 descriptions: 150 movies and 150 TV shows,
ten library strata, five whole-description held-out folds. All arms used one
frozen source and the same nominations. Final source verification passed with no
changed components, no generation calls and no routing receipts.

| Measure | Ordered sampled references | Representative sample | Exact eligible references |
| --- | ---: | ---: | ---: |
| Accepted nominations, including vetoed cases | 4 | 4 | 6 |
| Accepted unvetoed placement gains | 1 | 1 | 2 |
| Accepted unvetoed placement losses | 0 | 0 | 0 |
| Accepted hypothetical gains under veto | 3 | 3 | 4 |
| Accepted hypothetical losses under veto | 0 | 0 | 0 |
| Withheld: not distinguished | 27 | 27 | 25 |
| Withheld: challenger unfamiliar | 2 | 2 | 2 |
| Placement agreements after unvetoed changes | 229 | 229 | 230 |

There were 33 nominations, 284 reviewable samples, 16 not-reviewable samples and
249 unchanged policy vetoes. The untouched policy baseline agreed with 228
placements. Raw, uncalibrated challenges included three placement gains and one
loss; the exact acceptance arm admitted two gains and no losses.

The improvement is not uniform. Movie accepted nominations decreased from three
to two (one unvetoed gain in both); TV increased from one to four (zero to one
unvetoed gain). All four exact TV acceptances came from anonymous stratum 9. The
two exact movie acceptances came from strata 2 and 5. Do not describe the aggregate
increase as universal improvement, two necessarily additional identical-case
acceptances, or a validated increase in accuracy.

This establishes that reference truncation can affect calibrated acceptance in
this cohort, but it does not explain all abstentions: 25 nominations remain
undistinguished. More neighbors are not automatically better evidence of meaning.
Existing placements are weak labels; correctness, independent ground truth, and
unknown-content rejection remain unverified.

A second 300-item seed (`classifarr-crossfit-20260920`) was attempted but deferred
with `busy` because another discovery job owned the shared lock. It produced no
evaluation result and is not counted as a replication. The gate was not bypassed.

## Resource and recovery evidence

The exact arm computed 1,200,022,528 vector components, below its unchanged
two-billion work ceiling. It retained 356 scalar-cache rows containing 2,368,112
Float64 slots (18,944,896 bytes), below the four-million-slot limit, and reused
3,743,714 pair scores. Reuse does not cache fold membership: each scan reapplies
the admitted reference set, and whole held groups and the query itself cannot
re-enter through a cache hit.

Preflight checks reject fits that cannot fit within the remaining work/cache
budgets before their distance work or allocations. Execution checks enforce the
same limits against concurrent work. Failed fits are evicted; immutable partial
pair values may be reused on a safe retry. There is no automatic limit increase
or approximate fallback. Existing discovery locking and memory-pressure gates
remain active, and scans yield for cancellation.

After the verified run, Compose was healthy, with a read-only root filesystem,
zero memory-limit failures and zero OOM kills. The observed cgroup peak was
1,402,028,032 bytes; this includes background application work and is not an
isolated measurement of this experiment.

## Reproduction

Use the existing local Compose image and run:

```powershell
docker exec -e LOG_LEVEL=fatal -e FILE_LOGGING_ENABLED=false -e 'PGOPTIONS=-c default_transaction_read_only=on' classifarr node src/scripts/runInventoryDescriptionBenchmark.mjs --seed classifarr-leader-20260920 --size 300 --folds 5 --leader-challenge --max-minutes 30
```

Verified sample fingerprint:
`87f58693d97f5e4e251b93bdb0ab7d6a1e1bcf909b99e32c404520e65bbe231a`.
Fold fingerprint:
`de91fbe9cbb1b6270c33ebc44f0d7961a021446a9cb63d60110174020d2776fa`.
Documents, vectors, metadata, configuration, policies, observed traits and
provenance matched the prior verified reference-coverage experiment. The embedding
representation was `mxbai-embed-large:latest`, 1024 dimensions, digest
`468836162de7f81e041c43663fedbbba921dcea9b9fefea135685a39b2d83dd8`.
Private console output remains under ignored `.tmp/`; do not commit library data.

## Validation and delivery

Validation passed:

- Focused tests: 22 suites, 264 tests.
- Complete backend coverage run: 1,348 suites, 39,199 tests (429.995 seconds).
- Database projection/vector-cache integration: three suites, 24 tests.
- Coverage ratchet: passed; backend statements/lines 90.28%, branches 83.40%,
  functions 92.41%. Both new runtime services have 100% statements/lines/functions;
  score-cache branch coverage is 96.49%, exact calibration 97.87%.
- Lint, type checks, dependency/copyright preflight and both ESM checks passed.
- Markdown lint: 1,390 documents, zero issues. Git whitespace checks passed.

The unchanged frontend uses its existing coverage artifact for the ratchet, not
a newly claimed frontend run. The pre-existing production-naming gate remains
blocked at 43 production references against a zero-reference baseline; no waiver
or baseline adjustment was made.

Unit coverage includes an independent brute-force calibration oracle with pools larger than the old
384-group split, cached/fresh fold equivalence, self/shared/held-group exclusions,
caller mutation, concurrent requests, cancellation/retry, sparse rivals, invalid
scope, explicit acceptance versions, preserved vetoes and resource limits.

GitHub's open-PR collection was empty when checked. No random open PR could be
selected, and none was substituted or merged. The previous commit's build/test,
database tests, release acceptance readout and security workflows passed; release
and publication jobs were skipped.

## Final recommendation stack and next item

Keep validated inventory → provenance-clean grouped folds → exact nearest examples
→ library-relative calibration → unchanged policy safeguards. Keep the exact arm
evaluation-only until its rejection behavior and reproducibility are tested.

| Choice | Pros | Cons / recommendation |
| --- | --- | --- |
| Keep bounded exact retrieval as the evaluation control | Removes reference-sampling blind spots; modest observed gain | Higher compute; gains concentrated in one TV stratum; keep |
| Promote it to live routing now | Could reduce some reviews | No independent correctness or unknown-content rejection evidence; do not promote |
| Increase thresholds or sample size immediately | Easy to change | Does not address incorrect acceptance or prove generalization; defer |
| Automated rejection and corruption challenge suite | Tests safe behavior with unfamiliar, conflicting or stale evidence without user setup | Negative controls are not a substitute for semantic labels; next |

**Next: add automated negative-control evaluation for the exact-neighbor path.**
Test missing/contradictory identities, corrupted or changed representations,
unrelated descriptions and held-out content groups, alongside ordinary movie/TV
cases. Distinguish integrity failures (must reject) from semantically unfamiliar
content (measure abstention; do not invent ground truth). Report false acceptance,
retained placement gains, cancellation/retry and snapshot invalidation separately.
Use library-agnostic fixtures and frozen comparisons, not category-name rules or
another approval screen. Independent semantic labels are still required before
claiming routing accuracy or relaxing safety gates.

The follow-up is now implemented in the
[neighbor rejection evaluation design](neighbor-rejection-evaluation-design.md),
with results recorded in its [outcome](neighbor-rejection-evaluation-outcome.md).
