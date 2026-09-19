# Independent-start candidate stability

Date: 2026-09-19. Follow-up to [outlier-aware recovery](outlier-aware-recovery-outcome.md).

## Finding and selected fix

The next task is evaluating unseen-item candidate selection, including unusual
content. Previous complete-coverage controls had 131 abstentions and 59 disagreements
with existing placements across 600 descriptions. Those placements are not verified
answers, so these numbers cannot identify a semantic misclassification by themselves.

Code inspection exposed a testable stability defect before changing any ranking
weights. The description-only comparator checks three aligned initialization views
and one selected view. Library profiles are fitted independently, so matching start
numbers are not paired experiments. A candidate can win all four checked views yet
lose to another library under an unchecked combination of their fitted starts.

Example: candidate A's similarities are `[0.9, 0.5, 0.6]` and B's are
`[0.8, 0.4, 0.5]`. With both selected starts zero, the old guard calls A stable.
But A's second start loses to B's first: `0.5 < 0.8`. This demonstrates a stability
claim defect, not which library is semantically correct.

Require the aligned winner's lowest score to exceed every rival's highest score
by the existing tie tolerance. This is equivalent to the same positive, unique
winner across the full Cartesian product of available starts, without enumerating
`3^libraries` combinations. Newly ambiguous cases use the existing
`initialization_sensitive` result. Do not invent a replacement winner or confidence.

## Architecture and boundaries

- A small ESM score-agreement service owns aligned and independent-start checks.
  The existing comparator retains profile/vector validation and redacted errors.
  Runtime comparison uses only the independent result; aligned output is a private
  evaluation control, not a user-selectable weaker mode.
- Extend the existing benchmark CLI with one exclusive, zero-generation mode.
  Reuse deterministic sampling, grouped hold-outs, production fitting, bounded
  work/cancellation and fresh source/model checks. Remove every held description
  copy before fitting. Do not choose thresholds using held-out placements.
- Report paired changes, movie/TV and anonymous library strata, and whether a
  query lies outside all selected groups' observed training-similarity ranges.
  The range slice is diagnostic only: no statistical outlier claim or routing gate.
- Preserve all libraries and unavailable alternatives in scope. No name, genre,
  destination-specific rule, verified label, model generation or routing write.
- Version changed shadow/benchmark semantics and preserve client compatibility
  with the prior status contract. Keep existing SWR, compact details and controls.
- The historical hybrid-reranker experiment is separate from this description-only
  runtime shadow comparison. Do not present its aligned-start results as the new
  independent-start guarantee.

## Alternatives and recommendation stack

| Option | Benefit | Cost / decision |
| --- | --- | --- |
| Keep four aligned views | Cheap; more comparisons | Misses independent-start reversals; reject |
| Enumerate every combination | Exact finite-start check | Exponential work; unnecessary |
| Winner minimum versus rival maxima | Exact finite-start check with bounded scalar work | May abstain more; implement |
| Tune scoring or route from placement agreement | Could increase apparent agreement | Unverified labels and selection bias; defer |

Final stack: source-verified cached descriptions → grouped hold-out learning →
all-candidate validation → independent-start stability → paired evidence analysis.
This fixes diagnostic reliability without promoting experimental groups into routing.

## Official research checked in September 2026

- [scikit-learn's leakage guidance](https://scikit-learn.org/1.8/common_pitfalls.html)
  recommends splitting before learned transformations and keeping test data out of
  fitting. Apply this principle to source copies and group learning; no scikit-learn
  dependency is introduced. This is a verified versioned reference, not a claim
  that version 1.8 is the newest release.
- [NIST AI RMF trustworthiness guidance](https://airc.nist.gov/airmf-resources/airmf/3-sec-characteristics/)
  calls for realistic test sets, documented methodology and disaggregated measures.
  Distinguish observed-placement agreement from independently verified correctness.
- [OWASP logging guidance](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
  supports validated, bounded diagnostics excluding sensitive content. Keep raw
  descriptions, item identities, vectors and per-item results out of public reports.
- [W3C status-message guidance](https://www.w3.org/WAI/WCAG22/Understanding/status-messages)
  addresses accessible status announcements without unnecessary chatter. Preserve
  existing announcements and SWR behavior; add no dense review panel or new prompt.
- [GitHub Actions secure-use guidance](https://docs.github.com/en/actions/reference/security/secure-use)
  recommends full-length SHA pins. The separately selected PR #537 retains them;
  verify each upstream tag resolves to the proposed commit before applying.

## Verification plan

Prove mixed-start reversals and ties are rejected, independently permuting start
numbers cannot change selection, and a bounded exhaustive oracle agrees with the
interval check. Retain malformed-vector, full-scope, cancellation, no-positive and
nonconvergence guards. Test held-out copies, unusual vectors, privacy and source
drift. Compare fresh movie/TV controls and a disjoint cohort through read-only local
Compose, then run full suites, coverage ratchets and workflow contract checks.
