# Candidate-local evidence: design

Date: 2026-09-19. Follows the [independent-start outcome](independent-candidate-stability-outcome.md).

## Scope and decision

Build a private ESM resolver for initialization-sensitive or tied library comparisons.
Use actual cached examples and selected, validated learned-group memberships, not
library names or hard-coded content categories. Keep stable controls unchanged.
Evaluate before giving the resolver live routing authority; it creates no labels,
user acknowledgements, settings or additional provider calls.

The earlier [neighborhood experiment](neighborhood-metadata-matching-outcome.md)
lost more placement agreement than it gained. This is not another weighted average
of twenty neighbors. A proposal must pass separate description and metadata checks.

## Fixed experimental rule

- Remove every held-out description copy before fitting and indexing. Reuse the
  existing identity-conflict exclusion, normalized metadata and complete movie/TV scope.
- Validate selected memberships and their actual means. Index all exclusive training
  items, including unassigned items; shared items cannot vote and remain rival vetoes.
- Retrieve three nearest distinct descriptions per candidate. A positive proposal
  needs all three in one supported group, and its weakest example must beat every
  rival's strongest example and every shared example by more than `1e-12`.
- Reject highly correlated query/example or supporting-example pairs at cosine
  `>= 0.98`. This fixed conservative veto is experimental, not proof of duplication
  or statistical independence; paraphrases below it can remain correlated.
- Compare genre-set overlap and studio equality separately using the same three
  examples. Every field present on the query needs complete neighbor metadata.
  The proposed candidate must be no worse on any field and strictly better on at
  least one field against every rival. Ratings are audience constraints, not purpose
  evidence. Missing metadata and contradictions abstain, never become zero evidence.
- Do not fill missing/sparse/nonconverged/invalid profiles through this resolver.
  Stable baseline decisions remain unchanged even if the diagnostic resolver differs.

Three examples follows the existing representative support minimum. The correlation
veto and metadata dominance are fixed before evaluation, not tuned on placement
agreement. Selected membership is not an all-start semantic guarantee.
Metadata comes from the same retrieved records: it is an additional consistency
check, not an independent corroborating source or a confidence bonus. Exact synopsis
copies collapse in the existing index; the correlation veto does not establish
that the retained observations are independent.

## Research and tradeoffs

Official sources discovered through search/GitHub MCP and read on 2026-09-19:

- [scikit-learn leakage guidance](https://scikit-learn.org/1.8/common_pitfalls.html):
  fit transforms only on training data. Apply whole-description exclusions before
  both group learning and local evidence retrieval. Versioned 1.8 documentation is
  used for this stable principle, not claimed as the newest package.
- [Nearest-neighbor guidance](https://scikit-learn.org/1.8/modules/neighbors.html):
  neighbor count and distance affect bias and decision behavior. A nearest example
  alone is not a calibrated destination probability; no Python dependency is added.
- [NIST validity and reliability](https://airc.nist.gov/airmf-resources/airmf/3-sec-characteristics/):
  measure representative conditions and limitations. Report movies, TV, library
  strata and nearest-example group slices separately; placement is not ground truth.
- [OWASP logging](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html):
  retain bounded reason categories, not private titles, metadata terms or vectors.
- [W3C status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages):
  preserve meaningful accessible updates without repetitive announcements. No UI
  change is necessary; existing compact disclosures and SWR remain untouched.

| Option | Pros | Cons / decision |
| --- | --- | --- |
| More centroid starts alone | Detects unstable comparisons | Does not add local content discrimination |
| Broad metadata rank fusion | Cheap and available | Prior regressions; do not repeat |
| Candidate-local group evidence | Uses actual inventory and reusable cached vectors | Conservative; weak placement labels and correlated examples limit claims; evaluate now |
| Immediate automatic routing | Could reduce review counts | No correctness evidence yet; do not promote |

Recommended stack: source-verified cache → grouped hold-outs → validated learned
memberships → complete-scope local examples → separate metadata/correlation vetoes →
paired diagnostics → unchanged live authorization. This is a step toward organic
library understanding, not a promise of improved automation before results exist.

## Evaluation and operational safety

Extend the existing benchmark with exclusive `--candidate-local-evidence`, keeping
`--candidate-stability` output unchanged. Reuse its isolated fitter, snapshot/model
verification, cancellation and fitting budgets. Bound retrieval work and yield
between batches. Read-only database sessions; zero LLM/embedding generation.

Replay the original 300 and the later 300 excluding `300,300,100,100`. Report baseline,
local-only diagnostic and conservative combined decisions. Count newly resolved
ambiguities, stable-control disagreements and reasons for abstention. Slice by the
globally nearest exclusive training example: unassigned, smallest supported group
(strictly smaller than another in that library), or other. These are geometric
diagnostics, not known minority labels, and do not inspect the query's placement.

Reports contain aggregate counts and anonymous strata only. Preserve source-drift
invalidation and full candidate scope; do not retune after reading results. Outcomes
and the separately selected PR are documented in separate documents. No release,
version bump, schema migration or runtime authority change is part of this work.
