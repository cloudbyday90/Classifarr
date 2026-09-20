# Neighbor-reference coverage experiment

## Goal

Determine whether sampled references miss relevant descriptions during the numeric
library-distinction check. The preceding [familiarity experiment](library-familiarity-cross-fit-outcome.md)
removed sparse-library blocks but left 27–34 nominations not distinguished. This
does not yet establish that reference selection caused those abstentions.

## Design

Keep the current ordered cross-fit references as the control. Compare a bounded
representative-selected alternative using the existing content-only geometry
fitter and numeric neighbor kernel, not another retrieval system.

- Preserve the first 32 calibration descriptions in their original order.
- Fit representative geometry only on the remaining descriptions in the first
  256 deterministically ordered, exclusive training groups. Calibration queries
  cannot influence this selection fit; neither can the outer held-out fold.
- Prefer the existing fitter's representative descriptions, then fill remaining
  slots in the original deterministic order. Retain 65 groups total, allowing the
  existing kernel to use at most 64 references after excluding each scored item.
- Libraries with at most 65 groups retain exactly the current selection. An
  unconverged geometry fit retains the ordered control and reports that fallback.
- Keep the same calibration queries, scoring, tail rule, familiarity check,
  candidate scope and policy vetoes. Give the alternative its own version and
  explicit evaluation-only admission; default and live consumers remain unchanged.

For nominated challenges, measure how many of each library's exact top three
exclusive training descriptions occur in the reference sample, plus the difference
in top-three mean similarity. Reuse the existing full-corpus query scoring pass.
Report paired selection coverage and accepted placement gains/losses by media type
and anonymous library stratum. Shared descriptions are excluded from both sides
of the coverage comparison, and coverage is not a confidence or correctness score.

## Safety and resource constraints

Use the current provenance-clean training complement. Exclude retained decisions,
metadata conflicts, description copies and the entire outer evaluation fold before
selection. Snapshot fingerprints include the selection version and bounds.
Retain cancellation, cache limits, failed-fit eviction, work/memory ceilings and
source revalidation. Charge a conservative geometry work reservation before fitting.
Store no new persistent state and make no model-generation or routing calls.
Reports must not contain titles, text, raw vectors, item hashes or destination IDs.

## Official research checked 20 September 2026

- [Scikit-learn nearest-neighbor documentation](https://scikit-learn.org/stable/modules/generated/sklearn.neighbors.NearestNeighbors.html)
  describes exact brute-force search. It supports using an exact nearest-neighbor
  control to quantify sample coverage, not assuming a representative subset is better.
- [Scikit-learn leakage guidance](https://scikit-learn.org/dev/common_pitfalls.html)
  requires learning transformations on training data, not test data. Apply that
  separation to representative selection as well as score calibration. This is
  methodology guidance; no dependency on the documented development release is added.
- [OWASP RAG security guidance](https://cheatsheetseries.owasp.org/cheatsheets/RAG_Security_Cheat_Sheet.html)
  supports source provenance, integrity checks and retrieval isolation. Retain the
  existing exclusions and fail-closed routing boundary.
- [W3C status-message guidance](https://www.w3.org/WAI/WCAG21/Understanding/status-messages.html)
  says not to create unnecessary status messages and warns about excessive live
  announcements. This offline experiment adds no UI panels or controls and makes
  no new accessibility-conformance claim.

URLs were discovered through search and opened with research tools. The proposed
selection method is an engineering hypothesis, not a standards requirement.

## Options and recommendation

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Ordered reference sample | Cheap, reproducible control | Can omit nearby examples | Keep |
| Representative-selected remainder | Reuses existing content learning at the same final sample size | Additional bounded fitting; may favor broad themes over near neighbors | Evaluate |
| Full-corpus calibration for every training query | Removes sample truncation | Much higher repeated computation | Defer until coverage measurements justify it |
| Lower distinction thresholds | More accepted proposals | Does not diagnose missed examples or demonstrate safety | Reject |

Recommendation stack: validated inventory → provenance-clean description groups →
bounded content selection → identical calibration and veto rules → paired held-out
evaluation. Promote nothing live based only on existing-placement agreement.

## Verification plan

Verify calibration isolation, group exclusions, deterministic selection, small
library identity, convergence fallback, cancellation, budget recovery and explicit
version admission. Compare diagnostic arithmetic with an independent oracle and
test redacted aggregation. Run focused and full tests, then paired movie/TV samples
in local Compose under database read-only enforcement. Record measured outcomes in
a separate document before selecting the next component.
