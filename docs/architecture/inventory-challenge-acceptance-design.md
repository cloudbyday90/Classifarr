# Candidate-specific inventory challenge acceptance

## Intent and boundary

The preceding leader-challenge experiment found useful proposals but also losses
in smaller library strata. Relative leadership is not evidence that a description
belongs in that library. Evaluate candidate-specific acceptance before any live
shortlist change. This is an experiment, not a routing permission or confidence
probability. No user declarations, library-name rules or additional model are added.

## Design

Extend the existing `--leader-challenge` read-only runner with paired raw and
accepted arms on the same frozen snapshot. Reuse the existing per-library match
baseline and cross-fitted neighbor-margin kernels, including their unchanged
sample limits and empirical tail setting. Assess only content nominations,
including hypothetical nominations blocked by a review veto.

Both kernels use precisely the provenance-clean description groups admitted for
policy observations, organic metadata and nearest examples. Exclude the complete
outer held-out fold, retained decisions, shared descriptions, conflicting metadata
and sparse training classes. Within that training set, retain the kernels' own
reference/calibration separation and leave-description-out cross-fitting. Query
identity remains available for validation but cannot enter either training set.

An accepted nomination requires valid complete evidence, an assessable incumbent,
a familiar challenger, and unique calibrated neighbor support for the challenger.
Sparse or degenerate evidence abstains. Familiarity alone cannot distinguish two
libraries; empirical ranks are not compared as cross-library probabilities.
Every existing policy review veto remains in force. The report separates accepted
unvetoed nominations from accepted-but-still-blocked hypothetical nominations.

## Research checked 20 September 2026

- [Scikit-learn leakage guidance](https://scikit-learn.org/stable/common_pitfalls.html)
  requires training-only fitting and separation of evaluation data. Apply this to
  every evidence family, not just the final ranker.
- [Scikit-learn threshold example](https://scikit-learn.org/1.8/auto_examples/model_selection/plot_tuned_decision_threshold.html)
  distinguishes model scores from decision rules and shows metric tradeoffs. We
  reuse existing rules without tuning them on this audit; observed placement is
  a weak label, not independently verified correctness.
- [OWASP RAG security guidance](https://cheatsheetseries.owasp.org/cheatsheets/RAG_Security_Cheat_Sheet.html)
  supports provenance, integrity, bounded processing and policy enforcement.
  Keep private descriptions out of reports, make no generation calls and reject
  changed snapshots rather than using stale evidence.
- [W3C status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages)
  informs future presentation: concise meaningful status without taking focus.
  This backend experiment adds no UI, and makes no accessibility-conformance claim.

Sources were discovered with search and opened through research tools; the above
are implementation choices informed by those sources, not mandated algorithms.

## Options and recommendation stack

| Option | Benefit | Cost / limitation | Decision |
| --- | --- | --- | --- |
| Raw relative winner | Broad coverage, inexpensive | Can nominate an unfamiliar destination | Keep as paired baseline |
| Familiarity only | Detects atypical content | Multiple libraries can be familiar | Insufficient alone |
| Familiarity plus calibrated distinction | Reuses organic per-library patterns; can abstain | Sparse libraries reduce coverage; extra bounded CPU | Evaluate now |
| Enable live leader replacement now | Potentially fewer reviews | Known regressions and fallback identity coupling | Defer |

Priority: shared clean evidence, paired candidate acceptance, per-library loss
inspection, then a separately tested live advisory integration if results warrant
it. Keep explicit eligibility and routing authority independent from ordering.

## Verification plan

Test malformed/partial calibration, sparse and degenerate candidates, disagreement,
scope integrity, retained-decision and whole-description exclusions, cancellation,
snapshot drift, unchanged vetoes and private-report redaction. Run the all-library
300-item Compose audit with cached vectors and read-only database permissions.
Record actual outcomes separately; do not promote solely on aggregate improvement.
