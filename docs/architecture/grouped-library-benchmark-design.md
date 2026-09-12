# Grouped library benchmark design

## Decision

Evaluate 300 additional distinct descriptions using five library-aware,
description-grouped folds. Reconstruct the earlier 100-title and 200-title
cohorts sequentially with the original seed, excluding them from new test
selection. In grouped mode those previous items remain available for training;
each fold excludes all copies of its own test descriptions before fitting
metadata profiles or selecting retrieval examples. No model weights, routing
thresholds, policies or media placements are changed.

The previous commit, `af296838`, connected qualified learned inventory evidence
to policy scoring. Its all-held-out experiment removed every eligible example
from a small movie library. This component fixes that evaluation artifact;
it does not weaken the live scorer to compensate for missing evidence.

## Research and alternatives

Official sources were discovered with search and read on September 12, 2026.
The requested reference period is August 2026; live pages are not represented
as archived August snapshots. Grouped cross-validation is established guidance
predating that period.

| Approach | Advantages | Disadvantages |
| --- | --- | --- |
| Hold every historical and new test item out together | Simple; reproduces earlier runs | Can empty small libraries and exaggerate missing evidence |
| Five grouped, library-balanced folds | Retains small-library examples; prevents duplicate-description leakage; fits only five profiles | Different evaluation protocol; shared memberships make perfect balance impossible |
| Leave one description group out per query | Most training data per query | Up to 300 profile fits; harder to compare and more expensive |

The recommendation follows the separation principle in the official
[scikit-learn grouped cross-validation guide](https://scikit-learn.org/1.1/modules/cross_validation.html#cross-validation-iterators-for-grouped-data):
related observations must not occur in both a test fold and its paired training
set. Our deterministic multi-membership balancing algorithm is not an
implementation of scikit-learn's `StratifiedGroupKFold`.

Keep descriptions untrusted, candidate output bounded, and evaluation isolated
from routing, consistent with the
[OWASP RAG security guidance](https://cheatsheetseries.owasp.org/cheatsheets/RAG_Security_Cheat_Sheet.html).
Following the user's request for less UI density, this remains a CLI component.
If surfaced later, expose one concise progress/result summary with details
collapsed, following [W3C status-message guidance](https://www.w3.org/WAI/WCAG22/Understanding/status-messages).
There is no browser control or accessibility behavior to change in this slice.

## Implementation contract

- Keep the existing all-held-out default and `--exclude-prior-size` semantics.
- Add explicit grouped mode and sequential prior-cohort sizes. Validate budgets
  before accessing configuration or providers. Maximum sample: 300 titles;
  maximum inference: 900 calls across the unchanged 9/30/100-example arms.
- Use the existing validated corpus, stable media identities, description
  hashes and local embedding cache. Conflicting descriptions for one identity
  remain ineligible under the existing corpus contract.
- Put every identical description, across identities and memberships, in one
  holdout group. Fit profiles and retrieval from the same fold training set.
- Balance groups using library membership counts, never names or fixed genres.
  Report actual minimum training coverage, including irreducibly sparse cases.
- Reuse each fold's learned profile and training membership index. Do not fit
  once per query or mutate the shared snapshot.
- Include the evaluation protocol and fold assignment in reproducibility
  fingerprints. Report prior exclusions, media coverage, anonymous per-library
  coverage and per-arm placement agreement. Never print descriptions or item
  identifiers in the aggregate report.
- Existing placements are observations, not independently verified labels.
  Agreement is not accuracy, and no threshold promotion follows this run.

## Recommendation stack

1. Grouped, library-aware evaluation with explicit leakage and coverage tests.
2. Run 300 new cases on the installed local models, comparing 9/30/100 examples.
3. Use measured disagreement and cost to design an adaptive 9-to-30-example
   retrieval experiment, without globally increasing prompt size.
4. Validate routing quality on independently checked outcomes before claiming
   accuracy improvements or changing automatic-routing thresholds.

## Verification and outcome

Unit tests cover sequential exclusion, deterministic grouping, small libraries,
shared descriptions, metadata isolation and malformed budgets. CLI tests verify
configuration is untouched for invalid requests and generation stays explicit.
Run the experiment with PostgreSQL read-only sessions on rebuilt local Compose.
Record actual results, limitations, PR availability and test outcomes separately
in [the outcome document](grouped-library-benchmark-outcome.md).
