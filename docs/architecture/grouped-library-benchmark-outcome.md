# Grouped library benchmark outcome

## Scope

Implementation follows [the grouped evaluation design](grouped-library-benchmark-design.md).
The new component evaluates additional items without routing or moving them.
It does not train model weights or treat existing library placements as verified
answers. Validation and local experiment results are recorded below as they
complete.

## Local procedure

Use the installed local embedding and generation models with the existing cache.
Run on the rebuilt Compose service with read-only database sessions:

```powershell
docker compose exec -T -e LOG_LEVEL=fatal -e FILE_LOGGING_ENABLED=false `
  -e 'PGOPTIONS=-c default_transaction_read_only=on -c statement_timeout=15000 -c lock_timeout=1000' `
  classifarr node src/scripts/runInventoryDescriptionBenchmark.mjs `
  --seed classifarr-profile-20260912 --size 300 --exclude-prior-sizes 100,200 `
  --folds 5 --generate-cases 300 --context 32768 --max-minutes 20 --learned-profiles
```

Omit `--generate-cases 300` for the read-only preflight. Compare the reconstructed
prior cohort fingerprints with earlier reports before generating. A changed
inventory may change seeded cohorts; do not claim historical disjointness solely
from a same-seed rerun on a changed snapshot.

## Sample and training coverage

Preflight selected **300 additional distinct descriptions: 144 movies and
156 TV shows**, with no overlap with the prior 300 descriptions. Both historical
sample fingerprints matched the earlier reports:

- Earlier 100: `8917b00674e5ec5116e628c42c3a02191c22aad983b0611c0ba516849f9d89d9`.
- Earlier 200: `6d0331ca6462abb62518d55e4aedc7ec7783269d59e15b3b696738a8422b4f1d`.
- New 300: `6a35df4dfced22a5c8f7a608ae26cdfac8db6316f386328be451463f76a040ce`.
- Grouped snapshot: `ff30d1a86bd603a98a21dbcbf9522b07514e3e412e550425a958a07d337c1de0`.
- Fold assignment: `49e220b946dfd7e8e019491b374fa3050399808ca67d6e5a125ea32fc086a784`.

Five folds contain 60 test descriptions each. All ten active libraries retain
training examples in every fold; each learned profile uses 6,582–6,583 usable
training descriptions. Metadata is unavailable or conflicting for one or two
training descriptions per fold; none of the new query metadata is missing.

Nine libraries contribute new test items. The smallest movie library has only
29 eligible descriptions, all already used in earlier cohorts. Repeating those
would not satisfy "additional"; all 29 remain available for comparison and
training. This run therefore does **not** provide new test performance for that
library. The following anonymous strata follow the report's stable ID ordering;
they are not hardcoded library categories.

| Stratum | Media | Inventory descriptions | New sampled memberships | Minimum training per fold |
| --- | --- | ---: | ---: | ---: |
| 1 | Movie | 29 | 0 | 29 |
| 2 | Movie | 530 | 36 | 522 |
| 3 | Movie | 396 | 36 | 388 |
| 4 | Movie | 1,240 | 36 | 1,232 |
| 5 | Movie | 2,809 | 36 | 2,801 |
| 6 | TV | 45 | 15 | 42 |
| 7 | TV | 67 | 35 | 60 |
| 8 | TV | 267 | 35 | 260 |
| 9 | TV | 299 | 35 | 292 |
| 10 | TV | 964 | 37 | 956 |

Membership counts can exceed distinct title counts because shared descriptions
may belong to multiple libraries. All such copies stay out of their own test
fold's training data. The prepared 300-case shortlist contains an observed
destination in every case; description-only selection missed two, recovered by
learned metadata. Shortlist inclusion is not a successful final classification.

## Same-200 protocol check

Re-preflighting the exact previous 200-item cohort with five folds retained
25–26 training descriptions in the small movie library, versus zero under the
previous all-held-out protocol. All ten profiles trained successfully. The
learned shortlist missed observed placement for two cases, versus 19 previously.
Description-only selection missed six; metadata recovered six but introduced
two other misses. This is an evaluation-protocol comparison, not a live routing
or verified accuracy improvement. No additional AI generations were requested
for this preflight.

## Validation

- Full backend coverage: 1,230 suites and 35,000 tests passed in 562 seconds.
  Coverage: 90.01% statements/lines, 81.39% branches, 92.10% functions.
- Latest targeted run: five suites and 66 tests passed, including the maximum
  300-case/900-comparison budget and per-library missing-example accounting.
- Real PostgreSQL integration: one suite and seven tests passed, including
  grouped holdouts using the existing read-only snapshot/cache path.
- Backend/frontend lint and typechecks, ESM static import/mock-shape checks,
  and documentation lint passed. No new dependencies or schema migrations.
- Compose rebuilt the frontend and backend and became healthy. Four benchmark
  module hashes matched the workspace. Client behavior was unchanged; the full
  frontend unit suite was not rerun for this backend evaluation-only change.
- The existing production naming gate remains blocked at 26 references versus
  its zero baseline, unchanged from the previous commit. No gate was weakened;
  these results are not a claim that every CI gate is green.

The coverage ratchet passed without lowered baselines. It used the new backend
report and the existing, unchanged-client coverage report.

## Completed 300-item AI experiment

All 900 comparisons completed successfully. Final snapshot, sample, prior-cohort
and fold fingerprints matched preflight. Every arm proposed a destination for
all 300 items, with zero failures, abstentions, invalid responses, missing-example
skips, output-limit events or suspected context-limit events. Input truncation
remains unknown; no undocumented tokenizer guarantee is inferred.

| Retrieved examples | Agreement with observed placement | Mean generation latency | p95 latency | Mean input tokens |
| --- | --- | ---: | ---: | ---: |
| 9 | 243/300 (81.0%) | 290.39 ms | 358 ms | 808.57 |
| 30 | 243/300 (81.0%) | 361.76 ms | 512 ms | 2,191.86 |
| 100 | 242/300 (80.7%) | 847.31 ms | 1,109 ms | 6,747.31 |

The 30-example arm changed eight proposals relative to nine examples without
net agreement improvement. The 100-example arm changed 17 proposals and had
one fewer agreement. Its mean input token count was 8.34 times the nine-example
arm, and mean generation latency was 2.92 times higher. Full-suite tests ran
alongside the experiment; these latency values are local observations, not
isolated performance guarantees. The nine-example arm also included a 7,463 ms
maximum latency, while the other arms peaked at 793 ms and 1,328 ms.

Per-library agreement counts below use sampled item memberships. A shared item
can count in more than one row; the overall denominator remains 300 distinct
items. These are not verified classifications.

| Stratum | Sampled memberships | 9 examples | 30 examples | 100 examples |
| --- | ---: | ---: | ---: | ---: |
| 1 | 0 | Not evaluated | Not evaluated | Not evaluated |
| 2 | 36 | 28 | 28 | 30 |
| 3 | 36 | 35 | 34 | 34 |
| 4 | 36 | 27 | 27 | 26 |
| 5 | 36 | 34 | 33 | 34 |
| 6 | 15 | 8 | 8 | 9 |
| 7 | 35 | 16 | 17 | 15 |
| 8 | 35 | 29 | 29 | 27 |
| 9 | 35 | 30 | 32 | 32 |
| 10 | 37 | 37 | 36 | 36 |

The installed generation model was `gemma4:e4b`, digest
`c6eb396dbd5992bbe3f5cdb947e8bbc0ee413d7c17e2beaae69f5d569cf982eb`.
Configuration: context 32,768, temperature zero, seed 42, thinking disabled,
64-token output limit. Embeddings were `mxbai-embed-large:latest`, 1,024 dimensions,
digest `468836162de7f81e041c43663fedbbba921dcea9b9fefea135685a39b2d83dd8`.
Only installed local providers and the existing cache were used; no paid
fallback, model pull, routing grant, policy edit or media move was performed.

## Recommendations after measurement

| Recommendation | Pros | Cons / boundary |
| --- | --- | --- |
| Keep grouped evaluation as the explicit benchmark protocol | All ten libraries retain training evidence; each query remains held out | Historical all-held-out scores are not directly comparable |
| Keep nine examples as the low-cost baseline | Same aggregate agreement as 30; substantially fewer tokens | Some individual decisions differ at larger budgets |
| Investigate contrastive library-boundary evidence next | Targets remaining semantic disagreements after shortlist coverage reaches 300/300 | Observed placement may itself be wrong; needs separate validation |
| Do not globally switch to 100 examples | Avoids extra cost without demonstrated aggregate benefit | A few individual library strata improved and deserve focused investigation |

Final recommendation stack: **grouped evaluation → automatic disagreement
analysis → contrastive retrieval/reranking → independently validated routing
changes**. Prioritize TV strata 6 and 7: their agreement remains low at every
context budget. Compare representative positive and alternative-library examples
using current descriptions and metadata, and test whether library names bias
the comparison. Do not hardcode those library names or turn the model's own
answer into a trusted training label.

The design's proposed adaptive nine-to-30 budget is now a secondary experiment,
not the immediate production recommendation: this cohort showed no net benefit
from 30. The next component should find what distinguishes the confused
libraries organically, with no new declaration forms or mandatory user prompts.
There are zero independent labels in this experiment, so accuracy and an
automatic-routing threshold improvement remain unproven.

## Pull requests

GitHub MCP search returned no open PRs for `cloudbyday90/Classifarr` on
September 12, 2026, both before implementation and at final verification.
No random PR was available to implement. None was merged. Changelog entries
remain under Unreleased; no release, tag or version bump is created.
