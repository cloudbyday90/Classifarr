# Independent inventory content-fit outcome

Date: 2026-09-19

## Implementation

Implemented the separate [design](independent-inventory-fit-design.md) as an
explicit read-only benchmark mode. Small ESM modules own the single-candidate
contract and shared inference validation. The existing benchmark retains the
compact mode unchanged and reuses its holdouts, source checks and admission.

The independent mode uses raw examples, bounded exact fit grades, deterministic
tie abstention, real repeated inference and aggregate grade-disagreement counters.
It introduces no production routing change, UI acknowledgement, API, schema
migration, provider fallback, model download or release.

## Local Compose result

Completed the comparison using the existing installed local models and this
read-only command inside the rebuilt Compose container:

```sh
node src/scripts/runInventoryDescriptionBenchmark.mjs \
  --seed classifarr-profile-20260912 --size 300 --folds 5 \
  --multi-scale-ai --independent-fit --generate-cases 100 --context 32768 \
  --exclude-prior-sizes 300,300,100,100,300,300,300 --max-minutes 60
```

Protocol `inventory_independent_fit_v1` completed with 800 valid calls, 100 complete
pairs, no response failures, no context-budget failures and no sample/generation
shortfall. All five folds were available. Source verification passed with no
changed components; consumed source hashes, sample, generation prefix, embedding
and generation-model identities exactly match the preceding compact experiment.

| Measurement | Raw control | Independent assessments |
| --- | ---: | ---: |
| Calls / valid responses | 200 / 200 | 600 / 600 |
| Stable selections | 75 | 29 |
| Stable abstentions | 1 | 36 |
| Changed decisions between passes | 24 | 35 |
| Stable selections agreeing with inventory placement | 61 | 25 |
| Input tokens | 223,278 | 251,652 |
| Output tokens | 1,201 | 3,600 |
| Summed generation latency, ms | 55,884 | 81,645 |

Independent assessment used three times the calls, 12.7% more input tokens and
46.1% more summed generation latency in this run. Single-run timing is not a
general performance guarantee. Its instability is repeat/example-order
sensitivity; raw instability is measured under reversed candidate order. These
are related robustness checks, not identical causal interventions.

Of 300 candidate assessments compared across passes, 58 grades changed (19.3%),
affecting 49 cases. Final decisions changed in 35 cases. Grade counts across all
600 responses were 36 at grade 0, 194 at grade 1, 314 at grade 2 and 56 at grade 3.
No candidate was empty. A deterministic aggregator therefore does not imply
stable semantic judgments, and a valid JSON response does not establish truth.

For movies, changed decisions were 15 raw versus 19 independent; for TV, 9 versus
16. Among cases where both arms were stable, 26 changed outcome, including one
gained and 18 lost placement agreements. This includes selection-to-abstention
changes, not just moves between destinations. Placement agreement is not accuracy:
independent labels remain zero, accuracy unknown and live promotion disallowed.

### Scope and provenance

- Source: 6,655 identity documents, 6,652 descriptions/vectors and 10 libraries.
- Prepared cohort: 300 descriptions, 172 movies and 128 TV items; 1,700 prior
  descriptions excluded. Generation prefix: 58 movies and 42 TV items.
- Seven libraries contributed held-outs; three strata had no eligible remaining
  samples after exclusions. Do not claim every library received a measured case.
- Each prepared case retained the unchanged raw shortlist; one observed placement
  was outside that shortlist. Both arms consumed raw examples, not compact ones.
  Compact preparation counters remain diagnostics of the reused preflight only;
  the report explicitly sets `compactEvidenceConsumed: false`.
- Sample fingerprint:
  `ad63320ed17b1c413293a6b801a73dbcc5dd017ec65394da67ae67907bd2f12c`.
- Generation-prefix fingerprint:
  `fb8007cae79621eea81854d20d8e5d6737d2e15a55f95182bcedce2ee58369be`.
- Embedding: `mxbai-embed-large:latest`, 1,024 dimensions, digest
  `468836162de7f81e041c43663fedbbba921dcea9b9fefea135685a39b2d83dd8`.
- Generation: `gemma4:e4b`, digest
  `c6eb396dbd5992bbe3f5cdb947e8bbc0ee413d7c17e2beaae69f5d569cf982eb`.

The raw control returned to 24 changed decisions versus 25 in the preceding run,
despite identical input/model identities. Fixed seed and temperature zero do not
eliminate inference variability. The frozen exploratory cohort must not become a
parameter-tuning target or be presented as independent validation.

Fold fitting took 29.422, 59.974, 63.637, 56.784 and 57.172 seconds. The container's
peak memory was 1,803,341,824 bytes under its unchanged 2 GiB limit, with zero
memory-limit hits, OOM kills or restarts at measurement completion. It remained
healthy on a read-only root filesystem. Admission and background services stayed
enabled; host test/build workloads did not overlap the measured comparison.

## Verification

- Focused unit and CLI checks: 8 suites, 122 tests passed.
- Real PostgreSQL integration checks: 3 suites, 22 tests passed.
- Lint, server/client type checks, copyright/dependency preflight, ESM import and
  mock-shape checks passed. Documentation lint passed across 1,378 files.
- Full backend coverage run: 1,329 suites / 38,665 tests passed in 433.938 seconds,
  without concurrent host builds or other test suites. Both new service modules
  have 100% statement, branch, function and line coverage. The coverage ratchet
  passed (server 90.25% lines / 83.21% branches). The frontend has no source
  changes; the preceding full client run passed 369 files / 5,128 tests, and this
  image rebuilt the client successfully. The unchanged client coverage report
  remains 87.67% lines / 77.54% branches; it was not regenerated in this turn.
- The separate production-naming gate still reports the pre-existing 43 temporary
  references against a zero baseline. This work does not add or waive references.

The preceding commit's CI/CD, CodeQL, Gitleaks, OSV, Trivy and copyright workflows
all completed successfully. GitHub MCP returned no open PRs at the start of this
work; no random PR was available to implement and no PR was merged.

## Final recommendation stack

1. **Do not promote independent grading.** It produced fewer stable selections,
   more changed decisions and greater cost. Preserve the versioned result rather
   than lowering thresholds or hiding abstentions to manufacture improvement.
2. **Next: a bounded, deterministic learned content-fit ranker.** Compare a small
   regularized linear model over existing description vectors with the existing
   organic metadata profile and raw-neighbor baselines. Discover candidate classes
   from current libraries, not names or hard-coded genres. This tests whether
   learnable content boundaries can replace repeated generative judgments.
3. Fit only within training folds, exclude shared/conflicting identities and
   self-generated decisions as labels, and treat inventory membership as noisy
   observational supervision, not ground truth. Evaluate class balance, empty
   strata, unseen content, abstention, label-noise sensitivity and untouched cases.
   Do not describe classifier outputs as verified routing confidence.
4. If supported by validation, reuse bounded background refresh, source revisions,
   SWR last-known-good state and rollback for automatic relearning after inventory
   changes. No manual purpose declaration or per-library training acknowledgement
   should be added. Live adoption is a separate change, not authorized by this run.

The next model is a proposal, not implemented here. It differs from the existing
[organic profile](organic-library-profile-design.md), which learns smoothed
metadata frequencies: the proposed ranker would learn discriminative weights on
description embeddings. Benefit: fixed-input ranking needs no generative calls;
cost: training, regularization and noisy-label risks need independent evaluation.

Official [regularized logistic-regression documentation](https://scikit-learn.org/stable/modules/generated/sklearn.linear_model.LogisticRegression.html)
describes the model family and class weighting; official
[leakage guidance](https://scikit-learn.org/dev/common_pitfalls.html) supports
training-only preprocessing and held-out evaluation. These sources were discovered
and opened on 2026-09-19. They support an experimental direction, not a claim that
this model will improve Classifarr. No Python dependency or implementation is
introduced; any implementation must retain the repository's modular ESM contract.
