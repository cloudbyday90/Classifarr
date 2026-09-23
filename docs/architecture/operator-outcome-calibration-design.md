# Operator-outcome calibration: design

Date: 2026-09-22. Follows the [production-company learning outcome](production-company-learning-outcome.md).

## Problem and decision

The existing 300-item company study compared recommendations with current library
placements. Placements can be wrong and company observations were not yet deployed,
so that agreement cannot justify changing live rankings. Add a read-only,
operator-outcome shadow comparison before any promotion. This first comparison
tests the existing organic genre/studio/rating fit against the same fit plus a
separate company score. It does **not** evaluate the full semantic-description,
RAG, policy or routing pipeline; that requires a subsequent paired replay.

Eligible `policy_feedback_evaluation` rows identify an explicit operator-selected
destination and a known recommendation. Persisted `classification_corrections`
add explicit manual changes only when the linked final classification still
matches the corrected active destination and media type. Both sources are
bounded in one snapshot. Confirmations and changes are retained
as separate counts because confirmations are suggestion-influenced. Automatic
route success is not a label. Require responded, finite, non-future feedback,
an active same-media selected policy/library, a consistent correction flag, a
usable inventory description. Current membership in the selected library is a
coverage observation, not an eligibility condition: corrections can precede sync.
If one typed item has contradictory destinations, exclude it rather than vote.

The membership correction and automatic event-time comparison are documented in
the [prospective ranking design](prospective-inventory-ranking-design.md).

Run seeded stratified selection across up to 300 labeled identities and grouped
folds shared by all copies of a description, including across movie/TV. Learn
both models with held-out description groups excluded. Compare baseline and a
**predeclared** `baseline + 0.25 × company` score, counting decisions, matches,
abstentions, gains and regressions per media type, library and feedback kind.
The weight is a diagnostic arm, not a fitted parameter or calibrated confidence.
The output contains only aggregate counts; no title, item ID, description,
company term, user reason, private metadata or raw model score is printed.

The read-only CLI uses one repeatable PostgreSQL snapshot, fixed timeouts, a
50,000-row inventory cap, 5,000-row combined outcome cap and 64-library cap. If a cap is
exceeded, it fails closed; it never treats a truncated label pool as representative.
It performs no provider calls, training-data writes or routing changes.

## Official guidance and tradeoffs

Sources were discovered through online search on 2026-09-22.

- [NIST AI RMF Measure](https://airc.nist.gov/airmf-resources/airmf/5-sec-core/)
  calls for documented, repeatable test metrics, representative conditions and
  measured improvements or declines. We report coverage and regressions, not a
  single inflated confidence number.
- [scikit-learn's leakage guidance](https://scikit-learn.org/dev/common_pitfalls.html)
  and [grouped cross-validation guidance](https://scikit-learn.org/dev/modules/cross_validation.html)
  motivate excluding duplicate descriptions from each fold's fit. The
  implementation remains native ESM JavaScript; scikit-learn is not a dependency.
- [OWASP RAG Security](https://cheatsheetseries.owasp.org/cheatsheets/RAG_Security_Cheat_Sheet.html)
  distinguishes retrieved content from authorization. No observed metadata or
  operator feedback can directly authorize a route.
- [W3C WCAG 2.2, status messages](https://www.w3.org/TR/wcag/)
  is relevant if these diagnostics later enter a live interface: status changes
  must be exposed programmatically without moving focus. This change adds no UI
  and claims no accessibility conformance for existing screens.

| Option | Benefit | Cost/risk | Decision |
| --- | --- | --- | --- |
| Shadow paired comparison on explicit operator choices | Directly exposes company-related gains and regressions | Suggestion bias; current inventory can reflect later changes | Implement, do not promote |
| Use existing placement as ground truth | Many labels now | Repeats existing mistakes and hides feedback bias | Reject |
| Tune a company weight on the same benchmark labels | Potentially higher apparent match rate | Test-set leakage and overfitting | Reject |
| Immediately add company score to routing | Faster apparent product change | No deployed coverage or outcome evidence yet | Defer |

Final stack: existing PostgreSQL feedback eligibility view, manual corrections and inventory corpus
→ bounded ESM label projection → grouped shadow comparison → aggregate report.
Keep the current classification/policy gates, model cache and RAG path untouched.

## Limits and promotion gate

This is retrospective observational evidence, not blinded ground truth. The
feedback set preferentially contains prompted or reviewed items, and current
inventory may contain a later placement. Distinct description groups prevent
model leakage but cannot remove that temporal bias. No promotion follows from
this diagnostic alone. Next compare the actual description/RAG ranker and company
ablation on a frozen, prospectively captured operator-reviewed cohort with
held-out identities; require adequate corrections and no library-specific
regressions before considering a guarded rollout.

Implementation and validation are in the [outcome document](operator-outcome-calibration-outcome.md).
