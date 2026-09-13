# Focused library fallback evaluation: outcome

Date: 2026-09-13

## What was evaluated

The original AI/RAG evaluation now includes actual local inference, not only
readiness checks. The existing 300-item snapshot contains 150 movies and 150 TV
shows across all ten libraries, with at least 30 sampled memberships per library.
One identity has multiple memberships, so membership counts exceed unique items.

All 23 adjudication-ready fallback targets were evaluated: ten movies and thirteen
TV shows. A second diagnostic pass repeated those 23 calls against the same
verified source and sample fingerprints and reproduced the aggregate outcomes.
Total local generation cost for these two passes was **46 calls**, not 23 unique
additional cases. Neither pass changed library contents, policies or routing.

| Result per pass | Movies | TV | Total |
| --- | ---: | ---: | ---: |
| Local AI proposals | 10 | 13 | 23 |
| Strict-only learned review resolutions | 0 | 0 | 0 |
| Additional selective fallback resolutions | 6 | 9 | 15 |
| Also pass library familiarity | 4 | 8 | 12 |
| Metadata disagreement | 2 | 4 | 6 |
| AI and description leader disagree | 2 | 0 | 2 |

The twelve fully qualified offline candidates all agree with existing placements.
They are **potential reductions in review**, not twelve newly routed items or a
measured accuracy improvement. There are no independent ground-truth labels.
The 168 strict-neighbor-supported items were not the generation targets; a zero
strict-loss count in this focused run cannot establish cohort-wide non-regression.

The first pass used 64,384 prompt tokens and 347 output tokens, with mean measured
generation latency of 2,397.65 ms. It used `gemma4:e4b`, a 32,768-token context,
temperature zero and seed 42; embeddings were `mxbai-embed-large:latest`, 1,024
dimensions. Installed model digests were checked throughout the run. Neither
snapshot verification reported drift or invalidation.

## What the remaining cases actually mean

The six metadata disagreements are **not caused by an absent genre, studio or
certification field**: every one has all three. This does not establish that the
metadata is correct or exhaustive. In five, the AI/description destination
has positive learned metadata fit, but another library scores higher. In the
sixth, the selected destination's metadata fit is slightly negative while an
alternative is positive. Two positive-fit gaps are relatively small (0.0518 and
0.0352), but these numbers are not probabilities and do not justify ignoring the
check. Rebuilding or fetching the same complete metadata is not an established
solution to this ranking disagreement.

Both AI/description disagreements choose the highest learned-metadata-fit
alternative. This is evidence of competing signals, not a malformed model reply;
one of the 23 AI proposals disagrees with existing placement. That placement may
itself be wrong, so neither side is treated as ground truth.

Three of the fifteen additional candidates fail the separate familiarity stage.
The current split needs at least twenty reference and twenty calibration
descriptions after query/fold exclusions. Small-library folds can support the
neighbor cross-fit comparison yet remain too small for this separate split.
This is insufficient evidence, not a demonstrated semantic contradiction.

## Code changes

The focused reporting service now distinguishes withheld familiarity states and
counts evaluated strict controls explicitly. It also includes strict-control
preservation/loss when those controls are supplied. This fixes an evaluation
blind spot without changing the classifier, thresholds, inference budget, API,
SWR behavior, UI or live fallback routing.

The latest [CI run](https://github.com/cloudbyday90/Classifarr/actions/runs/34761755955)
also exposed two test defects. The test-file closure heuristic rejected valid
Jest timeout syntax; it now parses ESM without linking or executing imports and
tests both complete and truncated examples. Reviewer-packet expectations now use
native path joining rather than Windows-only separators. These changes follow
the official [Node module parser](https://github.com/nodejs/node/blob/main/doc/api/vm.md)
and [path documentation](https://nodejs.org/api/path.html). Production timeouts
and resource ceilings were not weakened.

## Reproduction

```powershell
docker exec -e LOG_LEVEL=fatal -e FILE_LOGGING_ENABLED=false -e 'PGOPTIONS=-c default_transaction_read_only=on' classifarr node src/scripts/runInventoryDescriptionBenchmark.mjs --seed classifarr-profile-20260912 --size 300 --folds 5 --fresh-policy-evaluation --neighbor-fallback --generate-cases 23 --max-minutes 20
```

The CLI emits progress on stderr and aggregate JSON on stdout. A later inventory
snapshot can change target counts. Keep private diagnostic artifacts out of Git.
The [design](focused-library-fallback-evaluation-design.md) records sources,
security boundaries, alternatives and the final recommendation stack.

## Validation and delivery

- Full backend coverage regression: **1,270 suites and 36,682 tests passed**.
  Coverage was 90.09% lines/statements, 82.19% branches and 92.16% functions.
  The coverage ratchet passed using this backend report and the existing report
  for the unchanged client. No new full frontend or database integration run is
  claimed for this report-only/backend-test change.
- Focused evaluation regression: eight suites, 123 tests passed, including the
  real parser/comparison path, snapshot drift, cancellation and redaction.
- Reporting-service coverage: four tests passed with 100% statements, branches,
  functions and lines. This is scoped coverage, not the repository-wide ratchet.
- CI-defect regression: two suites, 24,562 tests passed, including the repository
  code-health checks and native reviewer-packet path expectations.
- A network-disabled, read-only Node 24.18.1 Linux smoke verified four native path
  contracts, compilation of four affected test modules, rejection of truncation
  and sparse-evidence accounting. This is not a full Linux Jest run: reusing the
  host Windows dependencies lacks the Linux native resolver binding. No dependency
  lockfile was altered to work around that environment mismatch.
- Copyright, development/production dependency checks, backend typecheck,
  backend test/security lint, Markdown lint, ESM static-import and mock-shape
  checks passed.

No frontend or database contract changed. No release, tag or version bump is part
of this work. GitHub MCP returned no open Classifarr PRs on both checks; none was
available to select randomly, and no closed PR or unrelated repository was
substituted.

## Next high-value component

**Resolve metadata-versus-description disagreement using learned library evidence.**
Start with the six measured cases: attribute the existing metadata fit to genre,
studio and audience features, compare them with the retrieved synopsis examples,
and evaluate a library-agnostic combined reranker on separate held-out controls.
Keep hard identity/media restrictions and query exclusion unchanged. Do not
hard-code library names, relabel old placements as verified truth, or add manual
library-purpose declarations. The goal is fewer unnecessary user decisions based
on better matching, not a larger diagnostics screen.

Small-library familiarity is the following component: investigate a bounded
cross-fit alternative to the disjoint split, without lowering evidence minimums
or conflating empirical support with calibrated confidence. Automatic live
fallback promotion is not justified by this focused, weak-label result alone.
