# Learned-evidence review resolution: outcome

## Result and promotion decision

The implemented resolver qualified **147 of 248 AI comparisons**, compared with
**two** under existing consensus. Both paths consumed each identical parsed AI
response. Of the 147 potential resolutions, **146 agreed with observed library
placement and one differed**. None of the two baseline cases was lost.

This is promising evidence for less user involvement, not verified 99.3%
classification accuracy. The cohort has no independent correctness labels, and
nearest-neighbor unanimity alone does not reject out-of-distribution items.
**Live routing is unchanged in this commit.** No threshold was lowered, score
raised, routing receipt created or media item moved by the evaluator.

The rationale, official research, alternatives and recommendation stack are in
[the design document](learned-evidence-review-resolution-design.md).

## Implemented component

- `learnedEvidenceReviewScope.mjs` separates known soft review reasons from
  selected-policy conflicts, unknown constraints, hard exclusions and invalid
  candidate/provider scope.
- `learnedEvidenceReviewResolver.mjs` compares all eligible libraries. The
  proposed library must own the three closest distinct, unshared descriptions
  and have the strongest positive learned metadata fit. Library names and
  generated confidence never determine this result.
- `learnedEvidenceReviewReport.mjs` reports paired eligibility and weak-label
  agreement by media type and anonymous library stratum.
- `policyCandidateProposalAuthority.mjs` shares the unchanged local-proposal
  predicate with existing consensus instead of duplicating it.
- Fresh evaluation reuses the full-pool evidence already retrieved during
  shortlist preparation. There are no additional retrieval or model calls for
  the second resolver, and no new settings, acknowledgement or UI panel.

The pure resolver returns `wouldResolve`, never routing authorization. Its
production promotion is deliberately separate from implementing and evaluating
the decision rule. Existing live consensus still requires its configured policy
threshold and fresh server-owned receipt.

## Paired local Compose evaluation

Run on September 12, 2026, using the existing command:

```text
docker compose exec -T -e LOG_LEVEL=fatal -e FILE_LOGGING_ENABLED=false classifarr node src/scripts/runInventoryDescriptionBenchmark.mjs --fresh-policy-evaluation --seed classifarr-profile-20260912 --size 300 --exclude-prior-sizes 100,200,300,300 --folds 5 --generate-cases 300 --context 32768 --max-minutes 120
```

The 300 cases contain 172 movies and 128 TV items, split into five grouped folds
of 60. All ten libraries supply training/candidate evidence. Only seven have
unused items left for this additional cohort; three small libraries have zero
new test cases. This is not independent test coverage of all ten libraries.

Held-out identities and synopsis copies are excluded from training and retrieval.
The four earlier cohort sizes are replayed in order, not combined into one
sample. The sample and fold fingerprints match the preceding evaluation.

| Measure | Existing consensus | Learned review hypothesis |
| --- | ---: | ---: |
| Evaluated AI proposals | 248 | 248 |
| Qualified comparisons | 2 | 147 |
| Additional potential resolutions | — | 145 |
| Qualified cases agreeing with placement | 2 | 146 |
| Qualified cases differing from placement | 0 | 1 |
| Baseline cases lost | — | 0 |
| Live automatic routes authorized by evaluation | 0 | 0 |

The hypothesis qualifies 59.3% of admitted comparisons and would remove 145 of
the baseline's 246 unresolved comparisons (58.9%), **if separately validated and
promoted**. These are not measured live review reductions. The remaining 101
comparisons retain review: 88 have competing description neighbors and 13 lack
agreement from learned metadata.

Fourteen qualified proposals differ from the policy leader: ten movies and four
TV items. All fourteen agree with observed placement. This demonstrates that the
resolver is not merely rewarding the existing top policy score.

| Media / observed-library stratum | Sampled | AI proposals | Qualified | Agree with placement | Differ |
| --- | ---: | ---: | ---: | ---: | ---: |
| Movies, total | 172 | 144 | 83 | 82 | 1 |
| Movie 2 | 43 | 41 | 18 | 18 | 0 |
| Movie 3 | 43 | 32 | 26 | 26 | 0 |
| Movie 4 | 43 | 41 | 22 | 21 | 1 |
| Movie 5 | 43 | 30 | 17 | 17 | 0 |
| TV, total | 128 | 104 | 64 | 64 | 0 |
| TV 8 | 42 | 39 | 23 | 23 | 0 |
| TV 9 | 43 | 31 | 17 | 17 | 0 |
| TV 10 | 43 | 34 | 24 | 24 | 0 |

Strata 1, 6 and 7 have no new sampled items. Strata describe observed libraries,
not newly assigned destinations. The one qualified placement disagreement is in
movie stratum 4 and agrees with the policy leader; without an independent label
we cannot determine whether the proposal or the existing placement is wrong.

The full proposal pool still has 225/248 placement agreement and 41 policy-leader
disagreements. Eight sampled placements are absent from the policy-eligible pool;
three admitted cases omit the observed placement from the AI shortlist. This
resolver cannot restore excluded destinations or make those recall gaps vanish.

## Cost, freshness and reproducibility

- 248 actual generation calls, all producing valid proposals; no failed,
  malformed, output-limited or abstained responses in this completed run.
- Mean generation latency: 1,855.57 ms. Prompt tokens: 663,576; output tokens:
  3,623. These timings are descriptive, not an isolated performance benchmark.
- Five policy-auto cases, 16 verify cases and 31 abstain cases did not enter AI
  adjudication. The new resolver does not widen invocation modes in this change.
- Model: `gemma4:e4b`; context 32,768, temperature 0, seed 42, thinking off.
  Embeddings: `mxbai-embed-large:latest`, 1,024 dimensions. Both model digests
  match the preceding run and were rechecked during execution.
- Background metadata and observed-trait refresh occurred after inputs were
  frozen. `evaluationSnapshotValid=true`, `sourceVerified=false`, and
  `liveMetadataRefreshed=true` explicitly distinguish a valid frozen experiment
  from a fresh live-routing decision. Other source/model changes still invalidate
  the experiment.
- Aggregate output is retained locally in the ignored
  `.tmp/learned-review-evaluation-completed.json`. Private case evidence and
  provider response text are not committed.

```text
sample: ca0cb510c117061372a669e58a69fca6975f1f4a50c2b5da6ff26cf9742784ba
folds: 77cb7990b67c02ab7db01bb764334910af9e744d4df04ad8979aa78f98bbe7f3
source: 5a5e50af06b4fb918114edfc70ebf6945a9dad6668a2306cf31ba1de75e78c76
evidence: fa1a095ecb715913930cb8b2d9c99e78bff9f3b915a526e4b29d03ddd0331ecc
model: c6eb396dbd5992bbe3f5cdb947e8bbc0ee413d7c17e2beaae69f5d569cf982eb
embedding: 468836162de7f81e041c43663fedbbba921dcea9b9fefea135685a39b2d83dd8
```

## Validation

- Focused regression: 15 suites, 290 tests passed, covering the new resolver,
  existing consensus, route safety, replay and fresh evaluation.
- New-service coverage: 100% statements, branches, functions and lines across
  the three learned-review modules and shared proposal-authority predicate.
- Final focused coverage across all nine changed service modules: 99.18%
  statements/lines, 97.89% branches and 97.61% functions; nine suites and 229
  tests passed.
- Local database integration: three suites and 49 tests passed, including policy
  evaluation, retained replay and deterministic routing acceptance.
- Repository code health: 24,049 checks passed.
- Backend typecheck, changed-file ESLint, static ESM imports and ESM mock-shape
  checks passed. Full backend/client coverage sweeps and the repository-wide
  coverage ratchet were not rerun for this scoped change; the focused coverage
  report is separate and does not overwrite the existing full reports.
- Local Compose rebuilt and healthy; the full paired benchmark completed there.
  The four new service hashes match the running container. Markdown lint and
  the final whitespace/diff check completed without issues.
- The production-naming gate still fails on the same 26 pre-existing references
  against its zero-reference baseline. No baseline or CI gate was relaxed.

## Next high-value component

Follow-up: the [library match baseline design](library-match-calibration-design.md)
implements the separate reference/calibration/test split in the frozen evaluator.
Its [outcome](library-match-calibration-outcome.md) records the measured effect.
This is not yet a production background scheduler or live promotion.

Implement **per-library novelty calibration**: learn the normal range of
description-neighbor distances from each library's own grouped training items,
then reject incoming items that are merely closer to that library than the
alternatives but unlike its actual contents. Compute it in the background from
existing vectors, excluding self/duplicate matches, and invalidate it when the
embedding representation or inventory changes. No library-name rules or manual
purpose declarations are needed.

Evaluate that component on a separate calibration/evaluation split and inspect
the qualified placement disagreement before enabling this resolver in the live
fresh-revalidation path. Keep independent outcome labels separate from inferred
inventory labels; automatic collection of ordinary corrections can improve that
evidence without adding a setup questionnaire. No label-free test can establish
the actual classification error rate.

## Pull requests and release scope

Two GitHub MCP searches on September 12 returned no open pull requests for
`cloudbyday90/Classifarr`. There was no random open PR to implement locally; no
unrelated repository or closed PR was substituted. No PR was merged. This change
updates Unreleased only and creates no release, version bump or release tag.
